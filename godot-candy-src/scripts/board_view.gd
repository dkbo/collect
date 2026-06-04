class_name BoardView
extends Node2D

## 盤面渲染與操作：依 CandyBoard 狀態生成 CandyPiece、棋盤格背景與裝飾邊框；
## 處理點選交換與拖曳 swipe。56px 格、448×448 盤面置中於 960×540。
## 狀態機 IDLE → SWAP →（Step 4 接 RESOLVE → FALL → CHECK），動畫中鎖輸入。

const CELL := 56.0
const BOARD_PX := CELL * CandyBoard.SIZE
const ORIGIN := Vector2((960.0 - BOARD_PX) / 2.0, (540.0 - BOARD_PX) / 2.0)
const SWAP_TIME := 0.15
const SWIPE_THRESHOLD := 24.0  # 拖曳判定距離（px）

const CandyPieceScript := preload("res://scripts/candy_piece.gd")

enum State { IDLE, ANIM }

const NO_CELL := Vector2i(-1, -1)

var board: CandyBoard
var pieces := {}  # Vector2i -> CandyPiece
var _state := State.IDLE
var _selected := NO_CELL
var _press_cell := NO_CELL  # 按下時的格子（swipe 起點）
var _press_pos := Vector2.ZERO
var _swiped := false  # 本次按壓已觸發 swipe，release 不再當點選


func _ready() -> void:
	board = CandyBoard.new(6)
	_spawn_pieces()


func _spawn_pieces() -> void:
	for y in CandyBoard.SIZE:
		for x in CandyBoard.SIZE:
			var p := Vector2i(x, y)
			var piece: CandyPiece = CandyPieceScript.new()
			piece.color_id = board.get_cell(p)
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
	if _state != State.IDLE:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		var pos := get_global_mouse_position()
		if event.pressed:
			_press_cell = pos_to_cell(pos)
			_press_pos = pos
			_swiped = false
		else:
			if not _swiped:
				_on_click(pos_to_cell(pos))
			_press_cell = NO_CELL
	elif event is InputEventMouseMotion and _press_cell != NO_CELL and not _swiped:
		var delta := get_global_mouse_position() - _press_pos
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
	await _animate_swap(a, b)
	if board.would_swap_match(a, b):
		board.swap(a, b)
		var tmp: CandyPiece = pieces[a]
		pieces[a] = pieces[b]
		pieces[b] = tmp
		# TODO Step 4：進 RESOLVE（消除 → 重力 → 補位 → 連鎖）流程
		_state = State.IDLE
	else:
		await _animate_swap(a, b)  # 無消除 → 回彈
		_state = State.IDLE


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
