import { BaseApp } from './ui/BaseApp';
import { ExpeditionApp } from './ui/ExpeditionApp';
import { RosterSelection } from './ui/RosterSelection';
import { TitleScreen } from './ui/TitleScreen';
import { Expedition } from './battle/expedition';
import { DungeonId } from './battle/dungeonConfig';
import { DEFAULT_HERO_IDS } from './battle/roster';
import { loadBase, saveBase, prepareExpedition, reserveExpedition, returnExpedition } from './battle/base';
const root = document.getElementById('app')!;
let preparedBase: Expedition = loadBase();
let selectedDungeon: DungeonId = 'suburban-road';
const persist = (base: Expedition) => { preparedBase = base; saveBase(base); };
const showBase = () => new BaseApp(root, (prepared, dungeonId) => { persist(prepared); selectedDungeon = dungeonId; selectParty(); }, preparedBase, persist);
const selectParty = () => new RosterSelection(root, members => {
    const run = prepareExpedition(preparedBase, members, undefined, selectedDungeon);
    persist(reserveExpedition(preparedBase, run));
    new ExpeditionApp(root, DEFAULT_HERO_IDS, () => { showBase(); }, { initialRun: run, onFinish: finished => persist(returnExpedition(preparedBase, finished)) });
}, { party: preparedBase.party, onBack: showBase });
new TitleScreen(root, showBase);
