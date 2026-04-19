# Vitals — TODO

> 사후분석 문서를 "질문 > 댓글" 구조로 개편하는 중.
> 배경/아키텍처: [PROJECT.md](./PROJECT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 완료 (현 앱 기반)

- [x] 포스트 CRUD + Tiptap 에디터 + 자동저장
- [x] 슬래시 커맨드 + 섹션 블록
- [x] GitHub OAuth (딥링크) + 레포 선택
- [x] Notion OAuth (폴링) + 페이지 검색
- [x] 컨텍스트(GitHub/Notion) 부착 UI
- [x] AI 팩트체크 (본문 전체, Worker `/ai/chat`)
- [x] AI 정교화 (우클릭 선택 → 팝업 제안 교체, Worker `/ai/refine`)
- [x] Notion 하위 블록/페이지 재귀 읽기 (depth 2)
- [x] credentials safeStorage 암호화
- [x] 네이티브 코너 반경 (darwin-arm64)
- [x] 레거시 "프로젝트/보고서 관리" 코드 제거 (2026-04-19)

---

## Phase 1 — 질문 > 댓글 구조 개편

> 현재 포스트 본문은 통짜 마크다운. AI 결론만 남고 원본 질의응답이 폐기되는 구조.
> 부검 렌즈별 **질문**과 **답변 스레드**를 1급 시민으로 올려 추적성을 보존한다.

### 설계
- [ ] 데이터 모델 결정 — `Post.content: string` 대신 `entries: QAEntry[]` 로 갈지, 저장은 마크다운/JSON 중 어느 쪽이 나을지
- [ ] `QAEntry` 타입 초안 — `{ id, lens, question, replies: Reply[], createdAt }`
- [ ] `Reply` 작성자 구분 — `'user' | 'ai'` / 정교화·팩트체크가 Reply로 들어오는지 여부
- [ ] 렌즈 소재: `SKILL_SPEC.md`의 7가지 렌즈를 그대로 쓸지, 줄이거나 커스터마이징할지

### UI
- [ ] 질문 카드 + 댓글 입력 + 답변 리스트 컴포넌트
- [ ] 기존 Tiptap 에디터 위치 재설계 (답변 내부에 중첩? 또는 별도 뷰?)
- [ ] 팩트체크 결과를 질문 스레드에 AI 댓글로 기록

### 마이그레이션
- [ ] 기존 `posts.json`(통짜 HTML) → 새 구조로 마이그레이션 러너 or 새 포맷 전환 여부

---

## Backlog

- [ ] `WORKER_URL` 환경 분기 (현재 `localhost:8787` 하드코드)
- [ ] 포스트 검색 / 필터
- [ ] 포스트 내보내기 (마크다운)
- [ ] DMG 빌드 및 배포 자동화
- [ ] README 작성
- [ ] 미사용 의존성 정리 (`gray-matter`, `react-markdown`, `remark-gfm`, `electron-updater`)
