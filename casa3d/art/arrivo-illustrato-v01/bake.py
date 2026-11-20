"""Unwrap the approved painted sky around a cylinder. The centre opens on the live world."""
from pathlib import Path
import numpy as np
from PIL import Image

here = Path(__file__).resolve().parent
source = np.asarray(Image.open(here / "bozzetto.png").convert("RGB"), dtype=np.float32)[:481]
height, width = 512, 1536
y, x = np.mgrid[:height, :width]
theta = (x+.5)*2*np.pi/width
radius = .13 + 1.62*(y+.5)/height
# Mirror paint outside the rectangular panel, including its uneven outer corners.
def mirror(v, limit):
    return limit - np.abs(v % (2*limit) - limit)

u = mirror(537+radius*505*np.cos(theta), source.shape[1]-2)
v = mirror(213-radius*244*np.sin(theta), source.shape[0]-2)
ix, iy = u.astype(int), v.astype(int)
fx, fy = (u-ix)[:,:,None], (v-iy)[:,:,None]
rgb = ((1-fy)*((1-fx)*source[iy,ix]+fx*source[iy,ix+1])
       + fy*((1-fx)*source[iy+1,ix]+fx*source[iy+1,ix+1]))
# The little painted palace and guide star belong to the storyboard only.
clear = np.clip((radius-.235)/.09,0,1)[:,:,None]
rgb = np.array([22,24,48])*(1-clear)+rgb*clear
Image.fromarray(rgb.astype(np.uint8)).save(
    here/"vortex-paint.webp", quality=90, method=6)
