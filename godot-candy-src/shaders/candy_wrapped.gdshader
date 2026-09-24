shader_type canvas_item;

// 包裝糖待機（spec §7）：兩側扭結以糖身邊緣為軸 ±6° 鏡像擺動，1.2s 一輪。
// 做法是對扭結區的 UV 做局部旋轉：轉角隨離軸距離與離扭結中線距離平滑衰減，
// 糖身本體完全不動、沒有接縫。座標以 @1x 64 畫布計（糖身 x 12..52、扭結中線 y 32）。

uniform float amp_deg = 6.0;
uniform float period = 1.2;
uniform float phase = 0.0;
uniform float canvas_px = 64.0;
uniform float body_left = 12.0;
uniform float body_right = 52.0;
uniform float knot_y = 32.0;
uniform float knot_half = 8.0;

varying vec4 v_mod;

void vertex() {
	v_mod = COLOR; // modulate（已引爆脈動會調亮度），貼圖另外取樣
}

void fragment() {
	vec2 px = UV * canvas_px;
	float side = px.x < canvas_px * 0.5 ? -1.0 : 1.0;
	vec2 pivot = vec2(side < 0.0 ? body_left : body_right, knot_y);
	float outward = (px.x - pivot.x) * side; // >0 在糖身外側
	float wx = smoothstep(0.0, 3.0, outward);
	float wy = 1.0 - smoothstep(knot_half, knot_half + 5.0, abs(px.y - knot_y));
	float ang = radians(amp_deg) * sin((TIME + phase) * TAU / period) * side * wx * wy;
	vec2 r = px - pivot;
	float c = cos(ang);
	float s = sin(ang);
	vec2 src = pivot + vec2(c * r.x + s * r.y, -s * r.x + c * r.y);
	COLOR = texture(TEXTURE, src / canvas_px) * v_mod;
}
