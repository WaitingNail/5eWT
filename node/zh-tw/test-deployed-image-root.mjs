import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const EXPECTED_IMAGE_ROOT = "https://raw.githubusercontent.com/WaitingNail/5eWT-img/main/";
const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CRAFT_FLUFF_FILES = [
	"data/fluff-vehicles.json",
	"data/fluff-recipes.json",
	"data/fluff-homecrafts.json",
];

const collectInternalImagePaths = (value, out = []) => {
	if (Array.isArray(value)) {
		value.forEach(it => collectInternalImagePaths(it, out));
		return out;
	}
	if (!value || typeof value !== "object") return out;
	if (value.type === "image" && value.href?.type === "internal" && value.href.path) out.push(value.href.path);
	Object.values(value).forEach(it => collectInternalImagePaths(it, out));
	return out;
};

test("deployment config points at the public WaitingNail image fork", () => {
	const source = fs.readFileSync(path.join(SITE_ROOT, "js/utils.js"), "utf8");
	const matches = [...source.matchAll(/globalThis\.DEPLOYED_IMG_ROOT\s*=\s*"([^"]+)";/g)];
	assert.equal(matches.length, 1);
	assert.equal(matches[0][1], EXPECTED_IMAGE_ROOT);
	assert.ok(!source.includes("globalThis.DEPLOYED_IMG_ROOT = undefined;"));
});

test("renderer resolves internal media through the configured image root", () => {
	const source = fs.readFileSync(path.join(SITE_ROOT, "js/render.js"), "utf8");
	assert.match(source, /this\.baseMediaUrls\["img"\]\s*=\s*globalThis\.DEPLOYED_IMG_ROOT/);
	assert.match(source, /return `\$\{Renderer\.get\(\)\.baseMediaUrls\[mediaDir\]\}\$\{path\}`/);
});

test("all craft-page image paths resolve to the image fork", () => {
	const paths = CRAFT_FLUFF_FILES.flatMap(file => collectInternalImagePaths(JSON.parse(fs.readFileSync(path.join(SITE_ROOT, file), "utf8"))));
	assert.equal(paths.length, 351);
	for (const imagePath of paths) {
		assert.ok(!imagePath.startsWith("/"), imagePath);
		assert.ok(!imagePath.includes(".."), imagePath);
		const url = new URL(imagePath, EXPECTED_IMAGE_ROOT);
		assert.equal(url.origin, "https://raw.githubusercontent.com");
		assert.ok(url.pathname.startsWith("/WaitingNail/5eWT-img/main/"), url.href);
	}
});
