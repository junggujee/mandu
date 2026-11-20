# 🎁 준우 · 정우 생일 AR 서프라이즈

선물 그림을 휴대폰 카메라로 비추면 그림 위로 **진짜 선물(3D)** 이 튀어나오는 웹 앱입니다.

- 준우: 하프물범 필통 (`targets/junwoo.png`)
- 정우: 스타 스파크 검 (`targets/jungwoo.png`)

연출 순서: 그림 인식 → 그림이 빛나며 링이 퍼짐 → 선물 등장(빙글빙글) → 폭죽·색종이와 생일 축하 노래 → 축하 문구 → **💌 편지 열기** 버튼 → 편지와 진짜 선물 힌트.
선물이 나온 뒤 화면을 탭하면 색종이가 한 번 더 터집니다. 오른쪽 위 **다시 보기**를 누르면 처음부터 다시 재생합니다.

## 문구·편지 고치기
`config.js` 만 수정하면 됩니다(축하 문구, 표시 시간, 편지, 마지막 힌트).

## GitHub Pages로 배포 (카메라는 https 필요)
1. GitHub 저장소 → **Settings → Pages**
2. *Build and deployment* → Source: **Deploy from a branch**
3. Branch: 이 파일이 있는 브랜치, 폴더 `/ (root)` → **Save**
4. 1~2분 뒤 `https://<아이디>.github.io/mandu/` 주소가 생깁니다. 안드로이드 크롬으로 열고 카메라를 허용하세요.

## 그림(마커) 바꾸기
1. `targets/junwoo.png`, `targets/jungwoo.png` 를 교체합니다(순서는 `targets/order.json`).
2. 마커 파일을 다시 만듭니다.
   ```bash
   npm i -g playwright   # 처음 한 번
   node tools/compile.js # targets/targets.mind 생성
   ```
   또는 [MindAR 온라인 컴파일러](https://hiukim.github.io/mind-ar-js-doc/tools/compile)에 **준우 → 정우 순서**로 두 그림을 올리고, 받은 파일을 `targets/targets.mind` 로 저장합니다.

## 미리보기 / 확인
- `tools/preview.html`: 카메라 없이 3D 선물 모델만 보기
- 인식이 잘 되려면 그림을 화면에 꽉 차게, 밝은 곳에서, 반사 없이 비추세요.

## 구조
```
index.html     화면(시작 화면, 문구, 편지)
app.js         AR 인식, 연출, 소리(WebAudio로 합성, 파일 없음)
models.js      코드로 만든 3D 모델(하프물범 필통, 스파크 검)
config.js      문구·편지 설정
targets/       인식용 그림과 컴파일된 targets.mind
lib/           MindAR 1.2.5, three.js 0.160 (오프라인 동작용 사본)
```
