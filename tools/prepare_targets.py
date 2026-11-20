"""
유리(투명) + 흰 선 그림용 마커 전처리.
targets/src/<이름>.png  →  targets/<이름>_full.png (그림 전체), targets/<이름>_char.png (캐릭터만)
그리고 targets/targets.json (앱과 compile.js 가 읽는 목록) 을 만듭니다.

실행: python3 tools/prepare_targets.py   (이후 node tools/compile.js)
"""
import json, os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(ROOT, "targets")
KIDS = [("junwoo", 0), ("jungwoo", 1)]  # (파일 이름, config.js 의 kids 순서)


def clean(img, thick=3):
    a = np.asarray(img.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    green = (g > r + 60) & (g > b + 60)  # 화면 캡처의 초록 점 등 제거
    # 초록 점과 그 둘레(회색 테두리)까지 지움
    green = np.asarray(Image.fromarray(green.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(7))) > 0
    mask = (lum > 60) & ~green
    m = Image.fromarray((mask * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MaxFilter(thick))  # 선을 살짝 두껍게 → 멀리서도 인식
    return m.convert("RGB"), np.asarray(m) > 0


def components(mask, s=4):
    """작게 줄인 격자에서 연결된 덩어리들의 (x0, y0, x1, y1) 목록 (원본 픽셀 좌표)."""
    H, W = mask.shape
    small = mask[: H // s * s, : W // s * s].reshape(H // s, s, W // s, s).max(axis=(1, 3))
    small = np.asarray(Image.fromarray(small.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
    h, w = small.shape
    seen = np.zeros_like(small)
    boxes = []
    for y0 in range(h):
        for x0 in range(w):
            if not small[y0, x0] or seen[y0, x0]:
                continue
            q = deque([(y0, x0)]); seen[y0, x0] = True
            xs, ys, n = [x0, x0], [y0, y0], 0
            while q:
                y, x = q.popleft(); n += 1
                xs[0] = min(xs[0], x); xs[1] = max(xs[1], x); ys[0] = min(ys[0], y); ys[1] = max(ys[1], y)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and small[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True; q.append((yy, xx))
            boxes.append((xs[0] * s, ys[0] * s, (xs[1] + 1) * s, (ys[1] + 1) * s))
    return boxes


def split(mask, s=4):
    """(바깥 테두리 박스 또는 None, 캐릭터 박스) — 테두리 밖의 작은 조각은 mask 에서 지움."""
    H, W = mask.shape
    boxes = components(mask, s)
    big = lambda b: (b[2] - b[0]) > 0.8 * W or (b[3] - b[1]) > 0.8 * H
    border = next((b for b in boxes if big(b)), None)
    if border:
        for b in boxes:
            inside = b[0] >= border[0] and b[1] >= border[1] and b[2] <= border[2] and b[3] <= border[3]
            if not big(b) and not inside:
                mask[b[1]:b[3], b[0]:b[2]] = False
    inner = [b for b in boxes if not big(b) and (border is None or (b[0] >= border[0] and b[1] >= border[1] and b[2] <= border[2] and b[3] <= border[3]))]
    return mask, max(inner, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))


def load(src, up, thick):
    img = Image.open(src).convert("RGB")
    img = img.resize((img.width * up, img.height * up), Image.BICUBIC)
    _, mask = clean(img, thick)
    mask, box = split(mask, 4 * up)
    return mask, box


def main():
    out = []
    for name, kid in KIDS:
        src = os.path.join(T, "src", name + ".png")
        if not os.path.exists(src):
            print("없음(건너뜀):", src); continue
        # 전체 그림: 원본 해상도 → 멀리서/비스듬히 볼 때 잘 잡힘
        mask, (x0, y0, x1, y1) = load(src, 1, 3)
        H, W = mask.shape
        Image.fromarray((mask * 255).astype(np.uint8)).convert("RGB").save(os.path.join(T, name + "_full.png"))
        m = 0.08 * max(x1 - x0, y1 - y0)
        box = (max(0, int(x0 - m)), max(0, int(y0 - m)), min(W, int(x1 + m)), min(H, int(y1 + m)))
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        # 캐릭터만: 2배 해상도 → 휴대폰을 가까이 대서 테두리가 화면 밖으로 나가도 잡힘
        mask2, _ = load(src, 2, 5)
        Image.fromarray((mask2 * 255).astype(np.uint8)).convert("RGB").crop(tuple(v * 2 for v in box)).save(os.path.join(T, name + "_char.png"))
        cw = box[2] - box[0]
        flash = [1, H / W, -(cx - W / 2) / W, (cy - H / 2) / W]
        # 앱 좌표: 원점 = 캐릭터 중심, 1 = 그림 전체 가로 길이
        out.append({"file": name + "_full.png", "kid": kid, "scale": 1, "x": (cx - W / 2) / W, "y": -(cy - H / 2) / W, "flash": flash})
        out.append({"file": name + "_char.png", "kid": kid, "scale": W / cw, "x": 0, "y": 0, "flash": flash})
        print(name, "캐릭터 영역", box, "그림", (W, H))
    with open(os.path.join(T, "targets.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("targets.json:", [t["file"] for t in out])


main()
