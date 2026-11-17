"""Find white gutters per column; generated 5x4 sheets are not perfectly even."""
def row_edges(sheet, x0, x1, rows=4):
    rgb=sheet.convert('RGB');pix=rgb.load();h=rgb.height
    counts=[sum(min(pix[x,y])<235 for x in range(x0,x1)) for y in range(h)]
    edges=[0]
    for row in range(1,rows):
        center=round(row*h/rows);lo=max(1,center-round(h*.07));hi=min(h-1,center+round(h*.07));gaps=[];start=None
        for y in range(lo,hi+1):
            if counts[y]<=1:
                if start is None:start=y
            elif start is not None:
                if y-start>=3:gaps.append((start+y-1)//2)
                start=None
        if start is not None and hi-start>=3:gaps.append((start+hi)//2)
        edges.append(min(gaps,key=lambda y:abs(y-center)) if gaps else center)
    return edges+[h]
