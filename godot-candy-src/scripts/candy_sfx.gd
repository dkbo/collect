extends Node

## 簡易音效播放器：預載 SFX、輪替播放器池（避免互相截斷）、
## 支援靜音（SET_MUTED 指令）與音高縮放（連鎖逐層升調用）。
## 音檔由 tools/gen_sfx.py 程式生成（自製合成音，無版權疑慮）。

const STREAMS := {
	"swap": preload("res://assets/sfx/swap.wav"),
	"invalid": preload("res://assets/sfx/invalid.wav"),
	"pop": preload("res://assets/sfx/pop.wav"),
	"special": preload("res://assets/sfx/special.wav"),
	"boom": preload("res://assets/sfx/boom.wav"),
	"win": preload("res://assets/sfx/win.wav"),
	"lose": preload("res://assets/sfx/lose.wav"),
}
const POOL_SIZE := 8

var _players: Array[AudioStreamPlayer] = []
var _next := 0


func _ready() -> void:
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)


func play(sfx: String, pitch := 1.0, volume_db := 0.0) -> void:
	if not STREAMS.has(sfx):
		return
	var p := _players[_next]
	_next = (_next + 1) % POOL_SIZE
	p.stream = STREAMS[sfx]
	p.pitch_scale = pitch
	p.volume_db = volume_db
	p.play()


func set_muted(muted: bool) -> void:
	AudioServer.set_bus_mute(0, muted)
