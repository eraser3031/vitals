# Vitals — App Architecture

## Overview

Vitals는 Electron + React + Vite + TypeScript 기반의 macOS 데스크톱 앱이다.
프로젝트 단위로 Git 레포를 연결하고, Claude Code 스킬이 생성한 진단 보고서를 관리한다.

## Directory Structure

```
vitals/
├── docs/                     # 프로젝트 문서
│   ├── PROJECT.md            # 프로젝트 개요
│   ├── SKILL_SPEC.md         # 스킬 명세 요약
│   ├── TODO.md               # TODO 현황
│   ├── PLAN_PROJECT_STRUCTURE.md  # 프로젝트 구조 전환 설계
│   └── ARCHITECTURE.md       # 이 문서
│
└── app/                      # Electron 앱
    ├── electron/
    │   ├── main/index.ts     # Main Process (Node.js)
    │   ├── preload/index.ts  # Preload (IPC 브릿지)
    │   └── electron-env.d.ts # Electron 환경 타입
    │
    ├── src/                  # Renderer Process (React)
    │   ├── main.tsx          # React 엔트리포인트
    │   ├── App.tsx           # 루트 컴포넌트 (메인 앱 + 설정 분기)
    │   ├── types.ts          # 타입 정의 (Project, Connection, Report 등)
    │   ├── global.d.ts       # window.vitalsAPI 타입 선언
    │   ├── index.css         # 글로벌 스타일 (Tailwind)
    │   ├── vite-env.d.ts     # Vite 환경 타입
    │   ├── lib/
    │   │   └── parseReport.ts     # 보고서 파싱 유틸
    │   ├── type/
    │   │   └── electron-updater.d.ts  # electron-updater 타입
    │   └── components/
    │       ├── ProjectList.tsx     # 사이드바 프로젝트 목록
    │       ├── ProjectDetail.tsx   # 프로젝트 상세 (인라인 편집, 진단, 보고서)
    │       ├── ConnectionList.tsx  # 커넥션 목록 (Git local/remote 표시)
    │       ├── Settings.tsx        # 설정 뷰 (스킬 상태, 업데이트)
    │       └── SkillInstaller.tsx  # 스킬 원클릭 설치 컴포넌트
    │
    ├── native/               # 네이티브 모듈 (Objective-C++)
    │   ├── corner_radius.mm  # NSWindow 코너 반경 커스텀
    │   ├── binding.gyp       # node-gyp 빌드 설정
    │   ├── index.js          # JS wrapper
    │   └── prebuilds/        # 사전 빌드된 바이너리
    │       └── darwin-arm64/  # Apple Silicon 빌드
    │
    ├── vite.config.ts        # Vite + Electron 빌드 설정
    └── package.json          # 앱 의존성
```

## Data Structure

```
~/.vitals/
├── config.json                    ← 앱 전역 설정
├── credentials.dat                ← safeStorage 암호화 (API 토큰)
├── inbox/                         ← 스킬이 보고서를 쓰는 곳
│   └── postmortem-vitals-2026-04-04.md
└── projects/
    └── {uuid}/
        ├── project.json           ← 프로젝트 메타데이터
        ├── connections.json       ← 커넥션 배열
        ├── diagnosis-context.md   ← 진단 컨텍스트 (자동 생성)
        └── reports/
            └── postmortem-2026-04-01.md
```

## Electron Process Model

```
┌─────────────────────────────────────────────────┐
│  Main Process (Node.js)                         │
│  electron/main/index.ts                         │
│                                                 │
│  - 프로젝트/커넥션/보고서 CRUD (fs + JSON)       │
│  - inbox 처리 (meta.repo ↔ local.path 매칭)     │
│  - inbox 보고서 수동 배정 (assign-report)        │
│  - 진단 컨텍스트 생성 (git log/branch/파일구조)   │
│  - 터미널 자동 실행 (Ghostty/iTerm/Terminal.app)  │
│  - Git 레포 스캔 + remote URL 파싱              │
│  - 스캔 결과 일괄 프로젝트 생성 (import-scanned)  │
│  - 스킬 설치/업데이트 확인 (SHA-256 via GitHub)   │
│  - inbox fs.watch (실시간 보고서 감지)            │
│  - credentials safeStorage 암호화                │
│  - 네이티브 모듈 (코너 반경)                      │
│  - 첫 실행 온보딩 (프로젝트 0개 시 폴더 스캔 안내) │
│  - 프로젝트 ID path traversal 방어               │
│                                                 │
│  IPC Handlers (28개):                           │
│  ├── 프로젝트: get-projects, get-project,         │
│  │            create-project, update-project,     │
│  │            delete-project                      │
│  ├── 커넥션: get-connections, save-connection,     │
│  │          delete-connection                     │
│  ├── 보고서: get-reports, delete-report            │
│  ├── inbox: process-inbox, get-unmatched-reports, │
│  │         assign-report                          │
│  ├── 인증: get-credential, save-credential,       │
│  │        delete-credential                       │
│  ├── 진단: generate-diagnosis-context             │
│  ├── 터미널: open-terminal                        │
│  ├── Git: pick-git-repo, scan-directory,          │
│  │       import-scanned-repos                     │
│  └── 스킬: check-skill, check-skill-update,       │
│           install-skill                           │
└──────────────┬──────────────────────────────────┘
               │ IPC (ipcMain.handle / ipcRenderer.invoke)
┌──────────────┴──────────────────────────────────┐
│  Preload (electron/preload/index.ts)            │
│                                                 │
│  contextBridge.exposeInMainWorld('vitalsAPI', {  │
│    ...all IPC methods (25+ 메서드),              │
│    onInboxChanged(callback)  ← ipcRenderer.on    │
│  })                                              │
└──────────────┬──────────────────────────────────┘
               │ window.vitalsAPI
┌──────────────┴──────────────────────────────────┐
│  Renderer Process (React)                       │
│  src/App.tsx                                    │
│                                                 │
│  - URL hash로 메인/설정 분기 (#settings)         │
│  - 프로젝트 목록 + 상세 보기                     │
│  - 인라인 편집 (blur-to-save)                    │
│  - 진단 CTA → 터미널 자동 실행                   │
│  - react-markdown + remark-gfm 렌더링           │
│  - inbox 실시간 감지 (fs.watch + focus 폴백)     │
│  - 첫 실행 시 온보딩 (폴더 스캔 안내)             │
│  - 스캔 결과 선택 → 일괄 프로젝트 생성            │
└─────────────────────────────────────────────────┘
```

