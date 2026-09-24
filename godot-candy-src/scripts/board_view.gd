class_name BoardView
extends Node2D

## 盤面渲染與操作：依 CandyBoard 狀態生成 CandyPiece、bg_night 背景、board_frame 九宮格框與程式畫的格子；
## 處理點選交換與拖曳 swipe。56px 格、448×448 盤面以節點原點為中心，
## _layout() 依 viewport 尺寸動態置中縮放（手機直式也能滿版）。
## 狀態機 IDLE → SWAP →（Step 4 接 RESOLVE → FALL → CHECK），動畫中鎖輸入。
## 特效（spec §7）由 Fx 子節點（CandyFx）播放；特殊糖觸發時把每格的消除延遲與特效事件
## 記在 _fx_delays／_fx_events，_animate_remove 依此排程，不影響盤面邏輯與計分。

const CELL := 56.0
const BOARD_PX := CELL * CandyBoard.SIZE
const ORIGIN := Vector2(-BOARD_PX / 2.0, -BOARD_PX / 2.0)
const DESIGN_MIN := 540.0  # 設計基準：min(viewport 邊長) = 540 時 scale = 1
const SWAP_TIME := 0.15
const REMOVE_TIME := 0.2
const FALL_PER_CELL := 0.08
const SWIPE_THRESHOLD := 24.0  # 拖曳判定距離（px）
const SQUASH_SCALE := 1.15  # 消除前先放大
const SQUASH_TIME := 0.06
const LAND_TIME := 0.1  # 落地 squash 回彈
const STRIPE_STEP := 0.02  # 條紋清行逐格延遲
const BOLT_STEP := 0.03  # 彩色炸彈電光依序射出間隔
const BOLT_ARRIVE := 0.06  # 最後一條電光到位後才一起消除
const RIPPLE_STEP := 0.03  # 炸彈＋炸彈由中心向外，每格距離的延遲
const SHAKE_PX := 4.0
const SHAKE_TIME := 0.15
const CRUSH_STEP := 0.05  # Sweet Crush 逐顆轉條紋的間隔
const GOLD := Color("#ffc21a")
const COMBO_TEXTS: Array[String] = ["Sweet!", "Tasty!", "Divine!"]

const CandyPieceScript := preload("res://scripts/candy_piece.gd")
const CandyFxScript := preload("res://scripts/fx/candy_fx.gd")

# ---- A 亮面經典盤面（spec §4.1、§5） ----
const BG_PATH := "res://assets/candy/bg_night.webp"
const FRAME_PATH := "res://assets/candy/board_frame.webp"
const FONT_PATH := "res://assets/fonts/Fredoka-Bold.ttf"
const GRADIENT_SHADER_PATH := "res://shaders/banner_gradient.gdshader"
const FRAME_PAD := 14.0  # 框到格子的邊距（邏輯）
const FRAME_MARGIN := 56  # 九宮格邊距（@2x 貼圖像素）
const FRAME_RADIUS := 26
const GRID_CELL := 53.0
const GRID_RADIUS := 9.0
const GRID_COLORS: Array[Color] = [Color("#3a2c8c"), Color("#30237a")]
const Z_BOARD := -2  # 框與格子在糖果光暈（-1）之下

## Godot 內 banner 樣式（spec §6.5）：[字級, 外框, 外框色, 落影色, 落影 y]
const BANNER_STYLES := {
	"Level": [48, 8, "#e01f78", "#8c0f4a", 5],
	"Sweet!": [44, 6, "#ff4fa3", "#8c0f4a", 4],
	"Tasty!": [48, 6, "#ff8a1f", "#b04500", 4],
	"Divine!": [52, 6, "#b04dff", "#56128f", 4],
	"Sweet Crush!": [64, 8, "#e01f78", "#8c0f4a", 5],
	"No more moves!": [36, 6, "#1f8cff", "#0a3a9e", 4],
}

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
var _bg: Sprite2D
var fx: CandyFx
var last_particle_total := 0  # 最近一次消除的粒子總數（[fx] particles= 同值）
var _fx_delays := {}  # Vector2i -> 消除延遲秒數（特殊糖觸發的連帶格）
var _fx_events: Array = []  # [{type: beam|ring|bolt|ripple, cell, delay, ...}]
var _base_pos := Vector2.ZERO  # _layout 算出的置中位置（震動以此為基準）
var _shake_tween: Tween
var _fps_timer: Timer


