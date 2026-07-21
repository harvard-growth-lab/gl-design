--[[
  gl-figure.lua — render figure captions as Nil's stacked figure block:

      FIGURE 4                                  ← accent eyebrow (Inter 600 UPPER)
      Mongolia rode the commodity supercycle.   ← chart title (Source Serif 4, period)
      Share of merchandise exports, 2003-2024.  ← chart subtitle (Inter, optional)

  Authoring (markdown):

      ![Chart title. // Optional subtitle](chart.png){#fig:label}

  The chart title is the alt text up to a standalone ` // `; everything after the
  ` // ` becomes the subtitle. (A legacy form — the subtitle in the image title
  attribute, `![Title](chart.png "Subtitle")` — still works as a fallback.)

  Runs AFTER pandoc-crossref, which prepends the figure number to the caption as
  plain inlines ("Figure", Space, "N:", Space, …). We strip that into a
  `.fig-label` span, split the remainder on ` // ` into `.fig-title` /
  `.fig-subtitle`, and let md2pdf-style.css stack the three (display:block).

  Implicit figures (no {#fig:…} id, so crossref leaves them unnumbered) get no
  label — the alt text (still split on ` // `) becomes the title (+ subtitle).
]]

-- ---------------------------------------------------------------------------
-- Physical-size stamping — the fix for "baked-in chart text rescales with the
-- container". GL charts save text as PIXELS at a fixed dpi (save_fig → ragg,
-- 300dpi). On-page point size is only correct when the image is DISPLAYED at
-- the exact physical width it was RENDERED for. Chromium ignores a PNG's dpi
-- (pHYs) metadata and sizes it at px÷96, so `max-width:100%` then squashes it
-- to the column and multiplies every label/tick/axis title by the squash
-- factor. We counter that by stamping each PNG with an explicit width in inches
-- = pixel_width ÷ dpi (read from the file), so display-inches == render-inches
-- and the baked text lands at the point size ggplot drew it. Word already does
-- this (growthlabbify.lua pins inch widths); this brings the Chromium path in
-- line. `max-width:100%` in the CSS stays as an overflow guard.

local function be32(s, i)  -- big-endian uint32 at 1-based byte offset i
  local a, b, c, d = s:byte(i, i + 3)
  return ((a * 256 + b) * 256 + c) * 256 + d
end

-- Return width_px, dpi for a PNG file (dpi nil if no usable pHYs chunk).
local function png_dims(path)
  local f = io.open(path, "rb")
  if not f then return nil end
  local data = f:read("*all")
  f:close()
  if not data or #data < 33 or data:sub(1, 8) ~= "\137PNG\r\n\26\n" then
    return nil
  end
  local width = be32(data, 17)          -- IHDR width: bytes 17-20
  local dpi = nil
  local pos, n = 9, #data               -- first chunk starts at byte 9
  while pos + 8 <= n do
    local len = be32(data, pos)
    local typ = data:sub(pos + 4, pos + 7)
    if typ == "pHYs" then
      local d = pos + 8                  -- pHYs data: ppu_x(4) ppu_y(4) unit(1)
      local ppu_x = be32(data, d)
      local unit = data:byte(d + 8)
      if unit == 1 and ppu_x > 0 then    -- unit 1 = pixels per metre
        dpi = math.floor(ppu_x * 0.0254 + 0.5)
      end
      break
    end
    if typ == "IEND" then break end
    pos = pos + 12 + len                 -- length(4)+type(4)+data(len)+crc(4)
  end
  return width, dpi
end

-- Resolve a possibly-relative image src against pandoc's resource paths.
local function resolve_src(src)
  src = src:gsub("^file://", "")
  local f = io.open(src, "rb")
  if f then f:close(); return src end
  for _, base in ipairs(PANDOC_STATE.resource_path or { "." }) do
    local p = base .. "/" .. src
    local ff = io.open(p, "rb")
    if ff then ff:close(); return p end
  end
  return nil
end

function Image(img)
  -- Respect an author-set width; only stamp PNGs (charts) we can measure.
  if img.attributes.width and img.attributes.width ~= "" then return nil end
  if not img.src:lower():match("%.png$") then return nil end
  local path = resolve_src(img.src)
  if not path then return nil end
  local width_px, dpi = png_dims(path)
  if not width_px then return nil end
  img.attributes.width = string.format("%.3fin", width_px / (dpi or 300))
  return img
end

-- Copy inlines[from..to] into a fresh list, dropping a leading/trailing Space.
local function slice(inlines, from, to)
  local out = {}
  for j = from, to do out[#out + 1] = inlines[j] end
  while #out > 0 and out[1].t == "Space" do table.remove(out, 1) end
  while #out > 0 and out[#out].t == "Space" do table.remove(out, #out) end
  return out
end

function Figure(fig)
  local inlines = pandoc.utils.blocks_to_inlines(fig.caption.long or {})
  local numbered = fig.identifier and fig.identifier:match("^fig:")

  -- 1. Strip the crossref "Figure N" label off the front.
  local label, rest = nil, inlines
  if numbered then
    for i, el in ipairs(inlines) do
      if el.t == "Str" and el.text:match("^%d+:$") then
        label = slice(inlines, 1, i)
        label[#label] = pandoc.Str(el.text:gsub(":$", ""))  -- drop the ":"
        rest = slice(inlines, i + 1, #inlines)
        break
      end
    end
  end

  -- 2. Split title // subtitle on a standalone "//" token.
  local title, subtitle = rest, nil
  for i, el in ipairs(rest) do
    if el.t == "Str" and el.text == "//" then
      title = slice(rest, 1, i - 1)
      local s = slice(rest, i + 1, #rest)
      if #s > 0 then subtitle = s end
      break
    end
  end

  -- 3. Legacy fallback: subtitle from the image title attribute.
  if not subtitle then
    local substr
    pandoc.walk_block(fig, {
      Image = function(img)
        local tt = img.title or ""
        if tt ~= "" and tt ~= "fig:" then substr = tt end
      end,
    })
    if substr then
      subtitle = pandoc.utils.blocks_to_inlines(pandoc.read(substr, "markdown").blocks)
    end
  end

  local caption = {}
  if label then
    caption[#caption + 1] = pandoc.Span(label, pandoc.Attr("", { "fig-label" }))
  end
  caption[#caption + 1] = pandoc.Span(title, pandoc.Attr("", { "fig-title" }))
  if subtitle then
    caption[#caption + 1] = pandoc.Span(subtitle, pandoc.Attr("", { "fig-subtitle" }))
  end

  fig.caption.long = { pandoc.Plain(caption) }
  return fig
end
