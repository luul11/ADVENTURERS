"""Reusable N-row x 5-column sprite cutter. Requires Pillow only."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
POSES = ('idle', 'portrait', 'melee', 'ranged', 'broken')


def split_roster(source, rows, output, names=None, white_threshold=245, overwrite=False):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not isinstance(rows, int) or isinstance(rows, bool) or rows < 1:
        raise ValueError('rows must be a positive integer')
    if white_threshold is not None and (not isinstance(white_threshold, int) or not 0 <= white_threshold <= 255):
        raise ValueError('white threshold must be an integer from 0 to 255')
    names = list(names) if names is not None else [f'row_{i + 1:02d}' for i in range(rows)]
    if len(names) != rows or any(not re.fullmatch(r'[A-Za-z0-9_-]+', name) for name in names):
        raise ValueError('provide one ASCII row ID per row; use letters, numbers, _ or -')
    if len({name.casefold() for name in names}) != rows:
        raise ValueError('row IDs must be unique (case-insensitive)')
    with Image.open(source) as image:
        image.load()
        sheet = image.convert('RGBA')
    width, height = sheet.size
    if width < 5 or height < rows:
        raise ValueError('image is too small for this grid')
    xs = [round(i * width / 5) for i in range(6)]
    ys = [round(i * height / rows) for i in range(rows + 1)]
    filenames = [f'{name}_{pose}.png' for name in names for pose in POSES]
    targets = [output / name for name in filenames + ['preview.png', 'manifest.json']]
    if source in [path.resolve() for path in targets]:
        raise ValueError('output would overwrite the source image')
    existing = [path.name for path in targets if path.exists()]
    if existing and not overwrite:
        raise FileExistsError('output exists; use another directory or --overwrite: ' + ', '.join(existing[:3]))
    output.mkdir(parents=True, exist_ok=True)
    preview = Image.new('RGBA', sheet.size, '#22313e')
    records = []
    for row, name in enumerate(names):
        for col, pose in enumerate(POSES):
            box = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            crop = sheet.crop(box)
            if white_threshold is not None:
                crop.putdata([
                    (0, 0, 0, 0) if min(r, g, b) >= white_threshold else (r, g, b, a)
                    for r, g, b, a in crop.getdata()
                ])
            filename = f'{name}_{pose}.png'
            crop.save(output / filename, optimize=True)
            preview.alpha_composite(crop, (box[0], box[1]))
            records.append({'row': row + 1, 'column': col + 1, 'row_id': name, 'pose': pose,
                            'file': filename, 'box': box, 'size': crop.size})
    preview.convert('RGB').save(output / 'preview.png')
    manifest = {
        'version': 1, 'source': source.name,
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'size': sheet.size, 'columns': 5, 'rows': rows, 'row_ids': names,
        'poses': POSES, 'x_boundaries': xs, 'y_boundaries': ys,
        'white_threshold': white_threshold, 'resized': False, 'sprites': records
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest


def main():
    parser = argparse.ArgumentParser(description='Split an image into N rows x 5 columns; no resizing or padding.')
    parser.add_argument('--input', type=Path, default=ROOT / 'card_roster_5x4_battle_damage.png', help='source image (never modified)')
    parser.add_argument('--rows', type=int, default=4, help='number of rows, default: 4')
    parser.add_argument('--output', type=Path, help='output directory, default: project/image/<source>_<rows>x5')
    parser.add_argument('--names', nargs='+', help='one row ID per row; otherwise row_01, row_02, ...')
    parser.add_argument('--white-threshold', type=int, default=245, help='RGB channels at/above this value become transparent, default: 245')
    parser.add_argument('--keep-white', action='store_true', help='skip white removal, preserving original RGBA')
    parser.add_argument('--overwrite', action='store_true', help='replace generated files only; unrelated files are not deleted')
    args = parser.parse_args()
    output = args.output or ROOT / 'image' / f'{args.input.stem}_{args.rows}x5'
    try:
        manifest = split_roster(args.input, args.rows, output, args.names,
                                None if args.keep_white else args.white_threshold, args.overwrite)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Error: {error}\n')
    print(json.dumps({'output': str(output.resolve()), 'sprites': len(manifest['sprites']),
                      'source_size': manifest['size'], 'rows': args.rows, 'columns': 5,
                      'white_threshold': manifest['white_threshold'], 'resized': False,
                      'sizes': sorted({tuple(s['size']) for s in manifest['sprites']})}, indent=2))


if __name__ == '__main__':
    main()