func _ready() -> void:
	_build_board_layers()
	fx = CandyFxScript.new()
	fx.name = "Fx"
	fx.z_index = 5  # 糖果之上、banner 之下
	add_child(fx)
	_fps_timer = Timer.new()
	_fps_timer.wait_time = 1.0
	_fps_timer.timeout.connect(_print_fps)
	add_child(_fps_timer)
	CandyBridge.command_received.connect(_on_command)
	get_viewport().size_changed.connect(_layout)
	_layout()
	_start_level(1)


## 依 viewport 尺寸置中並等比縮放（stretch=expand 下直式螢幕 viewport 會拉長）；
## 背景另在 CanvasLayer 以 cover 縮放鋪滿整個 viewport。
func _layout() -> void:
	var vp := get_viewport_rect().size
	_base_pos = vp / 2.0
	position = _base_pos
	scale = Vector2.ONE * (minf(vp.x, vp.y) / DESIGN_MIN)
	if _bg and _bg.texture:
		_bg.position = vp / 2.0
		_bg.scale = Vector2.ONE * bg_cover_scale(vp, _bg.texture.get_size())


## 背景貼圖 cover 縮放：取寬高比例較大者，寬螢幕與直式都不露底。
static func bg_cover_scale(vp: Vector2, tex_size: Vector2) -> float:
	return maxf(vp.x / tex_size.x, vp.y / tex_size.y)


## 背景（CanvasLayer −1）→ 框落影 → board_frame 九宮格 → 格子，糖果之後才加入。
func _build_board_layers() -> void:
	var bg_layer := CanvasLayer.new()
	bg_layer.name = "BgLayer"
	bg_layer.layer = -1
	add_child(bg_layer)
	_bg = Sprite2D.new()
	_bg.name = "Bg"
	_bg.texture = load(BG_PATH) if ResourceLoader.exists(BG_PATH) else null
	_bg.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	bg_layer.add_child(_bg)

	var frame_rect := Rect2(ORIGIN - Vector2.ONE * FRAME_PAD,
		Vector2.ONE * (BOARD_PX + FRAME_PAD * 2))
	# 稿上的大落影（y+12 blur 28）放不進九宮格邊距，另以 StyleBoxFlat shadow 補畫
	var shadow := Panel.new()
	shadow.name = "FrameShadow"
	var sb := StyleBoxFlat.new()
	sb.draw_center = false
	sb.set_corner_radius_all(FRAME_RADIUS)
	sb.shadow_color = Color(0.039, 0.016, 0.125, 0.6)
	sb.shadow_size = 20
	sb.shadow_offset = Vector2(0, 12)
	shadow.add_theme_stylebox_override("panel", sb)
	shadow.position = frame_rect.position
	shadow.size = frame_rect.size
	shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	shadow.z_index = Z_BOARD
	add_child(shadow)

	var frame := NinePatchRect.new()
	frame.name = "Frame"
	frame.texture = load(FRAME_PATH) if ResourceLoader.exists(FRAME_PATH) else null
	frame.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	frame.patch_margin_left = FRAME_MARGIN
	frame.patch_margin_top = FRAME_MARGIN
	frame.patch_margin_right = FRAME_MARGIN
	frame.patch_margin_bottom = FRAME_MARGIN
	# @2x 貼圖：以 2 倍大小鋪、再縮 0.5，角落就是 28 邏輯單位
	frame.position = frame_rect.position
	frame.size = frame_rect.size * 2.0
	frame.scale = Vector2.ONE * 0.5
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.z_index = Z_BOARD
	add_child(frame)

	var grid := Node2D.new()
	grid.name = "Grid"
	grid.z_index = Z_BOARD
	grid.draw.connect(_draw_grid.bind(grid))
	add_child(grid)


