class_name BoardView
extends Node2D

## 盤面渲染與操作：依 CandyBoard 狀態生成 CandyPiece、棋盤格背景與裝飾邊框；
## 處理點選交換與拖曳 swipe。56px 格、448×448 盤面以節點原點為中心，
## _layout() 依 viewport 尺寸動態置中縮放（手機直式也能滿版）。
## 狀態機 IDLE → SWAP →（Step 4 接 RESOLVE → FALL → CHECK），動畫中鎖輸入。

const CELL := 56.0
const BOARD_PX := CELL * CandyBoard.SIZE
const ORIGIN := Vector2(-BOARD_PX / 2.0, -BOARD_PX / 2.0)
const DESIGN_MIN := 540.0  # 設計基準：min(viewport 邊長) = 540 時 scale = 1
const SWAP_TIME := 0.15
const REMOVE_TIME := 0.2
const FALL_PER_CELL := 0.08
const SWIPE_THRESHOLD := 24.0  # 拖曳判定距離（px）

const CandyPieceScript := preload("res://scripts/candy_piece.gd")

enum State { IDLE, ANIM }

const NO_CELL := Vector2i(-1, -1)

var board: CandyBoard
var level_mgr := LevelManager.new()
var pieces := {}  # Vector2i -> CandyPiece
var _state := State.IDLE
var _paused := false
var _level_over := false
var _selected := NO_CELL
var _press_cell := NO_CELL  # 按下時的格子（swipe 起點）
var _press_pos := Vector2.ZERO
var _swiped := false  # 本次按壓已觸發 swipe，release 不再當點選


func _ready() -> void:
	CandyBridge.command_received.connect(_on_command)
	get_viewport().size_changed.connect(_layout)
	_layout()
	_start_level(1)


## 依 viewport 尺寸置中並等比縮放（stretch=expand 下直式螢幕 viewport 會拉長）。
func _layout() -> void:
	var vp := get_viewport_rect().size
	position = vp / 2.0
	scale = Vector2.ONE * (minf(vp.x, vp.y) / DESIGN_MIN)


func _start_level(n: int) -> void:
	level_mgr.start(n)
	board = CandyBoard.new(level_mgr.colors)
	_level_over = false
	_refresh_pieces()
	_post_state()
	_show_banner("Level %d" % level_mgr.level)


func _spawn_pieces() -> void:
	for y in CandyBoard.SIZE:
		for x in CandyBoard.SIZE:
			var p := Vector2i(x, y)
			var piece: CandyPiece = CandyPieceScript.new()
			piece.color_id = board.get_cell(p)
			piece.special = board.get_special(p)
			piece.position = cell_to_pos(p)
			add_child(piece)
			pieces[p] = piece


static func cell_to_pos(p: Vector2i) -> Vector2:
	return ORIGIN + (Vector2(p) + Vector2(0.5, 0.5)) * CELL


static func pos_to_cell(pos: Vector2) -> Vector2i:
	var cell := Vector2i(((pos - ORIGIN) / CELL).floor())
	return cell if CandyBoard.in_bounds(cell) else NO_CELL


# ---------- 輸入（觸控由 Godot 預設模擬為滑鼠事件） ----------

func _unhandled_input(event: InputEvent) -> void:
	if _state != State.IDLE or _paused or _level_over:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		var pos := get_local_mouse_position()
		if event.pressed:
			_press_cell = pos_to_cell(pos)
			_press_pos = pos
			_swiped = false
		else:
			if not _swiped:
				_on_click(pos_to_cell(pos))
			_press_cell = NO_CELL
	elif event is InputEventMouseMotion and _press_cell != NO_CELL and not _swiped:
		var delta := get_local_mouse_position() - _press_pos
		if delta.length() >= SWIPE_THRESHOLD:
			_swiped = true
			var dir := Vector2i(signi(roundi(delta.x)), 0) \
				if absf(delta.x) > absf(delta.y) else Vector2i(0, signi(roundi(delta.y)))
			_set_selected(NO_CELL)
			_try_swap(_press_cell, _press_cell + dir)


