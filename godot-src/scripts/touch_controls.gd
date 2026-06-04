class_name TouchControls
extends Control

## 行動裝置操作（對齊原版 RpgRoom 觸控）：
## 按住畫面任意處出現拖曳虛擬搖桿（半徑 48、死區 12），右下 A 鈕互動（對話中上移）。
## 僅在 (pointer: coarse) 裝置顯示；方向狀態由 game._gather_input() 合併。

signal interact_pressed

const JOY_RADIUS := 48.0
const JOY_DEAD := 12.0
const BTN_RADIUS := 28.0

var dir := {"left": false, "right": false, "up": false, "down": false}
var chat_lift := false  # 對話中 A 鈕上移避免遮擋對話框

var _joy_active := false
var _joy_id := -1
var _joy_origin := Vector2.ZERO
var _joy_knob := Vector2.ZERO


func _ready() -> void:
	# CanvasLayer 下 anchors 不會自動撐滿，直接跟 viewport 尺寸同步
	_sync_size()
	get_viewport().size_changed.connect(_sync_size)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	# 對齊原版：以 (pointer: coarse) 判斷觸控裝置
	var coarse := false
	if OS.has_feature("web"):
		coarse = bool(JavaScriptBridge.eval("window.matchMedia('(pointer: coarse)').matches", true))
	else:
		coarse = DisplayServer.is_touchscreen_available()
	visible = coarse


func _sync_size() -> void:
	size = get_viewport_rect().size
	queue_redraw()


func set_chat_lift(lift: bool) -> void:
	chat_lift = lift
	queue_redraw()


func _btn_center() -> Vector2:
	return Vector2(size.x - 52.0, size.y - (180.0 if chat_lift else 52.0))


func _input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventScreenTouch:
		var e := event as InputEventScreenTouch
		if e.pressed:
			if e.position.distance_to(_btn_center()) <= BTN_RADIUS + 8.0:
				interact_pressed.emit()
			elif not _joy_active:
				_joy_active = true
				_joy_id = e.index
				_joy_origin = e.position
				_joy_knob = e.position
				_update_dir(Vector2.ZERO)
				queue_redraw()
		elif e.index == _joy_id:
			_release()
	elif event is InputEventScreenDrag and _joy_active:
		var d := event as InputEventScreenDrag
		if d.index != _joy_id:
			return
		var off := d.position - _joy_origin
		if off.length() > JOY_RADIUS:
			off = off.normalized() * JOY_RADIUS
		_joy_knob = _joy_origin + off
		_update_dir(off)
		queue_redraw()


func _release() -> void:
	_joy_active = false
	_joy_id = -1
	dir = {"left": false, "right": false, "up": false, "down": false}
	queue_redraw()


func _update_dir(off: Vector2) -> void:
	dir["left"] = off.x < -JOY_DEAD
	dir["right"] = off.x > JOY_DEAD
	dir["up"] = off.y < -JOY_DEAD
	dir["down"] = off.y > JOY_DEAD


func _draw() -> void:
	# 右下 A 鈕
	var c := _btn_center()
	draw_circle(c, BTN_RADIUS, Color(0.55, 0.36, 0.96, 0.75))
	draw_arc(c, BTN_RADIUS, 0.0, TAU, 32, Color(1, 1, 1, 0.4), 2.0, true)
	draw_string(
		ThemeDB.fallback_font, c + Vector2(-7.0, 8.0), "A",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE
	)

	# 拖曳虛擬搖桿（按住時顯示於觸碰點）
	if _joy_active:
		draw_circle(_joy_origin, JOY_RADIUS, Color(0.06, 0.09, 0.16, 0.3))
		draw_arc(_joy_origin, JOY_RADIUS, 0.0, TAU, 32, Color(1, 1, 1, 0.3), 2.0, true)
		draw_circle(_joy_knob, 20.0, Color(1, 1, 1, 0.4))