## 格子：53×53、圓角 9，#3A2C8C／#30237A 交替，置中於 56 格。
func _draw_grid(grid: Node2D) -> void:
	var boxes: Array[StyleBoxFlat] = []
	for col in GRID_COLORS:
		var sb := StyleBoxFlat.new()
		sb.bg_color = col
		sb.set_corner_radius_all(int(GRID_RADIUS))
		boxes.append(sb)
	var inset := (CELL - GRID_CELL) / 2.0
	for y in CandyBoard.SIZE:
		for x in CandyBoard.SIZE:
			var r := Rect2(ORIGIN + Vector2(x, y) * CELL + Vector2.ONE * inset,
				Vector2.ONE * GRID_CELL)
			grid.draw_style_box(boxes[(x + y) % 2], r)


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
		_fx_reset()
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
		# 每顆轉換一次金色閃光＋「叮」，0.05s 連響
		fx.flash(pieces[p].position, GOLD, 1.2)
		CandySfx.play("special", 1.0 + 0.03 * mini(i, 10))
		await get_tree().create_timer(CRUSH_STEP).timeout
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
		var center := Vector2(CandyBoard.SIZE - 1, CandyBoard.SIZE - 1) / 2.0
		for y in CandyBoard.SIZE:
			for x in CandyBoard.SIZE:
				removed[Vector2i(x, y)] = true
				_fx_delays[Vector2i(x, y)] = RIPPLE_STEP * Vector2(x, y).distance_to(center)
		_fx_events.append({"type": "ripple", "cell": b, "delay": 0.0})
		triggered = 2
	elif bombs.size() == 1:  # 炸彈+糖果：清除全盤同色（對方若為特殊糖會鏈式觸發）
		var bomb := bombs[0]
		var other := b if bomb == a else a
		var target_color := board.get_cell(other)
		removed[bomb] = true
		var targets: Array[Vector2i] = []
		for y in CandyBoard.SIZE:
			for x in CandyBoard.SIZE:
				if board.get_cell(Vector2i(x, y)) == target_color:
					removed[Vector2i(x, y)] = true
					targets.append(Vector2i(x, y))
		_fx_bomb(bomb, targets, 0.0)
		triggered = 1
	else:  # 條紋+條紋：十字（以交換目標格為中心），兩顆條紋就地消耗
		for x in CandyBoard.SIZE:
			removed[Vector2i(x, b.y)] = true
			_fx_delays[Vector2i(x, b.y)] = STRIPE_STEP * absi(x - b.x)
		for y in CandyBoard.SIZE:
			removed[Vector2i(b.x, y)] = true
			_fx_delays[Vector2i(b.x, y)] = STRIPE_STEP * absi(y - b.y)
		_fx_events.append({"type": "beam", "cell": b, "delay": 0.0, "horizontal": true,
			"color": _cell_color(b)})
		_fx_events.append({"type": "beam", "cell": b, "delay": 0.0, "horizontal": false,
			"color": _cell_color(b)})
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
	_fps_timer.start()
	while true:
		var groups := board.find_match_groups()
		var armed := _armed_wrapped_cells()
		if groups.is_empty() and pending.is_empty() and armed.is_empty():
			break
		var mult := 1.0 + 0.5 * cascade
		if cascade >= 1 and not groups.is_empty():  # 連鎖喝采文字
			_show_banner(COMBO_TEXTS[mini(cascade - 1, COMBO_TEXTS.size() - 1)])
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
		await _animate_remove(removed.keys(), cascade)
		_fx_reset()
		board.clear_cells(removed.keys())
		for c in removed:
			pieces[c].queue_free()
			pieces.erase(c)
		await _animate_fall(board.apply_gravity(), board.refill())
		cascade += 1
	_fps_timer.stop()
	_print_fps()  # 短連鎖不滿 1 秒也留一筆
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
		var d: float = _fx_delays.get(c, 0.0)
		var color := _cell_color(c)
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
		var newly: Array[Vector2i] = []
		for cell in add:
			if cell in removed or cell in protected:
				continue
			if board.get_cell(cell) == CandyBoard.EMPTY:
				continue
			removed[cell] = true
			newly.append(cell)
			if board.get_special(cell) != CandyBoard.Special.NONE:
				queue.append(cell)
		_fx_special(sp, c, d, color, newly)
	return triggered


func _fx_reset() -> void:
	_fx_delays.clear()
	_fx_events.clear()


## 記錄一次特殊糖觸發的特效事件與連帶格的消除延遲（只影響動畫排程）。
func _fx_special(sp: int, c: Vector2i, d: float, color: Color, cells: Array[Vector2i]) -> void:
	match sp:
		CandyBoard.Special.STRIPED_H, CandyBoard.Special.STRIPED_V:
			var horizontal := sp == CandyBoard.Special.STRIPED_H
			_fx_events.append({"type": "beam", "cell": c, "delay": d, "horizontal": horizontal,
				"color": color})
			for cell in cells:
				var dist := absi(cell.x - c.x) if horizontal else absi(cell.y - c.y)
				_fx_delays[cell] = d + STRIPE_STEP * dist
		CandyBoard.Special.WRAPPED, CandyBoard.Special.WRAPPED_ARMED:
			_fx_events.append({"type": "ring", "cell": c, "delay": d, "color": color})
			for cell in cells:
				_fx_delays[cell] = d
		CandyBoard.Special.BOMB:
			_fx_bomb(c, cells, d)


