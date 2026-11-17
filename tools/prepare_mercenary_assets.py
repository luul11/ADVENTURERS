"""Import the supplied base and 5x4 human sheet without changing the originals."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
from prepare_hero_rosters import remove_background, remove_border_fragments
from roster_grid import row_edges

ROOT = Path(__file__).resolve().parents[1]
ROWS = ('guard_spearman', 'guard_veteran', 'bandit_archer', 'bandit_raider')
POSES = ('idle', 'portrait', 'melee', 'ranged', 'broken')

def prepare(base_source, roster_source, overwrite=False):
    output = ROOT / 'image' / 'roster_raiders'
    base_dir = ROOT / 'image' / 'base'
    runtime = ROOT / 'public' / 'assets' / 'mercenary_base.webp'
    targets = [runtime] + [output / f'{row}_{pose}.png' for row in ROWS for pose in POSES]
    targets += [p.with_suffix('.webp') for p in targets if p.suffix=='.png']
    if not overwrite and any(p.exists() for p in targets):
        raise FileExistsError('Assets exist; pass --overwrite to regenerate.')
    output.mkdir(parents=True, exist_ok=True)
    base_dir.mkdir(parents=True, exist_ok=True)
    base_copy = base_dir / 'mercenary_base.png'
    sheet_copy = output / 'card_roster_guard_bandit_5x4.png'
    for source, target in ((base_source, base_copy), (roster_source, sheet_copy)):
        if source.resolve() != target.resolve():
            shutil.copy2(source, target)
    base = Image.open(base_copy).convert('RGB')
    base.save(runtime, 'WEBP', quality=88, method=6)
    sheet = Image.open(sheet_copy).convert('RGBA')
    w, h = sheet.size
    ys = [row_edges(sheet,round(c*w/5),round((c+1)*w/5)) for c in range(5)]
    preview = Image.new('RGB', (1280, 1120), '#23272e')
    draw = ImageDraw.Draw(preview)
    records = []
    for row, name in enumerate(ROWS):
        draw.text((8, row * 280 + 4), name, fill='white')
        for col, pose in enumerate(POSES):
            box = (round(col*w/5), ys[col][row], round((col+1)*w/5), ys[col][row+1])
            crop = remove_border_fragments(remove_background(sheet.crop(box), bow=row in (0,2)))
            frame = Image.new('RGBA', (256,256))
            scaled = ImageOps.contain(crop, (256,256), Image.Resampling.LANCZOS)
            frame.alpha_composite(scaled, ((256-scaled.width)//2, (256-scaled.height)//2))
            path = output / f'{name}_{pose}.png'
            frame.save(path, optimize=True)
            frame.save(path.with_suffix('.webp'), 'WEBP', quality=92, method=6)
            preview.paste(frame, (col*256,row*280+24), frame)
            records.append({'id':name, 'pose':pose, 'file':path.name, 'source_box':box,
                            'size':[256,256], 'alpha_bounds':frame.getbbox(), 'bytes':path.stat().st_size, 'runtime_file':path.with_suffix('.webp').name, 'runtime_bytes':path.with_suffix('.webp').stat().st_size})
    preview.save(output / 'raiders_preview.png', optimize=True)
    manifest={'version':1, 'rows':ROWS, 'poses':POSES, 'source_size':[w,h], 'source_sha256':hashlib.sha256(sheet_copy.read_bytes()).hexdigest(), 'sprites':records,
              'base':{'source_size':base.size, 'runtime':'public/assets/mercenary_base.webp','bytes':runtime.stat().st_size}}
    (output/'raiders_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'sprites':len(records),'sprite_bytes':sum(r['bytes'] for r in records),'background_bytes':runtime.stat().st_size,'empty':[r['file'] for r in records if not r['alpha_bounds']]},indent=2))

if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--base', type=Path, default=ROOT/'image/base/mercenary_base.png')
    p.add_argument('--roster', type=Path, default=ROOT/'image/roster_raiders/card_roster_guard_bandit_5x4.png')
    p.add_argument('--overwrite',action='store_true')
    a=p.parse_args()
    prepare(a.base,a.roster,a.overwrite)
