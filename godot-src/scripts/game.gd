extends Node2D

## 遊戲主控：載入地圖 JSON、建立圖層、驅動玩家與攝影機。
## 以 60Hz 固定 tick（_physics_process）對齊原版 rAF 邏輯，後續步驟加入傳送門、NPC 與對話。

# 圖庫索引對齊地圖 JSON 的 b 欄位：0=man, 1=rpg_maker_xp, 2=rpg_maker_xp2
# （長條圖庫以 image importer 匯入為 CPU Image，man.png 維持 Texture2D 供 Sprite2D 直用）
const TEXTURES: Array = [
	preload("res://assets/man.png"),
	preload("res://assets/rpg_maker_xp.png"),
	preload("res://assets/rpg_maker_xp2.png"),
]
const TEX_GRASS := preload("res://assets/bg.jpg")

const NX := 32.0  # 玩家碰撞框寬
const NY := 48.0  # 玩家碰撞框高

# 長條圖庫切塊快取（見 TileAtlas 註解），啟動時建立一次
var atlases: Array = []

var map_loader: MapLoader
var map_data: Dictionary = {}
var map_id := 0
var _paused := false
var _loading := true
var _pos_tick := 0  # PLAYER_POS 節流（每 12 tick ≈ 5Hz）

var world := Node2D.new()
var bg_layer := MapLayer.new()
var chars := Node2D.new()  # 玩家與 NPC 同掛此節點，Y-sort 取代手寫排序
var fg_layer := MapLayer.new()
var player: Player
var camera := Camera2D.new()

# NPC：節點清單（當前地圖）+ 運行時狀態緩存（依 mapId，跨場景保留走位）
var npcs: Array[Npc] = []
var npc_runtimes: Dictionary = {}

# 對話狀態：NPC 全部定格；頁碼為全域計數（對齊原版 messageCount，移動或無目標時關閉）
var is_chat := false
var chat_count := 0

# 觸控操作層（行動裝置虛擬搖桿 + A 鈕）
var ui_layer := CanvasLayer.new()
var touch_controls := TouchControls.new()

# 場景切換黑幕（CanvasLayer 不受攝影機影響，layer 高於觸控層）
var fade_layer := CanvasLayer.new()
var fade_rect := ColorRect.new()


func _ready() -> void:
	Bridge.command_received.connect(_on_bridge_command)

	for tex: Resource in TEXTURES:
		atlases.append(TileAtlas.new(tex))

	map_loader = MapLoader.new()
	add_child(map_loader)

	chars.y_sort_enabled = true
	world.add_child(bg_layer)
	world.add_child(chars)
	world.add_child(fg_layer)
	add_child(world)

	player = Player.new(TEXTURES[0])
	chars.add_child(player)

	camera.anchor_mode = Camera2D.ANCHOR_MODE_FIXED_TOP_LEFT
	add_child(camera)
	camera.make_current()

	ui_layer.layer = 1
	touch_controls.interact_pressed.connect(_on_touch_interact)
	ui_layer.add_child(touch_controls)
	add_child(ui_layer)

	fade_layer.layer = 2
	fade_rect.color = Color.BLACK
	fade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fade_layer.add_child(fade_rect)
	add_child(fade_layer)

	_initial_load()


func _initial_load() -> void:
	_loading = true
	await change_map(0, 0)
	await _fade_to(0.0, 0.3)
	_loading = false


## 切換地圖並把玩家放到 map.in[spawn_index] 落點
func change_map(id: int, spawn_index: int) -> void:
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

	_rebuild_npcs(id)

	var spawn: Dictionary = m["in"][spawn_index]
	player.place(float(spawn["x"]), float(spawn["y"]))
	_update_camera()
	Bridge.post("MAP_CHANGED", {"mapId": id, "name": String(m["name"])})


## 重建當前地圖 NPC 節點（運行時狀態以 mapId 緩存，跨場景保留走位）
func _rebuild_npcs(id: int) -> void:
	for npc in npcs:
		npc.queue_free()
	npcs.clear()

	var npc_list: Array = map_data.get("npc", [])
	var messages: Array = map_data.get("messages", [])
	if not npc_runtimes.has(id):
		var runtimes: Array = []
		for npc_data: Dictionary in npc_list:
			runtimes.append(Npc.create_runtime(npc_data))
		npc_runtimes[id] = runtimes

	for i in npc_list.size():
		var npc_data: Dictionary = npc_list[i]
		var e := int(npc_data.get("e", -1))
		if e < 0 or e >= messages.size():
			continue  # 無對話資料者不渲染（對齊原版）
		var npc := Npc.new(npc_data, npc_runtimes[id][i], atlases[int(npc_data.get("b", 0))])
		npcs.append(npc)
		chars.add_child(npc)