## 彩色炸彈：由近到遠每顆目標一條電光、間隔 0.03s，全部到位後炸彈與目標同時消除。
func _fx_bomb(bomb: Vector2i, targets: Array[Vector2i], d: float) -> void:
	var order := targets.filter(func(t): return t != bomb)
	order.sort_custom(func(p, q): return Vector2(p - bomb).length() < Vector2(q - bomb).length())
	var arrive := d + BOLT_STEP * maxi(order.size() - 1, 0) + BOLT_ARRIVE
	for i in order.size():
		var t: Vector2i = order[i]
		_fx_events.append({"type": "bolt", "cell": bomb, "target": t, "delay": d + BOLT_STEP * i,
			"hold": arrive - (d + BOLT_STEP * i), "color": _cell_color(t)})
		_fx_delays[t] = arrive
	_fx_delays[bomb] = arrive


func _cell_color(c: Vector2i) -> Color:
	var col := board.get_cell(c)
	if col < 0 or board.get_special(c) == CandyBoard.Special.BOMB:
		return Color.WHITE
	return CandyPiece.COLORS[posmod(col, CandyPiece.COLORS.size())]


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


## 消除動畫：先播特殊糖事件（光束、衝擊波、電光），各格依 _fx_delays 延遲後
## squash 到 1.15 再 TRANS_BACK 縮到 0，同時播本色 fx_flash 與 fx_sugar 糖粒。
## 連鎖第 k 層閃光放大 1+0.1k、粒子 +2k；整次消除粒子總量受 CandyFx.particle_budget 限制。
func _animate_remove(cells: Array, cascade := 0) -> void:
	if cells.is_empty():
		return
	_play_fx_events()
	var counts := []
	for c in cells:
		counts.append(CandyFxScript.cascade_particles(randi_range(8, 12), cascade))
	var budget := CandyFxScript.particle_budget(counts)
	last_particle_total = 0
	for n in budget:
		last_particle_total += n
	print("[fx] particles=%d" % last_particle_total)
	var last: Tween
	var last_delay := -1.0
	for i in cells.size():
		var piece: CandyPiece = pieces[cells[i]]
		piece.set_selected(false)
		var delay: float = _fx_delays.get(cells[i], 0.0)
		var t := piece.create_tween()
		if delay > 0.0:
			t.tween_interval(delay)
		t.tween_callback(_pop_fx.bind(piece.position, _piece_burst_color(piece), budget[i], cascade))
		t.tween_property(piece, "scale", Vector2.ONE * SQUASH_SCALE, SQUASH_TIME) \
			.set_ease(Tween.EASE_OUT)
		t.tween_property(piece, "scale", Vector2.ZERO, REMOVE_TIME) \
			.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
		if delay > last_delay:
			last_delay = delay
			last = t
	await last.finished


func _pop_fx(pos: Vector2, color: Color, amount: int, cascade: int) -> void:
	fx.flash(pos, color, CandyFxScript.flash_scale(cascade))
	fx.burst(pos, color, amount)


func _play_fx_events() -> void:
	for e in _fx_events:
		var pos := cell_to_pos(e["cell"])
		var d: float = e["delay"]
		match e["type"]:
			"beam":  # 以該行／列中心展開到整盤寬
				var at := Vector2(0.0, pos.y) if e["horizontal"] else Vector2(pos.x, 0.0)
				fx.later(d, fx.beam.bind(at, e["horizontal"], e["color"].lightened(0.4), BOARD_PX))
			"ring":
				fx.later(d, fx.ring.bind(pos, e["color"].lightened(0.5)))
				fx.later(d, shake.bind(SHAKE_PX, SHAKE_TIME))
			"bolt":
				fx.later(d, fx.bolt.bind(pos, cell_to_pos(e["target"]), e["color"], e["hold"]))
			"ripple":  # 炸彈＋炸彈：盤心一記大閃光，其餘格由延遲排出波紋
				fx.flash(Vector2.ZERO, Color.WHITE, 4.0, 0.35)
				shake(SHAKE_PX, SHAKE_TIME)


## 畫面震動：以 _layout 的置中位置為基準隨機偏移、線性衰減到 0。
func shake(px := SHAKE_PX, dur := SHAKE_TIME) -> void:
	if _shake_tween:
		_shake_tween.kill()
	_shake_tween = create_tween()
	_shake_tween.tween_method(_apply_shake.bind(px), 1.0, 0.0, dur)


func _apply_shake(strength: float, px: float) -> void:
	var off := Vector2.ZERO
	if strength > 0.0:
		off = Vector2.from_angle(randf() * TAU) * px * strength * scale.x
	position = _base_pos + off


func _print_fps() -> void:
	print("[fx] fps=%d" % Engine.get_frames_per_second())