## 點選模式：第一下選中（呼吸高亮），第二下相鄰則交換、否則改選。
func _on_click(cell: Vector2i) -> void:
	if cell == NO_CELL:
		_set_selected(NO_CELL)
	elif _selected == NO_CELL:
		_set_selected(cell)
	elif cell == _selected:
		_set_selected(NO_CELL)
	elif CandyBoard.are_adjacent(_selected, cell):
		var from := _selected
		_set_selected(NO_CELL)
		_try_swap(from, cell)
	else:
		_set_selected(cell)


func _set_selected(cell: Vector2i) -> void:
	if _selected != NO_CELL and pieces.has(_selected):
		pieces[_selected].set_selected(false)
	_selected = cell
	if cell != NO_CELL:
		pieces[cell].set_selected(true)


# ---------- 交換 ----------

func _try_swap(a: Vector2i, b: Vector2i) -> void:
	if not (CandyBoard.in_bounds(a) and CandyBoard.in_bounds(b)) \
			or not CandyBoard.are_adjacent(a, b):
		return
	_state = State.ANIM
	CandySfx.play("swap")
	await _animate_swap(a, b)
	if board.is_special_swap(a, b) or board.would_swap_match(a, b):
		board.swap(a, b)
		var tmp: CandyPiece = pieces[a]
		pieces[a] = pieces[b]
		pieces[b] = tmp
		_swap_a = a
		_swap_b = b
		level_mgr.moves_left -= 1  # 僅有效交換扣步
		var initial := _special_swap_effect(a, b)
		await _resolve(initial["cells"], initial["triggered"])
		await _check_level_end()
		_state = State.IDLE
	else:
		CandySfx.play("invalid", 1.0, -6.0)
		await _animate_swap(a, b)  # 無消除 → 回彈
		_state = State.IDLE


## 結算落定後判定勝敗：達標即過關（剩步轉條紋糖結算）；步數用完未達標失敗。
func _check_level_end() -> void:
	if _level_over:
		return
	if level_mgr.score >= level_mgr.target:
		await _sugar_crush()
		_level_over = true
		CandySfx.play("win")
		CandyBridge.post("LEVEL_END", {
			"won": true, "level": level_mgr.level,
			"score": level_mgr.score, "stars": level_mgr.stars(),
		})
	elif level_mgr.moves_left <= 0:
		_level_over = true
		CandySfx.play("lose")
		CandyBridge.post("LEVEL_END", {
			"won": false, "level": level_mgr.level,
			"score": level_mgr.score, "stars": 0,
		})


## Sugar Crush（簡化版）：每剩 1 步將一顆隨機普通糖轉為隨機方向條紋糖，
## 然後一次觸發全部結算加分。
func _sugar_crush() -> void:
	if level_mgr.moves_left <= 0:
		return
	_show_banner("Sweet Crush!")
	CandySfx.play("special")
	var candidates: Array[Vector2i] = []
	for y in CandyBoard.SIZE:
		for x in CandyBoard.SIZE:
			var p := Vector2i(x, y)
			if board.get_cell(p) >= 0 and board.get_special(p) == CandyBoard.Special.NONE:
				candidates.append(p)
	candidates.shuffle()
	var converted := {}
	for i in mini(level_mgr.moves_left, candidates.size()):
		var p := candidates[i]
		var sp := CandyBoard.Special.STRIPED_H if randi() % 2 == 0 \
			else CandyBoard.Special.STRIPED_V
		board.set_special(p, sp)
		pieces[p].special = sp
		converted[p] = true
	level_mgr.moves_left = 0
	_post_state()
	await get_tree().create_timer(0.9).timeout
	await _resolve(converted, 0)


