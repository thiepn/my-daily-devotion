# Approved cream-and-forest identity

The user selected the cream-and-forest reference edit (“the first one is good”). `design/brand/cream-forest-master.png` is the exact selected image, SHA-256 `391b70b313e75fa7cee0f7b687fbcf4cbdd18ad16db7b8b6c20e61f2e035856f`. It preserves the supplied reference's book, cross, morning sun and softly finished cream tile. It replaces the old sprig mark.

The image was produced with the built-in image-generation tool from the user's first logo reference. Prompt: “Precisely edit the attached app icon. This is a COLOR-ONLY revision, not a redesign. Preserve the original image's exact geometry, composition, proportions, positions, stroke widths, curved open-book pages, upright cross, semicircular sun, rounded cream app tile, subtle edge highlights, soft dimensional shading and pale surrounding background. Change ONLY the navy blue cross and navy blue book to a deep muted forest green, approximately #456653. Preserve the existing warm cream tile and the soft pale golden sun. Keep the attractive softly finished original appearance. Do not flatten, simplify, redraw, enlarge, sharpen corners, add details or remove page lines. Extremely important: keep the ENTIRE square image fully OPAQUE, including the pale background outside the rounded tile. No transparency, no cutout, no alpha removal, no dark blotches, no distressed texture, no speckles, no mottling. Preserve the clean smooth reference surface. No text. Match the reference aspect ratio.”

## Exports

Run `npm run icons:build` after installing the pinned Playwright Chromium browser. Optional `-- --review <directory>` writes a portable review sheet and size exports. This is deterministic resizing of the approved raster, without a redraw, recoloring or filters. The master checksum is verified first.

- `public/icons/icon-192.png`, `icon-512.png`: install icons; the 192px export also supplies the in-app brand.
- `public/apple-touch-icon.png`: 180px iOS export.
- `public/icons/maskable-512.png`: 90% scale on cream; the script checks that all green book/cross pixels remain within the central 80%-diameter safe circle.
- `public/icons/favicon-16.png`, `favicon-32.png`: dedicated small browser sizes.
- `public/brand-mark.svg`: self-contained wrapper around a 64px raster export, **not vector artwork**. No remote dependency.

Use the same approved colors in dark mode. Do not invert or dim this brand asset. The existing service worker discovers favicon links from HTML and caches install icons as core assets; its logic is unchanged. No database, devotional or backup behavior changes.
