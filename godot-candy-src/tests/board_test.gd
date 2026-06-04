extends SceneTree

## board.gd 純邏輯測試（不開視窗）：
## godot --headless --path godot-candy-src --script res://tests/board_test.gd

const CandyBoardScript := preload("res://scripts/board.gd")


func _init() -> void:
	_test_fill_no_matches()
	_test_find_matches_patterns()
	_test_swap_and_legal_moves()
	_test_match_groups()
	_test_gravity_and_refill()
	_test_shuffle()
	_test_group_classification()
	_test_special_swap_and_gravity()
	print("board_test: ALL PASS")
	quit(0)


## 鋪 4 色週期盤面（任意相鄰皆不同色，保證無三連、無合法步）
static func _periodic(b: CandyBoard) -> void:
	for y in 8:
		for x in 8:
			b.set_cell(Vector2i(x, y), (x % 2) + 2 * (y % 2))


func _test_match_groups() -> void:
	var b: CandyBoard = CandyBoardScript.new(6)
	_periodic(b)
	# 兩個獨立群組：row0 橫 3 連（色5）+ col7 直 4 連（色4）
	for x in 3:
		b.set_cell(Vector2i(x, 0), 5)
	for y in range(2, 6):
		b.set_cell(Vector2i(7, y), 4)
	var groups := b.find_match_groups()
	assert(groups.size() == 2, "應有 2 個群組，實得 %d" % groups.size())
	var sizes := [groups[0]["cells"].size(), groups[1]["cells"].size()]
	sizes.sort()
	assert(sizes == [3, 4])
	# L 形：再讓 (0,1)(0,2) 同色 5 → 與 row0 三連合併為一組 5 格
	b.set_cell(Vector2i(0, 1), 5)
	b.set_cell(Vector2i(0, 2), 5)
	groups = b.find_match_groups()
	assert(groups.size() == 2)
	for g in groups:
		if g["color"] == 5:
			assert(g["cells"].size() == 5, "L 形應合併為 5 格群組")
			assert(g["runs"].size() == 2, "L 形應由橫直兩線段組成")


func _test_gravity_and_refill() -> void:
	var b: CandyBoard = CandyBoardScript.new(6)
	_periodic(b)
	# 挖掉 col2 的 y=5,6,7 與 col4 的 y=3
	b.clear_cells([Vector2i(2, 5), Vector2i(2, 6), Vector2i(2, 7), Vector2i(4, 3)])
	var snapshot_col2: Array[int] = []
	for y in 5:
		snapshot_col2.append(b.get_cell(Vector2i(2, y)))
	var moves := b.apply_gravity()
	assert(moves.size() == 5 + 3, "col2 上方 5 顆 + col4 上方 3 顆下移，實得 %d" % moves.size())
	# col2 原 y=0..4 應落至 y=3..7，順序不變
	for i in 5:
		assert(b.get_cell(Vector2i(2, i + 3)) == snapshot_col2[i], "重力後順序應保持")
	# 空格應集中在頂部
	for x in [2, 4]:
		var empties := 0
		for y in 8:
			if b.get_cell(Vector2i(x, y)) == CandyBoard.EMPTY:
				assert(y < 3, "空格應在頂部")
				empties += 1
	var spawns := b.refill()
	assert(spawns.size() == 4, "應補 4 顆")
	for y in 8:
		for x in 8:
			assert(b.get_cell(Vector2i(x, y)) != CandyBoard.EMPTY, "補位後不得有空格")


func _test_shuffle() -> void:
	var b: CandyBoard = CandyBoardScript.new(6)
	_periodic(b)  # 死局盤面
	assert(not b.has_legal_move())
	var before := b.grid.duplicate()
	before.sort()
	b.shuffle()
	assert(b.find_matches().is_empty(), "洗牌後不得有現成三連")
	assert(b.has_legal_move(), "洗牌後須有合法步")
	var after := b.grid.duplicate()
	after.sort()
	assert(before == after, "洗牌應保留原有糖果（多重集不變）")


func _test_group_classification() -> void:
	var b: CandyBoard = CandyBoardScript.new(6)
	# 4 連 → striped（方向 = 線段方向）
	_periodic(b)
	for x in 4:
		b.set_cell(Vector2i(x, 0), 5)
	var g: Dictionary = b.find_match_groups()[0]
	assert(g["kind"] == "striped" and g["horizontal"] == true)
	# 5 連 → bomb，origin 在中點
	_periodic(b)
	for y in range(1, 6):
		b.set_cell(Vector2i(3, y), 5)
	g = b.find_match_groups()[0]
	assert(g["kind"] == "bomb" and g["horizontal"] == false)
	assert(g["origin"] == Vector2i(3, 3), "5 連 origin 應在中點")
	# L 形 → wrapped，origin 在交點
	_periodic(b)
	for x in 3:
		b.set_cell(Vector2i(x, 0), 5)
	for y in 3:
		b.set_cell(Vector2i(0, y), 5)
	g = b.find_match_groups()[0]
	assert(g["kind"] == "wrapped")
	assert(g["origin"] == Vector2i(0, 0), "L 形 origin 應在交點")


