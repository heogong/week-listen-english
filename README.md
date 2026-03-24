# 🎧 Listen App

영어 듣기 학습 서비스 — 완전 정적, 서버 없음

## 구조

```
listen-app/
├── index.html              # 앱 전체
├── scripts/
│   ├── index.json          # 스크립트 목록 (자동 업데이트)
│   └── sarah-daily.json    # 스크립트 파일들
├── audio/                  # TTS mp3 캐시 (선택)
│   └── sarah-daily.mp3
├── generate.js             # AI 스크립트 생성 CLI
├── package.json
└── .env                    # ANTHROPIC_API_KEY
```

## GitHub Pages 배포

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/<your>/<repo>.git
git push -u origin main

# GitHub 레포 → Settings → Pages → Source: main branch → Save
# → https://<your>.github.io/<repo>/ 접속
```

## 새 스크립트 AI 생성

```bash
npm install
cp .env.example .env    # ANTHROPIC_API_KEY 입력

node generate.js --topic "Travel" --level "beginner"
node generate.js --topic "Technology" --level "intermediate"
node generate.js --topic "Climate Change" --level "advanced"

# scripts/ 폴더에 JSON + index.json 자동 업데이트
git add scripts/ && git commit -m "add script" && git push
```

## TTS mp3 캐시 (선택)

TTS 로드 버튼 → mp3 생성 → **💾 mp3 저장** 버튼으로 다운로드
→ `audio/<id>.mp3` 로 저장 후 push → 다음부터 자동 로드

```bash
mkdir -p audio
# 다운로드한 mp3를 audio/ 폴더에 이동
git add audio/ && git commit -m "add audio" && git push
```

## 스크립트 JSON 구조

```json
{
  "title": "Sarah's Daily Life",
  "topic": "Daily Life",
  "level": "beginner",
  "sentences": [
    { "p": true },
    { "en": "English sentence.", "ko": "한국어 번역." }
  ]
}
```
