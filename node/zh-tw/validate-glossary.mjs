import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const glossaryPath = process.argv[2]
	? path.resolve(process.cwd(), process.argv[2])
	: path.join(ROOT_DIR, "translation", "zh-TW", "glossary-proposed.csv");

function parseCsv (text) {
	const rows = [];
	let row = [];
	let field = "";
	let isQuoted = false;
	for (let i = 0; i < text.length; ++i) {
		const char = text[i];
		if (isQuoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				++i;
				continue;
			}
			if (char === '"') {
				isQuoted = false;
				continue;
			}
			field += char;
			continue;
		}
		if (char === '"') {
			isQuoted = true;
			continue;
		}
		if (char === ",") {
			row.push(field);
			field = "";
			continue;
		}
		if (char === "\n") {
			row.push(field.replace(/\r$/, ""));
			if (row.some(Boolean)) rows.push(row);
			row = [];
			field = "";
			continue;
		}
		field += char;
	}
	if (isQuoted) throw new Error("Unterminated quoted CSV field.");
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

const requiredHeaders = [
	"english", "category", "proposed_zh_tw", "alternative_zh_tw", "status", "source", "notes",
];
const rows = parseCsv(fs.readFileSync(glossaryPath, "utf8"));
const [headers, ...dataRows] = rows;
const errors = [];

if (!headers) errors.push("Glossary is empty.");
for (const header of requiredHeaders) {
	if (!headers?.includes(header)) errors.push(`Missing required column: ${header}`);
}

const headerLookup = Object.fromEntries((headers || []).map((header, ix) => [header, ix]));
const seenEnglish = new Map();
const allowedStatuses = new Set(["proposed", "approved", "conflict", "pending"]);
const simplifiedOnlyCharacters = /[这发后里为于个种术龙门书见东丝两严丧丰临举义乌乐习乡买乱争亏云亚产亩亲亿仅从仓仪们价众优会伞伟传伤伦伪体余佣侠侣侥侦侧侨侩侮俩债倾偿储儿兑党兰关兴养兽冈册写军农冯冲决况冻净凉减几凤凭凯击凿刍划刘则刚创删别刬剂剑剧劝办务动励劲劳势勋区医华协单卖卢卫却厂厅历厉压厌县叁参双变叙叶号叹吓听启吴呐呕员呛呜咏咙哑响哟唤啧喷嘱噜团园围国图圆圣场坏块坚坛坝坞坟坠垄垒垫垦执]/u;

dataRows.forEach((row, rowIx) => {
	const line = rowIx + 2;
	if (row.length !== headers.length) errors.push(`Line ${line}: expected ${headers.length} columns, found ${row.length}.`);
	const english = row[headerLookup.english]?.trim();
	const zhTw = row[headerLookup.proposed_zh_tw]?.trim();
	const status = row[headerLookup.status]?.trim();
	if (!english) errors.push(`Line ${line}: English term is required.`);
	if (!zhTw) errors.push(`Line ${line}: proposed_zh_tw is required.`);
	if (!allowedStatuses.has(status)) errors.push(`Line ${line}: invalid status '${status}'.`);
	if (seenEnglish.has(english)) errors.push(`Line ${line}: duplicate English term '${english}' (first seen on line ${seenEnglish.get(english)}).`);
	else seenEnglish.set(english, line);
	if (/\p{Script=Han}/u.test(english)) errors.push(`Line ${line}: English source term unexpectedly contains Han characters.`);
	if (simplifiedOnlyCharacters.test(zhTw)) {
		errors.push(`Line ${line}: proposed_zh_tw may contain Simplified Chinese characters: '${zhTw}'.`);
	}
});

if (errors.length) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log(`Glossary OK: ${dataRows.length} terms, ${seenEnglish.size} unique English keys.`);
}
