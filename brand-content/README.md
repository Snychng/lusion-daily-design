# Brand content adapter

Run from the case directory:

```sh
node scripts/build-brand-media.mjs
python3 scripts/brand-content.py
```

Run the media generator first so the copied Bodoni font exists. The Python adapter reads the 22 saved `reference/**/index.html` pages and writes complete HTML to `brand-content/pages/`. It does not write `reference/` or `dist/`. The HTML parser uses the Python standard library. Before adapting pages it automatically runs `scripts/build-brand-lettering.mjs`, which uses the existing Three.js bundled OpenType parser to generate real SVG paths from the existing brand fonts. This satisfies the original SVGLoader contract; SVG text elements are not used. Font provenance is recorded in `lettering.json`. The About `#about-who-title-main-logo` SVG is intentionally empty, with its original viewBox; its visible wordmark comes from the WebGL model. Full dependency locations and the media → content → models → verification → stickers → build sequence are documented in the [case README](../README.md).

Copy the resulting page tree over the corresponding paths in the branded build. Also copy `brand.css`, `site.webmanifest`, and `sitemap.xml` under `/brand-content/`, and `brand-assets/media/` under the same public URL. Apply `media-map.json` in the runtime integration build; project media filenames are also assembled dynamically by the original runtime, so replacing HTML URLs alone is insufficient.

`projects.json` is the 19-entry display-content map. Project slugs now use the 19 branded study titles. `routes.json` maps original pages and IDs to their branded paths and declares 38 dynamic thumbnail aliases. Before copying branded HTML, remove the original project-detail HTML paths listed in `routes.json.pages` from the build output. After applying media replacements, copy the already-branded original thumbnail/depth files from each `assetAliases` value to its key. Detail `data-filename` asset paths and the original media-map keys remain unchanged. `content-audit.json` records each source/output hash, structural parity outside intentional SVG lettering changes, and the scan for original institutional claims. `media-map.json` and the media audit document all original-to-brand asset mappings and any reused motion references.

The two newsletter forms retain their original DOM. Inputs are disabled and labelled as source addresses. Their existing arrow buttons have `type="button"` and `data-brand-href`; the integration layer must bind that URL and disable the original submission handler. The adapter intentionally does not replace the renderer, animation code, scene parameters or event architecture.

Static checks do not establish browser visual parity or final media behavior. The main task owns browser validation, actual runtime URL replacement, original 3D logo/team geometry adaptation, and video-overlay integration.
