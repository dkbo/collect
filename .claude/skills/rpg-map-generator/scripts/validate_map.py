#!/usr/bin/env python3
"""地圖 JSON 驗證器

用法：python3 validate_map.py <map.json 路徑> [更多路徑...]
省略參數時驗證 src/pages/RpgRoom/data/ 下全部地圖。

檢查：schema 完整性、邊界、32px 對齊（警告）、e/cm/cmm 邏輯、
出生點可行走、傳送雙向配對、NPC 活動範圍。
ERROR 即 exit code 1；WARN 不影響 exit code。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = ROOT / 'src/pages/RpgRoom/data'

SHEET_SIZES = {0: (128, 1344), 1: (256, 12000), 2: (256, 7000)}
PLAYER_W, PLAYER_H = 32, 48
TILE = 32

errors = []
warnings = []


def err(map_name, msg):
    errors.append(f'[{map_name}] ERROR: {msg}')


def warn(map_name, msg):
    warnings.append(f'[{map_name}] WARN: {msg}')


def aabb(x, y, w, h, r):
    return x + w >= r['x'] and x <= r['x'] + r['w'] and \
        y + h >= r['y'] and y <= r['y'] + r['h']


def load_all_maps():
    """以檔名排序載入全部地圖（索引 = 陣列位置，與 import.meta.glob 一致）"""
    maps = []
    for f in sorted(DATA_DIR.glob('[0-9]*_map.json')):
        try:
            maps.append((f, json.loads(f.read_text())))
        except json.JSONDecodeError as e:
            errors.append(f'[{f.name}] ERROR: JSON 解析失敗: {e}')
    return maps


def validate(file: Path, data: dict, all_maps: list):
    name = file.name

    # 1. schema 完整性
    m = data.get('map')
    if not isinstance(m, dict):
        err(name, '缺少 map 區塊')
        return
    for field in ('index', 'name', 'width', 'height', 'in'):
        if field not in m:
            err(name, f'map 缺少欄位 {field}')
    if not all(f in m for f in ('width', 'height', 'in', 'index')):
        return
    W, H = m['width'], m['height']
    if W % TILE or H % TILE:
        err(name, f'地圖尺寸 {W}×{H} 不是 32 的倍數')

    # 檔名編號 vs map.index vs 陣列位置
    file_idx = int(name.split('_')[0])
    if m['index'] != file_idx:
        err(name, f'map.index={m["index"]} 與檔名編號 {file_idx} 不一致')
    array_pos = next((i for i, (f, _) in enumerate(all_maps) if f == file), -1)
    if array_pos != -1 and array_pos != m['index']:
        err(name, f'map.index={m["index"]} 與載入順序位置 {array_pos} 不一致（編號必須連續）')

    styles = data.get('styles', [])
    is_move = [c for c in data.get('isMove', [])]
    npcs = data.get('npc') or []
    messages = data.get('messages') or []

    if not isinstance(styles, list) or not styles:
        warn(name, 'styles 為空')
    if 'messages' not in data:
        warn(name, '缺少 messages 欄位（沒有任何對話）')

    # 2. styles 邊界 / 對齊 / 圖庫
    for i, t in enumerate(styles):
        missing = [k for k in ('l', 't', 'w', 'h', 'b', 'x', 'y') if k not in t]
        if missing:
            err(name, f'styles[{i}] 缺少欄位 {missing}')
            continue
        if t['b'] not in SHEET_SIZES:
            err(name, f'styles[{i}] b={t["b"]} 不在 {{0,1,2}}')
            continue
        sw, sh = SHEET_SIZES[t['b']]
        if t['x'] < 0 or t['y'] < 0 or t['x'] + t['w'] > sw or t['y'] + t['h'] > sh:
            err(name, f'styles[{i}] 來源 ({t["x"]},{t["y"]},{t["w"]},{t["h"]}) 超出圖庫 b={t["b"]} ({sw}×{sh})')
        rx, ry = t.get('rx', 1), t.get('ry', 1)
        if rx < 1 or ry < 1:
            err(name, f'styles[{i}] rx/ry 必須 >= 1')
        total_w, total_h = t['w'] * rx, t['h'] * ry
        if t['l'] < 0 or t['t'] < 0 or t['l'] + total_w > W or t['t'] + total_h > H:
            # 超出地圖的貼圖會被 canvas 裁切（既有地圖邊緣樹木即如此），僅警告
            warn(name, f'styles[{i}] ({t["l"]},{t["t"]}) + {total_w}×{total_h} 超出地圖 {W}×{H}（會被裁切）')
        if t['l'] % TILE or t['t'] % TILE:
            warn(name, f'styles[{i}] 位置 ({t["l"]},{t["t"]}) 未對齊 32px')
        z = t.get('z')
        if z is not None and z != 2:
            warn(name, f'styles[{i}] z={z}（只有 2 = 前景有意義）')

    # 3. isMove 邊界 / 邏輯
    blockers = []  # 不含傳送區的阻擋區
    for i, c in enumerate(is_move):
        missing = [k for k in ('x', 'y', 'w', 'h') if k not in c]
        if missing:
            err(name, f'isMove[{i}] 缺少欄位 {missing}')
            continue
        if c['w'] <= 0 or c['h'] <= 0:
            err(name, f'isMove[{i}] 尺寸 {c["w"]}×{c["h"]} 無效（w/h 必須 > 0）')
        if c['x'] < 0 or c['y'] < 0 or c['x'] + c['w'] > W or c['y'] + c['h'] > H:
            warn(name, f'isMove[{i}] ({c["x"]},{c["y"]},{c["w"]},{c["h"]}) 超出地圖 {W}×{H}')
        has_cm = c.get('cm') is not None
        has_cmm = c.get('cmm') is not None
        if has_cm != has_cmm:
            err(name, f'isMove[{i}] cm/cmm 必須成對出現')
        if has_cm and has_cmm:
            cm, cmm = c['cm'], c['cmm']
            if cm < 0 or cm >= len(all_maps):
                err(name, f'isMove[{i}] cm={cm} 指向不存在的地圖（共 {len(all_maps)} 張）')
            else:
                target = all_maps[cm][1]
                t_in = target.get('map', {}).get('in', [])
                if cmm < 0 or cmm >= len(t_in):
                    err(name, f'isMove[{i}] cmm={cmm} 在地圖 {cm} 的 in[]（長度 {len(t_in)}）不存在')
                # 雙向配對：目標地圖要有回來的傳送區
                back = [b for b in target.get('isMove', []) if b.get('cm') == m['index']]
                if not back:
                    warn(name, f'isMove[{i}] 傳送到地圖 {cm}，但該地圖沒有回到本圖的傳送區')
        else:
            blockers.append(c)
        e = c.get('e')
        if e is not None and (e < 0 or e >= len(messages)):
            err(name, f'isMove[{i}] e={e} 沒有對應 messages（長度 {len(messages)}）')

    # 4. NPC
    for i, n in enumerate(npcs):
        for k in ('b', 'pX', 'pY', 'w', 'h', 'e', 'type', 'd'):
            if k not in n:
                err(name, f'npc[{i}] 缺少欄位 {k}')
        if not all(k in n for k in ('pX', 'pY', 'w', 'h')):
            continue
        if n['pX'] < 0 or n['pY'] < 0 or n['pX'] + n['w'] > W or n['pY'] + n['h'] > H:
            err(name, f'npc[{i}] 位置超出地圖')
        e = n.get('e', -1)
        if e < 0 or e >= len(messages):
            warn(name, f'npc[{i}] e={e} 沒有對應 messages（NPC 將不會顯示）')
        if n.get('type') == 4:
            area = {'x': n.get('aX', 0), 'y': n.get('aY', 0), 'w': n.get('aW', 0), 'h': n.get('aH', 0)}
            for j, c in enumerate(blockers):
                if aabb(area['x'], area['y'], area['w'], area['h'], c):
                    warn(name, f'npc[{i}] 行走範圍與碰撞區 isMove[{j}]({c.get("n", "?")}) 重疊')
                    break
        if n.get('pX', 0) % TILE or n.get('pY', 0) % TILE:
            warn(name, f'npc[{i}] 位置 ({n.get("pX")},{n.get("pY")}) 未對齊 32px')

    # 5. 出生點
    for i, p in enumerate(m.get('in', [])):
        if p['x'] < 0 or p['y'] < 0 or p['x'] + PLAYER_W > W or p['y'] + PLAYER_H > H:
            err(name, f'in[{i}] ({p["x"]},{p["y"]}) 超出地圖（角色佔 32×48）')
            continue
        hit = next((c for c in blockers if aabb(p['x'], p['y'], PLAYER_W, PLAYER_H, c)), None)
        if hit:
            err(name, f'in[{i}] ({p["x"]},{p["y"]}) 與碰撞區 ({hit.get("n", "?")} {hit["x"]},{hit["y"]}) 相交，出生即卡死')
        hit_npc = next((n for n in npcs if all(k in n for k in ('pX', 'pY', 'w', 'h')) and
                        aabb(p['x'], p['y'], PLAYER_W, PLAYER_H,
                             {'x': n['pX'], 'y': n['pY'], 'w': n['w'], 'h': n['h']})), None)
        if hit_npc:
            err(name, f'in[{i}] 與 NPC 位置相交')
    if not m.get('in'):
        warn(name, 'in[] 為空，其他地圖無法傳送進來')

    # 6. 邊界封閉：四邊必須有碰撞或傳送覆蓋（簡化檢查）
    portals = [c for c in is_move if c.get('cm') is not None]
    edges = {
        '上': lambda c: c['y'] <= TILE,
        '下': lambda c: c['y'] + c['h'] >= H - TILE,
        '左': lambda c: c['x'] <= TILE,
        '右': lambda c: c['x'] + c['w'] >= W - TILE,
    }
    for label, pred in edges.items():
        if not any(pred(c) for c in blockers + portals if all(k in c for k in ('x', 'y', 'w', 'h'))):
            warn(name, f'{label}邊界附近沒有任何碰撞/傳送區，玩家可能沿邊走出場景')

    # 7. messages
    for i, msg in enumerate(messages):
        if not msg.get('name'):
            err(name, f'messages[{i}] 缺少 name')
        texts = msg.get('text')
        if not isinstance(texts, list) or not texts:
            err(name, f'messages[{i}] text 必須是非空字串陣列')
        used = any(c.get('e') == i for c in is_move) or any(n.get('e') == i for n in npcs)
        if not used:
            warn(name, f'messages[{i}]（{msg.get("name")}）沒有任何 isMove/npc 引用')


def main():
    all_maps = load_all_maps()
    if len(sys.argv) > 1:
        targets = [Path(a).resolve() for a in sys.argv[1:]]
    else:
        targets = [f for f, _ in all_maps]
    for target in targets:
        match = next(((f, d) for f, d in all_maps if f == target), None)
        if not match:
            try:
                match = (target, json.loads(target.read_text()))
            except (OSError, json.JSONDecodeError) as e:
                errors.append(f'[{target.name}] ERROR: 無法讀取: {e}')
                continue
        validate(match[0], match[1], all_maps)

    for w in warnings:
        print(w)
    for e in errors:
        print(e)
    print(f'--- {len(errors)} error(s), {len(warnings)} warning(s) ---')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