## 特殊交換的初始效果（已 swap 後呼叫）：炸彈+任意 = 清同色、炸彈+炸彈 = 全盤、
## 條紋+條紋 = 十字（MVP 組合）。參與的特殊糖效果已套用，特殊屬性就地消耗。
func _special_swap_effect(a: Vector2i, b: Vector2i) -> Dictionary:
	if not board.is_special_swap(a, b):
		return {"cells": {}, "triggered": 0}
	var removed := {}
	var triggered := 0
	var bombs: Array[Vector2i] = []
	if board.get_special(a) == CandyBoard.Special.BOMB:
		bombs.append(a)
	if board.get_special(b) == CandyBoard.Special.BOMB:
		bombs.append(b)
	if bombs.size() == 2:  # 炸彈+炸彈：全盤清除
		for y in CandyBoard.SIZE:
			for x in CandyBoard.SIZE:
				removed[Vector2i(x, y)] = true
		triggered = 2
	elif bombs.size() == 1:  # 炸彈+糖果：清除全盤同色（對方若為特殊糖會鏈式觸發）
		var bomb := bombs[0]
		var other := b if bomb == a else a
		var target_color := board.get_cell(other)
		removed[bomb] = true
		for y in CandyBoard.SIZE:
			for x in CandyBoard.SIZE:
				if board.get_cell(Vector2i(x, y)) == target_color:
					removed[Vector2i(x, y)] = true
		triggered = 1
	else:  # 條紋+條紋：十字（以交換目標格為中心），兩顆條紋就地消耗
		for x in CandyBoard.SIZE:
			removed[Vector2i(x, b.y)] = true
		for y in CandyBoard.SIZE:
			removed[Vector2i(b.x, y)] = true
		triggered = 2
		board.set_special(a, CandyBoard.Special.NONE)
		board.set_special(b, CandyBoard.Special.NONE)
	for c in bombs:
		board.set_special(c, CandyBoard.Special.NONE)
	return {"cells": removed, "triggered": triggered}


# ---------- 結算（RESOLVE → FALL → CHECK 循環） ----------

var _swap_a := NO_CELL  # 最近一次有效交換的兩格（特殊糖生成點）
var _swap_b := NO_CELL


## 消除 → 特殊糖生成/觸發 → 重力下落 → 補位 → 連鎖檢查，直到盤面穩定；最後做死局檢測。
## 計分：群組 n 顆 = 60 + 20(n-3)，連鎖第 k 層 ×(1 + 0.5k)；特殊糖觸發每顆 +40。
func _resolve(pending := {}, pending_triggers := 0) -> void:
	var cascade := 0
	while true:
		var groups := board.find_match_groups()
		var armed := _armed_wrapped_cells()
		if groups.is_empty() and pending.is_empty() and armed.is_empty():
			break
		var mult := 1.0 + 0.5 * cascade
		if cascade >= 1 and not groups.is_empty():  # 連鎖喝采文字
			_show_banner(["Sweet!", "Tasty!", "Divine!"][mini(cascade - 1, 2)], 34)
		var removed := pending
		pending = {}
		var spawns := {}  # cell -> {color, special}
		for g in groups:
			level_mgr.score += int((60 + 20 * (g["cells"].size() - 3)) * mult)
			for c in g["cells"]:
				removed[c] = true
			if g["kind"] != "normal":
				var s := _spawn_from_group(g, cascade == 0)
				if not spawns.has(s["cell"]):
					spawns[s["cell"]] = s
		for c in armed:
			removed[c] = true
		for cell in spawns:  # 生成格不消除（原地變身特殊糖）
			removed.erase(cell)
		var triggered := pending_triggers + _expand_specials(removed, spawns)
		pending_triggers = 0
		level_mgr.score += 40 * triggered
		_post_state()
		if not removed.is_empty():
			CandySfx.play("pop", 1.0 + 0.12 * mini(cascade, 6))  # 連鎖逐層升調
		if not spawns.is_empty():
			CandySfx.play("special")
		if triggered > 0:
			CandySfx.play("boom", 1.0, -3.0)
		for cell in spawns:
			board.set_cell(cell, spawns[cell]["color"])
			board.set_special(cell, spawns[cell]["special"])
			pieces[cell].color_id = spawns[cell]["color"]
			pieces[cell].special = spawns[cell]["special"]
		await _animate_remove(removed.keys())
		board.clear_cells(removed.keys())
		for c in removed:
			pieces[c].queue_free()
			pieces.erase(c)
		await _animate_fall(board.apply_gravity(), board.refill())
		cascade += 1
	_swap_a = NO_CELL
	_swap_b = NO_CELL
	if not board.has_legal_move():
		await _shuffle_board()


