import { icon } from './icons';
import './TitleScreen.css';

/** 独立封面入口。只负责开始回调，不创建战场或保存战斗状态。 */
export class TitleScreen {
    private button: HTMLButtonElement;
    private start: () => void;

    constructor(root: HTMLElement, onStart: () => void) {
        root.innerHTML = `<main class="title-screen" aria-labelledby="game-title">
            <div class="title-screen-art" aria-hidden="true"></div>
            <section class="title-screen-content">
                <span class="title-screen-emblem" aria-hidden="true">${icon('spark', 28)}</span>
                <h1 id="game-title">冒险者们</h1>
                <p class="title-screen-english" lang="en">ADVENTURERS</p>
                <button type="button" data-action="start-game" class="title-screen-start">开始游戏 ${icon('arrow', 20)}</button>
            </section>
            <footer class="title-screen-footer"><span>V0.3</span><span>制作人 <strong>伊玛目的门徒</strong></span></footer>
        </main>`;
        this.button = root.querySelector<HTMLButtonElement>('[data-action="start-game"]')!;
        this.start = () => {
            this.button.disabled = true;
            this.dispose();
            onStart();
        };
        this.button.addEventListener('click', this.start);
        this.button.focus({ preventScroll: true });
    }

    dispose() {
        this.button.removeEventListener('click', this.start);
    }
}
