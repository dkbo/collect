class_name CandyFx
extends Node2D

## 盤面特效層（spec §7）：消除閃光、糖粒、條紋光束、包裝衝擊波、彩色炸彈電光。
## 由 BoardView 以子節點建立，座標與盤面相同；每個特效播完即自毀。
## 素材皆 @2x，以 TEX_SCALE 呈現成邏輯尺寸。

const TEX_SCALE := 0.5
const MAX_PARTICLES := 300  # 單次消除的粒子總量上限
const MIN_PER_CELL := 2
const FLASH_TIME := 0.18
const BEAM_TIME := 0.25
const RING_TIME := 0.3
const RING_CELLS := 3.0  # 衝擊波 scale 1 時涵蓋 3×3 格
const CELL := 56.0

const FLASH_TEX := preload("res://assets/candy/fx_flash.webp")
const SUGAR_TEX := preload("res://assets/candy/fx_sugar.webp")
const BEAM_TEX := preload("res://assets/candy/fx_stripe_beam.webp")
const RING_TEX := preload("res://assets/candy/fx_ring.webp")

static var _add_mat: CanvasItemMaterial


static func additive() -> CanvasItemMaterial:
	if _add_mat == null:
		_add_mat = CanvasItemMaterial.new()
		_add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return _add_mat


## 粒子配額：總數＝min(300, Σ)。超過時每格先保底 2 顆，其餘依各格超出保底的量等比例分配
## （最大餘數法，總數剛好 300、每格不超過原本）。
static func particle_budget(counts: Array) -> Array[int]:
	var out: Array[int] = []
	var total := 0
	for c in counts:
		total += int(c)
	if total <= MAX_PARTICLES:
		for c in counts:
			out.append(int(c))
		return out
	var n := counts.size()
	var spare := MAX_PARTICLES - n * MIN_PER_CELL
	if spare <= 0:
		out.resize(n)
		out.fill(MIN_PER_CELL)
		return out
	var excess := 0
	for c in counts:
		excess += maxi(int(c) - MIN_PER_CELL, 0)
	var rema: Array[float] = []
	var given := 0
	for c in counts:
		var q := float(maxi(int(c) - MIN_PER_CELL, 0)) * spare / excess
		out.append(MIN_PER_CELL + int(q))
		rema.append(q - floorf(q))
		given += int(q)
	var order := range(n)
	order.sort_custom(func(a, b): return rema[a] > rema[b])
	for i in spare - given:
		out[order[i]] += 1
	return out


## 連鎖第 k 層：閃光放大 1+0.1k、粒子數 +2k。
static func flash_scale(cascade: int) -> float:
	return 1.0 + 0.1 * cascade


static func cascade_particles(base: int, cascade: int) -> int:
	return base + 2 * cascade


## delay 秒後呼叫（0 就立刻）；特效層被釋放時 timer 的連線會自動斷開。
func later(delay: float, fn: Callable) -> void:
	if delay <= 0.0:
		fn.call()
	else:
		get_tree().create_timer(delay).timeout.connect(fn)


func _sprite(tex: Texture2D, pos: Vector2, color: Color, add := true) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = tex
	s.position = pos
	s.modulate = color
	s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	if add:
		s.material = additive()
	add_child(s)
	return s


## 消除星芒：本色、scale 0.4→1.3（×size_mul）、alpha 1→0、0.18s、ADD。
func flash(pos: Vector2, color: Color, size_mul := 1.0, time := FLASH_TIME) -> Sprite2D:
	var s := _sprite(FLASH_TEX, pos, color)
	var k := TEX_SCALE * size_mul
	s.scale = Vector2.ONE * 0.4 * k
	var t := s.create_tween().set_parallel()
	t.tween_property(s, "scale", Vector2.ONE * 1.3 * k, time).set_ease(Tween.EASE_OUT)
	t.tween_property(s, "modulate:a", 0.0, time).set_ease(Tween.EASE_IN)
	t.chain().tween_callback(s.queue_free)
	return s


## 糖粒爆發：fx_sugar 貼圖、隨機角度並旋轉，一次性、播完自毀。
func burst(pos: Vector2, color: Color, amount: int) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.position = pos
	p.texture = SUGAR_TEX
	p.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	p.one_shot = true
	p.amount = maxi(amount, 1)
	p.lifetime = 0.45
	p.explosiveness = 1.0
	p.spread = 180.0
	p.initial_velocity_min = 60.0
	p.initial_velocity_max = 160.0
	p.gravity = Vector2(0, 260)
	p.angle_min = 0.0
	p.angle_max = 360.0
	p.angular_velocity_min = -540.0
	p.angular_velocity_max = 540.0
	p.scale_amount_min = 0.25  # 32px @2x → 約 8–13 邏輯單位
	p.scale_amount_max = 0.42
	p.color = color
	add_child(p)
	p.emitting = true
	get_tree().create_timer(p.lifetime + 0.2).timeout.connect(p.queue_free)
	return p


## 條紋光束：以 pos 為中心沿行（或列）在 0.25s 內展開到 length 長，再淡出。
func beam(pos: Vector2, horizontal: bool, color: Color, length: float) -> Sprite2D:
	var s := _sprite(BEAM_TEX, pos, color)
	s.rotation = 0.0 if horizontal else PI / 2
	var full := length / BEAM_TEX.get_width()
	s.scale = Vector2(0.0, TEX_SCALE)
	var t := s.create_tween()
	t.tween_property(s, "scale:x", full, BEAM_TIME).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	t.tween_property(s, "modulate:a", 0.0, 0.15)
	t.tween_callback(s.queue_free)
	return s


## 包裝爆炸衝擊波：以 3×3 範圍為基準 scale 0.3→1.6、alpha 1→0、0.3s。
func ring(pos: Vector2, color := Color.WHITE) -> Sprite2D:
	var s := _sprite(RING_TEX, pos, color)
	var k := CELL * RING_CELLS / RING_TEX.get_width()
	s.scale = Vector2.ONE * 0.3 * k
	var t := s.create_tween().set_parallel()
	t.tween_property(s, "scale", Vector2.ONE * 1.6 * k, RING_TIME).set_ease(Tween.EASE_OUT)
	t.tween_property(s, "modulate:a", 0.0, RING_TIME).set_ease(Tween.EASE_IN)
	t.chain().tween_callback(s.queue_free)
	return s


## 彩色炸彈電光：Line2D 鋸齒線（寬 3、目標色、additive），停留後淡出自毀。
func bolt(from: Vector2, to: Vector2, color: Color, hold := 0.25) -> Line2D:
	var line := Line2D.new()
	line.width = 3.0
	line.default_color = color
	line.material = additive()
	line.joint_mode = Line2D.LINE_JOINT_ROUND
	line.begin_cap_mode = Line2D.LINE_CAP_ROUND
	line.end_cap_mode = Line2D.LINE_CAP_ROUND
	line.points = bolt_points(from, to)
	add_child(line)
	var t := line.create_tween()
	t.tween_interval(hold)
	t.tween_property(line, "modulate:a", 0.0, 0.15)
	t.tween_callback(line.queue_free)
	return line


## 起點到終點切 6 段，中間點沿垂直方向隨機偏移 ±6。
static func bolt_points(from: Vector2, to: Vector2, segments := 6) -> PackedVector2Array:
	var pts := PackedVector2Array([from])
	var normal := (to - from).orthogonal().normalized()
	for i in range(1, segments):
		pts.append(from.lerp(to, float(i) / segments) + normal * randf_range(-6.0, 6.0))
	pts.append(to)
	return pts
