"""The train car's inside (NEXT STOP), lit by its ceiling strip. Nothing is added or moved:
  1. stray grey dashes on the wall above the window are painted out with the wall's own colour
  2. the post between the two panes is plain steel again (it carried cream and grey bands)
  3. the ceiling strip throws hard cel shadows: every solid part (rails, straps, poster frames, the window frame, door
     headers) casts one flat shadow down the cream wall; the wall is a little brighter near the light, darker low down
usage: interior_light.py in.webp out.webp [strength]"""
import sys, numpy as np, cv2
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; ST = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
H, W = im.shape[:2]; K = W / 2816.0
rgb, al = im[..., :3].copy(), im[..., 3]
opaque = al > 250
WALL = np.array([234, 225, 201], np.float32)
def wallish(a, tol): return (np.abs(a - WALL).max(axis=2) < tol)
# 1: the stray dashes (boxes measured on the art; only pixels darker than the wall there are touched)
for (x0, y0, x1, y1) in [(690, 462, 874, 484), (1946, 500, 2160, 562)]:
    x0, y0, x1, y1 = [int(v * K) for v in (x0, y0, x1, y1)]
    box = rgb[y0:y1, x0:x1]; w = wallish(box, 14)
    med = np.median(box[w], axis=0) if w.any() else WALL
    bad = ~wallish(box, 9)
    bad = cv2.dilate(bad.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    box[bad] = med
# 2: the post between the panes: each column takes its own median colour down the rows where glass lies on both sides
clear = al < 40
rows = [y for y in range(int(500 * K), int(940 * K)) if clear[y, int(1250 * K)] and clear[y, int(1560 * K)]]
if rows:
    ys = np.array(rows)
    cols = np.where(opaque[ys][:, int(1300 * K):int(1520 * K)].all(axis=0))[0] + int(1300 * K)
    if len(cols):
        xa, xb = cols.min(), cols.max() + 1
        strip = rgb[ys, xa:xb]
        prof = np.median(strip, axis=0)                      # one colour per column: the steel and its ink edges
        lum = strip.mean(axis=2); pl = prof.mean(axis=1)
        keep = np.abs(lum - pl[None, :]) < 6                 # (already right: untouched)
        strip[~keep] = np.broadcast_to(prof[None], strip.shape)[~keep]
        rgb[ys[:, None], np.arange(xa, xb)[None, :]] = strip
        print('post', xa, xb, 'rows', len(ys), 'fixed', int((~keep).sum()))
# 3: the light
lum0 = rgb.mean(axis=2)
wall = opaque & (lum0 > 150) & ((rgb[..., 0] - rgb[..., 2]) > 13)   # cream: bright and warm (the steel is neutral, the straps dark, the seat blue)
wall = cv2.morphologyEx(wall.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool)
solid = (opaque & ~wall).astype(np.uint8)
k = int(15 * K) | 1
solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))  # (ink lines throw no shadow)
solid = (cv2.GaussianBlur(solid.astype(np.float32), (0, 0), 4 * K) > 0.5).astype(np.uint8)          # (one clean outline)
dx, dy = int(10 * K), int(30 * K)
sh = cv2.warpAffine(solid, np.float32([[1, 0, dx], [0, 1, dy]]), (W, H), borderValue=0).astype(np.float32)
sh = cv2.GaussianBlur(sh, (0, 0), 0.8 * K)                 # (a hard edge, only anti-aliased)
sh *= cv2.GaussianBlur(wall.astype(np.float32), (0, 0), 0.8 * K)
sh[:int(495 * K)] = 0   # (above the window the rail's own shadow is drawn below, as one clean band)
# the hand rail's shadow on the wall: the art draws it only over the window (it stopped dead at both ends); it now runs the rail's whole length
ya, yb, xa2, xb2 = int(461 * K), int(472 * K), int(560 * K), int(2290 * K)
band = rgb[ya:yb, xa2:xb2]; wb = (band.mean(axis=2) > 185) & ((band[..., 0] - band[..., 2]) > 13)
band[wb] = np.array([205, 197, 176], np.float32)
Y = np.mgrid[0:H, 0:W][0].astype(np.float32) / H
grad = np.clip(1.04 - 0.17 * np.clip((Y - 0.12) / 0.6, 0, 1), 0, 2)
m = wall.astype(np.float32)[..., None]
rgb = rgb * (1 + (grad[..., None] - 1) * m * ST)
rgb = rgb * (1 - sh[..., None] * ST * (1 - np.array([0.76, 0.74, 0.77], np.float32)))
out = np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(dst, quality=90, method=6) if dst.endswith('.webp') else Image.fromarray(out, 'RGBA').save(dst)
print('interior lit', dst)
