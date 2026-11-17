import { Scene, GameObjects, Math as PhaserMath } from 'phaser';
import { ART_POSES, ART_SPECIES, ArtPose, ArtId, imageUrl, textureKey } from '../../battle/characterArt';
import { Battle, Point, areaCells, BLOCKS, COLS, ROWS, activeUnit, same, distance, BattleEvent, skillById, Unit } from '../../battle/engine';

export interface BoardView {
    effectCells?: Point[]; battle: Battle; inspectedId: string; moves: Point[]; range: Point[]; targetIds: string[];
    path: Point[]; effectIds: string[]; danger: Point[]; threat: Point[]; rangeKind: 'attack' | 'skill'; showGrid: boolean;
}
const CH = 136;
export class Game extends Scene {
    artIds: ArtId[] = ART_SPECIES;
    onCell: (p: Point) => void = () => {};
    onReady: () => void = () => {};
    private layer!: GameObjects.Container;
    private terrain!: GameObjects.Image;
    private view?: BoardView;
    private actors = new Map<string, GameObjects.Image>();
    private reducedMotion = false;
    private cellWidth = 120;
    private zoomLevel = 1;
    private offsetX = 0;
    private offsetY = 0;
    constructor() { super('Battle'); }
    preload() {
        this.load.image('battle-map', `${import.meta.env.BASE_URL}assets/battle_map_bg.webp`);
        for (const species of this.artIds) for (const pose of ART_POSES) this.load.image(`character-${species}-${pose}`, imageUrl(species, pose));
    }
    create() {
        this.terrain = this.add.image(0, 0, 'battle-map').setDepth(-1);
        this.layer = this.add.container();
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Map from current DOM bounds so scrolling the portrait page never offsets picks.
        const canvas = this.game.canvas;
        let down: { x: number; y: number; id: number; ox: number; oy: number } | null = null;
        const onDown = (event: PointerEvent) => {
            if (!event.isPrimary || event.button !== 0) return;
            down = { x: event.clientX, y: event.clientY, id: event.pointerId, ox: this.offsetX, oy: this.offsetY };
            if (this.zoomLevel > 1) canvas.setPointerCapture(event.pointerId);
        };
        const onMove = (event: PointerEvent) => {
            if (!down || this.zoomLevel === 1 || event.pointerId !== down.id) return;
            this.offsetX = down.ox + event.clientX - down.x;
            this.offsetY = down.oy + event.clientY - down.y;
            this.applyView();
        };
        const onWheel = (event: WheelEvent) => {
            if (event.ctrlKey) return;
            event.preventDefault();
            this.zoomBy(event.deltaY < 0 ? .12 : -.12);
        };
        const onCancel = () => { down = null; };
        const onUp = (event: PointerEvent) => {
            const start = down; down = null;
            if (!start || event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((event.clientX - rect.left) / rect.width * COLS);
            const y = Math.floor((event.clientY - rect.top) / rect.height * ROWS);
            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) this.onCell({ x, y });
        };
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('pointercancel', onCancel);
        const releaseInput = () => {
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('pointercancel', onCancel);
        };
        this.events.once('shutdown', releaseInput); this.events.once('destroy', releaseInput);
        // Preserve uniform art scaling while allowing a wider logical field on desktop.
        const parent = canvas.parentElement!;
        const resizeField = () => {
            const bounds = parent.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const width = Math.round(CH * ROWS * bounds.width / bounds.height);
            if (this.scale.width === width && this.scale.height === CH * ROWS) return;
            this.cellWidth = width / COLS;
            this.scale.resize(width, CH * ROWS);
            this.applyView();
            if (this.view) this.draw(this.view);
        };
        const observer = new ResizeObserver(resizeField);
        observer.observe(parent);
        const releaseScene = () => { observer.disconnect(); this.actors.clear(); this.view = undefined; };
        this.events.once('shutdown', releaseScene); this.events.once('destroy', releaseScene);
        resizeField();
        this.onReady();
    }
    private center(p: Point) {
        return { x: p.x * this.cellWidth + this.cellWidth / 2, y: p.y * CH + CH / 2 };
    }
    zoomBy(delta: number) {
        this.zoomLevel = Math.max(1, Math.min(1.8, this.zoomLevel + delta));
        this.applyView();
    }
    resetView() {
        this.zoomLevel = 1; this.offsetX = 0; this.offsetY = 0;
        this.applyView();
    }
    private applyView() {
        const canvas = this.game.canvas;
        const maxX = canvas.clientWidth * (this.zoomLevel - 1) / 2;
        const maxY = canvas.clientHeight * (this.zoomLevel - 1) / 2;
        this.offsetX = Math.max(-maxX, Math.min(maxX, this.offsetX));
        this.offsetY = Math.max(-maxY, Math.min(maxY, this.offsetY));
        canvas.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomLevel})`;
        canvas.style.touchAction = this.zoomLevel > 1 ? 'none' : 'pan-y';
        canvas.style.cursor = this.zoomLevel > 1 ? 'grab' : 'pointer';
    }
    private text(x: number, y: number, text: string, size: number, color = '#cdd6dc', bold = false) {
        const obj = this.add.text(x, y, text, { fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif', fontSize: size,
            color, fontStyle: bold ? 'bold' : 'normal' });
        this.layer.add(obj); return obj;
    }
    draw(view: BoardView) {
        this.view = view;
        if (!this.layer) return;
        this.actors.clear();
        this.layer.removeAll(true);
        const terrain = this.terrain;
        terrain.setPosition(COLS * this.cellWidth / 2, ROWS * CH / 2);
        terrain.setScale(Math.max(COLS * this.cellWidth / terrain.width, ROWS * CH / terrain.height));
        const g = this.add.graphics(); this.layer.add(g);
        const active = activeUnit(view.battle);
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
            const p = { x, y }, px = x * this.cellWidth + 3, py = y * CH + 3;
            g.fillStyle((x + y) % 2 ? 0xffffff : 0x173b32, .045);
            g.fillRect(x * this.cellWidth, y * CH, this.cellWidth, CH);
            if (view.showGrid) {
                g.lineStyle(1, 0xf3f0cd, .42); g.strokeRoundedRect(px + 1, py + 1, this.cellWidth - 6, CH - 6, 5);
                g.lineStyle(1, 0xf0e8bf, .32); g.lineBetween(px + 6, py + 3, px + this.cellWidth - 11, py + 3);
            }
            if (view.threat.some(t => same(t, p))) { g.fillStyle(0xaf5155, .16); g.fillRect(px + 2, py + 2, this.cellWidth - 10, CH - 10); }
            if (view.moves.some(t => same(t, p))) {
                g.fillStyle(0x459fde, .38); g.fillRoundedRect(px + 3, py + 3, this.cellWidth - 12, CH - 12, 4);
                g.lineStyle(2, 0x8dd6ff, .85); g.strokeRoundedRect(px + 3, py + 3, this.cellWidth - 12, CH - 12, 4);
                g.fillStyle(0xb0e2ff, .85); g.fillCircle(px + this.cellWidth / 2 - 3, py + CH / 2 - 3, 3);
            }
            if (view.range.some(t => same(t, p))) {
                const color = view.rangeKind === 'attack' ? 0xda6b67 : 0xd7b84e;
                g.fillStyle(color, .32); g.fillRoundedRect(px + 2, py + 2, this.cellWidth - 10, CH - 10, 4);
                g.lineStyle(2, color, .8); g.strokeRoundedRect(px + 3, py + 3, this.cellWidth - 12, CH - 12, 4);
            }
            if (BLOCKS.some(t => same(t, p))) {
                const cx = px + this.cellWidth / 2, cy = py + CH / 2;
                g.fillStyle(0x243e29, .2); g.fillEllipse(cx + 4, cy + 23, 84, 30);
                const rock = (ox: number, oy: number, scale: number) => {
                    const points = [[-27, 11], [-30, -8], [-13, -29], [16, -25], [29, -4], [21, 20], [-8, 23]];
                    const face = (indices: number[], color: number) => {
                        g.fillStyle(color); g.fillPoints(indices.map(i => new PhaserMath.Vector2(cx + ox + points[i][0] * scale, cy + oy + points[i][1] * scale)), true);
                    };
                    face([0, 1, 2, 3, 4, 5, 6], 0x8d947e);
                    face([1, 2, 3, 4], 0xc5c6aa);
                    face([3, 4, 5], 0x777f6b);
                    face([0, 1, 4, 5, 6], 0xa1a88b);
                    g.lineStyle(1, 0xe2dbc0, .6);
                    g.lineBetween(cx + ox - 13 * scale, cy + oy - 29 * scale, cx + ox + 16 * scale, cy + oy - 25 * scale);
                    g.lineStyle(1, 0x58664b, .6);
                    g.lineBetween(cx + ox - 10 * scale, cy + oy - 3 * scale, cx + ox + 4 * scale, cy + oy + 11 * scale);
                };
                rock(-13, -3, .9); rock(20, 12, .57); rock(-25, 24, .34);
                g.fillStyle(0x718a4f, .9); g.fillEllipse(cx - 9, cy + 25, 18, 5);
                g.fillStyle(0x90a066, .9); g.fillEllipse(cx + 22, cy + 23, 12, 4);
            }
            if (view.showGrid) this.text(px + 6, py + 5, `${String.fromCharCode(65 + x)}${y + 1}`, 11, '#fff0be', true);
        }
        for (const cell of view.effectCells || []) { g.lineStyle(2, 0xf1a45e, .85); g.strokeRoundedRect(cell.x * this.cellWidth + 4, cell.y * CH + 4, this.cellWidth - 8, CH - 8, 10); }
        if (view.path.length && active) {
            const points = [this.center(active), ...view.path.map(p => this.center(p))];
            g.lineStyle(4, view.danger.length ? 0xdea66a : 0x8ed4ff, .95); g.strokePoints(points.map(p => new PhaserMath.Vector2(p.x, p.y)));
            const end = points[points.length - 1]; g.fillStyle(0xd6c591); g.fillCircle(end.x, end.y, 8);
        }
        for (const u of view.battle.units.filter(t => t.hp > 0)) {
            const unitWidth = Math.min(110, Math.max(32, this.cellWidth - 6));
            const px = u.x * this.cellWidth + (this.cellWidth - unitWidth) / 2, py = u.y * CH + 2;
            const current = active?.id === u.id, selected = view.inspectedId === u.id;
            const enemy = u.team === 'enemy', teamColor = enemy ? 0xf07676 : 0x67c8e4;
            const cx = px + unitWidth / 2;
            const ringWidth = Math.min(70, unitWidth - 10);
            g.fillStyle(0x10221b, .24); g.fillEllipse(cx, py + 104, Math.min(80, unitWidth - 4), 19);
            g.fillStyle(teamColor, .2); g.fillEllipse(cx, py + 102, ringWidth, 15);
            g.lineStyle(current ? 3 : 2, current ? 0xffd579 : teamColor, .9);
            g.strokeEllipse(cx, py + 102, ringWidth, 15);
            if (selected || current) {
                g.lineStyle(current ? 3 : 2, current ? 0xffdb8c : 0xc4f0ff, .8);
                g.strokeRoundedRect(px + 4, py + 2, unitWidth - 8, CH - 8, 12);
            }
            const image = this.add.image(cx, py + 65, textureKey(u));
            this.fitActor(image);
            this.layer.add(image); this.actors.set(u.id, image);
            const overlay = this.add.graphics(); this.layer.add(overlay);
            if (view.targetIds.includes(u.id)) {
                overlay.lineStyle(3, view.rangeKind === 'attack' ? 0xff9485 : 0xffe477, 1);
                overlay.strokeRoundedRect(px + 3, py + 1, unitWidth - 6, CH - 6, 12);
            }
            if (view.effectIds.includes(u.id)) {
                overlay.fillStyle(view.rangeKind === 'attack' ? 0xde786a : 0xdfc359, .2);
                overlay.fillRoundedRect(px + 3, py + 1, unitWidth - 6, CH - 6, 12);
            }
            const fullName = u.name.replace('·', '');
            const name = this.text(0, py + 3, fullName, 18, current ? '#ffe3a0' : '#f4f7f8', true);
            const compact = this.cellWidth < 100, nameInset = compact ? 8 : 16, rightInset = compact ? 3 : 8;
            const maxLabelWidth = this.cellWidth - (compact ? 2 : 8);
            const padding = nameInset + rightInset;
            if (name.width + padding > maxLabelWidth) name.setFontSize(Math.max(12, Math.floor(18 * (maxLabelWidth - padding) / name.width)));
            let count = fullName.length;
            while (name.width + padding > maxLabelWidth && count > 0) name.setText(fullName.slice(0, --count) + '…');
            const labelWidth = Math.min(maxLabelWidth, Math.max(compact ? 0 : 92, name.width + padding));
            const labelX = cx - labelWidth / 2;
            overlay.fillStyle(0x17252c, .92); overlay.fillRoundedRect(labelX, py + 1, labelWidth, 22, 7);
            overlay.fillStyle(teamColor); overlay.fillCircle(labelX + (compact ? 4 : 8), py + 12, compact ? 2 : 3);
            name.setX(labelX + nameInset);
            const barX = px + 8, barWidth = unitWidth - 16;
            const health = u.hp / u.maxHp;
            overlay.fillStyle(0x122325, .9); overlay.fillRoundedRect(barX, py + 104, barWidth, 5, 2);
            if (health > 0) {
                overlay.fillStyle(health <= .25 ? 0xf16a6a : health <= .5 ? 0xf0be63 : 0x79d19c);
                overlay.fillRoundedRect(barX + 1, py + 105, (barWidth - 2) * health, 3, 1);
            }
            const armor = u.maxArmor > 0 ? u.armor / u.maxArmor : 0;
            overlay.fillStyle(0x30343b, .95); overlay.fillRoundedRect(barX, py + 111, barWidth, 5, 2);
            if (armor > 0) { overlay.fillStyle(0x9b9da6); overlay.fillRoundedRect(barX + 1, py + 112, (barWidth - 2) * armor, 3, 1); }
            overlay.fillStyle(0x17252c, .92); overlay.fillRoundedRect(barX, py + 117, barWidth, 15, 4);
            const hpText = this.text(barX + 3, py + 117, `${u.hp}`, 12, '#c2efcf', true);
            const armorText = this.text(cx, py + 117, `${unitWidth >= 94 ? '甲' : ''}${u.armor}`, 12, '#dde4ec').setOrigin(.5, 0);
            const mpText = this.text(barX + barWidth - 3, py + 117, `${u.mp}`, 12, '#91cbff').setOrigin(1, 0);
            if (hpText.x + hpText.width + 2 > cx - armorText.width / 2 || cx + armorText.width / 2 + 2 > mpText.x - mpText.width) {
                mpText.setVisible(false);
                armorText.setX(barX + barWidth - 3).setOrigin(1, 0);
                if (hpText.x + hpText.width + 2 > armorText.x - armorText.width) { hpText.setVisible(false); armorText.setX(cx).setOrigin(.5, 0); }
            }
        }
    }

    private animate(targets: object | object[], config: {
        alpha?: number; x?: number; y?: number; scale?: number; t?: number;
        duration?: number; repeat?: number; yoyo?: boolean; onUpdate?: () => void;
    }): Promise<void> {
        return new Promise(resolve => this.tweens.add({
            targets, ...config, duration: this.reducedMotion ? 60 : config.duration ?? 200,
            repeat: this.reducedMotion ? 0 : config.repeat ?? 0,
            yoyo: this.reducedMotion ? false : config.yoyo ?? false,
            onComplete: () => resolve()
        }));
    }
    private fitActor(image: GameObjects.Image) {
        image.setScale(Math.min(Math.min(102, Math.max(24, this.cellWidth - 18)) / image.width, 96 / image.height));
    }
    private attackPose(unit: Unit, pose: ArtPose) {
        const actor = this.actors.get(unit.id);
        if (actor) {
            actor.setTexture(textureKey(unit, pose));
            this.fitActor(actor);
        }
    }
    private async ray(from: Point, to: Point, color: number) {
        const beam = this.add.graphics().setDepth(30);
        const glow = this.add.circle(from.x, from.y, 8, color, .35).setDepth(31);
        const core = this.add.circle(from.x, from.y, 3, 0xfff8dc, 1).setDepth(32);
        const progress = { t: 0 };
        await this.animate(progress, { t: 1, duration: 180, onUpdate: () => {
            const x = from.x + (to.x - from.x) * progress.t;
            const y = from.y + (to.y - from.y) * progress.t;
            beam.clear().lineStyle(9, color, .16).lineBetween(from.x, from.y, x, y)
                .lineStyle(3, color, .85).lineBetween(from.x, from.y, x, y)
                .lineStyle(1, 0xfff8dc, 1).lineBetween(from.x, from.y, x, y);
            glow.setPosition(x, y); core.setPosition(x, y);
        } });
        await this.animate([beam, glow, core], { alpha: 0, duration: 70 });
        beam.destroy(); glow.destroy(); core.destroy();
    }
    private async blink(unitId: string, dodged: boolean) {
        const actor = this.actors.get(unitId);
        if (!actor || this.reducedMotion) return;
        const x = actor.x, y = actor.y;
        // A single subdued response on the affected sprite, not the cell or camera.
        actor.setTint(dodged ? 0xc8dce5 : 0xe3bdb7);
        try {
            await this.animate(actor, { x: x + (dodged ? 5 : 3), duration: 90, yoyo: true });
        } finally {
            if (actor.active) { actor.clearTint(); actor.setPosition(x, y); }
        }
    }
    private async positiveParticles(p: Point, color: number) {
        const ring = this.add.circle(p.x, p.y + 18, 21, color, .06).setStrokeStyle(2, color, .8).setDepth(30);
        const particles: GameObjects.Arc[] = [];
        const animations: Promise<void>[] = [this.animate(ring, { alpha: 0, scale: 1.8, duration: 280 })];
        const count = this.reducedMotion ? 4 : 10;
        for (let i = 0; i < count; i++) {
            const angle = i * Math.PI * 2 / count;
            const particle = this.add.circle(p.x + Math.cos(angle) * 10, p.y + 12 + Math.sin(angle) * 9, i % 2 ? 2 : 3, color, .95).setDepth(32);
            particles.push(particle);
            animations.push(this.animate(particle, { x: p.x + Math.cos(angle) * 34,
                y: p.y - 20 + Math.sin(angle) * 24, alpha: 0, scale: .3, duration: 280 }));
        }
        await Promise.all(animations);
        ring.destroy(); particles.forEach(particle => particle.destroy());
    }
    private async floatingText(p: Point, text: string, color: string) {
        const label = this.add.text(p.x, p.y - 30, text, {
            fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 17, color,
            backgroundColor: '#15212eee', padding: { x: 8, y: 5 }
        }).setOrigin(.5).setDepth(50);
        await this.animate(label, { y: p.y - 58, alpha: .15, duration: 300 });
        label.destroy();
    }
    private async areaBurst(center: Point, skillId: string) {
        const spell = skillById(skillId); if (!spell) return;
        const origin = this.center(center), cells = areaCells(center, spell), flame = skillId === 'flame-cross';
        const color = flame ? 0xff8b3d : 0xb9a0ff, core = flame ? 0xffecc0 : 0xe7ddff;
        const effects = this.add.container(0, 0).setDepth(28).setName('aoe-effect');
        const footprint = this.add.graphics(); effects.add(footprint);
        const width = Math.min(this.cellWidth - 8, 100), height = CH - 22;
        for (const cell of cells) {
            const at = this.center(cell);
            footprint.fillStyle(color, this.reducedMotion ? .12 : .24);
            footprint.fillRoundedRect(at.x - width / 2, at.y - height / 2, width, height, 12);
            footprint.lineStyle(3, color, .95).strokeRoundedRect(at.x - width / 2, at.y - height / 2, width, height, 12);
            footprint.lineStyle(1, core, .75).strokeRoundedRect(at.x - width / 2 + 5, at.y - height / 2 + 5, width - 10, height - 10, 8);
        }
        try {
            if (this.reducedMotion) {
                // Keep a legible footprint without moving rays, scale or repeated flashes.
                await new Promise<void>(resolve => this.time.delayedCall(180, resolve)); return;
            }
            footprint.setAlpha(.15); await this.animate(footprint, { alpha: 1, duration: 100 });
            const beam = this.add.graphics(); effects.add(beam);
            const progress = { t: 0 }, thickness = Math.min(40, this.cellWidth * .4);
            const drawBeam = () => {
                beam.clear();
                for (const cell of cells) {
                    const at = this.center(cell), x = origin.x + (at.x - origin.x) * progress.t, y = origin.y + (at.y - origin.y) * progress.t;
                    beam.lineStyle(thickness, color, .2).lineBetween(origin.x, origin.y, x, y);
                    beam.lineStyle(thickness * .48, color, .8).lineBetween(origin.x, origin.y, x, y);
                    beam.lineStyle(Math.max(3, thickness * .15), core, .95).lineBetween(origin.x, origin.y, x, y);
                }
            };
            const seal = this.add.circle(origin.x, origin.y, Math.min(28, this.cellWidth * .27), core, .9).setStrokeStyle(3, color, 1); effects.add(seal);
            await Promise.all([this.animate(progress, { t: 1, duration: 180, onUpdate: drawBeam }), this.animate(seal, { scale: 1.55, alpha: .35, duration: 180 })]);
            const bursts = cells.map(async (cell, index) => {
                const at = this.center(cell), ring = this.add.circle(at.x, at.y, Math.min(24, this.cellWidth * .24), color, .28).setStrokeStyle(3, core, .9); effects.add(ring);
                for (let i = 0; i < 4; i++) {
                    const angle = (i + index * .25) * Math.PI / 2;
                    const spark = this.add.circle(at.x, at.y, 3, core, 1); effects.add(spark);
                    void this.animate(spark, { x: at.x + Math.cos(angle) * Math.min(30, this.cellWidth * .3), y: at.y + Math.sin(angle) * 38, alpha: 0, duration: 240 });
                }
                await this.animate(ring, { scale: 1.6, alpha: 0, duration: 240 });
            });
            await Promise.all(bursts);
            // Hold the whole footprint through the impact; fade once rather than flashing.
            await this.animate(effects, { alpha: 0, duration: 200 });
        } finally { effects.destroy(true); }
    }
    async play(events: BattleEvent[]) {
        if (!this.view) return;
        for (const event of events) {
            if (event.type === 'area' && event.to && event.skillId) {
                const spell = skillById(event.skillId)!;
                const caster = this.view.battle.units.find(u => u.id === event.unitId);
                if (caster) { this.attackPose(caster, 'ranged'); if (!this.reducedMotion) await this.ray(this.center(caster), this.center(event.to), 0xf1a45e); }
                await this.areaBurst(event.to, spell.id);
                continue;
            }
            if (event.type === 'turn' || event.type === 'result') continue;
            const unit = this.view.battle.units.find(u => u.id === (event.targetId || event.unitId));
            if (!unit) continue;
            const p = event.type === 'move' && event.to ? this.center(event.to) : this.center(unit);
            if(event.type==='revive'){unit.hp=event.hp||1;unit.mp=unit.maxMp;unit.armor=0;if(event.to){unit.x=event.to.x;unit.y=event.to.y;}this.draw(this.view);const center=this.center(unit);await Promise.all([this.positiveParticles(center,0x8fdfaa),this.floatingText(center,'复活','#b1f1cb')]);continue;}
            if (event.type === 'move') {
                if (event.to) { unit.x = event.to.x; unit.y = event.to.y; this.draw(this.view); }
                const ring = this.add.circle(p.x, p.y, 24, 0x9bc9ba, .15).setStrokeStyle(2, 0xaad6c6, .8);
                await this.animate(ring, { scale: 1.4, alpha: 0, duration: 110 });
                ring.destroy(); continue;
            }
            const source = this.view.battle.units.find(u => u.id === event.unitId);
            const skill = event.skillId ? skillById(event.skillId) : undefined;
            const aim = this.view.battle.units.find(u => u.id === event.projectileTargetId);
            if (source && ['hit', 'miss', 'reaction'].includes(event.type)) this.attackPose(source, skill?.hit === 'ranged' ? 'ranged' : 'melee');
            if (source && aim && skill?.hit === 'ranged') {
                const rayColor = skill.id === 'flame-cross' ? 0xf1a45e : skill.piercing ? 0x9fe4ff : skill.spell > 0 ? 0xb7a0f4 : 0xe6d19a;
                await this.ray(this.center(source), this.center(aim), rayColor);
            }
            if (event.type === 'hit' || event.type === 'reaction') {
                // Keep the victim visible through the impact, including lethal hits.
                await Promise.all([this.blink(unit.id, false), this.floatingText(p, event.text, '#ffb09c')]);
                unit.hp = Math.max(0, unit.hp - (event.hp || 0));
                unit.armor = Math.max(0, unit.armor - (event.armor || 0));
            } else if (event.type === 'miss') {
                await Promise.all([this.blink(unit.id, true), this.floatingText(p, event.text, '#c9ebff')]);
            } else {
                if (event.resource && event.amount) { const maximum = { hp: unit.maxHp, mp: unit.maxMp, armor: unit.maxArmor }[event.resource]; unit[event.resource] = Math.min(maximum, unit[event.resource] + event.amount); }
                else if (event.type === 'heal') unit.hp = Math.min(unit.maxHp, unit.hp + (event.hp || 0));
                this.draw(this.view);
                const color = event.type === 'heal' ? 0x8fdfaa : 0xe3cf88;
                await Promise.all([this.positiveParticles(p, color), this.floatingText(p, event.text, '#c9e6d3')]);
            }
            this.draw(this.view);
        }
    }
    adjacentEnemyIds(): string[] {
        if (!this.view) return [];
        const u = activeUnit(this.view.battle);
        return u ? this.view.battle.units.filter(t => t.hp > 0 && t.team !== u.team && distance(u, t) === 1).map(t => t.id) : [];
    }
}









