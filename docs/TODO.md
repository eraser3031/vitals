# Vitals MVP — TODO

> 매일 동작하는 결과물을 만들고, 점진적으로 살을 붙인다.

---

## Day 1: 끝까지 동작하는 최소 루프 ⚡

> 프로젝트 선택 → 스킬로 부검 → 보고서 저장 → 앱에서 확인

- [x] 보일러플레이트 정리 (앱 이름, package.json 등)
- [x] 보고서 frontmatter 스키마 확정
- [x] `~/.vitals/reports/` 자동 생성
- [x] 보고서 파서 (gray-matter로 frontmatter + 마크다운 → 데이터)
- [x] 앱 레이아웃 (사이드바 목록 + 메인 상세)
- [x] 보고서 목록 화면 (프로젝트명, 모드, 날짜)
- [x] 보고서 상세 화면 (react-markdown 렌더링)
- [ ] 스킬로 실제 부검 1회 → 앱에서 확인까지 E2E 검증

## Day 2: 쓸 만한 앱으로

- [ ] 파일 시스템 watch (새 보고서 자동 감지)
- [x] 모드별 아이콘/뱃지 (⚰️🚨🩺)
- [x] 빈 상태 화면 (보고서 0개일 때 안내)
- [x] 보고서 삭제 (IPC 구현 완료, UI 미구현)
- [x] UI 다듬기 — 라이트 테마 적용
- [x] 타이틀바 숨김 (hiddenInset)
- [x] 커스텀 코너 반경 (네이티브 모듈, 24pt)
- [x] macOS 메뉴바 커스텀 (Vitals/Edit/Window)
- [x] Settings 별도 창 (Cmd+, / 메뉴)
- [x] 스킬 원클릭 설치 버튼 + skills.sh 연동
- [x] 스킬 별도 public 레포 분리 (eraser3031/vitals-skill)

## Day 3: 필터링 & 탐색

- [ ] 프로젝트별 그룹핑
- [ ] 모드별 필터 (부검/응급/검진)
- [ ] 검색 기능
- [x] 정렬 (날짜순 — 기본 적용)

## Day 4: 인사이트

- [ ] 프로젝트별 타임라인 (보고서 히스토리)
- [ ] 교훈/체크리스트 모아보기
- [ ] 사망 원인 태그 통계

## Day 5: 패키징 & 배포 준비

- [x] 앱 아이콘/브랜딩 (메뉴바 Vitals 반영)
- [x] 메뉴바 커스텀
- [ ] DMG 빌드 및 패키징
- [x] 스킬 설치 가이드 (앱 내 SkillInstaller 컴포넌트)
- [ ] README 작성

---

## 현재 진행

- [x] 프로젝트 기획 (PROJECT.md)
- [x] 스킬 명세 (SKILL_SPEC.md)
- [x] Electron 보일러플레이트 세팅
- [x] GitHub 레포 생성
- [x] Day 1 완료 (E2E 검증만 남음)
- [x] Day 2 대부분 완료
- **→ Day 1 E2E 검증 + Day 2 나머지 (fs watch, 삭제 UI) + Day 3 진행**
