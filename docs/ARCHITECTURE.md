# Vitals — App Architecture

## Overview

Vitals는 Electron + React + Vite + TypeScript 기반의 macOS 데스크톱 앱이다.
Claude Code 스킬(`vitals-postmortem`)이 생성한 마크다운 보고서를 읽고 보여주는 뷰어 역할을 한다.

## Directory Structure

```
vitals/
├── docs/                     # 프로젝트 문서
│   ├── PROJECT.md            # 프로젝트 개요
│   ├── SKILL_SPEC.md         # 스킬 명세 요약
│   ├── TODO.md               # 일별 TODO
│   └── ARCHITECTURE.md       # 이 문서
│
└── app/                      # Electron 앱
    ├── electron/
    │   ├── main/index.ts     # Main Process (Node.js)
    │   └── preload/index.ts  # Preload (IPC 브릿지)
    │
    ├── src/                  # Renderer Process (React)
    │   ├── main.tsx          # React 엔트리포인트
    │   ├── App.tsx           # 루트 컴포넌트 (메인 앱 + 설정 분기)
    │   ├── App.css           # 전역 스타일
    │   ├── types.ts          # 타입 정의 (Report, DiagnosisMode 등)
    │   ├── global.d.ts       # window.vitalsAPI 타입 선언
    │   └── components/
    │       ├── ReportList.tsx     # 사이드바 보고서 목록
    │       ├── ReportDetail.tsx   # 보고서 상세 (마크다운 렌더링)
    │       ├── Settings.tsx       # 설정 뷰 (스킬 상태, 경로)
    │       └── SkillInstaller.tsx # 스킬 원클릭 설치 버튼
    │
    ├── native/               # 네이티브 모듈 (Objective-C++)
    │   ├── corner_radius.mm  # NSWindow 코너 반경 커스텀
    │   ├── binding.gyp       # node-gyp 빌드 설정
    │   ├── index.js          # JS wrapper
    │   └── prebuilds/        # 사전 빌드된 바이너리
    │
    ├── vite.config.ts        # Vite + Electron 빌드 설정
    └── package.json          # 앱 의존성
```

## Electron Process Model

```
┌─────────────────────────────────────────────────┐
│  Main Process (Node.js)                         │
│  electron/main/index.ts                         │
│                                                 │
│  - 파일 시스템 접근 (fs, gray-matter)            │
│  - ~/.vitals/reports/*.md 읽기/삭제              │
│  - 스킬 설치 확인/실행 (child_process)           │
│  - 커스텀 메뉴바 (Vitals/Edit/Window)            │
│  - 네이티브 모듈 로드 (코너 반경)                 │
│  - BrowserWindow 생성 (메인 창, 설정 창)          │
│                                                 │
│  IPC Handlers:                                  │
│  ├── get-reports    → readReportFiles()          │
│  ├── delete-report  → deleteReportFile()         │
│  ├── get-reports-dir → REPORTS_DIR               │
│  ├── check-skill    → checkSkillInstalled()      │
│  └── install-skill  → installSkill()             │
└──────────────┬──────────────────────────────────┘
               │ IPC (ipcMain.handle / ipcRenderer.invoke)
┌──────────────┴──────────────────────────────────┐
│  Preload (electron/preload/index.ts)            │
│                                                 │
│  contextBridge.exposeInMainWorld('vitalsAPI', {  │
│    getReports, deleteReport, getReportsDir,      │
│    checkSkill, installSkill                      │
│  })                                              │
└──────────────┬──────────────────────────────────┘
               │ window.vitalsAPI
┌──────────────┴──────────────────────────────────┐
│  Renderer Process (React)                       │
│  src/App.tsx                                    │
│                                                 │
│  - URL hash로 메인/설정 분기 (#settings)         │
│  - 보고서 목록 + 상세 보기                       │
│  - react-markdown으로 마크다운 렌더링             │
│  - 스킬 설치 UI                                 │
└─────────────────────────────────────────────────┘
```

## Data Flow

```
~/.vitals/reports/*.md
    │
    │  fs.readFileSync + gray-matter
    ▼
Main Process (ParsedReport[])
    │
    │  IPC: get-reports
    ▼
Preload (contextBridge)
    │
    │  window.vitalsAPI.getReports()
    ▼
React State (reports, selected)
    │
    │  react-markdown
    ▼
UI Render
```

## Report Format

보고서는 YAML frontmatter + 마크다운 본문으로 구성된다.
`vitals-postmortem` 스킬이 `~/.vitals/reports/`에 자동 생성한다.

```markdown
---
project: my-app
mode: postmortem | emergency | checkup
date: 2026-04-03
status: abandoned | in-crisis | on-track
summary: 한 줄 요약
---

# 본문 (마크다운)
```

파일명 규칙: `{mode}-{project}-{YYYY-MM-DD}.md`

## Native Module (corner_radius)

macOS NSWindow의 private API(`_cornerMask`)를 Objective-C runtime swizzle로 교체하여
윈도우 코너 반경을 커스텀한다 (기본 ~10pt → 24pt).

- `_cornerMask` 메서드를 `NSBezierPath bezierPathWithRoundedRect:xRadius:yRadius:`로 대체
- `CALayer.cornerRadius`도 함께 적용 (이중 보장)
- N-API 애드온으로 빌드, `createRequire`로 ESM 환경에서 로드
- `ready-to-show` 이벤트 이후 적용하여 깜빡임 방지

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

- 설치: `npx skills add eraser3031/vitals-skill -g`
- 설치 경로: `~/.claude/skills/vitals-postmortem/SKILL.md`
- 앱에서 설치 여부 확인: `fs.existsSync(skillPath)`
- 앱 내 원클릭 설치: `child_process.exec('npx skills add ...')`

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Electron 33 |
| Frontend | React 18 + TypeScript |
| Build | Vite + vite-plugin-electron |
| Markdown parsing | gray-matter (Main), react-markdown (Renderer) |
| Native | Objective-C++ N-API addon |
| Skill distribution | skills.sh (eraser3031/vitals-skill) |
