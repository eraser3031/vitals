# Vitals — App Architecture

## Overview

Vitals는 Electron + React + Vite + TypeScript 기반의 macOS 데스크톱 앱이다.
사용자가 사후분석 포스트를 작성하는 에디터이며, GitHub/Notion을 컨텍스트로 연결해 AI가 기록과 대조·정교화한다.

## Directory Structure

```
vitals/
├── docs/
│   ├── PROJECT.md            # 제품 비전 + 현재 방향
│   ├── SKILL_SPEC.md         # 부검 질의응답 철학 (레퍼런스)
│   ├── TODO.md               # 할 일
│   └── ARCHITECTURE.md       # 이 문서
│
├── worker/                   # (별도 레포) CF Worker — OAuth + AI 프록시
│
└── app/                      # Electron 앱
    ├── electron/
    │   ├── main/index.ts     # Main Process (Node.js)
    │   ├── preload/index.ts  # Preload (IPC 브릿지)
    │   └── electron-env.d.ts
    │
    ├── src/                  # Renderer Process (React)
    │   ├── main.tsx          # React 엔트리포인트
    │   ├── App.tsx           # 루트 (사이드바 + 에디터)
    │   ├── types.ts          # Post / Context 타입
    │   ├── global.d.ts       # window.vitalsAPI 타입 선언
    │   ├── index.css         # Tailwind
    │   ├── components/
    │   │   └── SlashMenu.tsx      # Tiptap 슬래시 커맨드 메뉴
    │   └── extensions/
    │       ├── SectionBlock.ts    # Tiptap 섹션 블록
    │       └── SlashCommand.ts    # Tiptap 슬래시 커맨드
    │
    ├── native/               # 네이티브 모듈 (Objective-C++)
    │   ├── corner_radius.mm  # NSWindow 코너 반경
    │   ├── binding.gyp
    │   ├── index.js
    │   └── prebuilds/darwin-arm64/
    │
    ├── vite.config.ts
    └── package.json
```

## Data Structure

```
~/.vitals/
├── credentials.dat                 ← safeStorage 암호화 (GitHub/Notion 토큰)
└── posts.json                      ← 모든 포스트 배열 (단일 파일)
```

**메모**: 과거 `projects/`, `inbox/`, `config.json` 구조는 제거됨.

## Electron Process Model

```
┌──────────────────────────────────────────────────┐
│  Main Process (electron/main/index.ts)           │
│                                                  │
│  - Post CRUD (posts.json)                        │
│  - GitHub/Notion OAuth (딥링크 + 폴링)             │
│  - GitHub/Notion API 프록시 (토큰 재사용)          │
│  - AI 팩트체크 / 정교화 (Worker 경유)              │
│  - credentials safeStorage 암호화                 │
│  - 네이티브 코너 반경 모듈 로드                    │
│                                                  │
│  IPC Handlers:                                   │
│  ├── Post: get-posts, create-post,               │
│  │          update-post, delete-post             │
│  ├── GitHub OAuth: github-start-oauth,           │
│  │          github-get-token, github-logout,     │
│  │          github-get-user, github-get-repos    │
│  ├── Notion OAuth: notion-start-oauth,           │
│  │          notion-get-token, notion-logout,     │
│  │          notion-get-user, notion-search       │
│  └── AI: fact-check, refine                      │
└──────────────┬───────────────────────────────────┘
               │ IPC
┌──────────────┴───────────────────────────────────┐
│  Preload (electron/preload/index.ts)             │
│  contextBridge → window.vitalsAPI (16 메서드)    │
└──────────────┬───────────────────────────────────┘
               │ window.vitalsAPI
┌──────────────┴───────────────────────────────────┐
│  Renderer (src/App.tsx)                          │
│                                                  │
│  - 사이드바: 포스트 목록 + GitHub/Notion 연결 상태│
│  - 에디터: Tiptap (제목/프로젝트명/본문)          │
│  - 컨텍스트: GitHub repo / Notion page 부착       │
│  - 팩트체크 버튼: 본문 전체를 AI로 검증            │
│  - 우클릭 → "정교화하기" 팝업 (AI 제안 교체)       │
│  - 자동저장 (400ms debounce, blur flush)         │
└──────────────────────────────────────────────────┘
```

