class_name BoardView
extends Node2D

## 盤面渲染：依 CandyBoard 狀態生成 CandyPiece、棋盤格背景與裝飾邊框。
## 56px 格、448×448 盤面置中於 960×540。

const CELL := 56.0
const BOARD_PX := CELL * CandyBoard.SIZE
const ORIGIN := Vector2((960.0 - BOARD_PX) / 2.0, (540.0 - BOARD_PX) / 2.0)

const CandyPieceScript := preload("res://scripts/candy_piece.gd")

var board: CandyBoard
var pieces := {}  # Vector2i -> CandyPiece


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
	return Vector2i(((pos - ORIGIN) / CELL).floor())


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
