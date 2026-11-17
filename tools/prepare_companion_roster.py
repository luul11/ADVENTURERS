"""Prepare the supplied four-row sheet, preserving the source and existing sprites."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from prepare_hero_rosters import remove_background, remove_border_fragments

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'card_roster_5x4_four_heroes.png'
OUTPUT = ROOT / 'image' / 'roster_heroes'
POSES = ('idle', 'portrait', 'melee', 'ranged', 'broken')
ROWS = ('xu_guardian', 'dong_ranger', 'elf_archer', 'goblin_chief')
SIZE = 256


def prepare(overwrite=False):
    targets = [OUTPUT / f'{name}_{pose}.png' for name in ROWS for pose in POSES]
    if not overwrite and any(p.exists() for p in targets):
        raise FileExistsError('Companion sprites exist; pass --overwrite to regenerate.')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE).convert('RGBA')
    w, h = sheet.size
    xs, ys = [round(i * w / 5) for i in range(6)], [round(i * h / 4) for i in range(5)]
    preview = Image.new('RGB', (SIZE * 5, (SIZE + 24) * 4), '#23272e')
    draw = ImageDraw.Draw(preview)
    records = []
    for row, name in enumerate(ROWS):
        draw.text((8, row * (SIZE + 24) + 4), name, fill='white')
        for col, pose in enumerate(POSES):
            box = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            crop = remove_border_fragments(remove_background(sheet.crop(box), bow=row in (1, 2)))
            frame = Image.new('RGBA', (SIZE, SIZE))
            scaled = ImageOps.contain(crop, (SIZE, SIZE), Image.Resampling.LANCZOS)
            frame.alpha_composite(scaled, ((SIZE - scaled.width) // 2, (SIZE - scaled.height) // 2))
            path = OUTPUT / f'{name}_{pose}.png'
            frame.save(path, optimize=True)
            preview.paste(frame, (col * SIZE, row * (SIZE + 24) + 24), frame)
            records.append({'id': name, 'pose': pose, 'file': path.name, 'source_box': box,
                            'size': [SIZE, SIZE], 'alpha_bounds': frame.getbbox(), 'bytes': path.stat().st_size})
    preview.save(OUTPUT / 'companions_preview.png', optimize=True)
    manifest = {'version': 1, 'poses': POSES, 'size': SIZE, 'sources': {SOURCE.name: hashlib.sha256(SOURCE.read_bytes()).hexdigest()}, 'source_size': [w, h], 'sprites': records}
    (OUTPUT / 'companions_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'sprites': len(records), 'bytes': sum(r['bytes'] for r in records), 'empty': [r['file'] for r in records if not r['alpha_bounds']]}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--overwrite', action='store_true')
    prepare(parser.parse_args().overwrite)
