extends Node2D

## Step 2 骨架驗證場景：方塊水平往返移動，確認引擎在 iframe 內運行。
## Step 3 起將由 Bridge autoload 接上 React postMessage 通訊。

const SPEED := 160.0
const MIN_X := 100.0
const MAX_X := 800.0

@onready var square: ColorRect = $Square

var _dir := 1.0
var _paused := false

func _ready() -> void:
	square.position = Vector2(MIN_X, 246.0)
	Bridge.command_received.connect(_on_bridge_command)


func _on_bridge_command(type: String, payload: Dictionary) -> void:
	match type:
		"SET_PAUSED":
			_paused = bool(payload.get("paused", false))
		"RESTART":
			square.position = Vector2(MIN_X, 246.0)
			_dir = 1.0

func _process(delta: float) -> void:
	if _paused:
		return
	square.position.x += SPEED * delta * _dir
	if square.position.x >= MAX_X:
		_dir = -1.0
	elif square.position.x <= MIN_X:
		_dir = 1.0
