class_name TileAtlas
extends RefCounted

## 圖庫區塊快取：rpg_maker_xp(2).png 為 256×12000/256×7000 長條圖，
## 超過 WebGL 貼圖尺寸上限（行動裝置常見 4096–8192）無法整張上傳 GPU。
## 改持有 CPU 端 Image，按需裁切 (x,y,w,h) 小塊建 ImageTexture 並快取。

var _image: Image
var _cache: Dictionary = {}


func _init(tex: Texture2D) -> void:
	_image = tex.get_image()
	if _image.is_compressed():
		_image.decompress()


func region(x: int, y: int, w: int, h: int) -> Texture2D:
	var key := "%d,%d,%d,%d" % [x, y, w, h]
	if _cache.has(key):
		return _cache[key]
	var part := Image.create(w, h, false, _image.get_format())
	part.blit_rect(_image, Rect2i(x, y, w, h), Vector2i.ZERO)
	var tex := ImageTexture.create_from_image(part)
	_cache[key] = tex
	return tex
