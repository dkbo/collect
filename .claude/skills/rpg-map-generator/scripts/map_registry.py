#!/usr/bin/env python3
"""地圖註冊表：列出現有地圖、場景名→index 解析（rpg-map-generator / rpg-scene-image-to-json 共用防呆）

用法：
  python3 map_registry.py                # 表格列出全部地圖（index/名稱/尺寸/in[]/對外傳送）
  python3 map_registry.py --json         # JSON 輸出（程式取用）
  python3 map_registry.py --name 花草屋   # 場景名→index：印出 index；找不到 exit 1 並列出可用場景
  python3 map_registry.py --next-index   # 印出下一張新地圖的編號（現有最大 +1）

--name 解析規則：先精確比對，再唯一子字串比對；多筆符合視為模糊 → exit 1 列出候選。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = ROOT / 'src/pages/RpgRoom/data'


def load_maps():
    maps = []
    for f in sorted(DATA_DIR.glob('[0-9]*_map.json')):
        try:
            data = json.loads(f.read_text())
        except json.JSONDecodeError as e:
            print(f'[{f.name}] JSON 解析失敗: {e}', file=sys.stderr)
            sys.exit(1)
        m = data.get('map', {})
        portals = []
        for c in data.get('isMove', []):
            if c.get('cm') is not None:
                portals.append({'cm': c['cm'], 'cmm': c.get('cmm')})
        maps.append({
            'file': f.name,
            'index': m.get('index'),
            'name': m.get('name', '?'),
            'width': m.get('width'),
            'height': m.get('height'),
            'in': len(m.get('in', [])),
            'portals': portals,
        })
    return maps


def main():
    maps = load_maps()
    args = sys.argv[1:]

    if '--next-index' in args:
        print(max((m['index'] or 0) for m in maps) + 1 if maps else 0)
        return

    if '--name' in args:
        i = args.index('--name')
        if i + 1 >= len(args):
            print('用法: map_registry.py --name <場景名>', file=sys.stderr)
            sys.exit(1)
        query = args[i + 1]
        names = [m['name'] for m in maps]
        exact = [m for m in maps if m['name'] == query]
        if len(exact) == 1:
            print(exact[0]['index'])
            return
        partial = [m for m in maps if query in m['name']]
        if len(partial) == 1:
            print(partial[0]['index'])
            return
        if len(partial) > 1:
            print(f'場景名「{query}」有多筆符合：' +
                  '、'.join(f'{m["name"]}(index {m["index"]})' for m in partial), file=sys.stderr)
        else:
            print(f'找不到場景「{query}」。可用場景：' +
                  '、'.join(f'{n}(index {m["index"]})' for n, m in zip(names, maps)), file=sys.stderr)
        sys.exit(1)

    if '--json' in args:
        print(json.dumps(maps, ensure_ascii=False, indent=2))
        return

    # 表格輸出
    name_targets = {m['index']: m['name'] for m in maps}
    print(f'{"idx":>3}  {"名稱":<8} {"尺寸":<10} {"in[]":>4}  對外傳送')
    for m in maps:
        out = '、'.join(f'→{name_targets.get(p["cm"], "?")}({p["cm"]}/in[{p["cmm"]}])' for p in m['portals']) or '—'
        print(f'{m["index"]:>3}  {m["name"]:<8} {m["width"]}×{m["height"]:<6} {m["in"]:>4}  {out}')


if __name__ == '__main__':
    main()
