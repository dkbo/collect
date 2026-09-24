shader_type canvas_item;

// 條紋糖待機流光（spec §7）：每 period 秒一道 45° 白光掃過，寬 12px（@1x）、歷時 0.4s。
// 以貼圖 alpha 當形狀遮罩，落影與半透明邊緣不發亮。只掛在條紋糖上。

uniform float period = 2.5;
uniform float sweep = 0.4;
uniform float band_px = 12.0;   // @1x 光帶寬
uniform float canvas_px = 64.0; // @1x 畫布邊長
uniform float strength = 0.6;
uniform float phase = 0.0;      // 每顆錯開，避免整盤同步

void fragment() {
	float p = mod(TIME + phase, period) / sweep; // 0..1 為掃過中
	float span = canvas_px * 1.41421356;
	float diag = (UV.x + UV.y) * canvas_px * 0.70710678; // 沿 45° 方向的距離
	float center = mix(-band_px, span + band_px, p);
	float band = p <= 1.0 ? 1.0 - smoothstep(band_px * 0.25, band_px * 0.5, abs(diag - center)) : 0.0;
	float mask = smoothstep(0.8, 1.0, texture(TEXTURE, UV).a);
	COLOR.rgb = mix(COLOR.rgb, vec3(1.0), band * mask * strength);
}
