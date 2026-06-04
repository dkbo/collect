#!/usr/bin/env python3
"""程式生成糖果消消樂音效（CC0 等級的自製簡單合成音，無版權疑慮）。

用法：python3 godot-candy-src/tools/gen_sfx.py
輸出：godot-candy-src/assets/sfx/*.wav（22050Hz 16-bit mono，每檔數 KB）
"""
import math
import os
import random
import struct
import wave

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sfx")
random.seed(42)  # 雜訊類音效可重現


def write_wav(name: str, samples: list[float]) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{name}.wav")
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(
            b"".join(
                struct.pack("<h", max(-32767, min(32767, int(s * 32767))))
                for s in samples
            )
        )
    print(f"  {name}.wav  {len(samples) / SR * 1000:.0f}ms")


def silence(dur: float) -> list[float]:
    return [0.0] * int(SR * dur)


def tone(f0: float, f1: float, dur: float, vol: float, decay: float = 6.0,
         attack: float = 0.005, harmonic: float = 0.0) -> list[float]:
    """頻率 f0→f1 線性滑音的正弦音，指數衰減包絡。"""
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * t
        phase += 2 * math.pi * f / SR
        env = min(1.0, (i / SR) / attack) * math.exp(-decay * t)
        s = math.sin(phase) + harmonic * math.sin(2 * phase)
        out.append(s * env * vol)
    return out


def noise_burst(dur: float, vol: float, decay: float = 8.0, smooth: int = 6) -> list[float]:
    """平滑化白噪音爆發（近似低通）。"""
    n = int(SR * dur)
    raw = [random.uniform(-1, 1) for _ in range(n)]
    out = []
    for i in range(n):
        lo = max(0, i - smooth)
        avg = sum(raw[lo:i + 1]) / (i + 1 - lo)
        env = math.exp(-decay * i / n)
        out.append(avg * env * vol)
    return out


def mix(*tracks: tuple[list[float], float]) -> list[float]:
    """疊加多軌：(samples, 起始秒) 清單。"""
    total = max(int(off * SR) + len(s) for s, off in tracks)
    out = [0.0] * total
    for s, off in tracks:
        base = int(off * SR)
        for i, v in enumerate(s):
            out[base + i] += v
    peak = max(1.0, max(abs(v) for v in out))
    return [v / peak for v in out]


print("生成 SFX：")
# 交換：短促上滑 whoosh
write_wav("swap", tone(500, 880, 0.07, 0.5, decay=4))
# 無效交換：兩聲低頻嗡嗡
buzz = tone(150, 140, 0.055, 0.45, decay=3, harmonic=0.6)
write_wav("invalid", buzz + silence(0.035) + buzz)
# 消除：氣泡 pop（高→低快速衰減）
write_wav("pop", tone(950, 480, 0.1, 0.6, decay=7))
# 特殊糖生成：上行琶音閃光
write_wav("special", mix(
    (tone(660, 660, 0.12, 0.32, decay=5), 0.0),
    (tone(880, 880, 0.12, 0.32, decay=5), 0.055),
    (tone(1320, 1320, 0.16, 0.30, decay=5), 0.11),
))
# 特殊糖觸發：低頻轟 + 噪音
write_wav("boom", mix(
    (noise_burst(0.3, 0.7), 0.0),
    (tone(95, 55, 0.32, 0.8, decay=5), 0.0),
))
# 過關：大調琶音小號角
write_wav("win", mix(
    (tone(523, 523, 0.16, 0.35, decay=4, harmonic=0.4), 0.00),
    (tone(659, 659, 0.16, 0.35, decay=4, harmonic=0.4), 0.10),
    (tone(784, 784, 0.16, 0.35, decay=4, harmonic=0.4), 0.20),
    (tone(1047, 1047, 0.30, 0.40, decay=3, harmonic=0.4), 0.30),
))
# 失敗：下行三音
write_wav("lose", mix(
    (tone(392, 388, 0.20, 0.38, decay=4), 0.00),
    (tone(330, 326, 0.20, 0.38, decay=4), 0.16),
    (tone(262, 258, 0.30, 0.40, decay=3), 0.32),
))
print("完成 →", os.path.normpath(OUT_DIR))