func _physics_process(_delta: float) -> void:
	if _paused or _loading or map_data.is_empty():
		return
	var moved := player.tick(_gather_input(), _can_move, _check_transition)
	if moved and is_chat:
		_close_chat()  # 移動即關閉對話（對齊原版）

	# 對話中全部定格（對齊原版 updateNpcs 提前 return）
	if not is_chat:
		for npc in npcs:
			npc.tick(_npc_blocked)

	_update_camera()

	# 座標節流回報（僅供 React HUD 顯示）
	_pos_tick += 1
	if _pos_tick >= 12:
		_pos_tick = 0
		Bridge.post("PLAYER_POS", {"x": int(player.px), "y": int(player.py)})


# ── 互動/對話（移植原版 handleInteract + advanceChat） ──

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key := (event as InputEventKey).physical_keycode
		if (key == KEY_SPACE or key == KEY_ENTER) and not (_paused or _loading or map_data.is_empty()):
			_interact()


func _interact() -> void:
	# 面向處偏移（speed px，對齊原版 checkOffset）
	var check := Vector2.ZERO
	match player.sy:
		0:
			check = Vector2(0, Player.SPEED)
		48:
			check = Vector2(-Player.SPEED, 0)
		96:
			check = Vector2(Player.SPEED, 0)
		144:
			check = Vector2(0, -Player.SPEED)
	var x := player.px + check.x
	var y := player.py + check.y

	# 面向處的事件碰撞區
	var found := false
	for json: Dictionary in map_data["isMove"]:
		if int(json.get("e", -1)) >= 0 and RpgUtil.aabb_intersect(x, y, NX, NY, json):
			found = _advance_chat(int(json["e"]))
			break

	# NPC（下半身碰撞框）；對話時 NPC 轉身面向玩家
	if not found:
		for npc in npcs:
			if RpgUtil.aabb_intersect(x, y, NX, NY, npc.feet_box()):
				found = _advance_chat(int(npc.data["e"]))
				if found:
					npc.face_player(player.sy)
				break

	if not found and is_chat:
		_close_chat()


## 推進對話頁碼；text 為原始 markup 字串，渲染交給 React（messageRenderer）
func _advance_chat(event_index: int) -> bool:
	var messages: Array = map_data.get("messages", [])
	if event_index < 0 or event_index >= messages.size():
		return false
	var msg: Dictionary = messages[event_index]
	var texts: Array = msg.get("text", [])
	if texts.is_empty():
		return false

	chat_count += 1
	if chat_count <= texts.size():
		is_chat = true
		touch_controls.set_chat_lift(true)
		Bridge.post("NPC_CHAT", {
			"name": String(msg.get("name", "")),
			"text": String(texts[chat_count - 1]),
			"page": chat_count,
			"total": texts.size(),
		})
	else:
		_close_chat()
	return true


func _close_chat() -> void:
	is_chat = false
	chat_count = 0
	touch_controls.set_chat_lift(false)
	Bridge.post("CHAT_CLOSED")


# ── 輸入（WASD + 方向鍵；觸控於 Step 9 加入） ──

func _gather_input() -> Dictionary:
	var joy: Dictionary = touch_controls.dir
	return {
		"left": Input.is_physical_key_pressed(KEY_LEFT) or Input.is_physical_key_pressed(KEY_A) or joy["left"],
		"right": Input.is_physical_key_pressed(KEY_RIGHT) or Input.is_physical_key_pressed(KEY_D) or joy["right"],
		"up": Input.is_physical_key_pressed(KEY_UP) or Input.is_physical_key_pressed(KEY_W) or joy["up"],
		"down": Input.is_physical_key_pressed(KEY_DOWN) or Input.is_physical_key_pressed(KEY_S) or joy["down"],
	}


func _on_touch_interact() -> void:
	if not (_paused or _loading or map_data.is_empty()):
		_interact()


# ── 碰撞（AABB 純邏輯，對齊原版 canMove） ──

func _can_move(chk_x: float, chk_y: float) -> bool:
	var m: Dictionary = map_data["map"]
	if chk_x < 0 or chk_x + NX > float(m["width"]) or chk_y < 0 or chk_y + NY > float(m["height"]):
		return false
	for json: Dictionary in map_data["isMove"]:
		if RpgUtil.aabb_intersect(chk_x, chk_y, NX, NY, json):
			return false
	# NPC 阻擋（下半身碰撞框）
	for npc in npcs:
		if RpgUtil.aabb_intersect(chk_x, chk_y, NX, NY, npc.feet_box()):
			return false
	return true


