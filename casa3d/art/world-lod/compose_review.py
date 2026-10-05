"""Assemble the existing studio PNGs without re-rendering or changing the assets.

Requires Pillow and NumPy. Run: python casa3d/art/world-lod/compose_review.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ART = Path(__file__).resolve().parent
RENDERS = ART / "renders"
manifest = json.loads((ART / "manifest.json").read_text(encoding="utf8"))
TIERS = ["near", "medium", "far"]
VIEWS = ["front", "reverse"]


def font(size):
    for candidate in ["C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size=size)


metrics = {"scope": "Alpha silhouette of Blender studio PNGs; not GPU/FPS or production-camera evidence", "assets": {}}
for key, asset in manifest["assets"].items():
    sheet = Image.new("RGB", (1200, 1160), "#17212b")
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 16), f"{key.upper()}  |  identical camera and lighting", fill="#edf5fc", font=font(26))
    draw.text((24, 55), "Studio reference: full 384 px frame, plus 96 px downsample for distant-detail comparison", fill="#b9c8d4", font=font(17))
    near = asset["source"]
    for col, tier in enumerate(TIERS):
        record = near if tier == "near" else asset["tiers"][tier]
        draw.text((24 + col * 392, 96), f"{tier.upper()}  /  {record['triangles']:,} triangles", fill="#edf5fc", font=font(20))
    asset_metrics = {}
    for row, view in enumerate(VIEWS):
        y = 142 + row * 504
        draw.text((24, y - 21), view, fill="#92aec3", font=font(16))
        images = {tier: Image.open(RENDERS / f"{key}-{view}-{tier}.png").convert("RGBA") for tier in TIERS}
        for col, (tier, picture) in enumerate(images.items()):
            x = 12 + col * 392
            sheet.paste(picture, (x, y), picture)
            small = picture.resize((96, 96), Image.Resampling.LANCZOS)
            sheet.paste(small, (x + 144, y + 388), small)
        view_metrics = {}
        for resolution in (384, 96):
            resized = {tier: image.resize((resolution, resolution), Image.Resampling.LANCZOS) for tier, image in images.items()}
            masks = {tier: np.asarray(image)[:, :, 3] >= 128 for tier, image in resized.items()}
            ref = masks["near"]
            view_metrics[str(resolution)] = {}
            for tier in ("medium", "far"):
                actual = masks[tier]
                union = (ref | actual).sum()
                view_metrics[str(resolution)][tier] = {
                    "silhouetteIoU": round(float((ref & actual).sum() / union), 6),
                    "differentMaskPixels": int((ref ^ actual).sum()),
                    "referenceMaskPixels": int(ref.sum()),
                    "bounds": resized[tier].getchannel("A").getbbox(),
                    "referenceBounds": resized["near"].getchannel("A").getbbox(),
                }
        asset_metrics[view] = view_metrics
    sheet.save(RENDERS / f"{key}-comparison.png")
    metrics["assets"][key] = asset_metrics
(ART / "silhouette-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf8")
