"""Take the standalone architectural-S mark (bold version, on dark navy bg)
and chroma-key the background to transparent so it can sit on any surface.

We then auto-trim to the tight bounding box of the mark and centre it on a
square canvas with a small uniform pad, so it stays visually centred at any
size.

Saves to frontend/public/logo-mark.png and copies the same file to
frontend/app/icon.png + apple-icon.png so the favicon updates too.
"""

import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(r"c:/Personal/simulyn-ai/frontend")
ASSETS = Path(
    r"C:/Users/TAN4KOR/.cursor/projects/c-Personal-simulyn-ai/assets"
)
# Reference mark provided by the user — bold strokes on dark navy bg.
SRC = (
    ASSETS
    / "c__Users_TAN4KOR_AppData_Roaming_Cursor_User_workspaceStorage"
      "_e69b9a383ab2df52ae06dbd32af76b9f_images_image-3aabbeff-281d-47f4-b247-0a834cb532c0.png"
)
DST_MARK = ROOT / "public" / "logo-mark.png"
DST_ICON = ROOT / "app" / "icon.png"
DST_APPLE = ROOT / "app" / "apple-icon.png"

# Background colour of the reference (dark navy, same family as our site bg).
BG = (10, 15, 28)
TOLERANCE = 55  # generous to catch anti-aliased dark-navy halo around the strokes
# Reference is ~120x170 native, so don't over-upscale or it will pixelate.
# 256 is plenty for retina rendering of a small header mark and for favicons.
OUT_SIZE = 256


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    print(f"source: {SRC.name} ({src.size})")

    # 1. Chroma-key the dark navy background to transparent.
    pixels = src.load()
    sw, sh = src.size
    cleared = 0
    for y in range(sh):
        for x in range(sw):
            r, g, b, a = pixels[x, y]
            if (
                abs(r - BG[0]) <= TOLERANCE
                and abs(g - BG[1]) <= TOLERANCE
                and abs(b - BG[2]) <= TOLERANCE
            ):
                pixels[x, y] = (r, g, b, 0)
                cleared += 1
    print(f"cleared {cleared} of {sw * sh} pixels to transparent")

    # 2. Auto-trim to the tight bounding box of the mark.
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)
        print(f"auto-trimmed to bbox {bbox} -> {src.size}")

    # 3. Centre on a square canvas with a small uniform pad (~6% on each side).
    cw, ch = src.size
    pad = int(round(max(cw, ch) * 0.06))
    side = max(cw, ch) + pad * 2
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(src, ((side - cw) // 2, (side - ch) // 2), src)
    out = square.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)

    # 4. Save and propagate to favicon paths.
    out.save(DST_MARK, "PNG", optimize=True)
    shutil.copy(DST_MARK, DST_ICON)
    shutil.copy(DST_MARK, DST_APPLE)
    print(f"wrote {DST_MARK} ({DST_MARK.stat().st_size} bytes)")
    print(f"copied to {DST_ICON} and {DST_APPLE}")


if __name__ == "__main__":
    main()
