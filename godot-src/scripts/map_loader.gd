class_name MapLoader
extends Node

## 地圖 JSON 載入器：與 RpgRoom 共用單一來源（src/pages/RpgRoom/data/000N_map.json，
## 由 sync:maps 同步到 public/godot/maps/）。
## Web 匯出：fetch 同站相對路徑 maps/000N_map.json；編輯器測試：直接讀 repo 內檔案。

var _cache: Dictionary = {}


func load_map(id: int) -> Dictionary:
	if _cache.has(id):
		return _cache[id]

	var fname := "%04d_map.json" % id
	var text := ""
	if OS.has_feature("web"):
		var url := String(JavaScriptBridge.eval(
			"new URL('maps/%s', window.location.href).href" % fname, true
		))
		var req := HTTPRequest.new()
		add_child(req)
		req.request(url)
		var result: Array = await req.request_completed
		req.queue_free()
		if int(result[1]) == 200:
			text = (result[3] as PackedByteArray).get_string_from_utf8()
	else:
		var path := ProjectSettings.globalize_path("res://") + "../public/godot/maps/" + fname
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			text = file.get_as_text()

	var data: Variant = JSON.parse_string(text)
	if data is Dictionary:
		_cache[id] = data
		return data

	push_error("MapLoader: 無法載入地圖 %s" % fname)
	return {}