## 行走 NPC 阻擋判斷（地圖碰撞區（傳送區不擋）+ 玩家 + 其他 NPC）
func _npc_blocked(nx: float, ny: float, who: Npc) -> bool:
	var feet := {
		"x": nx,
		"y": ny + Npc.FEET_OFFSET,
		"w": float(who.data["w"]),
		"h": float(who.data["h"]) - Npc.FEET_OFFSET,
	}
	for json: Dictionary in map_data["isMove"]:
		if not json.has("cm") and RpgUtil.aabb_intersect(
			float(feet["x"]), float(feet["y"]), float(feet["w"]), float(feet["h"]), json
		):
			return true
	if RpgUtil.aabb_intersect(player.px, player.py, NX, NY, feet):
		return true
	for other in npcs:
		if other != who and RpgUtil.aabb_intersect(
			float(feet["x"]), float(feet["y"]), float(feet["w"]), float(feet["h"]),
			{"x": other.rt["px"], "y": float(other.rt["py"]) + 24.0, "w": 32.0, "h": 24.0}
		):
			return true
	return false


## 傳送門檢查：踩到 cm/cmm 碰撞區即觸發黑幕換圖（對齊原版 checkTransition）
func _check_transition(chk_x: float, chk_y: float) -> bool:
	for json: Dictionary in map_data["isMove"]:
		if (
			int(json.get("cm", -1)) >= 0
			and int(json.get("cmm", -1)) >= 0
			and RpgUtil.aabb_intersect(chk_x, chk_y, NX, NY, json)
		):
			_transition_to(int(json["cm"]), int(json["cmm"]))
			return true
	return false


func _transition_to(id: int, spawn_index: int) -> void:
	_loading = true
	await _fade_to(1.0, 0.2)
	await change_map(id, spawn_index)
	# 黑幕停留片刻再淡出（對齊原版 500ms 載入幕）
	await get_tree().create_timer(0.1).timeout
	await _fade_to(0.0, 0.2)
	_loading = false


func _fade_to(alpha: float, duration: float) -> void:
	var tw := create_tween()
	tw.tween_property(fade_rect, "color:a", alpha, duration)
	await tw.finished


# ── 攝影機（移植原版 updateCamera：跟隨點 + 邊界 + 小地圖置中） ──

func _update_camera() -> void:
	var vp := get_viewport_rect().size
	var w := vp.x
	var h := vp.y
	var m: Dictionary = map_data["map"]
	var sw := float(m["width"])
	var sh := float(m["height"])
	var px := player.px
	var py := player.py

	# 跟隨點（視窗 3/4 處、取 4 的倍數，對齊原版 mRf/mDw）
	var m_rf := floorf(w / 2.0 + (w / 4.0 - NX))
	m_rf -= fmod(m_rf, 4.0)
	var m_dw := floorf(h / 2.0 + (h / 4.0 - NY))
	m_dw -= fmod(m_dw, 4.0)

	var msx: float
	if w > sw or px <= m_rf:
		msx = 0.0
	elif px >= sw - NX or (px - m_rf) > (sw - w):
		msx = sw - w
	else:
		msx = px - m_rf

	var msy: float
	if h > sh or py <= m_dw:
		msy = 0.0
	elif py >= sh - NY or (py - m_dw) > (sh - h):
		msy = sh - h
	else:
		msy = py - m_dw

	# 地圖小於視窗時置中顯示
	camera.position = Vector2(
		-((w - sw) / 2.0) if w > sw else msx,
		-((h - sh) / 2.0) if h > sh else msy
	)


func _on_bridge_command(type: String, payload: Dictionary) -> void:
	match type:
		"SET_PAUSED":
			_paused = bool(payload.get("paused", false))
		"ADVANCE_CHAT":
			if not (_paused or _loading or map_data.is_empty()):
				_interact()
		"RESTART":
			_transition_to(0, 0)
		"DEBUG_STATE":
			# 驗收輔助：回報玩家/NPC 運行時狀態（不在正式協定中）
			var npc_states: Array = []
			for npc in npcs:
				npc_states.append({"px": npc.rt["px"], "py": npc.rt["py"], "mode": npc.rt["mode"], "d": npc.rt["d"]})
			Bridge.post("DEBUG_STATE", {
				"mapId": map_id, "px": player.px, "py": player.py, "npcs": npc_states,
				"touchVisible": touch_controls.visible,
				"touchSize": [touch_controls.size.x, touch_controls.size.y],
				"viewport": [get_viewport_rect().size.x, get_viewport_rect().size.y],
			})
