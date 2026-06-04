extends Node

## React ⇄ Godot-Candy postMessage 通訊橋（協定 v1，詳見 .prompts/candyCrush.md）。
## 訊息格式：{ source: 'godot-candy', type, payload? }
## 非 Web 平台（編輯器內測試）全部 no-op。

signal command_received(type: String, payload: Dictionary)

const SOURCE := "godot-candy"
const VERSION := "1.0"

var _js_callback: JavaScriptObject


func _ready() -> void:
	if not OS.has_feature("web"):
		return
	_js_callback = JavaScriptBridge.create_callback(_on_js_message)
	var window: JavaScriptObject = JavaScriptBridge.get_interface("window")
	window.__candyBridgeReceive = _js_callback
	JavaScriptBridge.eval("""
		window.addEventListener('message', function (ev) {
			if (ev.origin !== window.location.origin) return;
			var d = ev.data;
			if (!d || d.source !== 'godot-candy' || typeof d.type !== 'string') return;
			if (window.__candyBridgeReceive) window.__candyBridgeReceive(JSON.stringify(d));
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
