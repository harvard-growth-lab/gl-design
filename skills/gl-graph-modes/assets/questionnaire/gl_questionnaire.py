#!/usr/bin/env python3
"""gl_questionnaire.py — long-form chart-brief questionnaire for gl-graph-modes.

AskUserQuestion tops out at four multiple-choice questions, which invites the
author to click Claude's suggested message instead of writing their own. This
tool replaces it for production passes over many charts: one card per chart
(the draft image, then questions answered in the author's own words), a deck
section up front, and a storyline check at the end that reads the titles alone,
in order.

It serves a local form, waits for the author to submit, writes the answers next
to the spec, prints a markdown summary, and exits. Run it in the background:
Claude is notified when the process exits. Standard library only.

Usage:
  python3 gl_questionnaire.py SPEC.json [--out ANSWERS.json] [--port N]
                              [--no-browser] [--timeout-min M]
  python3 gl_questionnaire.py SPEC.json --static FORM.html   # offline form, no server

Outputs (default: next to the spec, "<stem>.answers.json" / ".answers.md"):
  answers JSON  structured briefs Claude turns into production chart code
  answers MD    human-readable record of what the author said each chart says
  draft JSON    autosaved while the form is open; restored on relaunch

Exit codes: 0 submitted, 3 paused by the author (draft kept), 2 timed out
(draft kept), 1 error.
"""

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
FORM = HERE / "form.html"
IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:
    pass


def say(*parts):
    print(*parts, flush=True)


# ---- Spec --------------------------------------------------------------------

def load_spec(path):
    spec = json.loads(path.read_text(encoding="utf-8"))
    graphs = spec.get("graphs")
    if not isinstance(graphs, list) or not graphs:
        raise ValueError("spec needs a non-empty 'graphs' list")
    seen = set()
    for i, g in enumerate(graphs):
        gid = g.get("id") or (Path(g["image"]).stem if g.get("image") else f"chart_{i + 1}")
        base, n = gid, 2
        while gid in seen:
            gid, n = f"{base}_{n}", n + 1
        g["id"] = gid
        seen.add(gid)
    spec.setdefault("title", path.stem.replace(".spec", ""))
    spec.setdefault("reveal", "after_answer")
    # Stable key so the browser's local autosave survives reloads of this spec.
    spec["key"] = hashlib.sha1(str(path.resolve()).encode()).hexdigest()[:12]
    return spec


def resolve_images(spec, spec_dir):
    """Return {index: Path} for images that exist; annotate graphs for the page."""
    files = {}
    for i, g in enumerate(spec["graphs"]):
        img = g.get("image")
        g["image_url"] = None
        if not img:
            continue
        p = Path(img)
        p = p if p.is_absolute() else (spec_dir / p)
        if p.suffix.lower() not in IMAGE_TYPES:
            g["image_note"] = f"{img} (not a browser image; export a PNG)"
        elif not p.exists():
            g["image_note"] = f"{img} (file not found)"
        else:
            files[i] = p.resolve()
            g["image_url"] = f"/img/{i}"
    return files


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_atomic(path, text):
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def default_out(spec_path):
    name = spec_path.name
    stem = name[: -len(".spec.json")] if name.endswith(".spec.json") else spec_path.stem
    return spec_path.with_name(stem + ".answers.json")


# ---- Static (offline) form ---------------------------------------------------

def build_static(spec, files, out_html):
    for i, p in files.items():
        mime = mimetypes.guess_type(p.name)[0] or "image/png"
        data = base64.b64encode(p.read_bytes()).decode("ascii")
        spec["graphs"][i]["image_url"] = f"data:{mime};base64,{data}"
    payload = json.dumps({"spec": spec, "draft": None}, ensure_ascii=False)
    payload = payload.replace("</", "<\\/")
    html = FORM.read_text(encoding="utf-8")
    inject = f"<script>window.__GL_BOOT__ = {payload};</script>\n"
    html = html.replace("<!--GL_BOOT-->", inject, 1)
    out_html.write_text(html, encoding="utf-8")
    say(f"Static questionnaire written: {out_html}")
    say("Open it in a browser. On submit it downloads the answers JSON for Claude to read.")


# ---- Server ------------------------------------------------------------------

class State:
    def __init__(self, spec, files, out_json, out_md, draft_path):
        self.spec = spec
        self.files = files
        self.out_json = out_json
        self.out_md = out_md
        self.draft_path = draft_path
        self.done = threading.Event()
        self.outcome = None          # "submitted" | "paused"
        self.markdown = ""