## 群組生成特殊糖：交換層優先生在交換點，連鎖層生在線段中點/交點；
## 條紋方向交換層依交換方向、連鎖層依線段方向。
func _spawn_from_group(g: Dictionary, use_swap_cell: bool) -> Dictionary:
	var cell: Vector2i = g["origin"]
	var from_swap := false
	if use_swap_cell:
		if _swap_b in g["cells"]:
			cell = _swap_b
			from_swap = true
		elif _swap_a in g["cells"]:
			cell = _swap_a
			from_swap = true
	var color: int = g["color"]
	var sp: int
	match g["kind"]:
		"wrapped":
			sp = CandyBoard.Special.WRAPPED
		"bomb":
			sp = CandyBoard.Special.BOMB
			color = CandyBoard.BOMB_COLOR
		_:
			var horizontal: bool = (_swap_a.y == _swap_b.y) if from_swap else g["horizontal"]
			sp = CandyBoard.Special.STRIPED_H if horizontal else CandyBoard.Special.STRIPED_V
	return {"cell": cell, "color": color, "special": sp}


## 鏈式觸發 removed 集合中的特殊糖，就地擴張集合；回傳觸發顆數。
## 條紋清行/列；包裝 3×3（第一段後轉 ARMED 留盤，落定後第二段）；
## 炸彈（被效果波及時）清除全盤最多色。protected = 本層剛生成的特殊糖。
func _expand_specials(removed: Dictionary, protected: Dictionary) -> int:
	var triggered := 0
	var queue: Array[Vector2i] = []
	for c in removed.keys():
		if board.get_special(c) != CandyBoard.Special.NONE:
			queue.append(c)
	while not queue.is_empty():
		var c: Vector2i = queue.pop_back()
		var sp := board.get_special(c)
		if sp == CandyBoard.Special.NONE:
			continue
		triggered += 1
		var add: Array[Vector2i] = []
		match sp:
			CandyBoard.Special.STRIPED_H:
				for x in CandyBoard.SIZE:
					add.append(Vector2i(x, c.y))
			CandyBoard.Special.STRIPED_V:
				for y in CandyBoard.SIZE:
					add.append(Vector2i(c.x, y))
			CandyBoard.Special.WRAPPED:
				add = _around_3x3(c)
				board.set_special(c, CandyBoard.Special.WRAPPED_ARMED)
				pieces[c].special = CandyBoard.Special.WRAPPED_ARMED
				removed.erase(c)  # 第一段爆完留在盤上
			CandyBoard.Special.WRAPPED_ARMED:
				add = _around_3x3(c)
			CandyBoard.Special.BOMB:
				var most := _most_common_color()
				if most >= 0:
					for y in CandyBoard.SIZE:
						for x in CandyBoard.SIZE:
							if board.get_cell(Vector2i(x, y)) == most:
								add.append(Vector2i(x, y))
		for cell in add:
			if cell in removed or cell in protected:
				continue
			if board.get_cell(cell) == CandyBoard.EMPTY:
				continue
			removed[cell] = true
			if board.get_special(cell) != CandyBoard.Special.NONE:
				queue.append(cell)
	return triggered


