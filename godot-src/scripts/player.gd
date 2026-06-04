class_name Player
extends Node2D

## 玩家：移植 RpgRoom loop() 的移動/動畫邏輯——
## 速度 4 px/tick、4 方向 sprite 列（0下/48左/96右/144上）、走路 4 幀（0/32/64/96）、
## 斜向被擋時 X/Y 分軸滑牆。碰撞判斷由 game 以 Callable 注入（AABB 純邏輯）。
## Y-sort 對齊腳底：節點座標 = (px, py + 高度)，sprite 子節點上移繪製。

const NX := 32
const NY := 48
const SPEED := 4

var px := 0.0
var py := 0.0
var sx := 0  # 走路幀 x
var sy := 0  # 朝向列 y
var _anim_frame := 0
var _sprite := Sprite2D.new()


func _init(tex: Texture2D) -> void:
	_sprite.texture = tex
	_sprite.centered = false
	_sprite.region_enabled = true
	_sprite.position = Vector2(0, -NY)
	add_child(_sprite)


func place(x: float, y: float) -> void:
	px = x
	py = y
	sx = 0
	sy = 0
	_anim_frame = 0
	_update_visual()


## 每 tick 呼叫，回傳是否有移動輸入（用於關閉對話框）
func tick(dir: Dictionary, can_move: Callable, check_transition: Callable) -> bool:
	var dx := 0
	var dy := 0
	var moving_x := false
	var moving_y := false

	if dir["left"] and not dir["right"]:
		dx = -SPEED
		sy = NY
		moving_x = true
	elif dir["right"] and not dir["left"]:
		dx = SPEED
		sy = NY * 2
		moving_x = true

	if dir["up"] and not dir["down"]:
		dy = -SPEED
		sy = NY * 3
		moving_y = true
	elif dir["down"] and not dir["up"]:
		dy = SPEED
		sy = 0
		moving_y = true

	if not (moving_x or moving_y):
		return false

	var next_x := px + dx
	var next_y := py + dy

	if not bool(check_transition.call(next_x, next_y)):
		if bool(can_move.call(next_x, next_y)):
			px = next_x
			py = next_y
		elif moving_x and moving_y and bool(can_move.call(next_x, py)):
			px = next_x
		elif moving_x and moving_y and bool(can_move.call(px, next_y)):
			py = next_y

		# 走路幀循環（每 8 tick 換幀、共 4 幀，被擋時同樣踏步——對齊原版）
		_anim_frame = (_anim_frame + 1) % NX
		sx = (_anim_frame / 8) * NX

	_update_visual()
	return true


func _update_visual() -> void:
	position = Vector2(px, py + NY)
	_sprite.region_rect = Rect2(sx, sy, NX, NY)
