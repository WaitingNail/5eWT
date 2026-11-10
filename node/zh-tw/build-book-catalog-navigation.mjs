import fs from "node:fs";

const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const navPath = "data/generated/gendata-nav-adventure-book-index.json";
const nav = read(navPath);
const catalog = Object.fromEntries(["book", "adventure"].map(kind => [
	kind, read(`data/zh-TW/book-catalog/${kind}s.json`)[kind],
]));
const parentNames = {
	WoW: "D&D：魔獸世界",
	TftYP: "哈欠傳送門故事集",
	ESK: "基礎套組",
	AitFR: "被遺忘國度的冒險",
	NRH: "NERDS 恢復和諧",
	SAiS: "魔法船：星海冒險",
	PAitM: "異度風景：多元宇宙冒險",
	DrDe: "巨龍迷城",
};

for (const [kind, entries] of Object.entries(nav)) {
	for (const entry of entries) {
		const localized = catalog[kind][entry.id];
		if (!localized?.name) throw new Error(`Missing ${kind} catalog label: ${entry.id}`);
		entry.displayName = localized.name;
		if (!entry.parentSource) continue;
		entry.displayParentName = parentNames[entry.parentSource] ?? catalog.book[entry.parentSource]?.name;
		if (!entry.displayParentName) throw new Error(`Missing catalog collection label: ${entry.parentSource}`);
	}
}

fs.writeFileSync("data/zh-TW/book-catalog/navigation.json", JSON.stringify(nav));
