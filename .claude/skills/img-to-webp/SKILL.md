---
name: img-to-webp
description: 使用 Google libwebp CLI (`cwebp`) 將 JPG/PNG 圖片批次轉換為 WebP 格式。當需要壓縮圖片、批次轉檔、或將專案圖片統一為 WebP 時使用。
---

# JPG/PNG → WebP 轉換 (CLI)

## 前置安裝

```bash
# Ubuntu/Debian
sudo apt install -y webp

# macOS
brew install webp
```

## 基本用法

```bash
# JPG → WebP（有損，品質 80）
cwebp -q 80 input.jpg -o output.webp

# PNG → WebP（無失真）
cwebp -lossless input.png -o output.webp

# PNG → WebP（有損，適合照片類 PNG）
cwebp -q 85 input.png -o output.webp
```

## 參數說明

| 參數 | 說明 |
|------|------|
| `-q <0-100>` | 品質，預設 75，數字越小檔案越小 |
| `-lossless` | 無失真壓縮（僅對 PNG 有意義） |
| `-m <0-6>` | 壓縮速度/密度，`0` 最快 `6` 最慢（檔案更小） |
| `-resize <w> <h>` | 轉檔同時縮圖 |
| `-alpha_filtering <0-3>` | Alpha 通道過濾品質 |

## 批次轉換

```bash
# 轉換目錄下所有 JPG
for f in *.jpg; do cwebp -q 80 "$f" -o "${f%.jpg}.webp"; done

# 轉換目錄下所有 PNG（無失真）
for f in *.png; do cwebp -lossless "$f" -o "${f%.png}.webp"; done

# 轉換所有 JPG + PNG
for f in *.jpg *.png; do
  [ -f "$f" ] || continue
  ext="${f##*.}"
  base="${f%.*}"
  if [ "$ext" = "png" ]; then
    cwebp -lossless "$f" -o "${base}.webp"
  else
    cwebp -q 80 "$f" -o "${base}.webp"
  fi
done
```

## 品質建議

- **PNG（UI 截圖、圖標、插畫）**: 用 `-lossless`，保留完整像素
- **JPG（照片）**: 用 `-q 80~85`，肉眼無明顯差異，體積減少 25-35%
- **大批量处理**: 加 `-m 0` 加速，最終品質差異極小

## 查看檔案資訊

```bash
# 查看 WebP 詳細資訊
webpinfo output.webp

# 比較原始與轉換後檔案大小
ls -lh input.jpg output.webp
```
