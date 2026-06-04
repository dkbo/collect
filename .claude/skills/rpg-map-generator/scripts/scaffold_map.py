#!/usr/bin/env python3
"""地圖骨架產生器：把機械性內容（地板/牆/天花板外框/邊界碰撞/門口）腳本化，
AI 只負責後續的家具、NPC、細部遮罩與傳送配對。

用法：
  python3 scaffold_map.py --size 960x640 --type indoor --name 書房 \
      --doors S:448:64:房屋(2F) [--out /tmp/0005_map.json]

參數：
  --size WxH       地圖尺寸；非 32 倍數自動 snap 並提示
  --type indoor|outdoor
  --name <場景名>   map.name
  --doors <spec>   逗號分隔，每筆 EDGE:OFFSET[:WIDTH[:TARGET]]
                   EDGE = N/S/E/W；OFFSET = 沿該邊的像素位置（N/S 為 x、E/W 為 y，snap 32）
                   WIDTH 預設 64；TARGET = 目標地圖 index 或場景名（產 cm/cmm placeholder，
                   cmm 先指向 in[0]，之後要人工確認並在目標地圖補回程傳送）
  --out <路徑>     預設 /tmp/000N_map.json（N = 現有最大編號 +1）；
                   完成布置並通過全量驗證後才移入 src/pages/RpgRoom/data/

產出內容（indoor）：map 區塊、地板 rx/ry 鋪滿、上緣牆（視覺 64/碰撞 32）、
天花板外框 z=2（門口留開）、四邊界碰撞（門口留開）、門口傳送薄條、每門一個 in[] 落點。
outdoor：草地底圖（引擎自動）、邊界碰撞（門口留開）、門口傳送薄條與 in[]。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = ROOT / 'src/pages/RpgRoom/data'
TILE = 32

# 固定素材（來自 design-rules.md / examples/interior-room.json，皆 ✓ 等級）
FLOOR = {'b': 1, 'x': 64, 'y': 6528}      # 木地板 32×32
WALL = {'b': 2, 'x': 0, 'y': 64}          # 上緣牆 32×64
CEILING = {'b': 2, 'x': 32, 'y': 3424}    # 天花板(外框遮罩) 32×32


def die(msg):
    print(f'❌ {msg}', file=sys.stderr)
    sys.exit(1)


def snap(v):
    return max(0, round(v / TILE) * TILE)


def load_maps():
    maps = []
    for f in sorted(DATA_DIR.glob('[0-9]*_map.json')):
        maps.append((f, json.loads(f.read_text())))
    return maps


def resolve_target(token, maps):
    """index 或場景名 → index；找不到 die 並列出可用場景"""
    if token.isdigit():
        idx = int(token)
        if idx >= len(maps):
            die(f'目標地圖 index {idx} 不存在（共 {len(maps)} 張）')
        return idx
    matches = [d['map']['index'] for _, d in maps if d['map'].get('name') == token]
    if not matches:
        matches = [d['map']['index'] for _, d in maps if token in d['map'].get('name', '')]
    if len(matches) == 1:
        return matches[0]
    names = '、'.join(f"{d['map'].get('name')}(index {d['map']['index']})" for _, d in maps)
    die(f'目標場景「{token}」{"有多筆符合" if matches else "不存在"}。可用場景：{names}')


def parse_args(argv):
    opts = {'size': None, 'type': 'indoor', 'name': None, 'doors': '', 'out': None}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip('-')
        if key not in opts or i + 1 >= len(argv):
            die(f'未知參數或缺值：{argv[i]}（見檔頭用法）')
        opts[key] = argv[i + 1]
        i += 2
    if not opts['size'] or not opts['name']:
        die('--size 與 --name 必填')
    if opts['type'] not in ('indoor', 'outdoor'):
        die('--type 必須是 indoor 或 outdoor')
    return opts


def segments(full_start, full_end, gaps):
    """[start,end) 扣掉 gaps [(s,e),...] 後的連續段"""
    segs = []
    pos = full_start
    for gs, ge in sorted(gaps):
        if gs > pos:
            segs.append((pos, min(gs, full_end)))
        pos = max(pos, ge)
    if pos < full_end:
        segs.append((pos, full_end))
    return [(s, e) for s, e in segs if e > s]


def main():
    opts = parse_args(sys.argv[1:])
    maps = load_maps()
    next_index = max((d['map']['index'] for _, d in maps), default=-1) + 1

    try:
        w_raw, h_raw = (int(v) for v in opts['size'].lower().split('x'))
    except ValueError:
        die('--size 格式錯誤，例：960x640')
    W, H = max(snap(w_raw), TILE * 10), max(snap(h_raw), TILE * 10)
    if (W, H) != (w_raw, h_raw):
        print(f'⚠ 尺寸 {w_raw}x{h_raw} 已 snap 為 {W}x{H}（32 倍數、最小 320）')

    indoor = opts['type'] == 'indoor'

    # ── 門解析 ──
    doors = []
    for spec in filter(None, opts['doors'].split(',')):
        parts = spec.split(':')
        if len(parts) < 2 or parts[0].upper() not in 'NSEW' or len(parts[0]) != 1:
            die(f'門格式錯誤：{spec}（EDGE:OFFSET[:WIDTH[:TARGET]]，EDGE=N/S/E/W）')
        edge = parts[0].upper()
        off = snap(int(parts[1]))
        width = snap(int(parts[2])) if len(parts) > 2 and parts[2] else 64
        width = max(width, 64)  # 門開口最少 64
        target = resolve_target(parts[3], maps) if len(parts) > 3 and parts[3] else None
        limit = W if edge in 'NS' else H
        off = min(max(off, TILE), limit - TILE - width)  # 不貼角落
        doors.append({'edge': edge, 'off': off, 'w': width, 'target': target})

    gaps = {e: [(d['off'], d['off'] + d['w']) for d in doors if d['edge'] == e] for e in 'NSEW'}

    styles, is_move, ins = [], [], []

    if indoor:
        # 地板鋪滿室內（左右留 32 外框、上留 64 牆、下留 32 外框）
        styles.append({'n': '地板', 'l': TILE, 't': TILE * 2, 'w': TILE, 'h': TILE, **FLOOR,
                       'rx': (W - TILE * 2) // TILE, 'ry': (H - TILE * 3) // TILE})
        # 上緣牆（視覺 64 高），N 門留開口
        for s, e in segments(TILE, W - TILE, gaps['N']):
            styles.append({'n': '牆壁', 'l': s, 't': 0, 'w': TILE, 'h': TILE * 2, **WALL,
                           'rx': (e - s) // TILE})
        # 天花板外框 z=2：左右整柱（E/W 門留開）、下緣一排（S 門留開）
        for s, e in segments(0, H, gaps['W']):
            styles.append({'n': '天花板', 'l': 0, 't': s, 'w': TILE, 'h': TILE, **CEILING,
                           'ry': (e - s) // TILE, 'z': 2})
        for s, e in segments(0, H, gaps['E']):
            styles.append({'n': '天花板', 'l': W - TILE, 't': s, 'w': TILE, 'h': TILE, **CEILING,
                           'ry': (e - s) // TILE, 'z': 2})
        for s, e in segments(TILE, W - TILE, gaps['S']):
            styles.append({'n': '天花板', 'l': s, 't': H - TILE, 'w': TILE, 'h': TILE, **CEILING,
                           'rx': (e - s) // TILE, 'z': 2})

    # ── 邊界碰撞（門口留開）。indoor 上牆碰撞只佔視覺上半 32 ──
    edge_rects = {
        'N': lambda s, e: {'n': '上牆', 'x': s, 'y': 0, 'w': e - s, 'h': TILE},
        'S': lambda s, e: {'n': '下牆', 'x': s, 'y': H - TILE, 'w': e - s, 'h': TILE},
        'W': lambda s, e: {'n': '左牆', 'x': 0, 'y': s, 'w': TILE, 'h': e - s},
        'E': lambda s, e: {'n': '右牆', 'x': W - TILE, 'y': s, 'w': TILE, 'h': e - s},
    }
    spans = {'N': (0, W), 'S': (0, W), 'W': (TILE, H - TILE), 'E': (TILE, H - TILE)}
    for edge in 'NSWE':
        for s, e in segments(*spans[edge], gaps[edge]):
            is_move.append(edge_rects[edge](s, e))

    # ── 門口傳送薄條 + in[] 落點（每門一個，落在門內側、背對門）──
    for d in doors:
        edge, off, dw = d['edge'], d['off'], d['w']
        # 門正中央（不 snap 32：snap 會把落點推向門邊，與邊界碰撞段邊緣接觸 = 出生卡死）
        cx = off + (dw - TILE) // 2
        portal = {'N': {'x': off, 'y': 0, 'w': dw, 'h': 6},
                  'S': {'x': off, 'y': H - 6, 'w': dw, 'h': 6},
                  'W': {'x': 0, 'y': off, 'w': 6, 'h': dw},
                  'E': {'x': W - 6, 'y': off, 'w': 6, 'h': dw}}[edge]
        spawn = {'N': {'x': cx, 'y': TILE * 2},
                 'S': {'x': cx, 'y': H - TILE - 48},
                 'W': {'x': TILE, 'y': cx},
                 'E': {'x': W - TILE * 2, 'y': cx}}[edge]
        ins.append(spawn)
        if d['target'] is not None:
            is_move.append({'n': f'門口{edge}', **portal, 'cm': d['target'], 'cmm': 0})
        else:
            print(f'⚠ 門 {edge}:{off} 未指定目標地圖：邊界已留開口但沒有傳送區，'
                  f'之後必須補 cm/cmm（位置 {portal}）')

    out = Path(opts['out']) if opts['out'] else Path(f'/tmp/{next_index:04d}_map.json')
    data = {
        'map': {'index': next_index, 'name': opts['name'], 'width': W, 'height': H, 'in': ins},
        'styles': styles,
        'isMove': is_move,
        'npc': [],
        'messages': [],
    }
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    print(f'ok 骨架 -> {out}')
    print(f'  index={next_index} {W}x{H} {opts["type"]}｜styles {len(styles)}｜'
          f'isMove {len(is_move)}｜in[] {len(ins)}（每門一個，順序同 --doors）')
    print('  後續：1) 家具布置 2) NPC+messages 3) 細部遮罩 4) cmm 確認 + 目標地圖補回程傳送')
    print(f'  驗證：python3 {Path(__file__).parent}/validate_map.py --stage 1 {out}')


if __name__ == '__main__':
    main()