def make_handler(st):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, code, body, ctype="application/json; charset=utf-8"):
            if isinstance(body, str):
                body = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            try:
                self.end_headers()
                self.wfile.write(body)
            except ConnectionError:           # tab closed or reloaded mid-autosave
                pass

        def body_json(self):
            n = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(n).decode("utf-8"))

        def do_GET(self):
            path = self.path.split("?", 1)[0]
            if path in ("/", "/index.html"):
                return self.send(200, FORM.read_bytes(), "text/html; charset=utf-8")
            if path == "/api/spec":
                # Resume order: unsent draft, else the last submission's state.
                draft = read_json(st.draft_path)
                if draft is None:
                    prev = read_json(st.out_json)
                    draft = prev.get("_state") if isinstance(prev, dict) else None
                return self.send(200, json.dumps({"spec": st.spec, "draft": draft},
                                                 ensure_ascii=False))
            if path.startswith("/img/"):
                try:
                    p = st.files[int(path[5:])]
                except (ValueError, KeyError):
                    return self.send(404, '{"error":"no such image"}')
                mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
                return self.send(200, p.read_bytes(), mime)
            self.send(404, '{"error":"not found"}')

        def do_POST(self):
            path = self.path.split("?", 1)[0]
            try:
                data = self.body_json()
            except ValueError:
                return self.send(400, '{"error":"bad json"}')
            if path == "/api/draft":
                write_atomic(st.draft_path, json.dumps(data, ensure_ascii=False, indent=1))
                return self.send(200, '{"ok":true}')
            if path == "/api/pause":
                write_atomic(st.draft_path, json.dumps(data, ensure_ascii=False, indent=1))
                st.outcome = "paused"
                self.send(200, json.dumps({"ok": True, "draft": str(st.draft_path)}))
                st.done.set()
                return
            if path == "/api/submit":
                answers = data.get("answers") or {}
                st.markdown = data.get("markdown") or ""
                write_atomic(st.out_json, json.dumps(answers, ensure_ascii=False, indent=2))
                write_atomic(st.out_md, st.markdown)
                try:
                    st.draft_path.unlink()
                except OSError:
                    pass
                st.outcome = "submitted"
                self.send(200, json.dumps({"ok": True, "answers": str(st.out_json)}))
                st.done.set()
                return
            self.send(404, '{"error":"not found"}')

    return Handler


def serve(st, port, open_browser, timeout_min):
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(st))
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    threading.Thread(target=server.serve_forever, daemon=True).start()

    n = len(st.spec["graphs"])
    say(f"GL questionnaire: {st.spec['title']} ({n} chart{'s' if n != 1 else ''})")
    say(f"URL: {url}")
    say(f"Answers will be written to: {st.out_json}")
    if st.draft_path.exists():
        say(f"Resuming from draft: {st.draft_path}")
    say("Waiting for the author to submit...")
    if open_browser:
        webbrowser.open(url)

    finished = st.done.wait(timeout=timeout_min * 60 if timeout_min else None)
    time.sleep(0.3)                       # let the last response flush
    server.shutdown()

    if not finished:
        say(f"TIMEOUT after {timeout_min} min. Draft (if any): {st.draft_path}")
        return 2
    if st.outcome == "paused":
        say(f"PAUSED by the author. Draft kept: {st.draft_path}")
        say("Relaunch with the same spec to resume where they left off.")
        return 3
    say(f"SUBMITTED {datetime.now():%Y-%m-%d %H:%M}")
    say(f"ANSWERS_JSON: {st.out_json}")
    say(f"ANSWERS_MD: {st.out_md}")
    say("")
    say(st.markdown)
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("spec", type=Path, help="questionnaire spec (JSON)")
    ap.add_argument("--out", type=Path, help="answers JSON path (default: next to the spec)")
    ap.add_argument("--port", type=int, default=0, help="port (default: any free port)")
    ap.add_argument("--no-browser", action="store_true", help="print the URL; do not open a browser")
    ap.add_argument("--timeout-min", type=float, default=240, help="stop waiting after M minutes (0 = never)")
    ap.add_argument("--static", type=Path, metavar="FORM.html",
                    help="write a self-contained offline form instead of serving")
    a = ap.parse_args(argv)

    try:
        spec_path = a.spec.resolve()
        spec = load_spec(spec_path)
        files = resolve_images(spec, spec_path.parent)
    except (OSError, ValueError, KeyError) as e:
        say(f"ERROR: cannot read spec {a.spec}: {e}")
        return 1
    for g in spec["graphs"]:
        if g.get("image_note"):
            say(f"warning: {g['id']}: image {g['image_note']}")

    if a.static:
        build_static(spec, files, a.static.resolve())
        return 0

    out_json = (a.out or default_out(spec_path)).resolve()
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md = out_json.with_suffix(".md")
    draft = out_json.with_name(out_json.name.replace(".answers.json", "") + ".draft.json") \
        if out_json.name.endswith(".answers.json") else out_json.with_suffix(".draft.json")
    st = State(spec, files, out_json, out_md, draft)
    return serve(st, a.port, not a.no_browser, a.timeout_min)


if __name__ == "__main__":
    sys.exit(main())
