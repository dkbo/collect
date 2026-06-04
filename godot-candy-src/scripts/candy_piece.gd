class_name CandyPiece
extends Node2D

## 單顆糖果：依色碼程式自繪幾何造型（圓/方/三角/菱/六角/環 + 高光），
## 不依賴外部素材。選中時播放縮放呼吸動畫。

const RADIUS := 22.0

const COLORS: Array[Color] = [
	Color("#ef4444"),  # 0 紅·圓
	Color("#facc15"),  # 1 黃·圓角方
	Color("#22c55e"),  # 2 綠·三角
	Color("#3b82f6"),  # 3 藍·菱形
	Color("#a855f7"),  # 4 紫·六角
	Color("#fb923c"),  # 5 橙·甜甜圈
]

var color_id := 0:
	set(v):
		color_id = v
		queue_redraw()

var _select_tween: Tween


func set_selected(selected: bool) -> void:
	if _select_tween:
		_select_tween.kill()
		_select_tween = null
	if selected:
		_select_tween = create_tween().set_loops()
		_select_tween.tween_property(self, "scale", Vector2.ONE * 1.14, 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_select_tween.tween_property(self, "scale", Vector2.ONE * 0.98, 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	else:
		scale = Vector2.ONE


func _draw() -> void:
	var c := COLORS[color_id % COLORS.size()]
	var dark := c.darkened(0.35)
	match color_id % COLORS.size():
		0:  # 圓
			draw_circle(Vector2.ZERO, RADIUS, dark)
			draw_circle(Vector2.ZERO, RADIUS - 3.0, c)
		1:  # 圓角方
			var r := RADIUS - 2.0
			draw_rect(Rect2(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2), dark)
			draw_rect(Rect2(-r + 1, -r + 1, (r - 1) * 2, (r - 1) * 2), c)
		2:  # 三角
			draw_colored_polygon(_polygon(3, RADIUS + 4.0, -PI / 2), dark)
			draw_colored_polygon(_polygon(3, RADIUS + 0.5, -PI / 2), c)
		3:  # 菱形
			draw_colored_polygon(_polygon(4, RADIUS + 3.0, -PI / 2), dark)
			draw_colored_polygon(_polygon(4, RADIUS, -PI / 2), c)
		4:  # 六角
			draw_colored_polygon(_polygon(6, RADIUS + 1.0, 0.0), dark)
			draw_colored_polygon(_polygon(6, RADIUS - 2.0, 0.0), c)
		5:  # 甜甜圈
			draw_circle(Vector2.ZERO, RADIUS, dark)
			draw_circle(Vector2.ZERO, RADIUS - 3.0, c)
			draw_circle(Vector2.ZERO, RADIUS * 0.38, dark)
			draw_circle(Vector2.ZERO, RADIUS * 0.30, Color("#0d1726"))
	# 左上高光
	draw_circle(Vector2(-RADIUS * 0.35, -RADIUS * 0.38), RADIUS * 0.22,
		Color(1, 1, 1, 0.55))


static func _polygon(sides: int, radius: float, rot: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in sides:
		var a := rot + TAU * i / sides
		pts.append(Vector2(cos(a), sin(a)) * radius)
	return pts
