/** 回归中的玩家选择：只搬运装得下的物品，再明确结束搜刮。 */
module.exports=(x,run)=>{
 if(run.stage!=='loot')return run;
 for(const id of [...run.lastLoot.items]){try{run=x.moveLootItem(run,id,'loot',1);}catch(error){if(!error.message.includes('空间不足'))throw error;}}
 return x.collectLoot(run);
};
