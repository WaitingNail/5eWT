#!/usr/bin/env python3
"""Refresh manual-correction expected-value guards from an uncorrected sidecar.

Run the importer with ``--skip-corrections`` first. This utility then records
the new baseline value at every correction JSON pointer, while leaving the
reviewed replacement and its reason unchanged.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SIDECAR_DIR = ROOT / "data" / "zh-TW" / "class"
CORRECTIONS_DIR = ROOT / "translation" / "zh-TW" / "classes" / "manual-corrections"


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser()
	parser.add_argument("--sidecar-dir", type=Path, default=DEFAULT_SIDECAR_DIR)
	return parser.parse_args()


def decode_pointer_part(value: str) -> str:
	return value.replace("~1", "/").replace("~0", "~")


def get_pointer(root, pointer: str):
	if not pointer.startswith("/"):
		raise ValueError(f"JSON pointer must start with '/': {pointer}")
	current = root
	for raw_part in pointer[1:].split("/"):
		part = decode_pointer_part(raw_part)
		current = current[int(part)] if isinstance(current, list) else current[part]
	return current


def main() -> None:
	args = parse_args()
	files_updated = 0
	guards_updated = 0
	for corrections_path in sorted(CORRECTIONS_DIR.glob("*.json")):
		sidecar_path = args.sidecar_dir / corrections_path.name
		if not sidecar_path.is_file():
			raise SystemExit(f"Missing uncorrected sidecar: {sidecar_path}")
		data = json.loads(sidecar_path.read_text(encoding="utf-8"))
		corrections = json.loads(corrections_path.read_text(encoding="utf-8"))
		changed = False
		for correction in corrections.get("corrections", []):
			baseline = get_pointer(data, correction["path"])
			if correction.get("expected") == baseline:
				continue
			correction["expected"] = baseline
			changed = True
			guards_updated += 1
		if not changed:
			continue
		corrections_path.write_text(
			json.dumps(corrections, ensure_ascii=False, indent="\t") + "\n",
			encoding="utf-8",
		)
		files_updated += 1
	print(json.dumps({"filesUpdated": files_updated, "guardsUpdated": guards_updated}, ensure_ascii=False))


if __name__ == "__main__":
	main()