static func _piece_burst_color(piece: CandyPiece) -> Color:
	if piece.special == CandyBoard.Special.BOMB:
		return Color.WHITE
	return CandyPiece.COLORS[posmod(piece.color_id, CandyPiece.COLORS.size())]


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
	# 落地當下（bounce 第一次觸地，約 36% 處）squash (1.1, 0.9) → (1, 1)
	tween.tween_method(piece.set_land, 0.0, 1.0, LAND_TIME).set_delay(dur / 2.75)


## 死局：顯示提示後保留糖果重排。
func _shuffle_board() -> void:
	_show_banner("No more moves!")
	CandySfx.play("swap", 0.7)
	await get_tree().create_timer(0.9).timeout
	board.shuffle()
	for c in pieces:
		pieces[c].color_id = board.get_cell(c)
		pieces[c].special = board.get_special(c)


static func _banner_style(text: String) -> Array:
	if text.begins_with("Level"):
		return BANNER_STYLES["Level"]
	return BANNER_STYLES.get(text, BANNER_STYLES["Sweet!"])


static func is_combo(text: String) -> bool:
	return text in COMBO_TEXTS


static func banner_uses_gradient(text: String) -> bool:
	return text == "Sweet Crush!"


## banner 的 LabelSettings：Fredoka、白色填色、外框、與外框同寬的硬落影（spec §6.5）。
static func banner_settings(text: String) -> LabelSettings:
	var st := _banner_style(text)
	var ls := LabelSettings.new()
	if ResourceLoader.exists(FONT_PATH):
		ls.font = load(FONT_PATH)
	ls.font_size = st[0]
	ls.font_color = Color.WHITE
	ls.outline_size = st[1]
	ls.outline_color = Color(st[2])
	ls.shadow_color = Color(st[3])
	ls.shadow_size = st[1]
	ls.shadow_offset = Vector2(0, st[4])
	return ls


## 盤面中央橫幅文字（漸大淡出）。
func _show_banner(text: String) -> void:
	var label := Label.new()
	label.text = text
	label.label_settings = banner_settings(text)
	label.z_index = 10
	if banner_uses_gradient(text) and ResourceLoader.exists(GRADIENT_SHADER_PATH):
		var mat := ShaderMaterial.new()
		mat.shader = load(GRADIENT_SHADER_PATH)
		var fs := label.label_settings.font_size
		var ascent := label.label_settings.font.get_ascent(fs) if label.label_settings.font else fs * 0.9
		mat.set_shader_parameter("y_top", ascent - fs * 0.72)  # 約字母頂端
		mat.set_shader_parameter("y_bottom", ascent)  # 基線
		label.material = mat
	add_child(label)
	await get_tree().process_frame  # 等 label 取得尺寸再置中
	label.position = -label.size / 2  # 節點原點即盤面中心
	label.pivot_offset = label.size / 2
	if is_combo(text):
		_animate_combo(label)
		return
	label.scale = Vector2.ONE * 0.5
	var tween := create_tween()
	tween.tween_property(label, "scale", Vector2.ONE * 1.2, 0.4) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_interval(0.3)
	tween.tween_property(label, "modulate:a", 0.0, 0.3)
	tween.tween_callback(label.queue_free)


## Combo 字（spec §7）：scale 0.3→1.15→1.0、旋轉 −6°→0（0.25s），停 0.35s，
## 再上升 20px 淡出（0.25s）；背後一張放大的 fx_flash（alpha 0.5、外框色）當爆光。
func _animate_combo(label: Label) -> Tween:
	var glow := Sprite2D.new()
	glow.texture = CandyFxScript.FLASH_TEX
	glow.material = CandyFxScript.additive()
	glow.show_behind_parent = true
	glow.position = label.size / 2
	glow.scale = Vector2.ONE * label.size.x * 1.6 / CandyFxScript.FLASH_TEX.get_width()
	glow.modulate = Color(label.label_settings.outline_color, 0.5)
	label.add_child(glow)
	label.scale = Vector2.ONE * 0.3
	label.rotation = deg_to_rad(-6.0)
	var tween := create_tween()
	tween.tween_property(label, "scale", Vector2.ONE * 1.15, 0.17) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(label, "rotation", 0.0, 0.25) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(label, "scale", Vector2.ONE, 0.08) \
		.set_ease(Tween.EASE_IN_OUT).set_delay(0.17)  # 與旋轉同一段，彈入總長 0.25s
	tween.tween_interval(0.35)
	tween.tween_property(label, "position:y", label.position.y - 20.0, 0.25) \
		.set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 0.25)
	tween.tween_callback(label.queue_free)
	return tween


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

