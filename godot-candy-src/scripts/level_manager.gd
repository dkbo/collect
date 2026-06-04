class_name LevelManager
extends RefCounted

## 關卡定義載入（data/candy_levels.json，進 pck）與單關狀態：
## 步數限制 + 目標分數；達標 1★、1.5 倍 2★、2 倍 3★。

var levels: Array = []
var level := 1
var moves_left := 0
var target := 0
var colors := 6
var score := 0


func _init() -> void:
	var f := FileAccess.open("res://data/candy_levels.json", FileAccess.READ)
	var parsed: Variant = JSON.parse_string(f.get_as_text()) if f else null
	if parsed is Array and not (parsed as Array).is_empty():
		levels = parsed
	else:
		levels = [{"level": 1, "moves": 15, "target": 1500, "colors": 6}]  # 保底


func level_count() -> int:
	return levels.size()


func start(n: int) -> void:
	level = clampi(n, 1, levels.size())
	var cfg: Dictionary = levels[level - 1]
	moves_left = int(cfg["moves"])
	target = int(cfg["target"])
	colors = int(cfg["colors"])
	score = 0


func stars() -> int:
	if score >= 2 * target:
		return 3
	if score >= int(1.5 * target):
		return 2
	if score >= target:
		return 1
	return 0
