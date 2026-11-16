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
      if el.t == "Str" and el.text:match("^%d[%d%.]*:$") then  -- "12:" or a chapter label "1.2:"
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

  -- 4. Alt text: `{fig-alt="..."}` on the image becomes the <img alt>, which
  --    Chromium carries into the tagged PDF's /Alt. Without it the alt falls
  --    back to the caption ("Figure N: title // subtitle").
  fig = pandoc.walk_block(fig, {
    Image = function(img)
      local alt = img.attributes["fig-alt"]
      if alt and alt ~= "" then
        img.caption = pandoc.Inlines({ pandoc.Str(alt) })
        img.attributes["fig-alt"] = nil
        return img
      end
    end,
  })
  return fig
end
