class_name Npc
extends Node2D

## NPC（站立 type 0 / 行走 type 4）：移植 RpgRoom NpcRuntime 狀態機——
## idle ⇄ walk 隨機時長/方向、活動範圍 + 碰撞區 + 玩家 + 其他 NPC 阻擋。
## rt 為共享 Dictionary（game 以 mapId 緩存，跨場景保留走位）。
## Y-sort 對齊腳底：節點座標 = (px, py + 高度)，sprite 子節點上移繪製。

const FEET_OFFSET := 24.0  # 碰撞框只取下半身（玩家可與 NPC 上半身視覺重疊）

var data: Dictionary
var rt: Dictionary
var _sprite := Sprite2D.new()


static func create_runtime(npc: Dictionary) -> Dictionary:
	return {
		"px": float(npc["pX"]),
		"py": float(npc["pY"]),
		"d": int(npc["d"]),  # 朝向（0下 1左 2右 3上）
		"sx": 0,  # walk frame x（0/32/64/96）
		"anim_tick": 0,
		"mode": "idle",
		"ticks": 30 + randi() % 60,
	}


func _init(p_data: Dictionary, p_rt: Dictionary, atlas: TileAtlas) -> void:
	data = p_data
	rt = p_rt
	var w := int(data["w"])
	var h := int(data["h"])
	# 取整個角色區塊（4 幀 × 4 向）作貼圖，region 在區塊內選幀
	_sprite.texture = atlas.region(0, int(data.get("y", 0)), 4 * w, 4 * h)
	_sprite.centered = false
	_sprite.region_enabled = true
	_sprite.position = Vector2(0, -float(h))
	add_child(_sprite)
	update_visual()


func feet_box() -> Dictionary:
	return {
		"x": float(rt["px"]),
		"y": float(rt["py"]) + FEET_OFFSET,
		"w": float(data["w"]),
		"h": float(data["h"]) - FEET_OFFSET,
	}


## 狀態機 tick（僅行走 NPC）；blocked: Callable(nx, ny, self) -> bool
func tick(blocked: Callable) -> void:
	if int(data["type"]) != 4:
		return

	if int(rt["ticks"]) <= 0:
		if rt["mode"] == "walk" or randf() < 0.4:
			rt["mode"] = "idle"
			rt["sx"] = 0
			rt["ticks"] = 40 + randi() % 80
		else:
			rt["mode"] = "walk"
			rt["d"] = randi() % 4
			rt["ticks"] = 32 + randi() % 64
	rt["ticks"] = int(rt["ticks"]) - 1
	if rt["mode"] != "walk":
		update_visual()
		return

	var speed := maxi(1, roundi(float(data.get("footSpeed", 8)) / 8.0))
	var delta: Array = [[0, speed], [-speed, 0], [speed, 0], [0, -speed]][int(rt["d"])]
	var nx := float(rt["px"]) + float(delta[0])
	var ny := float(rt["py"]) + float(delta[1])
	var nw := float(data["w"])
	var nh := float(data["h"])

	# 活動範圍（全身）+ 外部阻擋（地圖碰撞/玩家/其他 NPC）
	var out_of_area: bool = (
		nx < float(data["aX"])
		or nx + nw > float(data["aX"]) + float(data["aW"])
		or ny < float(data["aY"])
		or ny + nh > float(data["aY"]) + float(data["aH"])
	)
	if out_of_area or bool(blocked.call(nx, ny, self)):
		rt["mode"] = "idle"
		rt["sx"] = 0
		rt["ticks"] = 30 + randi() % 60
		update_visual()
		return

	rt["px"] = nx
	rt["py"] = ny
	rt["anim_tick"] = (int(rt["anim_tick"]) + 1) % 32
	rt["sx"] = (int(rt["anim_tick"]) / 8) * 32  # 步行幀循環（同玩家節奏）
	update_visual()


## 對話時轉身面向玩家（玩家朝向的反向）並定格
func face_player(player_sy: int) -> void:
	rt["d"] = 3 if player_sy == 0 else (2 if player_sy == 48 else (1 if player_sy == 96 else 0))
	rt["mode"] = "idle"
	rt["sx"] = 0
	update_visual()


func update_visual() -> void:
	var w := float(data["w"])
	var h := float(data["h"])
	position = Vector2(float(rt["px"]), float(rt["py"]) + h)
	_sprite.region_rect = Rect2(float(int(rt["sx"])), float(int(rt["d"])) * h, w, h)
