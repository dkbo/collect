shader_type canvas_item;

// 橫幅文字填色的由上到下漸層（Sweet Crush!）：只換白色填色像素，外框與落影保持原色。
// y_top／y_bottom 是 Label 本地座標的字身範圍，由 board_view.gd 依字級設定。

uniform vec4 top_color : source_color = vec4(1.0, 0.953, 0.627, 1.0);
uniform vec4 bottom_color : source_color = vec4(1.0, 0.761, 0.102, 1.0);
uniform float y_top = 0.0;
uniform float y_bottom = 64.0;

varying float local_y;

void vertex() {
	local_y = VERTEX.y;
}

void fragment() {
	if (COLOR.r > 0.9 && COLOR.g > 0.9 && COLOR.b > 0.9) {
		float t = clamp((local_y - y_top) / max(y_bottom - y_top, 1.0), 0.0, 1.0);
		COLOR.rgb = mix(top_color.rgb, bottom_color.rgb, t);
	}
}