## Key Flows

### Inbox 매칭 (보고서 자동 귀속)

```
스킬이 ~/.vitals/inbox/ 에 보고서 생성 (frontmatter: repo=/path/to/repo)
    │
    │  fs.watch 감지 → inbox-changed 이벤트
    ▼
앱 실행 시 또는 이벤트 수신 시 processInbox() 호출
    │
    │  각 보고서의 meta.repo ↔ 프로젝트 connections의 local.path 대조
    ▼
매칭 성공 → 해당 프로젝트 reports/ 로 이동
매칭 실패 → inbox에 유지 (수동 배정 가능: assign-report)
```

### 진단 컨텍스트 생성

```
사용자가 진단 버튼 클릭
    │
    ▼
프로젝트의 모든 Git 커넥션에서 정보 수집
  - git log (최근 50개)
  - 현재 브랜치
  - 파일/디렉토리 구조
    │
    ▼
diagnosis-context.md 생성 → 프로젝트 폴더에 저장
    │
    ▼
터미널 자동 실행 (첫 번째 Git 레포 경로에서 claude 명령)
```

### 첫 실행 온보딩

```
앱 실행 → 프로젝트 0개 감지
    │
    ▼
폴더 스캔 안내 UI 노출
    │
    ▼
사용자가 폴더 선택 → Git 레포 탐색
    │
    ▼
스캔 결과에서 원하는 레포 선택 → 일괄 프로젝트 생성
```

## Type System

```typescript
// 프로젝트
interface Project {
  version: 1; id: string; name: string;
  description?: string; createdAt: string; updatedAt: string;
}

// 커넥션 (Git + 서비스)
interface GitConnection {
  id: string; type: 'git';
  local?: { path: string };
  remote?: { provider: 'github'|'gitlab'|'bitbucket'; owner; repo; url };
}
interface ServiceConnection {
  id: string; type: 'linear' | 'notion' | 'jira';
  resourceId: string; resourceName?: string; url?: string;
}
type Connection = GitConnection | ServiceConnection;

// 보고서
type DiagnosisMode = 'postmortem' | 'emergency' | 'checkup';
interface Report { filename; meta: ReportMeta; content; raw; }

// 스캔
interface ScannedRepo { name; path; remoteUrl?; }

// 인증
interface Credentials { github?; linear?; notion?; jira?; }
```

## Report Format

보고서는 YAML frontmatter + 마크다운 본문으로 구성된다.
스킬이 `~/.vitals/inbox/`에 생성하고, 앱이 프로젝트에 귀속시킨다.

```markdown
---
mode: postmortem | emergency | checkup
date: 2026-04-04
status: "사망 확인"
summary: "한 줄 요약"
repo: /Users/e2/Projects/vitals
---

# 본문 (마크다운)
```

파일명 규칙: `{mode}-{project}-{YYYY-MM-DD}.md`

## Window Configuration

| 속성 | 값 |
|------|-----|
| titleBarStyle | hiddenInset (타이틀바 숨김, 신호등 유지) |
| trafficLightPosition | { x: 16, y: 18 } |
| cornerRadius | 24pt (네이티브 모듈) |
| 메뉴바 | Vitals / Edit / Window |
| Settings 단축키 | Cmd+, (별도 창) |

## Skill Integration

스킬은 별도 public 레포(`eraser3031/vitals-skill`)에서 관리한다.

- 설치: `npx skills add eraser3031/vitals-skill -g -y`
- 설치 경로: `~/.claude/skills/vitals-postmortem/SKILL.md`
- 앱에서 설치 여부 확인: `fs.existsSync(skillPath)`
- 앱에서 업데이트 확인: 로컬 vs GitHub SHA-256 비교
- 앱 내 원클릭 설치/업데이트: `child_process.exec('npx skills add ...')`

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Electron 33 |
| Frontend | React 18 + TypeScript |
| Build | Vite 5 + vite-plugin-electron |
| Styling | Tailwind CSS 3 |
| Icons | lucide-react |
| Markdown | gray-matter (Main), react-markdown + remark-gfm (Renderer) |
| Native | Objective-C++ N-API addon (darwin-arm64) |
| Test | Vitest + Playwright |
| Packaging | electron-builder |
| Auto-update | electron-updater |
| Skill distribution | skills.sh (eraser3031/vitals-skill) |
