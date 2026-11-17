import { DungeonId } from '../battle/dungeonConfig';
import { ExpeditionApp } from './ExpeditionApp';
import { Expedition } from '../battle/expedition';
import { loadBase } from '../battle/base';
import { DEFAULT_HERO_IDS } from '../battle/roster';

/** 基地复用队员整备与库存组件，不创建Phaser战场。 */
export class BaseApp {
    private view: ExpeditionApp;
    constructor(root: HTMLElement, onEnter: (prepared: Expedition, dungeonId: DungeonId) => void, prepared?: Expedition, onChange?: (base: Expedition) => void) {
        this.view = new ExpeditionApp(root, DEFAULT_HERO_IDS, undefined, { base: true, initialRun: prepared || loadBase(), onEnter, onChange });
    }
    dispose() { this.view.dispose(); }
}
