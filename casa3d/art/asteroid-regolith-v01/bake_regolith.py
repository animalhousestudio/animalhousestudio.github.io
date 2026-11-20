"""Bake a seamless RGB tile: planar normal XY and mineral tone with cavity shading."""
from pathlib import Path
import struct
import zlib

import numpy as np


SIZE = 512
RNG = np.random.default_rng(76182)
OUTPUT = Path(__file__).resolve().parents[2] / "src/assets/terrain-detail/regolith-detail.png"


def field(period):
    """Interpolate a periodic lattice with a smooth slope across the wrap."""
    grid = RNG.uniform(-1, 1, (period, period))
    p = np.arange(SIZE) * period / SIZE
    cell = p.astype(int)
    neighbor = (cell + 1) % period
    t = p - cell
    blend = t * t * (3 - 2 * t)
    a = grid[cell[:, None], cell] * (1 - blend) + grid[cell[:, None], neighbor] * blend
    b = grid[neighbor[:, None], cell] * (1 - blend) + grid[neighbor[:, None], neighbor] * blend
    return a * (1 - blend[:, None]) + b * blend[:, None]


def add_fragments(height, tone, patches, count, min_radius, max_radius):
    for _ in range(count):
        x, y = RNG.integers(0, SIZE, 2)
        if RNG.random() > patches[y, x]:
            continue
        radius = RNG.uniform(min_radius, max_radius)
        aspect = RNG.uniform(.46, .93)
        angle = RNG.uniform(0, 2 * np.pi)
        mineral = RNG.uniform(-.13, .25)
        reach = int(np.ceil(radius * 1.6))
        offset = np.arange(-reach, reach + 1)
        cols, rows = (x + offset) % SIZE, (y + offset) % SIZE
        px, py = np.meshgrid(offset, offset)
        u = (np.cos(angle) * px - np.sin(angle) * py) / radius
        v = (np.sin(angle) * px + np.cos(angle) * py) / (radius * aspect)
        azimuth = np.arctan2(v, u)
        rim = 1 + .12 * np.sin(3 * azimuth + angle) + .07 * np.cos(5 * azimuth - angle)
        d = np.hypot(u, v) / rim
        # Eroded shoulders, an off-center crest, and a narrow dark contact rim.
        edge = np.clip((1.06 - d) * radius * .72, 0, 1)
        crest = np.clip(1 - (u + .21)**2 - (v - .13)**2, 0, 1)
        collar = np.exp(-((d - .94) * radius * .95)**2) * (1 - .55 * edge)
        indices = np.ix_(rows, cols)
        height[indices] += edge * (.42 + .62 * crest) * radius * RNG.uniform(.26, .53)
        tone[indices] += edge * (mineral + .038 * np.sin(u * 13 + v * 9)) - .19 * collar


def bake():
    drifts = field(4) * .68 + field(9) * .32
    mottling = field(18)
    sand = field(69)
    grit = field(141)
    dust = field(239)
    patches = np.clip(.52 + 1.03 * drifts + .17 * mottling, .07, .95)
    height = .52 * mottling + .62 * sand + .39 * grit + .23 * dust
    tone = .59 + .16 * drifts + .055 * mottling + .049 * sand + .05 * grit + .035 * dust
    tone -= .14 * np.clip(-sand - .3 * grit - .44, 0, 1)
    add_fragments(height, tone, patches, 5200, .85, 2.25)
    add_fragments(height, tone, patches**1.5, 820, 2.3, 6.4)
    add_fragments(height, tone, patches**2, 100, 5.8, 13.1)
    nx = (np.roll(height, 1, axis=1) - np.roll(height, -1, axis=1)) * .5
    # PNG row order runs opposite to the V coordinate.
    nz = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .5
    norm = np.sqrt(1 + nx * nx + nz * nz)
    packed = np.stack((.5 + .5 * nx / norm, .5 + .5 * nz / norm, tone), axis=-1)
    # Drop two low bits before PNG compression. Filtering on the GPU interpolates the levels.
    return (4 * np.clip(np.rint(64 * packed), 0, 63)).astype(np.uint8)


def write_png(pixels):
    def chunk(name, payload):
        return struct.pack(">I", len(payload)) + name + payload + struct.pack(">I", zlib.crc32(name + payload))

    # PNG Sub filter, followed by lossless deflate. Keep the channels linear.
    filtered = pixels.copy()
    filtered[:, 1:] -= pixels[:, :-1]
    data = b"".join(b"\x01" + row.tobytes() for row in filtered)
    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)
    OUTPUT.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) +
                       chunk(b"IDAT", zlib.compress(data, level=9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    write_png(bake())
