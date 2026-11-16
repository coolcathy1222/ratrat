#!/usr/bin/env python3
"""Cut calm and angry heads out of the version-2 character sheets."""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "heads"
SPECIES = ["cream", "gray", "calico", "scarf", "gold", "crown"]
CENTERS = [123, 330, 537, 744, 951, 1158]


def paper_distance(r: int, g: int, b: int) -> int:
    return abs(r - 243) + abs(g - 234) + abs(b - 217)


def is_paper(r: int, g: int, b: int) -> bool:
    # Tight on purpose: cream fur and white fur sit just outside this distance,
    # and the dark outline stops the fill from leaking through any gap.
    return paper_distance(r, g, b) < 12 and (r + g + b) > 500


def knock_out(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    pix = im.load()
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        i = y * w + x
        if seen[i]:
            return
        r, g, b, _a = pix[x, y]
        if not is_paper(r, g, b):
            return
        seen[i] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while q:
        x, y = q.popleft()
        r, g, b, _a = pix[x, y]
        pix[x, y] = (r, g, b, 0)
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)
    return im


def body_box(index: int) -> tuple[int, int, int, int]:
    cx = CENTERS[index]
    # Windows meet between characters, so the outline stays closed and neighbors stay out.
    return cx - 102, 188, cx + 102, 522


def head_slice(index: int) -> tuple[int, int]:
    # Y range inside the body crop. The body crop starts at y=188.
    if index == 5:
        return 196 - 188, 392 - 188
    if index == 3:
        return 224 - 188, 430 - 188
    return 224 - 188, 392 - 188


def largest_opaque(im: Image.Image) -> Image.Image:
    im = im.copy()
    w, h = im.size
    pix = im.load()
    seen = bytearray(w * h)
    best: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if seen[i] or pix[x, y][3] == 0:
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[i] = 1
            comp: list[tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    ni = ny * w + nx
                    if seen[ni] or pix[nx, ny][3] == 0:
                        continue
                    seen[ni] = 1
                    q.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = set(best)
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep and pix[x, y][3]:
                r, g, b, _a = pix[x, y]
                pix[x, y] = (r, g, b, 0)
    return im


def to_shadow(im: Image.Image) -> Image.Image:
    out = im.copy()
    pix = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            _r, _g, _b, a = pix[x, y]
            if a == 0:
                continue
            pix[x, y] = (92, 64, 52, min(a, 210))
    return out


def main() -> None:
    calm = Image.open(ROOT / "design" / "version-2" / "rat1.jpg").convert("RGB")
    angry = Image.open(ROOT / "design" / "version-2" / "rat2.jpg").convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(SPECIES):
        box = body_box(i)
        top, bottom = head_slice(i)
        calm_head = largest_opaque(knock_out(calm.crop(box))).crop((0, top, box[2] - box[0], bottom))
        angry_head = largest_opaque(knock_out(angry.crop(box))).crop((0, top, box[2] - box[0], bottom))
        calm_head.save(OUT / f"{name}-calm.png", optimize=True)
        angry_head.save(OUT / f"{name}-angry.png", optimize=True)
        to_shadow(calm_head).save(OUT / f"{name}-shadow.png", optimize=True)
        print(name, calm_head.size)


if __name__ == "__main__":
    main()
