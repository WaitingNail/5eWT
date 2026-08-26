import assert from "node:assert/strict";

import {I18nZhTwClass} from "../../js/zh-tw/class-i18n.js";

const localized = I18nZhTwClass.localizeSourceHtml(
	`PHB, page 1. Available in the <span title="Systems Reference Document (5.2)">SRD 5.2.1</span> and the Basic Rules (5.5e/2024). Reprinted as Wizard in PHB`,
);

assert.equal(
	localized,
	`PHB，第 1 頁. 收錄於 <span title="Systems Reference Document (5.2)">SRD 5.2.1</span>及《基礎規則》 (5.5e/2024). 再版為 Wizard，收錄於 PHB`,
);

assert.equal(
	I18nZhTwClass.localizeSourceHtml(`Available in the Basic Rules (5e/2014) (as &quot;Fighter&quot;)`),
	`收錄於 《基礎規則》 (5e/2014) （名稱為「Fighter」）`,
);

console.log("Class UI localization tests passed.");
