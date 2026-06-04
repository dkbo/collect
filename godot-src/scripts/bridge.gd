extends Node

## React ⇄ Godot postMessage 通訊橋（協定 v1，詳見 .prompts/godot.md）。
## 訊息格式：{ source: 'godot-rpg', type, payload? }，雙向皆驗證同源與 source。
## 非 Web 平台（編輯器內測試）全部 no-op。

signal command_received(type: String, payload: Dictionary)

const SOURCE := "godot-rpg"
const VERSION := "1.0"

var _js_callback: JavaScriptObject


func _ready() -> void:
	if not OS.has_feature("web"):
		return
	# create_callback 的引用必須保存在成員變數，否則會被 GC 導致收不到訊息
	_js_callback = JavaScriptBridge.create_callback(_on_js_message)
	var window: JavaScriptObject = JavaScriptBridge.get_interface("window")
	window.__godotBridgeReceive = _js_callback
	# 監聽 React 指令：同源 + source 驗證後以 JSON 字串轉交 Godot callback
	JavaScriptBridge.eval("""
		window.addEventListener('message', function (ev) {
			if (ev.origin !== window.location.origin) return;
			var d = ev.data;
			if (!d || d.source !== 'godot-rpg' || typeof d.type !== 'string') return;
			if (window.__godotBridgeReceive) window.__godotBridgeReceive(JSON.stringify(d));
		});
	""", true)
	post("READY", {"version": VERSION})


## 送事件給 React 外殼（window.parent）
func post(type: String, payload: Dictionary = {}) -> void:
	if not OS.has_feature("web"):
		return
	var msg := {"source": SOURCE, "type": type}
	if not payload.is_empty():
		msg["payload"] = payload
	JavaScriptBridge.eval(
		"window.parent.postMessage(%s, window.location.origin);" % JSON.stringify(msg),
		true
	)


func _on_js_message(args: Array) -> void:
	var data: Variant = JSON.parse_string(String(args[0]))
	if data is not Dictionary:
		return
	var payload: Dictionary = {}
	if data.get("payload") is Dictionary:
		payload = data["payload"]
	command_received.emit(String(data.get("type", "")), payload)
