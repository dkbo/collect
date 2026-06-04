class_name MapLayer
extends Node2D

## 地圖圖層：對齊 RpgRoom 的離屏 canvas 渲染——
## 背景層 = 草地平鋪 + z≠2 圖塊；前景層（foreground）= z=2 圖塊（蓋過角色）。
## rx/ry 為壓縮欄位：同貼圖沿 X/Y 平鋪展開。

var foreground := false
var styles: Array = []
var map_w := 0
var map_h := 0
var atlases: Array = []  # TileAtlas 陣列，索引對齊 b：0=man, 1=rpg_maker_xp, 2=rpg_maker_xp2
var bg_texture: Texture2D


func _init() -> void:
	texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED


func setup(p_styles: Array, p_foreground: bool, w: int, h: int, p_atlases: Array, p_bg: Texture2D) -> void:
	styles = p_styles
	foreground = p_foreground
	map_w = w
	map_h = h
	atlases = p_atlases
	bg_texture = p_bg
	queue_redraw()


func _draw() -> void:
	# 背景層先平鋪 32px 草地作底
	if not foreground and bg_texture:
		draw_texture_rect(bg_texture, Rect2(0, 0, map_w, map_h), true)

	for tile: Dictionary in styles:
		var z := int(tile.get("z", 0))
		if (z == 2) != foreground:
			continue
		var b := int(tile.get("b", 0))
		if b < 0 or b >= atlases.size() or atlases[b] == null:
			continue
		var w := int(tile["w"])
		var h := int(tile["h"])
		var rx := int(tile.get("rx", 1))
		var ry := int(tile.get("ry", 1))
		var tex: Texture2D = (atlases[b] as TileAtlas).region(int(tile["x"]), int(tile["y"]), w, h)
		for ix in rx:
			for iy in ry:
				draw_texture_rect(
					tex,
					Rect2(float(tile["l"]) + ix * w, float(tile["t"]) + iy * h, w, h),
					false
				)
