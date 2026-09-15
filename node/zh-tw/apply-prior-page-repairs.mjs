import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),"utf8"));
const write=(rel,data)=>fs.writeFileSync(path.join(root,rel),JSON.stringify(data,null,"\t")+"\n");
const mythic=read("translation/zh-TW/utility-pages/prior-page-repairs.json");
const file="data/zh-TW/bestiary/legendarygroups.json";
const legends=read(file);
for(const[name,entries]of Object.entries(mythic)){
	const matches=legends.legendaryGroup.filter(x=>x.ENG_name===name&&x.source==="MOT");
	if(matches.length!==1||matches[0].mythicEncounter.length!==4)throw new Error(`Unexpected mythic entry: ${name}`);
	matches[0].mythicEncounter=entries;
	if(name==="Arasta")matches[0].regionalEffects=JSON.parse(JSON.stringify(matches[0].regionalEffects).replaceAll("Arasta","阿拉斯塔").replaceAll("阿拉絲塔","阿拉斯塔"));
}
write(file,legends);
const craftFile="data/zh-TW/craft-pages/homecrafts.json";
const craft=read(craftFile);
const mantle=craft.crochetPattern.find(x=>x.ENG_name==="Mantle of Spell Resistance"&&x.source==="CaBoMP");
if(!mantle)throw new Error("Missing mantle");
mantle.instructions[1].entries[0].items[2].entries[0]="正面朝向自己，將毛線接在底角的狗牙針處。ch1，在同一針鉤 sc，沿斗篷側邊向上鉤 97sc，在轉角鉤 (3sc)，接著鉤 84sc，在轉角鉤 (3sc)，再沿另一側向下鉤 98sc（283）。";
write(craftFile,craft);
const fluffFile="data/zh-TW/craft-pages/fluff-homecrafts.json";
let fluff=fs.readFileSync(path.join(root,fluffFile),"utf8");
fluff=fluff.replace("Guarantee does not apply if soul coin coasters have been enchanted in any way. Not recommended for use under {@item potion of invisibility||隱形藥水}, for reasons that should be easy to see.","若靈魂幣杯墊受到任何形式的附魔，本保證即不適用。不建議將{@item potion of invisibility||隱形藥水}放在上面，理由想必顯而易見。");
fluff=fluff.replaceAll("{@creature pit fiend||小魔鬼}","{@creature pit fiend||深獄煉魔}");
write(fluffFile,JSON.parse(fluff));
const featsFile="data/zh-TW/character-options/feats.json";
const feats=read(featsFile);
for(const[name,source,text]of [
	["Potent Dragonmark","EFA","將你的龍紋專長所使用的施法屬性值提高 1，上限為 20。"],
	["Resilient","XPHB","選擇一項你尚未具有豁免熟練的屬性。將所選屬性值提高 1，上限為 20。"],
]){
	const feat=feats.feat.find(x=>x.ENG_name===name&&x.source===source);
	if(!feat?.ability?.[0]?.choose?.entry)throw new Error(`Missing feat: ${name}`);
	feat.ability[0].choose.entry=text;
}
write(featsFile,feats);
const optionalFile="data/zh-TW/character-options/optionalfeatures.json";
let optional=fs.readFileSync(path.join(root,optionalFile),"utf8");
optional=optional.replaceAll("a Warlock Cantrip That Deals Damage via an Attack Roll","以攻擊擲骰造成傷害的魔契師戲法").replaceAll("Warlock Cantrip That Deals Damage via an Attack Roll","以攻擊擲骰造成傷害的魔契師戲法").replaceAll("a Warlock Cantrip That Deals Damage","可造成傷害的魔契師戲法").replaceAll("Warlock Cantrip That Deals Damage","可造成傷害的魔契師戲法");
write(optionalFile,JSON.parse(optional));
console.log("Applied guarded repairs to mythic encounters, crochet instructions, footnotes, and prerequisites");
