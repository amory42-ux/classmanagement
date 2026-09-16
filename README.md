# 🎮 자리왕 배틀 & 남녀 밸런스 학급 자리 관리 웹 앱

초등학교 학급 자리 바꾸기 및 남녀 밸런스 모둠 자동 편성 웹 애플리케이션입니다.

---

## 🌟 주요 기능

1. **👨‍🏫 교사 관리자 기능 (PIN 인증)**
   - 관리자 PIN: `100402` (6자리)
   - 전체 25명 학생 명단 관리 및 비밀 보정 가중치 점수 부여
   - 게임 라이브러리 (번개 반응 배틀, 행운의 룰렛) 선택

2. **⚖️ 남녀 밸런스 모둠 자동 편성**
   - 남학생(10명)과 여학생(15명)을 각 모둠에 골고루 섞어 밸런스를 맞춰주는 자동 편성 알고리즘
   - 기본 5개 모둠 편성 시: **각 모둠당 남 2명, 여 3명 (남녀 비율 40% : 60%)**
   - 모둠 배치표 생성 후 바로 교실 자리 레이아웃 적용 가능

3. **🎮 자리왕 미니게임 배틀**
   - 번개 반응 순발력 미니게임 & 행운의 룰렛
   - 점수 순위대로 학생들이 칠판 레이아웃에서 자리를 직관적으로 터치하여 선택
   - 최종 자리 배치 축하 이벤트 (폭죽 연출)

---

## 👥 학급 학생 명단 (총 25명)

- **👨 남학생 (10명)**: 김기성, 김일흠, 김한주, 서진우, 임현성, 장성우, 최희락, 허윤, 황일봉, 최미르
- **👩 여학생 (15명)**: 강리나, 권다윤, 권하린, 김서연, 김슬기, 낫라다, 박지온, 박효진, 손연아, 안라윤, 장하윤, 전서은, 차수연, 한지안, 장서현

---

## 🚀 깃허브(GitHub) 업로드 및 배포 방법

### 방법 1: GitHub 웹사이트를 통한 간편 업로드 (추천)
1. [GitHub](https.github.com)에 로그인 후 **New Repository**를 클릭합니다.
2. Repository name에 `classmanagement` 입력 후 **Create repository**를 클릭합니다.
3. 생성된 페이지에서 **uploading an existing file** 링크를 클릭합니다.
4. 이 폴더의 모든 파일 (`index.html`, `app.js`, `style.css`, `README.md`, `.gitignore`)을 드래그하여 업로드합니다.
5. 페이지 하단 **Commit changes**를 클릭합니다.

### 방법 2: Git CLI를 이용한 업로드
Git이 설치된 컴퓨터의 터미널/PowerShell에서 다음 명령어 실행:
```bash
git init
git add .
git commit -m "feat: 학급 자리 바꾸기 및 남녀 밸런스 모둠 시스템 완성"
git branch -M main
git remote add origin https://github.com/사용자아이디/classmanagement.git
git push -u origin main
```

---

## 🌐 GitHub Pages로 무료 웹 사이트 배포하기

1. 생성한 GitHub 리포지토리의 **Settings** 탭으로 이동합니다.
2. 좌측 메뉴에서 **Pages**를 선택합니다.
3. **Build and deployment** 항목의 Source를 `Deploy from a branch`로 설정합니다.
4. Branch를 `main` / `/ (root)`로 선택 후 **Save**를 클릭합니다.
5. 약 1~2분 후 생성되는 웹 주소(`https://사용자아이디.github.io/classmanagement/`)로 접속하면 어디서나 접속할 수 있습니다!
