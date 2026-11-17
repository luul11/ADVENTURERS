"""Normalize the supplied 5x4 character sheets without modifying their sources."""
import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
POSES = ('idle', 'portrait', 'melee', 'ranged', 'broken')
SHEETS = (
    ('card_roster_4classes_5x4_final.png', ('vanguard', 'ranger', 'guardian', 'mage')),
    ('card_roster_cn_5x4_base.png', ('cn_blade', 'cn_archer', 'cn_guardian', 'cn_mage')),
)
SIZE = 256


def remove_border_fragments(image):
    w, h = image.size
    pixels, seen, components = image.load(), set(), []
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not pixels[x, y][3]:
                continue
            component, pending = [], [(x, y)]
            while pending:
                px, py = pending.pop()
                if (px, py) in seen or not 0 <= px < w or not 0 <= py < h:
                    continue
                seen.add((px, py))
                if not pixels[px, py][3]:
                    continue
                component.append((px, py))
                pending.extend((px + dx, py + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
            components.append(component)
    largest = max(components, key=len, default=[])
    for component in components:
        if component is largest:
            continue
        xs, ys = zip(*component)
        width, height = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        edge = min(xs) <= 1 or max(xs) >= w - 2
        if edge and width < w * .10 and height > h * .15 and height > width * 3:
            for xy in component:
                pixels[xy] = (0, 0, 0, 0)
    return image


def remove_background(image, bow=False):
    image = image.convert('RGBA')
    w, h = image.size
    pixels = image.load()
    seen = set()
    queue = deque((x, y) for x in range(w) for y in (0, h - 1))
    queue.extend((x, y) for y in range(h) for x in (0, w - 1))
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not 0 <= x < w or not 0 <= y < h:
            continue
        seen.add((x, y))
        r, g, b, a = pixels[x, y]
        if a and (min(r, g, b) < 238 or max(r, g, b) - min(r, g, b) > 20):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    if bow:
        visited = set()
        for y in range(h):
            for x in range(w):
                if (x, y) in visited or not pixels[x, y][3] or min(pixels[x, y][:3]) < 248:
                    continue
                component, pending = [], [(x, y)]
                while pending:
                    px, py = pending.pop()
                    if (px, py) in visited or not 0 <= px < w or not 0 <= py < h:
                        continue
                    visited.add((px, py))
                    if not pixels[px, py][3] or min(pixels[px, py][:3]) < 248:
                        continue
                    component.append((px, py))
                    pending.extend(((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)))
                if len(component) >= 80:
                    for xy in component:
                        pixels[xy] = (0, 0, 0, 0)
    # Remove the white matte from the outer antialiased contour only.
    background = {(x, y) for y in range(h) for x in range(w) if not pixels[x, y][3]}
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            low = min(r, g, b)
            if a and low >= 100 and any(xy in background for xy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))):
                alpha = 255 - low
                pixels[x, y] = tuple(round((v - low) * 255 / alpha) for v in (r, g, b)) + (alpha,) if alpha else (0, 0, 0, 0)
    return image


def prepare(output, overwrite=False):
    targets = [output / f'{name}_{pose}.png' for _, names in SHEETS for name in names for pose in POSES]
    if not overwrite and any(p.exists() for p in targets):
        raise FileExistsError('Generated hero sprites already exist; pass --overwrite to regenerate.')
    output.mkdir(parents=True, exist_ok=True)
    preview = Image.new('RGB', (SIZE * 5, (SIZE + 24) * 8), '#23272e')
    draw = ImageDraw.Draw(preview)
    records = []
    for sheet_index, (filename, names) in enumerate(SHEETS):
        source = ROOT / filename
        sheet = Image.open(source).convert('RGBA')
        w, h = sheet.size
        xs = [round(i * w / 5) for i in range(6)]
        ys = [round(i * h / 4) for i in range(5)]
        for row, name in enumerate(names):
            top = (sheet_index * 4 + row) * (SIZE + 24)
            draw.text((8, top + 4), name, fill='white')
            for col, pose in enumerate(POSES):
                box = (xs[col], ys[row], xs[col + 1], ys[row + 1])
                crop = remove_background(sheet.crop(box), bow=name in ('ranger', 'cn_archer') or (pose == 'portrait' and name == 'mage'))
                crop = remove_border_fragments(crop)
                frame = Image.new('RGBA', (SIZE, SIZE))
                scaled = ImageOps.contain(crop, (SIZE, SIZE), Image.Resampling.LANCZOS)
                frame.alpha_composite(scaled, ((SIZE - scaled.width) // 2, (SIZE - scaled.height) // 2))
                target = output / f'{name}_{pose}.png'
                frame.save(target, optimize=True)
                preview.paste(frame, (col * SIZE, top + 24), frame)
                records.append({'id': name, 'pose': pose, 'file': target.name, 'source': filename,
                                'source_box': box, 'source_size': [w, h], 'size': [SIZE, SIZE],
                                'alpha_bounds': frame.getbbox(), 'bytes': target.stat().st_size})
    preview.save(output / 'preview.png', optimize=True)
    manifest = {'version': 1, 'poses': POSES, 'size': SIZE,
                'sources': {f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest() for f, _ in SHEETS},
                'sprites': records}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'sprites': len(records), 'size': SIZE, 'total_bytes': sum(r['bytes'] for r in records),
                      'output': str(output), 'empty': [r['file'] for r in records if not r['alpha_bounds']]}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    prepare(ROOT / 'image' / 'roster_heroes', args.overwrite)
