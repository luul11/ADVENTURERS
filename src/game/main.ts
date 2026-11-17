import { AUTO, Game, Scale } from 'phaser';
import { Game as BattleScene } from './scenes/Game';
export default function StartGame(parent: string, scene: BattleScene) {
    return new Game({ type: AUTO, parent, width: 600, height: 816, backgroundColor: '#14212b',
        antialias: true, roundPixels: true, input: { touch: { capture: false } }, scale: { mode: Scale.NONE, autoCenter: Scale.CENTER_BOTH }, scene: [scene] });
}

