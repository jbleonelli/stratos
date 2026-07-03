# Screenshots — convention for the user guides

Anything dropped in this folder is served by Vercel as a static asset at
`/screenshots/<path>`. The user guide PDFs (rendered at
`/print/guide/<slug>` → produced via the browser's "Save as PDF" path)
inline whatever images the markdown references.

## Folder layout

One subfolder per guide slug:

```
public/screenshots/
├── getting-started/
│   ├── briefing.png
│   ├── workspace-picker.png
│   └── …
├── organization-setup/
│   ├── location-tree.png
│   └── …
├── contractor/
│   ├── contracts-dashboard.png
│   ├── buildings-tab.png
│   ├── hardware-store-browse.png
│   ├── hardware-store-cart.png
│   ├── inventory-install-modal.png
│   └── …
└── …
```

The slug matches the `<slug>` in `/print/guide/<slug>` exactly — see
`GUIDE_SOURCES` in [`../../src/app/PrintGuidePage.jsx`](../../src/app/PrintGuidePage.jsx) for the canonical list (currently 7 guides).

## Referencing in markdown

From inside a guide (e.g. `docs/guides/contractor.md`):

```markdown
![Lisa's contracts dashboard, hovering on the Merlin's take toggle](/screenshots/contractor/contracts-dashboard.png)
```

Three things to note:

1. **Path starts with `/`** — Vercel serves files in `public/` from the
   root.
2. **Alt text becomes the figcaption** in the printed PDF. Write it
   describing what's in the screenshot, not the filename — it shows up
   centered under each figure.
3. **PNG, JPG, or WebP** all work. PNG for screenshots with text or UI
   chrome (sharper). JPG for photographic content (smaller). Aim for
   ~1600px wide; the print template downsizes to fit the page.

## Capture guidelines

- **Window size** — 1280×800 or 1440×900. Avoid 2× retina captures; they
  bloat the PDF for no gain in print.
- **Theme** — capture in light theme. The guides print on white paper
  so the dark theme is a poor fit.
- **Privacy** — blur or replace any real user names / emails / org
  data. Use the demo logins (`lisa@sparkleco.com`, `lily.park@meridian.example`, etc.) so nothing sensitive ships.
- **Cropping** — full-page captures for orientation; tight zoom-ins for
  specific UI affordances. Mix both in one guide for visual rhythm.

## Placeholder behavior

If an image referenced in a guide doesn't exist yet, the print template
renders a labeled "Screenshot pending" box (diagonal stripes,
intentional-looking) instead of a broken-image icon. That's by design —
missing art is visible, but the PDF still looks professional. Replace
the file → reload the print view → it picks up the real image.

## Naming conventions

- **Lowercase, hyphenated**: `briefing-cta-strip.png`, not
  `BriefingCTAStrip.PNG`.
- **Action-oriented**: name by what the screenshot shows, not where it
  lives. `building-picker-open.png` beats `topbar-3.png`.
- **No spaces, no special characters** — keeps URL encoding clean.
