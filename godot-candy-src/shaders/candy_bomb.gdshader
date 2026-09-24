shader_type canvas_item;

// 彩色炸彈待機（spec §7）：糖粒層每 period 秒繞球心緩轉一圈。
// candy_bomb.webp 本身已烘了糖粒，所以先把原位糖粒（sprinkles 的 alpha，稍微擴張）
// 用周圍非糖粒像素補回（連巧克力漸層與高光一起補），再疊上旋轉後的糖粒，
// 最後把近白的高光與鏡面點疊回最上層。
// 補色在分支內，所以一律用 textureLod（非一致控制流內的隱式導數在 GLSL ES 未定義）。

uniform sampler2D sprinkles : source_color, filter_linear_mipmap;
uniform float period = 6.0;
uniform float phase = 0.0;

varying vec4 v_mod;

void vertex() {
	v_mod = COLOR;
}

float sprinkle_mask(vec2 uv, vec2 texel) {
	float m = 0.0;
	for (int dx = -1; dx <= 1; dx++) {
		for (int dy = -1; dy <= 1; dy++) {
			m = max(m, textureLod(sprinkles, uv + vec2(float(dx), float(dy)) * texel * 1.5, 0.0).a);
		}
	}
	return m;
}

void fragment() {
	vec2 texel = TEXTURE_PIXEL_SIZE;
	vec4 base = texture(TEXTURE, UV);
	float m = sprinkle_mask(UV, texel);
	vec3 fill = base.rgb;
	if (m > 0.0) {
		// 12 方向 × 兩圈取樣，只採不在糖粒上的像素當補色
		vec3 acc = vec3(0.0);
		float wsum = 0.0;
		for (int i = 0; i < 12; i++) {
			float a = float(i) * TAU / 12.0;
			for (int k = 1; k <= 2; k++) {
				vec2 uv = UV + vec2(cos(a), sin(a)) * texel * (4.0 * float(k) + 1.0);
				float w = 1.0 - sprinkle_mask(uv, texel);
				acc += textureLod(TEXTURE, uv, 0.0).rgb * w;
				wsum += w;
			}
		}
		if (wsum > 0.01) {
			fill = mix(base.rgb, acc / wsum, m);
		}
	}
	float ang = (TIME + phase) * TAU / period;
	vec2 r = UV - vec2(0.5);
	float c = cos(ang);
	float s = sin(ang);
	vec4 sp = texture(sprinkles, vec2(0.5) + vec2(c * r.x + s * r.y, -s * r.x + c * r.y));
	vec3 col = mix(fill, sp.rgb, sp.a);
	float hl = smoothstep(0.55, 0.85, min(fill.r, min(fill.g, fill.b)));
	col = mix(col, fill, hl);
	COLOR = vec4(col, base.a) * v_mod;
}
