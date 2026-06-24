#!/usr/bin/env python3
"""
Cut the carved-wood dice out of their (opaque, mottled) backgrounds and emit
transparent, squared, web-sized PNGs the app can use.

Input:  images/<focus>_cube_<style>.png   (e.g. character_cube_wood.png)
        images/voicepov_cube_cream.png / voicepov+vube_wood.png  -> focus "voice"
Output: public/focus/<style>/<focus>.png  (512x512, transparent)

Styles kept: "wood" (light wood) and "cream". "darkwood" is ignored.
Re-run this whenever new dice are added to images/ — it just reprocesses the folder.

Segmentation: every backdrop seen so far is NEUTRAL — a light grey/white
checkerboard (baked in, not real transparency), or a solid black field, both with
a soft neutral shadow. The carved die, wood or cream, is the only WARM/chromatic
object. So we key on colour warmth (R-B) + chroma rather than texture, which gives
clean edges on both backdrop types, then keep the largest warm region that does
NOT touch the image border (the die is always centred with a margin).
"""
import glob, os, warnings
warnings.filterwarnings("ignore")
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images")
OUT = os.path.join(ROOT, "public", "focus")
FOCUSES = ["character", "setting", "plot", "voice", "dialogue", "sensory", "scenario"]
SIZE = 512


def _candidate_fg(im: Image.Image) -> np.ndarray:
    arr = np.asarray(im.convert("RGB"), dtype=np.float32)
    warmth = arr[:, :, 0] - arr[:, :, 2]            # R-B: warm die vs neutral bg
    chroma = arr.max(axis=2) - arr.min(axis=2)
    return (warmth > 14) | (chroma > 26)


def alpha_mask(im: Image.Image) -> np.ndarray:
    smooth = ndimage.binary_fill_holes(_candidate_fg(im))
    lbl, n = ndimage.label(smooth)
    if n == 0:
        return smooth
    border = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    best, best_sz = None, 0
    for i in range(1, n + 1):
        if i in border:
            continue
        sz = int((lbl == i).sum())
        if sz > best_sz:
            best, best_sz = i, sz
    if best is None:  # fallback: largest component overall
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
        best = int(np.argmax(sizes)) + 1
    fg = lbl == best
    st = ndimage.generate_binary_structure(2, 2)
    fg = ndimage.binary_closing(fg, st, iterations=3)
    fg = ndimage.binary_fill_holes(fg)
    fg = ndimage.binary_opening(fg, st, iterations=2)
    # Smooth the contour: blur + re-threshold removes lacy edges / shadow notches.
    fg = ndimage.gaussian_filter(fg.astype(np.float32), 2.5) > 0.5
    fg = ndimage.binary_erosion(fg, iterations=1)
    return ndimage.binary_fill_holes(fg)


def cut(path: str) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    alpha = np.asarray(im.getchannel("A"))
    if (alpha < 10).mean() > 0.02:
        # Already cut out (real transparency) — keep the artist's alpha as-is.
        res = im
    else:
        # Opaque source on a neutral backdrop — key the warm die out.
        fg = alpha_mask(im.convert("RGB"))
        mask = Image.fromarray((fg * 255).astype("uint8")).resize((W, H)).filter(ImageFilter.GaussianBlur(1.2))
        res = im.copy(); res.putalpha(mask)
    bbox = res.getchannel("A").getbbox()
    if bbox:
        res = res.crop(bbox)
    # paste onto a centred transparent square with a little breathing room
    side = int(max(res.size) * 1.08)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(res, ((side - res.width) // 2, (side - res.height) // 2), res)
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def parse(stem: str):
    s = stem.lower()
    style = "darkwood" if "darkwood" in s else "cream" if "cream" in s else "wood" if "wood" in s else None
    focus = next((f for f in FOCUSES if f in s), None)
    return focus, style


def main():
    done = 0
    for path in sorted(glob.glob(os.path.join(SRC, "*.png"))):
        focus, style = parse(os.path.splitext(os.path.basename(path))[0])
        if not focus or style not in ("wood", "cream"):
            print(f"skip {os.path.basename(path)}")
            continue
        out_dir = os.path.join(OUT, style)
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, f"{focus}.png")
        cut(path).save(out, optimize=True)
        print(f"  {os.path.basename(path)} -> public/focus/{style}/{focus}.png")
        done += 1
    print(f"done: {done} dice")


if __name__ == "__main__":
    main()
