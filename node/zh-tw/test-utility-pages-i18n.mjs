import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const source=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/zh-tw/site-i18n-data.js");
await import("../../js/zh-tw/site-i18n.js");
await import("../../js/zh-tw/content-i18n.js");
await import("../../js/zh-tw/utility-ui-data.js");
await import("../../js/zh-tw/utility-pages-i18n.js");
await import("../../js/render.js");
await import("../../js/render-dice.js");
globalThis.VetoolsConfig={get:()=>"classic"};
globalThis.PrereleaseUtil={hasSourceJson:()=>false,sourceJsonToStylePart:()=>"",getBrewProcessedFromCache:()=>[]};
globalThis.BrewUtil2={hasSourceJson:()=>false,sourceJsonToStylePart:()=>"",getBrewProcessedFromCache:()=>[]};
globalThis.ExcludeUtil={isExcluded:()=>false};
globalThis.DataLoader={getAllFromCacheAll:()=>[]};
const calls=[];
globalThis.fetch=async url=>{calls.push(url);return {ok:true,status:200,json:async()=>read(url)};};
// Replace transport only. Keep the real public loadJSON, property-specific
// object/deck loaders, table aggregator, generators, and Renderer code.
DataUtil._loadJson=async url=>read(url);
const I=I18nZhTwUtilities;
const loaded={};
for(const file of I.FILES)loaded[file]=await DataUtil.loadJSON(`data/${file}`);

test("the public data loader localizes every requested utility data file",async()=>{
	for(const[file,data]of Object.entries(loaded)){
		const raw=read(`data/${file}`);
		for(const[prop,values]of Object.entries(raw)){
			if(!Array.isArray(values))continue;
			assert.equal(data[prop].length,values.length,`${file}/${prop}`);
			values.forEach((ent,i)=>{if(!ent?.name)return;assert.equal(data[prop][i].name,ent.name);assert.equal(data[prop][i].source,ent.source);assert.match(data[prop][i]._displayName||"",/\p{Script=Han}/u,`${file}/${prop}/${i} missing name`);});
		}
		assert.ok(calls.includes(`data/zh-TW/utility-pages/${file}`),`${file} sidecar not actually requested`);
	}
	assert.equal((await DataUtil.object.loadJSON()).object.length,37);
	const tables=await DataUtil.table.loadJSON();
	assert.equal(tables.table.length,2339);
	assert.equal(tables.tableGroup.length,22);
	const decks=await DataUtil.deck.loadRawJSON();
	assert.equal(decks.deck.length,35);
	assert.equal(decks.card.length,765);
});

test("canonical identifiers, references, numeric metadata, and runtime metadata survive",async()=>{
	const guarded=new Set(["name","source","page","id","uid","type","set","suit","item","fromGroup","fromGeneric","fromItems","cards","tier","dpr","ac","hp","cr","roll","diceExpression","min","max","reprintedAs","href"]);
	function check(raw,zh,ctx){
		if(Array.isArray(raw)){assert.equal(raw.length,zh.length,ctx);raw.forEach((x,i)=>check(x,zh[i],`${ctx}/${i}`));return;}
		if(!raw||typeof raw!=="object")return;
		for(const[k,v]of Object.entries(raw)){
			if((guarded.has(k)&&!(k==="name"&&Array.isArray(v)))||typeof v==="number"||typeof v==="boolean")assert.deepEqual(zh[k],v,`${ctx}/${k}`);
			else if(v&&typeof v==="object")check(v,zh[k],`${ctx}/${k}`);
		}
	}
	for(const[f,v]of Object.entries(loaded))check(read(`data/${f}`),v,f);
	const raw=read("data/loot.json");raw.gems[0].__prop="gems";
	const snapshot=structuredClone(raw);
	const localized=await I.pApplyDataFile({url:"data/loot.json",data:raw});
	assert.equal(localized.gems[0].__prop,"gems");assert.deepEqual(raw,snapshot);
	localized.gems[0].table.push("mutated");assert.notDeepEqual(localized.gems[0],(await DataUtil.loadJSON("data/loot.json")).gems[0]);
});

test("all traps, objects, cards, and standalone tables render translated content",()=>{
	for(const prop of ["trap","hazard"]){for(const ent of loaded["trapshazards.json"][prop]){
		ent.__prop=prop;
		const html=Renderer.traphazard.getCompactRenderedString(ent);
		assert.ok(html.includes(ent._displayName),ent.name);
		assert.match(html,/\p{Script=Han}/u,ent.name);
	}}
	for(const ent of loaded["objects.json"].object)assert.match(Renderer.object.getRenderedString(ent),/\p{Script=Han}/u,ent.name);
	for(const ent of loaded["decks.json"].card){const html=Renderer.get().render({entries:Renderer.card.getFullEntries(ent)});assert.equal(typeof html,"string",ent.name);}
	for(const file of ["tables.json","generated/gendata-tables.json"])for(const ent of loaded[file].table){assert.equal(typeof Renderer.get().render(ent),"string",ent.name);}
	const weather=loaded["generated/gendata-tables.json"].table.find(x=>x.name==="Weather"&&x.source==="XDMG");
	assert.deepEqual(weather.rows.map(x=>x[0]),["1–14","15–17","18–20"]);
	assert.equal(weather.colLabels.length,4);
});

