# Mascot assets

Source files for the site mascot. Each is referenced by
`src/components/mascot.tsx` via the `Mascot` component's `variant` prop.

Files are stored as **WebP** (transparent, ~80% smaller than the source PNGs
for the same visual quality). `next/image` re-encodes them to AVIF for
browsers that support it and serves the WebP source otherwise.

| Filename          | Variant       | Render at (intrinsic) | Where it lands                                 |
| ----------------- | ------------- | --------------------- | ---------------------------------------------- |
| `hero.webp`       | `hero`        | 1200×1200             | Home hero corner, right side                   |
| `peek-right.webp` | `peekRight`   | 640×800               | Blog/list/seasons hero, right side             |
| `peek-left.webp`  | `peekLeft`    | 640×800               | Teams list hero, left side                     |
| `empty.webp`      | `empty`       | 480×480               | Empty-state cards (no match data, no posts)    |
| `not-found.webp`  | `notFound`    | 840×840               | 404 page                                       |
| `footer.webp`     | `footer`      | 320×320               | Footer brand corner                            |
| `seasons.webp`    | `seasons`     | 560×640               | Seasons index hero + per-year decoration       |

All assets have a **transparent background**. The component uses `next/image`
with static imports — Next reads dimensions at build time and generates
responsive srcsets at request time.

## Regenerating an asset

1. Generate the new artwork at the dimensions above (or 2×).
2. Save as PNG with transparency.
3. Convert to WebP via `cwebp` (install once with `brew install webp`):
   ```bash
   cwebp -q 80 -alpha_q 100 -m 6 input.png -o output.webp
   ```
   Quality 80 with alpha at 100 and max compression effort (`-m 6`) is the
   sweet spot — drop to 70 for further savings if you don't notice quality
   loss, or bump to 90 if you see banding.
4. Overwrite the matching `<variant>.webp` here. No code change needed.

## `favicon.png`

This is a high-resolution source for the site favicon, not a mascot variant.
Use it with https://realfavicongenerator.net (or similar) to produce
`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `favicon-16x16.png`,
`favicon-32x32.png`, then drop those into `frontend/public/` and delete this
source file (or keep it as a working asset).
