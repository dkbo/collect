class_name RpgUtil
extends RefCounted

## 共用純函式：AABB 相交判斷直接移植 RpgRoom（types.ts aabbIntersect），
## 邊界接觸即視為相交，不用物理引擎以保證行為零差異。


static func aabb_intersect(x: float, y: float, w: float, h: float, r: Dictionary) -> bool:
	return (
		x + w >= float(r["x"])
		and x <= float(r["x"]) + float(r["w"])
		and y + h >= float(r["y"])
		and y <= float(r["y"]) + float(r["h"])
	)
