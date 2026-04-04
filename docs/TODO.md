# Vitals MVP — TODO

> 매일 동작하는 결과물을 만들고, 점진적으로 살을 붙인다.
> 설계 문서: [PLAN_PROJECT_STRUCTURE.md](./PLAN_PROJECT_STRUCTURE.md)

---

## Phase 0: 프로젝트 기반 구조 전환

> 보고서 중심 → 프로젝트 중심으로 앱 구조 전환

### 1단계: 데이터 구조 + 저장소

- [ ] `~/.vitals/projects/`, `~/.vitals/inbox/` 디렉토리 자동 생성
- [ ] 타입 정의 — `Project`, `GitConnection`, `ServiceConnection`, `Connection[]`
- [ ] `project.json` CRUD (version: 1 포함)
- [ ] `connections.json` 읽기/쓰기 (배열 기반)
- [ ] 보고서 읽기/쓰기/삭제 (프로젝트별 `reports/`)
- [ ] inbox 매칭 로직 — `meta.repo` ↔ git `local.path` 대조
- [ ] 미매칭 보고서 inbox에 유지 + 목록 반환
- [ ] `credentials.dat` — `safeStorage` 암호화 저장/읽기 (`isEncryptionAvailable` 체크)
- [ ] IPC 핸들러 — 프로젝트/커넥션/보고서/inbox/인증
- [ ] Preload — `VitalsAPI` 업데이트

### 2단계: UI 전환

- [ ] `ProjectList.tsx` — 사이드바 프로젝트 목록
- [ ] `ProjectDetail.tsx` — 프로젝트 상세 뷰
- [ ] `ConnectionList.tsx` — 커넥션 목록 (Git: 서버+구름 아이콘, 멀티 행)
- [ ] `App.tsx` 상태 관리 변경 — `projects[]`, `selectedProject`
- [ ] 앱 실행 시 `processInbox()` 호출
- [ ] 미매칭 보고서 배정 UI

### 3단계: Git 스캔 자동 감지

- [ ] 디렉토리 선택 다이얼로그 + 1depth `.git` 디렉토리 스캔
- [ ] `.git/config` remote origin URL 파싱 (GitHub/GitLab/Bitbucket)
- [ ] 스캔 결과 → 프로젝트 자동 생성 + git 커넥션 부착
- [ ] `config.json`에 스캔 루트 경로 저장

### 4단계: 프로젝트 수동 관리

- [ ] 프로젝트 추가 (이름 입력 → 빈 프로젝트 생성)
- [ ] 프로젝트 삭제 (확인 다이얼로그 + "보고서 N개 함께 삭제" 경고)
- [ ] 프로젝트 이름/설명 변경
- [ ] 커넥션 수동 추가/제거

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

## 보류 (구조 전환 후 재검토)

- [ ] 스킬 E2E 검증 (inbox 흐름으로 재설계 필요)
- [ ] 파일 시스템 watch (inbox 실시간 감지로 전환 가능)
- [ ] 모드별 필터 / 검색
- [ ] 프로젝트별 타임라인
- [ ] 교훈/체크리스트 모아보기
- [ ] 사망 원인 태그 통계
- [ ] DMG 빌드 및 패키징
- [ ] README 작성
