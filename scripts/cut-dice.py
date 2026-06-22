#!/usr/bin/env python3
"""
Cut the carved-wood dice out of their (opaque, mottled) backgrounds and emit
transparent, squared, web-sized PNGs the app can use.

Input:  images/<focus>_cube_<style>.png   (e.g. character_cube_wood.png)
        images/voicepov_cube_cream.png / voicepov+vube_wood.png  -> focus "voice"
Output: public/focus/<style>/<focus>.png  (512x512, transparent)

Styles kept: "wood" (light wood) and "cream". "darkwood" is ignored.
Re-run this whenever new dice are added to images/ — it just reprocesses the folder.

Segmentation: skimage.random_walker seeded with the border (background) and the
die centre (foreground); robust to render grain and to the cream die being a
near-match for the grey backdrop.
"""
import glob, os, warnings
warnings.filterwarnings("ignore")
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
from skimage.segmentation import random_walker

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images")
OUT = os.path.join(ROOT, "public", "focus")
FOCUSES = ["character", "setting", "plot", "voice", "dialogue", "sensory"]
SIZE = 512


def alpha_mask(im: Image.Image) -> np.ndarray:
    W, H = im.size
    sm = im.resize((W // 2, H // 2))
    a = np.asarray(sm, dtype=np.float64) / 255.0
    h, w, _ = a.shape
    mk = np.zeros((h, w), np.int32)
    m = max(2, int(0.03 * min(h, w)))
    mk[:m, :] = 1; mk[-m:, :] = 1; mk[:, :m] = 1; mk[:, -m:] = 1   # border = background
    cy, cx = h // 2, w // 2
    mk[cy - int(0.16 * h):cy + int(0.16 * h),
       cx - int(0.08 * w):cx + int(0.08 * w)] = 2                  # centre = die
    prob = random_walker(a, mk, beta=180, mode="cg_j", channel_axis=-1, return_full_prob=True)
    fg = prob[1] > 0.62
    fg = ndimage.binary_fill_holes(fg)
    lbl, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
        fg = lbl == (np.argmax(sizes) + 1)
    fg = ndimage.binary_erosion(fg, iterations=2)
    fg = ndimage.binary_fill_holes(fg)
    return fg


def cut(path: str) -> Image.Image:
    im = Image.open(path).convert("RGB")
    W, H = im.size
    fg = alpha_mask(im)
    mask = Image.fromarray((fg * 255).astype("uint8")).resize((W, H)).filter(ImageFilter.GaussianBlur(1.2))
    res = im.convert("RGBA"); res.putalpha(mask)
    bbox = res.getchannel("A").getbbox()
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