func _test_special_swap_and_gravity() -> void:
	var b: CandyBoard = CandyBoardScript.new(6)
	_periodic(b)  # 無合法步底盤
	assert(not b.has_legal_move())
	# 炸彈與任何相鄰交換皆合法
	b.set_cell(Vector2i(3, 3), CandyBoard.BOMB_COLOR)
	b.set_special(Vector2i(3, 3), CandyBoard.Special.BOMB)
	assert(b.is_special_swap(Vector2i(3, 3), Vector2i(3, 4)))
	assert(b.has_legal_move(), "有炸彈就不算死局")
	# 炸彈（色 -2）不得參與顏色配對
	assert(b.find_matches().is_empty())
	# 條紋+條紋為合法特殊交換
	b.set_special(Vector2i(5, 5), CandyBoard.Special.STRIPED_H)
	b.set_special(Vector2i(5, 6), CandyBoard.Special.STRIPED_V)
	assert(b.is_special_swap(Vector2i(5, 5), Vector2i(5, 6)))
	# swap 與重力都要帶著特殊屬性走
	b.swap(Vector2i(5, 5), Vector2i(5, 6))
	assert(b.get_special(Vector2i(5, 5)) == CandyBoard.Special.STRIPED_V)
	_periodic(b)
	b.special.fill(CandyBoard.Special.NONE)
	b.set_special(Vector2i(2, 2), CandyBoard.Special.WRAPPED)
	b.clear_cells([Vector2i(2, 5), Vector2i(2, 6), Vector2i(2, 7)])
	b.apply_gravity()
	assert(b.get_special(Vector2i(2, 5)) == CandyBoard.Special.WRAPPED,
		"重力後特殊屬性應隨糖果下移")
	assert(b.get_special(Vector2i(2, 2)) == CandyBoard.Special.NONE)


func _test_fill_no_matches() -> void:
	for i in 50:
		var b: CandyBoard = CandyBoardScript.new(6)
		assert(b.grid.size() == 64, "grid 應為 8x8")
		assert(b.find_matches().is_empty(), "初始盤面不得有現成三連")
		assert(b.has_legal_move(), "初始盤面不得死局")
	# 5 色（前期關卡）也要成立
	for i in 20:
		var b: CandyBoard = CandyBoardScript.new(5)
		assert(b.find_matches().is_empty())
		for c in b.grid:
			assert(c >= 0 and c < 5, "色碼須在 0..4")


func _test_find_matches_patterns() -> void:
	var b: CandyBoard = CandyBoardScript.new(6)
	# 鋪一個保證無三連的雙色週期盤面：色碼 = (x + 2*y) % 4 之 0/1 映射不穩，
	# 改用 4 色週期 (x % 2) + 2*(y % 2) → 任意橫/直相鄰皆不同色
	for y in 8:
		for x in 8:
			b.set_cell(Vector2i(x, y), (x % 2) + 2 * (y % 2))
	assert(b.find_matches().is_empty(), "週期盤面不應有三連")
	# 橫向 3 連
	for x in 3:
		b.set_cell(Vector2i(x, 0), 5)
	var m := b.find_matches()
	assert(m.size() == 3, "應恰有 3 格消除，實得 %d" % m.size())
	# 延伸成 4 連
	b.set_cell(Vector2i(3, 0), 5)
	assert(b.find_matches().size() == 4)
	# L 形：直向再補 2 顆（(0,1)(0,2)），共 4+2 格、兩條線交於 (0,0)
	b.set_cell(Vector2i(0, 1), 5)
	b.set_cell(Vector2i(0, 2), 5)
	assert(b.find_matches().size() == 6, "L 形 = 橫4 + 直3 去重共 6 格")


func _test_swap_and_legal_moves() -> void:
	var b: CandyBoard = CandyBoardScript.new(6)
	for y in 8:
		for x in 8:
			b.set_cell(Vector2i(x, y), (x % 2) + 2 * (y % 2))
	# 週期盤面任何交換都不產生三連 → 0 合法步
	assert(b.find_legal_moves().is_empty(), "週期盤面應為死局")
	assert(not b.has_legal_move())
	# 製造「交換後可消」局面：row0 = X 5 5 ...，(0,1)=5 → 把 (0,1) 換上去成橫三連
	b.set_cell(Vector2i(1, 0), 5)
	b.set_cell(Vector2i(2, 0), 5)
	b.set_cell(Vector2i(0, 1), 5)
	assert(b.would_swap_match(Vector2i(0, 0), Vector2i(0, 1)))
	assert(b.has_legal_move())
	# would_swap_match 不得留下副作用
	var snapshot := b.grid.duplicate()
	b.would_swap_match(Vector2i(3, 3), Vector2i(4, 3))
	assert(snapshot == b.grid, "would_swap_match 不應改變盤面")
	# swap 本體
	var a_val := b.get_cell(Vector2i(0, 0))
	var b_val := b.get_cell(Vector2i(0, 1))
	b.swap(Vector2i(0, 0), Vector2i(0, 1))
	assert(b.get_cell(Vector2i(0, 0)) == b_val and b.get_cell(Vector2i(0, 1)) == a_val)
