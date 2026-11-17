"""Prepare two four-row women sheets; original images remain untouched."""
import argparse,hashlib,json,shutil
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
from prepare_hero_rosters import remove_background,remove_border_fragments
from roster_grid import row_edges
ROOT=Path(__file__).resolve().parents[1]
POSES=('idle','portrait','melee','ranged','broken')
SHEETS=(('card_roster_bandit_women_5x4.png',('bandit_woman_blue','bandit_woman_shield','bandit_woman_corsair','bandit_woman_violet')),
        ('bandit-set-2-simple.png',('bandit_woman_scout','bandit_woman_redhead','bandit_woman_cutlass','bandit_woman_huntress')))
# The first corsair's ranged drawing is only a half-body crop: reuse her complete melee pose.
OVERRIDES={'bandit_woman_corsair':{'ranged':2}}
def prepare(source_a,source_b,overwrite=False):
    out=ROOT/'image/roster_bandit_women';targets=[out/f'{name}_{pose}{ext}' for _,rows in SHEETS for name in rows for pose in POSES for ext in ('.png','.webp')]
    if not overwrite and any(p.exists() for p in targets):raise FileExistsError('Women frames exist; pass --overwrite to regenerate.')
    out.mkdir(parents=True,exist_ok=True);records=[];sources={}
    for (filename,rows),source in zip(SHEETS,(source_a,source_b)):
        copy=out/filename
        if source.resolve()!=copy.resolve():shutil.copy2(source,copy)
        sheet=Image.open(copy).convert('RGBA');w,h=sheet.size;ys=[row_edges(sheet,round(c*w/5),round((c+1)*w/5)) for c in range(5)]
        sources[filename]={'size':[w,h],'sha256':hashlib.sha256(copy.read_bytes()).hexdigest(),'row_edges_by_column':ys}
        preview=Image.new('RGB',(1280,1120),'#23272e');draw=ImageDraw.Draw(preview)
        for row,name in enumerate(rows):
            draw.text((8,row*280+4),name,fill='white')
            for col,pose in enumerate(POSES):
                c=OVERRIDES.get(name,{}).get(pose,col);box=(round(c*w/5),ys[c][row],round((c+1)*w/5),ys[c][row+1])
                crop=remove_border_fragments(remove_background(sheet.crop(box),bow=True));frame=Image.new('RGBA',(256,256));scaled=ImageOps.contain(crop,(256,256),Image.Resampling.LANCZOS)
                frame.alpha_composite(scaled,((256-scaled.width)//2,(256-scaled.height)//2));path=out/f'{name}_{pose}.png';frame.save(path,optimize=True);runtime=path.with_suffix('.webp');frame.save(runtime,'WEBP',quality=92,method=6);preview.paste(frame,(col*256,row*280+24),frame)
                records.append({'id':name,'pose':pose,'file':path.name,'runtime_file':runtime.name,'runtime_bytes':runtime.stat().st_size,'source':filename,'source_column':c+1,'source_box':box,'size':[256,256],'alpha_bounds':frame.getbbox()})
        preview.save(out/(Path(filename).stem+'_preview.png'),optimize=True)
    (out/'bandit_women_manifest.json').write_text(json.dumps({'version':1,'sources':sources,'sprites':records,'source_overrides':OVERRIDES},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'women':8,'frames':len(records),'runtime_bytes':sum(x['runtime_bytes'] for x in records),'empty':[x['file'] for x in records if not x['alpha_bounds']]},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source-a',type=Path,default=ROOT/'image/roster_bandit_women/card_roster_bandit_women_5x4.png');p.add_argument('--source-b',type=Path,default=ROOT/'image/roster_bandit_women/bandit-set-2-simple.png');p.add_argument('--overwrite',action='store_true');a=p.parse_args();prepare(a.source_a,a.source_b,a.overwrite)