func _around_3x3(c: Vector2i) -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	for dy in [-1, 0, 1]:
		for dx in [-1, 0, 1]:
			var p := c + Vector2i(dx, dy)
			if CandyBoard.in_bounds(p) and p != c:
				cells.append(p)
	return cells


func _armed_wrapped_cells() -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	for y in CandyBoard.SIZE:
		for x in CandyBoard.SIZE:
			if board.get_special(Vector2i(x, y)) == CandyBoard.Special.WRAPPED_ARMED:
				cells.append(Vector2i(x, y))
	return cells


func _most_common_color() -> int:
	var counts := {}
	for c in board.grid:
		if c >= 0:
			counts[c] = counts.get(c, 0) + 1
	var best := -1
	var best_n := 0
	for c in counts:
		if counts[c] > best_n:
			best_n = counts[c]
			best = c
	return best


## 消除動畫：縮放至 0 + 同色粒子噴發。
func _animate_remove(cells: Array) -> void:
	var tween := create_tween().set_parallel()
	for c in cells:
		var piece: CandyPiece = pieces[c]
		piece.set_selected(false)
		tween.tween_property(piece, "scale", Vector2.ZERO, REMOVE_TIME) \
			.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
		_spawn_burst(piece.position, _piece_burst_color(piece))
	await tween.finished


static func _piece_burst_color(piece: CandyPiece) -> Color:
	if piece.special == CandyBoard.Special.BOMB:
		return Color.WHITE
	return CandyPiece.COLORS[posmod(piece.color_id, CandyPiece.COLORS.size())]


## 單格消除粒子（一次性爆發，播完自毀）。
func _spawn_burst(pos: Vector2, color: Color) -> void:
	var p := CPUParticles2D.new()
	p.position = pos
	p.one_shot = true
	p.amount = 10
	p.lifetime = 0.45
	p.explosiveness = 1.0
	p.spread = 180.0
	p.initial_velocity_min = 60.0
	p.initial_velocity_max = 150.0
	p.gravity = Vector2(0, 260)
	p.scale_amount_min = 2.0
	p.scale_amount_max = 4.0
	p.color = color
	add_child(p)
	p.emitting = true
	get_tree().create_timer(p.lifetime + 0.2).timeout.connect(p.queue_free)


## 下落動畫：既有糖果下沉 + 新糖果自盤面上方落入，每格 0.08s、落地微彈跳。
func _animate_fall(falls: Array, spawns: Array) -> void:
	var tween := create_tween().set_parallel()
	var landed := {}
	for m in falls:
		landed[m["to"]] = pieces[m["from"]]
		pieces.erase(m["from"])
	for to in landed:
		pieces[to] = landed[to]
		_tween_fall(tween, landed[to], to)
	# 各欄補位數（新糖果起點疊在盤面上方）
	var col_empties := {}
	for s in spawns:
		col_empties[s["cell"].x] = col_empties.get(s["cell"].x, 0) + 1
	for s in spawns:
		var cell: Vector2i = s["cell"]
		var piece: CandyPiece = CandyPieceScript.new()
		piece.color_id = s["color"]
		piece.position = cell_to_pos(Vector2i(cell.x, cell.y - col_empties[cell.x]))
		add_child(piece)
		pieces[cell] = piece
		_tween_fall(tween, piece, cell)
	await tween.finished


func _tween_fall(tween: Tween, piece: CandyPiece, to: Vector2i) -> void:
	var dist := cell_to_pos(to).y - piece.position.y
	var dur := maxf(FALL_PER_CELL, FALL_PER_CELL * dist / CELL)
	tween.tween_property(piece, "position", cell_to_pos(to), dur) \
		.set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)


## 死局：顯示提示後保留糖果重排。
func _shuffle_board() -> void:
	_show_banner("No more moves!")
	CandySfx.play("swap", 0.7)
	await get_tree().create_timer(0.9).timeout
	board.shuffle()
	for c in pieces:
		pieces[c].color_id = board.get_cell(c)
		pieces[c].special = board.get_special(c)


