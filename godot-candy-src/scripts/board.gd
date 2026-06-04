class_name CandyBoard
extends RefCounted

## 純邏輯盤面（不碰任何節點）：8×8 grid、隨機填充排除三連、
## 消除判定、交換、合法步枚舉（死局檢測用）。可獨立以 headless 腳本驗證。

const SIZE := 8
const EMPTY := -1

var color_count := 6
var grid: Array[int] = []  # 長度 SIZE*SIZE，存色碼 0..color_count-1


func _init(colors := 6) -> void:
	color_count = colors
	fill_random()


static func idx(p: Vector2i) -> int:
	return p.y * SIZE + p.x


static func in_bounds(p: Vector2i) -> bool:
	return p.x >= 0 and p.x < SIZE and p.y >= 0 and p.y < SIZE


static func are_adjacent(a: Vector2i, b: Vector2i) -> bool:
	return abs(a.x - b.x) + abs(a.y - b.y) == 1


func get_cell(p: Vector2i) -> int:
	return grid[idx(p)]


func set_cell(p: Vector2i, color: int) -> void:
	grid[idx(p)] = color


func swap(a: Vector2i, b: Vector2i) -> void:
	var tmp := get_cell(a)
	set_cell(a, get_cell(b))
	set_cell(b, tmp)


## 隨機填滿盤面，邊填邊排除「與左二/上二同色」避免現成三連；
## 填完若無合法步（死局）則重填。
func fill_random() -> void:
	grid.resize(SIZE * SIZE)
	for attempt in 20:
		for y in SIZE:
			for x in SIZE:
				var p := Vector2i(x, y)
				var banned: Array[int] = []
				if x >= 2 and get_cell(p + Vector2i.LEFT) == get_cell(p + Vector2i.LEFT * 2):
					banned.append(get_cell(p + Vector2i.LEFT))
				if y >= 2 and get_cell(p + Vector2i.UP) == get_cell(p + Vector2i.UP * 2):
					banned.append(get_cell(p + Vector2i.UP))
				var color := randi() % color_count
				while color in banned:
					color = randi() % color_count
				set_cell(p, color)
		if has_legal_move():
			return
	# 20 次仍死局機率趨近 0；保底直接沿用最後一次盤面


## 回傳所有屬於橫/直 3 連以上的格子（去重）。L/T 形自然包含於兩條線。
func find_matches() -> Array[Vector2i]:
	var matched := {}
	# 橫向掃描（run-length）
	for y in SIZE:
		var run_start := 0
		for x in range(1, SIZE + 1):
			if x < SIZE and grid[y * SIZE + x] != EMPTY \
					and grid[y * SIZE + x] == grid[y * SIZE + run_start]:
				continue
			if x - run_start >= 3 and grid[y * SIZE + run_start] != EMPTY:
				for i in range(run_start, x):
					matched[Vector2i(i, y)] = true
			run_start = x
	# 縱向掃描
	for x in SIZE:
		var run_start := 0
		for y in range(1, SIZE + 1):
			if y < SIZE and grid[y * SIZE + x] != EMPTY \
					and grid[y * SIZE + x] == grid[run_start * SIZE + x]:
				continue
			if y - run_start >= 3 and grid[run_start * SIZE + x] != EMPTY:
				for i in range(run_start, y):
					matched[Vector2i(x, i)] = true
			run_start = y
	var result: Array[Vector2i] = []
	result.assign(matched.keys())
	return result


## 收集所有橫/直 3 連以上的「線段」：[{cells, color, horizontal}]
func _find_runs() -> Array:
	var runs := []
	for y in SIZE:
		var s := 0
		for x in range(1, SIZE + 1):
			if x < SIZE and grid[y * SIZE + x] != EMPTY \
					and grid[y * SIZE + x] == grid[y * SIZE + s]:
				continue
			if x - s >= 3 and grid[y * SIZE + s] != EMPTY:
				var cells: Array[Vector2i] = []
				for i in range(s, x):
					cells.append(Vector2i(i, y))
				runs.append({"cells": cells, "color": grid[y * SIZE + s], "horizontal": true})
			s = x
	for x in SIZE:
		var s := 0
		for y in range(1, SIZE + 1):
			if y < SIZE and grid[y * SIZE + x] != EMPTY \
					and grid[y * SIZE + x] == grid[s * SIZE + x]:
				continue
			if y - s >= 3 and grid[s * SIZE + x] != EMPTY:
				var cells: Array[Vector2i] = []
				for i in range(s, y):
					cells.append(Vector2i(x, i))
				runs.append({"cells": cells, "color": grid[s * SIZE + x], "horizontal": false})
			s = y
	return runs