## Key Flows

### 포스트 작성 + 자동저장

```
사용자 타이핑 → debounce 400ms → update-post IPC → posts.json 덮어쓰기
에디터 전환/삭제 → flushSave() 즉시 → update-post
```

### GitHub OAuth (딥링크)

```
githubStartOAuth → github.com/login/oauth/authorize 외부 브라우저 열림
사용자 승인 → vitals://oauth/callback?code=xxx 딥링크
Main의 app.on('open-url') → Worker /github/oauth/token 으로 code 교환
access_token 수신 → credentials.dat 저장 + webContents.send('github-oauth-success')
Renderer: onGitHubOAuthSuccess 콜백으로 유저 정보 재조회
```

### Notion OAuth (폴링 — 개발 모드에서 딥링크 미작동 우회)

```
notionStartOAuth → Notion 인증 외부 브라우저 열림 + state 생성
Main이 2초 간격 최대 60초 Worker에 state로 polling
Worker가 callback으로 code 수신 후 토큰 교환, state와 함께 보관
polling 성공 시 access_token → credentials.dat + 'notion-oauth-success' 이벤트
```

### 팩트체크

```
사용자 "팩트체크" 버튼 클릭
  → Main이 각 Context 순회:
     · GitHub: 최근 20커밋 fetch
     · Notion: readNotionBlocksRecursive (depth 2)
  → 수집된 컨텍스트 + 본문을 Worker /ai/chat 으로 전송
  → AI 응답(한국어, URL 포함)을 Renderer에 문자열로 반환
```

### 정교화 (우클릭 팝업)

```
사용자 본문에서 텍스트 드래그 → 우클릭
  → "정교화하기" 버튼 클릭
  → Main이 컨텍스트 수집 후 Worker /ai/refine (JSON 응답)
  → 응답: { suggestions: string[], evidence: { text, url? }[] }
  → 팝업에서 제안 클릭 시 Tiptap insertContent로 교체
```

## Type System

```typescript
// src/types.ts

export interface Context {
  id: string
  type: 'github' | 'notion'
  label: string                    // 예: "owner/repo" 또는 Notion 페이지 제목
  data: Record<string, unknown>    // github: { owner, repo, defaultBranch }
                                   // notion: { pageId, url }
}

export interface Post {
  id: string
  title: string
  project: string                  // 프로젝트 이름 텍스트 (자유 입력)
  content: string                  // Tiptap HTML
  contexts: Context[]
  createdAt: string                // ISO 8601
  updatedAt: string                // ISO 8601
}
```

**메모**: `Post.project`는 자유 텍스트 필드이며, 과거의 프로젝트 CRUD와 무관하다.

## Window Configuration

| 속성 | 값 |
|------|-----|
| titleBarStyle | hiddenInset |
| trafficLightPosition | { x: 16, y: 18 } |
| cornerRadius | 24pt (네이티브 모듈) |
| 메뉴바 | Vitals / Edit / Window |
| 창 | 단일 창 (설정 창 없음) |

## External Integrations

| 대상 | 용도 | 인증 |
|------|------|------|
| GitHub API | 유저 정보, 레포 목록, 커밋 로그 | OAuth access_token |
| Notion API | 유저 정보, 페이지 검색, 블록 재귀 읽기 | OAuth access_token |
| Worker `/github/oauth/token` | OAuth code→token 교환 | (서버 시크릿) |
| Worker `/notion/oauth/callback` + `/notion/oauth/poll` | Notion OAuth 폴링 | state 키 |
| Worker `/ai/chat` | 팩트체크 AI 응답 | (서버 API 키) |
| Worker `/ai/refine` | 정교화 AI 응답 (JSON) | (서버 API 키) |

`WORKER_URL`은 `electron/main/index.ts`에 하드코드. 배포 시 교체 필요.

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Electron 33 |
| Frontend | React 18 + TypeScript |
| Build | Vite 5 + vite-plugin-electron |
| Editor | Tiptap + StarterKit + Placeholder + 커스텀 확장 (SectionBlock, SlashCommand) |
| Styling | Tailwind CSS 3 |
| Native | Objective-C++ N-API addon (darwin-arm64) |
| Test | Vitest + Playwright |
| Packaging | electron-builder |