## 盤面中央橫幅文字（漸大淡出）。
func _show_banner(text: String, font_size := 40) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", Color("#fbcfe8"))
	label.add_theme_color_override("font_outline_color", Color("#831843"))
	label.add_theme_constant_override("outline_size", 8)
	label.z_index = 10
	add_child(label)
	await get_tree().process_frame  # 等 label 取得尺寸再置中
	label.position = -label.size / 2  # 節點原點即盤面中心
	label.pivot_offset = label.size / 2
	label.scale = Vector2.ONE * 0.5
	var tween := create_tween()
	tween.tween_property(label, "scale", Vector2.ONE * 1.2, 0.4) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_interval(0.3)
	tween.tween_property(label, "modulate:a", 0.0, 0.3)
	tween.tween_callback(label.queue_free)


# ---------- Bridge ----------

func _post_state() -> void:
	CandyBridge.post("STATE", {
		"level": level_mgr.level,
		"score": level_mgr.score,
		"moves": level_mgr.moves_left,
		"target": level_mgr.target,
		"stars": level_mgr.stars(),
	})


func _on_command(type: String, payload: Dictionary) -> void:
	match type:
		"SET_PAUSED":
			_paused = bool(payload.get("paused", false))
			if _paused:
				_set_selected(NO_CELL)
		"SET_MUTED":
			CandySfx.set_muted(bool(payload.get("muted", false)))
		"START_LEVEL":
			if _state != State.IDLE:
				return
			_start_level(int(payload.get("level", 1)))
		"DEBUG_SET_STATE":  # e2e 測試用：直接調整分數/剩步
			if payload.has("score"):
				level_mgr.score = int(payload["score"])
			if payload.has("moves"):
				level_mgr.moves_left = int(payload["moves"])
			_post_state()
		"DEBUG_SET_BOARD":  # e2e 測試用：直接鋪指定盤面（可含特殊糖）
			if _state != State.IDLE:
				return
			var g: Array = payload.get("grid", [])
			var sp: Array = payload.get("special", [])
			if g.size() == CandyBoard.SIZE * CandyBoard.SIZE:
				for i in g.size():
					board.grid[i] = int(g[i])
					board.special[i] = int(sp[i]) if sp.size() == g.size() else CandyBoard.Special.NONE
				_refresh_pieces()
		"DEBUG_GET_BOARD":
			CandyBridge.post("DEBUG_BOARD", {
				"grid": board.grid, "special": board.special,
				"score": level_mgr.score, "moves": level_mgr.moves_left,
				"level": level_mgr.level,
			})


## 整盤重建糖果節點（洗牌/載入盤面用）。
func _refresh_pieces() -> void:
	_set_selected(NO_CELL)
	for c in pieces:
		pieces[c].queue_free()
	pieces.clear()
	_spawn_pieces()


## 將 a、b 兩顆糖果的顯示位置對調（0.15s tween），不動 board 資料。
func _animate_swap(a: Vector2i, b: Vector2i) -> void:
	var pa: CandyPiece = pieces[a]
	var pb: CandyPiece = pieces[b]
	var tween := create_tween().set_parallel()
	tween.tween_property(pa, "position", pb.position, SWAP_TIME) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(pb, "position", pa.position, SWAP_TIME) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	await tween.finished


func _draw() -> void:
	# 裝飾外框（雙層圓角）
	var outer := Rect2(ORIGIN - Vector2(14, 14), Vector2(BOARD_PX + 28, BOARD_PX + 28))
	draw_rect(outer, Color("#3b2a52"))
	draw_rect(outer.grow(-4), Color("#160f24"))
	# 棋盤格底
	for y in CandyBoard.SIZE:
		for x in CandyBoard.SIZE:
			var col := Color("#1e293b") if (x + y) % 2 == 0 else Color("#243349")
			draw_rect(Rect2(ORIGIN + Vector2(x, y) * CELL, Vector2(CELL, CELL)), col)
