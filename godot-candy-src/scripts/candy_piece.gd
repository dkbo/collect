class_name CandyPiece
extends Node2D

## 單顆糖果：以 A 亮面經典的 WebP 貼圖（Sprite2D、@2x 128px 以 0.5 倍呈現成 64 邏輯單位）
## 依色碼／特殊糖顯示 31 種造型；貼圖缺檔時退回程式自繪幾何造型（圓/方/三角/菱/六角/環）。
## 選中時播放縮放呼吸動畫，底下的 fx_select_halo 光暈同步脈動。

const RADIUS := 22.0
const TEX_SCALE := 0.5  # @2x 貼圖 → 邏輯尺寸
const HALO_TINT := Color("#fff4b3")
const HALO_PATH := "res://assets/candy/fx_select_halo.webp"

## 本色（spec §4.3），粒子上色也用這組
const COLORS: Array[Color] = [
	Color("#ff2d46"),  # 0 紅·圓球
	Color("#ffc61a"),  # 1 黃·圓角方
	Color("#38d64a"),  # 2 綠·圓頂軟糖
	Color("#1f8cff"),  # 3 藍·菱形
	Color("#b04dff"),  # 4 紫·六角
	Color("#ff8a1f"),  # 5 橙·甜甜圈
]
const COLOR_NAMES: Array[String] = ["red", "yellow", "green", "blue", "purple", "orange"]
const SPECIAL_SUFFIX := {
	CandyBoard.Special.NONE: "",
	CandyBoard.Special.STRIPED_H: "_stripe_h",
	CandyBoard.Special.STRIPED_V: "_stripe_v",
	CandyBoard.Special.WRAPPED: "_wrapped",
	CandyBoard.Special.WRAPPED_ARMED: "_wrapped_armed",
}

static var _tex_cache := {}  # path -> Texture2D（缺檔存 null）

var color_id := 0:
	set(v):
		color_id = v
		_refresh()

## CandyBoard.Special 值（0=無、1/2=條紋橫/直、3/4=包裝/已引爆、5=炸彈）
var special := 0:
	set(v):
		special = v
		_refresh()

## 貼圖目錄（測試可改成不存在的路徑驗證退回 _draw()）
var texture_root := "res://assets/candy/":
	set(v):
		texture_root = v
		_refresh()

var _select_tween: Tween
var _sprite: Sprite2D
var _halo: Sprite2D


func _init() -> void:
	_halo = _make_sprite("Halo")
	_halo.texture = _load_tex(HALO_PATH)
	_halo.modulate = HALO_TINT
	_halo.z_index = -1  # 畫在所有糖果之下、盤面格子之上
	_halo.visible = false
	_sprite = _make_sprite("Sprite")
	_refresh()


func _make_sprite(node_name: String) -> Sprite2D:
	var s := Sprite2D.new()
	s.name = node_name
	s.scale = Vector2.ONE * TEX_SCALE
	s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	add_child(s)
	return s


## 依 color_id／special 對應貼圖路徑（spec §5 檔名）。
static func texture_path(color: int, sp: int, root := "res://assets/candy/") -> String:
	if sp == CandyBoard.Special.BOMB:
		return root + "candy_bomb.webp"
	return root + "candy_%s%s.webp" % [
		COLOR_NAMES[posmod(color, COLOR_NAMES.size())], SPECIAL_SUFFIX.get(sp, "")]


static func _load_tex(path: String) -> Texture2D:
	if not _tex_cache.has(path):
		_tex_cache[path] = load(path) as Texture2D if ResourceLoader.exists(path) else null
	return _tex_cache[path]


## 貼圖缺檔、改用 _draw() 幾何造型。
func uses_fallback() -> bool:
	return _sprite == null or _sprite.texture == null


func _refresh() -> void:
	if _sprite == null:
		return
	_sprite.texture = _load_tex(texture_path(color_id, special, texture_root))
	_sprite.visible = _sprite.texture != null
	queue_redraw()


func set_selected(selected: bool) -> void:
	if _select_tween:
		_select_tween.kill()
		_select_tween = null
	_halo.visible = selected and _halo.texture != null
	if selected:
		_halo.modulate.a = 0.6
		_select_tween = create_tween().set_loops()
		_select_tween.tween_property(self, "scale", Vector2.ONE * 1.14, 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_select_tween.parallel().tween_property(_halo, "modulate:a", 1.0, 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_select_tween.tween_property(self, "scale", Vector2.ONE * 0.98, 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_select_tween.parallel().tween_property(_halo, "modulate:a", 0.6, 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	else:
		scale = Vector2.ONE


func _draw() -> void:
	if not uses_fallback():
		return
	if special == CandyBoard.Special.BOMB:
		_draw_bomb()
		return
	var c := COLORS[posmod(color_id, COLORS.size())]
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
	_draw_special_overlay()


## 特殊糖標記：條紋 = 三道白條（橫/直）；包裝 = 白色外框（引爆後轉紅）。
func _draw_special_overlay() -> void:
	var w := Color(1, 1, 1, 0.85)
	match special:
		CandyBoard.Special.STRIPED_H:
			for dy in [-10.0, 0.0, 10.0]:
				draw_rect(Rect2(-RADIUS * 0.7, dy - 2.5, RADIUS * 1.4, 5.0), w)
		CandyBoard.Special.STRIPED_V:
			for dx in [-10.0, 0.0, 10.0]:
				draw_rect(Rect2(dx - 2.5, -RADIUS * 0.7, 5.0, RADIUS * 1.4), w)
		CandyBoard.Special.WRAPPED, CandyBoard.Special.WRAPPED_ARMED:
			var border := w if special == CandyBoard.Special.WRAPPED else Color("#fb7185")
			draw_rect(Rect2(-RADIUS - 3, -RADIUS - 3, (RADIUS + 3) * 2, (RADIUS + 3) * 2),
				border, false, 3.5)


## 彩色炸彈：深色球體 + 六色糖粒。
func _draw_bomb() -> void:
	draw_circle(Vector2.ZERO, RADIUS + 2.0, Color("#1c1917"))
	draw_circle(Vector2.ZERO, RADIUS - 1.0, Color("#44403c"))
	for i in COLORS.size():
		var a := TAU * i / COLORS.size() + 0.5
		draw_circle(Vector2(cos(a), sin(a)) * RADIUS * 0.55, 4.0, COLORS[i])
	draw_circle(Vector2(-RADIUS * 0.35, -RADIUS * 0.38), RADIUS * 0.2, Color(1, 1, 1, 0.4))


static func _polygon(sides: int, radius: float, rot: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in sides:
		var a := rot + TAU * i / sides
		pts.append(Vector2(cos(a), sin(a)) * radius)
	return pts