## 將相交的同色線段合併成消除群組（L/T 形 = 橫直線交疊成一組），
## 回傳 [{cells: Array[Vector2i], color, runs: 原始線段}]，計分以群組為單位。
func find_match_groups() -> Array:
	var groups := []
	for run in _find_runs():
		var hits := []
		for g in groups:
			if g["color"] != run["color"]:
				continue
			for c in run["cells"]:
				if c in g["cell_set"]:
					hits.append(g)
					break
		var target: Dictionary
		if hits.is_empty():
			target = {"color": run["color"], "cell_set": {}, "runs": []}
			groups.append(target)
		else:
			target = hits[0]
			for i in range(1, hits.size()):  # 一條線橋接多個群組 → 全部併入
				target["cell_set"].merge(hits[i]["cell_set"])
				target["runs"].append_array(hits[i]["runs"])
				groups.erase(hits[i])
		for c in run["cells"]:
			target["cell_set"][c] = true
		target["runs"].append(run)
	for g in groups:
		var cells: Array[Vector2i] = []
		cells.assign(g["cell_set"].keys())
		g["cells"] = cells
		g.erase("cell_set")
	return groups


## 清空指定格（消除後呼叫）。
func clear_cells(cells: Array) -> void:
	for c in cells:
		set_cell(c, EMPTY)


## 重力下沉：每欄非空格往下壓實，回傳位移清單 [{from, to}]（供動畫）。
func apply_gravity() -> Array:
	var moves := []
	for x in SIZE:
		var write := SIZE - 1
		for y in range(SIZE - 1, -1, -1):
			if grid[y * SIZE + x] == EMPTY:
				continue
			if y != write:
				grid[write * SIZE + x] = grid[y * SIZE + x]
				grid[y * SIZE + x] = EMPTY
				moves.append({"from": Vector2i(x, y), "to": Vector2i(x, write)})
			write -= 1
	return moves


## 頂部補新糖果（隨機色），回傳 [{cell, color}]（供動畫）。
func refill() -> Array:
	var spawns := []
	for x in SIZE:
		for y in SIZE:
			if grid[y * SIZE + x] == EMPTY:
				var color := randi() % color_count
				grid[y * SIZE + x] = color
				spawns.append({"cell": Vector2i(x, y), "color": color})
	return spawns


## 死局洗牌：保留盤面糖果重排（多重集不變），直到無現成三連且有合法步。
## 建構式擺放：洗亂後逐格從剩餘糖果挑「不與左二/上二成三連」者，避免純隨機高失敗率。
func shuffle() -> void:
	var original := grid.duplicate()
	for attempt in 50:
		var bag := original.duplicate()
		bag.shuffle()
		if _place_from_bag(bag) and has_legal_move():
			return
	grid = original
	fill_random()  # 保底：理論上幾乎不會走到


## 依序將 bag 中的糖果擺入盤面，跳過會成三連的色；成功回傳 true。
func _place_from_bag(bag: Array) -> bool:
	var new_grid := grid.duplicate()
	for i in new_grid.size():
		new_grid[i] = EMPTY
	grid = new_grid
	for y in SIZE:
		for x in SIZE:
			var p := Vector2i(x, y)
			var placed := false
			for j in bag.size():
				var color: int = bag[j]
				if x >= 2 and get_cell(p + Vector2i.LEFT) == color \
						and get_cell(p + Vector2i.LEFT * 2) == color:
					continue
				if y >= 2 and get_cell(p + Vector2i.UP) == color \
						and get_cell(p + Vector2i.UP * 2) == color:
					continue
				set_cell(p, color)
				bag.remove_at(j)
				placed = true
				break
			if not placed:
				return false
	return true


## 交換 a、b 後是否會產生消除（檢查完立即還原，不留副作用）。
func would_swap_match(a: Vector2i, b: Vector2i) -> bool:
	swap(a, b)
	var ok := not find_matches().is_empty()
	swap(a, b)
	return ok


## 枚舉所有合法步（交換後可消除的相鄰對），死局檢測用。
func find_legal_moves() -> Array:
	var moves := []
	for y in SIZE:
		for x in SIZE:
			var p := Vector2i(x, y)
			for dir in [Vector2i.RIGHT, Vector2i.DOWN]:
				var q: Vector2i = p + dir
				if in_bounds(q) and would_swap_match(p, q):
					moves.append([p, q])
	return moves


func has_legal_move() -> bool:
	for y in SIZE:
		for x in SIZE:
			var p := Vector2i(x, y)
			for dir in [Vector2i.RIGHT, Vector2i.DOWN]:
				var q: Vector2i = p + dir
				if in_bounds(q) and would_swap_match(p, q):
					return true
	return false
