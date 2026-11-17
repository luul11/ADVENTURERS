# 项目说明

## 模块路径
- `src/main.ts`：入口串联封面、基地、选人和副本。
- `src/ui/TitleScreen.ts` / `src/ui/TitleScreen.css`：独立游戏封面。名称冒险者们，版本V0.3，制作人伊玛目的门徒。
- `src/ui/BaseApp.ts`：基地入口，复用原管理与保存规则。
- `src/ui/BaseScene.ts` / `src/ui/BaseScene.css`：写实驻地、建筑热点、手机全景与功能底栏。
- `src/battle/raiderArt.ts`：12种人类外观，含8名女子；实例appearance随收服保存。
- `src/battle/monsterRoster.ts`：8种哥布林/兽人身份及种族、Boss级别校验。
- `image/base/` / `public/assets/mercenary_base.webp`：基地原图与运行底图。
- `image/roster_raiders/` / `image/roster_monsters/` / `image/roster_bandit_women/`：100张新动作PNG、运行WebP、源图与清单。
- `tools/prepare_mercenary_assets.py` / `tools/prepare_monster_rosters.py` / `tools/prepare_bandit_women.py`：新素材处理，复用roster_grid.py按真实留白切行；重生成传--overwrite。
- `tools/test-mercenary-assets.cjs` / `tools/test-mercenary-base-ui.cjs`：新身份、基地和怪物演出定向验证。
- `tools/test-bandit-camp.cjs` / `tools/test-bandit-camp-ui.cjs`：固定Lv5女匪副本、素材、收服带回验证。
- `docx/写实基地与敌人素材接入.md`：本轮合并规则与素材限制。
- `src/battle/base.ts`：基地配置、打包、出发扣除、安全带回、扩容、精华培养和schema 2本地存档。
- `src/battle/storage.ts`：24/32/40/48格随队容量、10件堆叠、原子搬运。
- `src/ui/StockTransfer.ts`：搜刮与出发打包共用双栏搬运。
- `src/ui/Inventory.css` / `src/ui/itemPresentation.ts`：紧凑物品格、选中详情与统一图标。
- `docx/搜刮物资库与基地培养.md`：2026-11-13现行物资、技能掌握、培养及旧档废弃规则。
- `tools/test-logistics.cjs` / `tools/test-logistics-ui.cjs`：容量、搬运、养成、旧档清除与手机交互验收。
- `src/ui/GameTips.ts`：基地、副本与战斗共用的简要玩法说明。
- `src/ui/ExpeditionApp.ts` / `src/ui/ExpeditionApp.css`：副本路线、独立事件、商店、小队摘要、装备物资弹窗与战斗生命周期。
- `src/battle/expedition.ts`：副本路线、配置事件、低概率人类、团队物资、搜刮、复活与超员整理。
- `src/ui/BattleApp.ts`：页面布局、交互绑定、弹窗、行动栏与四种团队道具暂停使用与复活确认快捷栏。
- `src/ui/CharacterDetails.ts`：独立人物详情展示，不包含装备编辑控件。
- `src/ui/EquipmentInventory.ts`：可复用拖拽背包，支持点选、键盘、update和dispose。
- `src/battle/loot.ts`：被击败敌人的精华/杂物、人类全部携带物品、Boss高质量战利品。
- `src/battle/data/human-encounters.json`：人类1至5人人数登记，不含固定等级；等级入场自适应。
- `src/battle/dungeonConfig.ts` / `src/battle/encounters.ts`：副本JSON校验、编队抽取和自适应人类生成。
- `src/battle/inventory.ts`：纯物品移动规则，检查法宝行囊、槽位、裸属性门槛和只读状态。
- `src/ui/RosterSelection.ts`：开局十选五，确认后进入副本路线，进入战斗节点才创建战场。
- `src/battle/roster.ts`：十名角色的名字、性别、固定种子、技能与初始装备。
- `public/style.css`：界面样式、自适应布局和减少动态效果设置。
- `src/game/main.ts`：Phaser 启动和手动视口缩放配置。
- `src/game/scenes/Game.ts`：Phaser 棋盘、角色、动画和视角控制。
- `src/battle/engine.ts`：战斗规则。仅改界面时不要改此文件。
- `src/battle/progression.ts`：种族初始修正、45个人物特性与互斥、成长、武器护甲法宝、3至6格行囊、团队消耗品/精华/杂物、物品预算和战力。
- `src/battle/characterArt.ts`：角色素材映射。
- `image/roster_heroes/`：十名伙伴的50张256×256姿态图，另有精灵预留与哥布林首领各5张；原清单与companions_manifest.json分开维护。
- `tools/prepare_companion_roster.py`：card_roster_5x4_four_heroes.png四行新图裁切，重复生成须传--overwrite。
- `tools/test-companions.cjs` / `tools/test-companions-ui.cjs`：新伙伴面板、20张姿态图、AOE演出与独立对象/释放验收。
- `tools/prepare_hero_rosters.py`：本批角色图标准化，保留原图；重复生成需传--overwrite。
- `battle_map_bg.png`：场景源图。`public/assets/battle_map_bg.webp` 是运行时压缩图。
- `image/adventurers_cover.png`：生成封面原图。`public/assets/adventurers_cover.webp` 是运行时压缩图。
- `vite/`：开发和生产配置。`tools/`：素材处理脚本。
- `tools/test-battle.cjs`：原战斗规则、五人阵容和特性分布回归。`tools/test-expedition.cjs`：副本与20人规则、完整流程回归。
- `tools/test-base-items.cjs`：基地配置、资源满值拒绝与护甲修理规则。`tools/test-base-ui.cjs`：基地入口、配置带入、TIPS与消费提示浏览器验收。
- `tools/test-team-inventory.cjs` / `tools/test-human-encounters.cjs`：共享物资、搜刮、人类等级与投放概率、复活队列。
- `tools/test-team-inventory-ui.cjs`：四种全局道具、复活确认、搜刮和高危人类浏览器验收。
- `tools/test-quick-items-ui.cjs`：旧入口，转发四种团队道具完整验收。
- `tools/test-route-ui.cjs`：紧凑路线布局、装备弹窗、节点真实点击与焦点验收。
- `tools/test-expedition-ui.cjs`：副本与战斗Chrome验收。`tools/test-battle-ui.cjs`转发到当前验收入口。
- `docx/战斗数值与种族特性装备专项.md`：已确认战斗规则、物品和特性完整表、默认部署面板。
- `docx/角色预设与开局选人.md`：十人完整预设、素材处理规则和初始化面板。
- `docx/副本远征与队伍扩展.md`：当前副本规则、公式、经济、接口与边界。
- `docx/团队物资战利品与人类遭遇.md`：本轮个人/团队边界、复活、掉落、概率和验收规则。
- `docx/装备背包交互.md`：背包交互、组件接口和当前物资库边界。

## 工作方式
如果项目存在知识图谱 (graphify-out/graph.json)，在回答代码库相关问题时：
1. 先查询图谱获取结构和关系
2. 只在需要具体实现细节时才去读源文件
3. 这样可以大幅减少 token 消耗，回答也更准确
先读 `HANDOFF.md` 的归档状态。已完成的需求不要自动重新开发；收到新需求后再执行。优先用已有 `graphify-out/graph.json` 定位，再核对当前源码。图谱已纳入旧副本、选人、背包和封面。基地场景、新人类/怪物身份、女匪副本及前轮新机制尚未更新图谱，以本页模块说明、HANDOFF.md和源码为准。图谱用于定位，具体规则与行号仍须核对当前源码。不要为简单定位重建全图。
搜索默认只查相关模块。跳过 `node_modules`、`dist` 和浏览器测试缓存。
模块化新增角色或副本时，按用户偏好只做定向验证，不默认完整回归。界面修改后运行 `npm.cmd run typecheck` 和 `npm.cmd run build-nolog`。同时检查手机和桌面布局。
