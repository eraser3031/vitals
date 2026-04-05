# Vitals MVP — TODO

> 매일 동작하는 결과물을 만들고, 점진적으로 살을 붙인다.
> 설계 문서: [PLAN_PROJECT_STRUCTURE.md](./PLAN_PROJECT_STRUCTURE.md)

---

## Phase 0: 프로젝트 기반 구조 전환 ✅

> 보고서 중심 → 프로젝트 중심으로 앱 구조 전환

### 1단계: 데이터 구조 + 저장소

- [x] `~/.vitals/projects/`, `~/.vitals/inbox/` 디렉토리 자동 생성
- [x] 타입 정의 — `Project`, `GitConnection`, `ServiceConnection`, `Connection[]`
- [x] `project.json` CRUD (version: 1 포함)
- [x] `connections.json` 읽기/쓰기 (배열 기반)
- [x] 보고서 읽기/쓰기/삭제 (프로젝트별 `reports/`)
- [x] inbox 매칭 로직 — `meta.repo` ↔ git `local.path` 대조
- [x] 미매칭 보고서 inbox에 유지 + 목록 반환
- [x] `credentials.dat` — `safeStorage` 암호화 저장/읽기 (`isEncryptionAvailable` 체크)
- [x] IPC 핸들러 — 프로젝트/커넥션/보고서/inbox/인증
- [x] Preload — `VitalsAPI` 업데이트

### 2단계: UI 전환

- [x] `ProjectList.tsx` — 사이드바 프로젝트 목록
- [x] `ProjectDetail.tsx` — 프로젝트 상세 뷰 (인라인 편집, 진단 CTA)
- [x] `ConnectionList.tsx` — 커넥션 목록
- [x] `App.tsx` 상태 관리 변경 — `projects[]`, `selectedProject`
- [x] 앱 실행 시 `processInbox()` 호출
- [ ] 미매칭 보고서 배정 UI

### 3단계: Git 스캔 자동 감지

- [x] 디렉토리 선택 다이얼로그 + 1depth `.git` 디렉토리 스캔
- [x] `.git/config` remote origin URL 파싱 (GitHub/GitLab/Bitbucket)
- [x] 스캔 결과 → 프로젝트 자동 생성 + git 커넥션 부착

### 4단계: 프로젝트 수동 관리

- [x] 프로젝트 추가 (기본 이름으로 즉시 생성)
- [x] 프로젝트 삭제 (확인 다이얼로그 + "보고서 N개 함께 삭제" 경고)
- [x] 프로젝트 이름/설명 인라인 편집 (blur-to-save)
- [x] 커넥션 추가 — 네이티브 폴더 선택 + .git 자동 감지
- [x] 커넥션 제거

### 5단계: 진단 + 스킬 연동

- [x] 진단 컨텍스트 생성 (멀티레포 git log/branch/파일구조 수집)
- [x] 터미널 자동 실행 — Ghostty/iTerm/Terminal.app 감지
- [x] 스킬 업데이트 확인 (SHA-256 비교 via GitHub API)
- [x] inbox 실시간 감지 (`fs.watch` + window focus 폴백)
- [x] GFM 테이블 렌더링 (`remark-gfm`)

---

## 이전 완료 항목 (보고서 뷰어 시절)

<details>
<summary>Day 1~2 완료 항목</summary>

### Day 1: 최소 루프

- [x] 보일러플레이트 정리
- [x] 보고서 frontmatter 스키마 확정
- [x] `~/.vitals/reports/` 자동 생성
- [x] 보고서 파서 (gray-matter)
- [x] 앱 레이아웃 (사이드바 + 메인)
- [x] 보고서 목록/상세 화면

### Day 2: 앱 다듬기

- [x] 모드별 아이콘/뱃지 (⚰️🚨🩺)
- [x] 빈 상태 화면
- [x] 보고서 삭제 (IPC 구현)
- [x] 라이트 테마 전환
- [x] 타이틀바 숨김 + 커스텀 코너 반경
- [x] macOS 메뉴바 커스텀
- [x] Settings 별도 창
- [x] 스킬 원클릭 설치 + 별도 레포 분리
- [x] 시맨틱 색상 토큰 통일
- [x] Tailwind 유틸리티 전환

</details>

---

## 다음 단계

- [ ] 미매칭 보고서 배정 UI (inbox에 남은 보고서 수동 프로젝트 배정)
- [ ] 모드별 필터 / 검색
- [ ] 프로젝트별 타임라인
- [ ] 교훈/체크리스트 모아보기
- [ ] 사망 원인 태그 통계
- [ ] DMG 빌드 및 패키징
- [ ] README 작성
