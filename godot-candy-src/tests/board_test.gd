extends SceneTree

## board.gd 純邏輯測試（不開視窗）：
## godot --headless --path godot-candy-src --script res://tests/board_test.gd

const CandyBoardScript := preload("res://scripts/board.gd")


func _init() -> void:
	_test_fill_no_matches()
	_test_find_matches_patterns()
	_test_swap_and_legal_moves()
	print("board_test: ALL PASS")
	quit(0)


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
