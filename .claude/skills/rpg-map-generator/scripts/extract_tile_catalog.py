#!/usr/bin/env python3
"""Tile Catalog 萃取器

掃描 src/pages/RpgRoom/data/*.json 的 styles，依名稱分組彙整 (b, x, y, w, h)
唯一組合，並交叉比對同名 isMove 碰撞區尺寸作為碰撞建議，
產出/更新 references/tile-catalog/usage-stats.md 的「自動萃取」區段。

用法：python3 .claude/skills/rpg-map-generator/scripts/extract_tile_catalog.py
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = ROOT / 'src/pages/RpgRoom/data'
OUT = Path(__file__).resolve().parents[1] / 'references/tile-catalog/usage-stats.md'

SHEET_NAMES = {0: 'man', 1: 'xp', 2: 'xp2'}

AUTO_BEGIN = '<!-- AUTO-EXTRACT:BEGIN -->'
AUTO_END = '<!-- AUTO-EXTRACT:END -->'

def main():
    # name -> {(b,x,y,w,h) -> {'count': n, 'maps': set, 'z2': bool}}
    catalog = defaultdict(lambda: defaultdict(lambda: {'count': 0, 'maps': set(), 'z2': False}))
    # name -> set of collision (w,h) observed
    collisions = defaultdict(set)

    for f in sorted(DATA_DIR.glob('[0-9]*_map.json')):
        data = json.loads(f.read_text())
        map_idx = data['map']['index']
        for t in data.get('styles', []):
            name = t.get('n') or '(未命名)'
            key = (t.get('b', 0), t.get('x', 0), t.get('y', 0), t.get('w', 32), t.get('h', 32))
            entry = catalog[name][key]
            entry['count'] += 1
            entry['maps'].add(map_idx)
            if t.get('z') == 2:
                entry['z2'] = True
        for c in data.get('isMove', []):
            name = c.get('n')
            if name and c.get('w', 0) > 0 and c.get('h', 0) > 0 \
               and c.get('cm') is None and c.get('e') is None:
                collisions[name].add((c['w'], c['h']))

    lines = [
        AUTO_BEGIN,
        '',
        f'> 由 `scripts/extract_tile_catalog.py` 自動萃取自現有 {len(list(DATA_DIR.glob("[0-9]*_map.json")))} 張地圖。',
        '> 同名貼圖的多種來源組合各列一行（同一物件可能由多個 tile 拼成）。',
        '',
        '| 名稱 | 圖庫(b) | 來源 x,y | 尺寸 w,h | 層 | 使用次數 | 出現地圖 | 同名碰撞尺寸(參考) |',
        '|---|---|---|---|---|---|---|---|',
    ]
    for name in sorted(catalog.keys()):
        variants = catalog[name]
        col_hint = ', '.join(f'{w}×{h}' for w, h in sorted(collisions.get(name, []))) or '—'
        first = True
        for (b, x, y, w, h), info in sorted(variants.items()):
            layer = 'fg(z=2)' if info['z2'] else 'bg'
            maps_str = ','.join(str(m) for m in sorted(info['maps']))
            lines.append(
                f"| {name if first else '〃'} | {b} ({SHEET_NAMES.get(b, '?')}) "
                f"| {x},{y} | {w},{h} | {layer} | {info['count']} | {maps_str} "
                f"| {col_hint if first else '〃'} |"
            )
            first = False
    lines += ['', AUTO_END]
    auto_block = '\n'.join(lines)

    if OUT.exists():
        text = OUT.read_text()
        if AUTO_BEGIN in text and AUTO_END in text:
            text = re.sub(
                re.escape(AUTO_BEGIN) + r'.*?' + re.escape(AUTO_END),
                auto_block, text, flags=re.S,
            )
        else:
            text += '\n' + auto_block + '\n'
    else:
        text = '# Tile Catalog（貼圖目錄）\n\n' + auto_block + '\n'

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    total = sum(len(v) for v in catalog.values())
    print(f'寫入 {OUT.relative_to(ROOT)}：{len(catalog)} 個名稱、{total} 種貼圖組合')

if __name__ == '__main__':
    main()