test("names and encounters use bilingual group and option titles without changing hashes",()=>{
	for(const[file,prop,renderer]of [["names.json","name",Renderer.names],["encounters.json","encounter",Renderer.encounters]])for(const group of loaded[file][prop])for(const table of group.tables){
		const ent={...group,...table};delete ent.tables;
		const hashBefore=UrlUtil.URL_TO_HASH_BUILDER[file==="names.json"?"names.html":"encountergen.html"](ent);
		const title=renderer.getDisplayName(ent);
		assert.match(title,/\p{Script=Han}/u);
		assert.equal(typeof renderer.getRenderedString(ent),"string");
		assert.equal(UrlUtil.URL_TO_HASH_BUILDER[file==="names.json"?"names.html":"encountergen.html"](ent),hashBefore);
	}
});

test("source QA has no unresolved number, dice, canonical tag, or shape defects",()=>{
	const report=read("translation/zh-TW/utility-pages/generated/import-report.json");
	for(const key of ["tagCanonicalDifferences","diceDifferences","arrayShapeMismatches","typeShapeMismatches"])assert.equal(report[key].length,0,key);
	assert.equal(report.numericReview.filter(x=>!x.review[0]).length,0);
	assert.deepEqual(report.untranslatedProseCandidates,[]);
	assert.ok(report.auditedVisibleStrings>80000);
});

test("special object statistics, trap duration, table columns, and audited prior omissions are translated",()=>{
	for(const ent of loaded["objects.json"].object){
		const html=Renderer.object.getRenderedString(ent);
		assert.doesNotMatch(html,/your artificer level|Varies \(see below\)/);
	}
	for(const ent of loaded["trapshazards.json"].trap.filter(x=>x.duration)){
		const html=Renderer.get().render({entries:Renderer.trap.getTrapRenderableEntriesMeta(ent).entriesHeader});
		assert.match(html,/持續時間（Duration）/);assert.doesNotMatch(html,/Instantaneous/);
	}
	for(const ent of loaded["generated/gendata-tables.json"].table)for(const label of ent.colLabels||[])assert.ok(!["Insult","Encounter","Attitude","Name","NPC"].includes(label),ent.name);
	const legends=read("data/zh-TW/bestiary/legendarygroups.json").legendaryGroup;
	for(const name of ["Arasta","Hythonia","Tromokratis"]){
		const ent=legends.find(x=>x.ENG_name===name&&x.source==="MOT");
		assert.match(JSON.stringify(ent.mythicEncounter),/\p{Script=Han}/u);
		assert.doesNotMatch(JSON.stringify(ent.mythicEncounter),/Fighting |mythic trait is active|equivalent to taking on/);
	}
	assert.doesNotMatch(source("data/zh-TW/craft-pages/fluff-homecrafts.json"),/Guarantee does not apply|Not recommended for use/);
	assert.doesNotMatch(source("data/zh-TW/character-options/optionalfeatures.json"),/Warlock Cantrip That Deals Damage/);
	for(const s of ["js/lifegen.js","js/crcalculator.js","js/statgen/statgen-ui.js","js/lootgen/lootgen-output.js"])assert.match(source(s),/\p{Script=Han}/u,s);
});

test("life generator runs every random-table branch with canonical species and gender choices",async()=>{
	globalThis.window={addEventListener:()=>{}};
	vm.runInThisContext(source("js/utils-generate.js"),{filename:"js/utils-generate.js"});
	const names=[...source("js/lifegen.js").matchAll(/^const ([A-Z_]+) = \[/gm)].map(x=>x[1]);
	vm.runInThisContext(`${source("js/lifegen.js")}\nnameTables={}; trinketList=${JSON.stringify(loaded["life.json"].lifeTrinket)}; globalThis.__lifeTest={getPersonDetails,fmtChoice,absentParent,singleParentOrStep,${names.join(",")}};`,{filename:"js/lifegen.js"});
	assert.equal(__lifeTest.BIRTHPLACES[0].result,"家中");
	assert.ok(__lifeTest.RACES_UNSELECTABLE.includes("Halfling"));
	assert.equal(I.t("Halfling"),"半身人");
	assert.equal(__lifeTest.SUPP_RACE[0].result,"Human");
	const remaining=[];
	for(const key of names.filter(x=>!x.startsWith("RACES_")))for(const entry of __lifeTest[key]){
		const result=vm.runInThisContext(`GenUtil.getFromTable(${key},${entry.min})`);
		if(result.pNextRoll)await result.pNextRoll;
		if(["SUPP_CLASS","SUPP_RACE"].includes(key))continue;
		const text=String(result.result||result.display||"").replace(/<[^>]+>/g,"").replace(/（[^）]*）/g,"");
		if(/\b[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}\b/.test(text))remaining.push({key,text});
	}
	assert.deepEqual(remaining,[]);
	for(const gender of ["Male","Female","Other"]){const details=await __lifeTest.getPersonDetails({gender,race:"Human",isParent:false});assert.match(details.join(""),/種族|性別/u);}
});

test("static tool shells include translated instructions, labels, and section headings",()=>{
	for(const page of ["lifegen.html","crcalculator.html"]){
		const html=source(page);
		assert.doesNotMatch(html,/Charisma Modifier|Based on the tables|NOTE: Text displayed|Enter expected CR|Fill in the HP|A creature's|A monster's|Waiting for calculation|Feature Description/);
	}
	assert.match(source("lifegen.html"),/雙親（Parents）/);
	assert.match(source("crcalculator.html"),/豁免<br>DC/);
});
