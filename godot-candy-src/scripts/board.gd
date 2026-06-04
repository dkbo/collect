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
