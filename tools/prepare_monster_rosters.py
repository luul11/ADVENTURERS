"""Prepare eight supplied monster identities; preserve originals and pose provenance."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
from prepare_hero_rosters import remove_background, remove_border_fragments
from roster_grid import row_edges
ROOT=Path(__file__).resolve().parents[1]
POSES=('idle','portrait','melee','ranged','broken')
SHEETS={'goblin':('goblin_recruit','goblin_warrior','goblin_raider','goblin_chief'),
        'orc':('orc_recruit','orc_warrior','orc_archer','orc_chief')}
# The archer's supplied third cell is the actual drawn-bow pose. No invented frames.
SOURCE_COLUMNS={'orc_archer':{'melee':0,'ranged':2},'orc_chief':{'ranged':2}}
def prepare(source_dir,overwrite=False):
    out=ROOT/'image/roster_monsters'
    targets=[out/f'{name}_{pose}.png' for rows in SHEETS.values() for name in rows for pose in POSES]
    targets += [p.with_suffix('.webp') for p in targets if p.suffix=='.png']
    if not overwrite and any(p.exists() for p in targets):raise FileExistsError('Monster frames exist; pass --overwrite to regenerate.')
    out.mkdir(parents=True,exist_ok=True)
    records=[];sources={}
    for kind,rows in SHEETS.items():
        filename=f'card_roster_{kind}_5x4.png';source=source_dir/filename;copy=out/filename
        if source.resolve()!=copy.resolve():shutil.copy2(source,copy)
        sheet=Image.open(copy).convert('RGBA');w,h=sheet.size
        ys=[row_edges(sheet,round(c*w/5),round((c+1)*w/5)) for c in range(5)]
        sources[filename]={'row_edges_by_column':ys,'size':[w,h],'sha256':hashlib.sha256(copy.read_bytes()).hexdigest()}
        preview=Image.new('RGB',(1280,1120),'#23272e');draw=ImageDraw.Draw(preview)
        for row,name in enumerate(rows):
            draw.text((8,row*280+4),name,fill='white')
            for col,pose in enumerate(POSES):
                src_col=SOURCE_COLUMNS.get(name,{}).get(pose,col)
                box=(round(src_col*w/5),ys[src_col][row],round((src_col+1)*w/5),ys[src_col][row+1])
                crop=remove_border_fragments(remove_background(sheet.crop(box),bow=True))
                frame=Image.new('RGBA',(256,256));scaled=ImageOps.contain(crop,(256,256),Image.Resampling.LANCZOS)
                frame.alpha_composite(scaled,((256-scaled.width)//2,(256-scaled.height)//2))
                path=out/f'{name}_{pose}.png';frame.save(path,optimize=True);frame.save(path.with_suffix('.webp'),'WEBP',quality=92,method=6);preview.paste(frame,(col*256,row*280+24),frame)
                records.append({'id':name,'pose':pose,'file':path.name,'source':filename,'source_column':src_col+1,'source_box':box,'size':[256,256],'alpha_bounds':frame.getbbox(),'bytes':path.stat().st_size,'runtime_file':path.with_suffix('.webp').name,'runtime_bytes':path.with_suffix('.webp').stat().st_size})
        preview.save(out/f'{kind}_preview.png',optimize=True)
    manifest={'version':1,'poses':POSES,'sources':sources,'source_overrides':SOURCE_COLUMNS,'sprites':records}
    (out/'monsters_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'identities':8,'sprites':len(records),'bytes':sum(r['bytes'] for r in records),'empty':[r['file'] for r in records if not r['alpha_bounds']]},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source-dir',type=Path,default=ROOT/'image/roster_monsters');p.add_argument('--overwrite',action='store_true');a=p.parse_args();prepare(a.source_dir,a.overwrite)
