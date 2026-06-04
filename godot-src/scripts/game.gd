extends Node2D

## 遊戲主控：載入地圖 JSON、建立圖層節點。
## Step 4：地圖渲染；後續步驟逐步加入玩家、傳送門、NPC 與對話。

# 圖庫索引對齊地圖 JSON 的 b 欄位：0=man, 1=rpg_maker_xp, 2=rpg_maker_xp2
const TEXTURES: Array = [
	preload("res://assets/man.png"),
	preload("res://assets/rpg_maker_xp.png"),
	preload("res://assets/rpg_maker_xp2.png"),
]
const TEX_GRASS := preload("res://assets/bg.jpg")

# 長條圖庫切塊快取（見 TileAtlas 註解），啟動時建立一次
var atlases: Array = []

var map_loader: MapLoader
var map_data: Dictionary = {}
var map_id := 0
var _paused := false

var world := Node2D.new()
var bg_layer := MapLayer.new()
var chars := Node2D.new()  # 玩家與 NPC 同掛此節點，Y-sort 取代手寫排序
var fg_layer := MapLayer.new()


func _ready() -> void:
	Bridge.command_received.connect(_on_bridge_command)

	for tex: Texture2D in TEXTURES:
		atlases.append(TileAtlas.new(tex))

	map_loader = MapLoader.new()
	add_child(map_loader)

	chars.y_sort_enabled = true
	world.add_child(bg_layer)
	world.add_child(chars)
	world.add_child(fg_layer)
	add_child(world)

	change_map(0)


func change_map(id: int) -> void:
	var data := await map_loader.load_map(id)
	if data.is_empty():
		return
	map_id = id
	map_data = data
	var m: Dictionary = data["map"]
	var w := int(m["width"])
	var h := int(m["height"])
	bg_layer.setup(data["styles"], false, w, h, atlases, TEX_GRASS)
	fg_layer.setup(data["styles"], true, w, h, atlases, TEX_GRASS)
	Bridge.post("MAP_CHANGED", {"mapId": id, "name": String(m["name"])})


func _on_bridge_command(type: String, payload: Dictionary) -> void:
	match type:
		"SET_PAUSED":
			_paused = bool(payload.get("paused", false))
		"RESTART":
			change_map(0)
