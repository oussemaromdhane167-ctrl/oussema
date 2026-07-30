# 911 GT3 RS — Landing

Standalone build of the `GT3 RS Landing.dc.html` Claude Design page. No framework, no build step, no DC runtime — open `index.html`.

## Files
- `index.html` — markup
- `styles.css` — all styling, responsive + `prefers-reduced-motion`
- `main.js` — data + all motion/interaction

## Images
Every `<image-slot>` from the source became a `.slot` element, filled with a real Creative-Commons photo of a black 911 GT3 RS matched to that slot's subject — see [CREDITS.md](CREDITS.md) for licences.

Files live in `assets/`, named after the slot, pre-cropped to the slot aspect ratio:

| Slot | File | Size |
|---|---|---|
| `hero-car` | `assets/hero-car.jpg` | 1800×1125 |
| `specs-car` | `assets/specs-car.jpg` | 900×1125 (4:5) |
| `cta-bg` | `assets/cta-bg.jpg` | 1920×1080 |
| `gal-*` (6) | `assets/gal-front.jpg` … | 1200×900 (4:3) |
| `feat-*` (6) | `assets/feat-aero.jpg` … | 1400×875 (16:10) |

CSS grades every photo (`saturate .68 / contrast 1.12 / brightness .78`) plus a red-lit vignette so daylight street shots read as one dark studio set.

To swap a photo: drop an image file onto the slot, or **Alt+click** it for a file picker (plain click on a gallery card opens the lightbox). Overrides persist in `localStorage` under `gt3rs:slot:<id>`. Replacing the file in `assets/` works too.

## Added over the original
Preloader with progress · custom cursor (dot + lerped ring, swells to a red "VIEW" disc over gallery) · scroll progress bar · film grain · word-by-word heading reveal · scroll-reveal with stagger · count-up stat numbers · magnetic buttons · pointer parallax + 3D rotate on the hero car · pointer-tracking red glow · pointer-following radial glow inside stat cards · 3D tilt on gallery and specs media · scroll parallax on feature images and the CTA background · animated nav underline indicator with scrollspy · nav hides on scroll-down · marquee spec ticker · gallery lightbox (click, arrow keys, Esc) · spec rows that slide on hover · mobile menu · newsletter validation.

## Content edits
Change the arrays at the top of `main.js` (`PERF_STATS`, `GALLERY`, `SPEC_ROWS`, `FEATURES`). Accent color: `--accent` in `styles.css`.
