# 프로젝트 기반 구조 전환 계획

> Vitals 앱을 보고서 중심 → 프로젝트 중심으로 전환하는 구현 계획.
> 기존 `~/.vitals/reports/` 플랫 구조는 말소하고 새 구조로 시작한다.

---

## 핵심 설계 원칙

- **프로젝트 = 추상 컨테이너**: 로컬 디렉토리가 아닌, 맥락을 모으는 상위 단위
- **로컬 퍼스트, 로그인 없음**: 모든 데이터는 `~/.vitals/`에 JSON/마크다운으로 저장
- **인증 정보 분리**: API 키/토큰은 `safeStorage`로 암호화, 프로젝트 폴더엔 절대 미포함
- **느슨한 결합**: 스킬(진단 엔진)은 앱 내부 구조를 모른다. inbox를 통해 간접 연결
- **커넥션은 배열**: 하나의 프로젝트에 같은 타입의 커넥션을 여러 개 연결 가능

---

## 1단계: 데이터 구조 설계 + 저장소 전환

### 1-1. 디렉토리 구조

```
~/.vitals/
├── config.json                    ← 앱 전역 설정
├── credentials.dat                ← safeStorage 암호화 (API 토큰)
├── inbox/                         ← 스킬이 보고서를 쓰는 곳 (앱 구조 모름)
│   └── postmortem-vitals-2026-04-04.md
└── projects/
    └── {uuid}/
        ├── project.json           ← 프로젝트 메타데이터
        ├── connections.json       ← 커넥션 배열 (단일 파일)
        └── reports/
            └── postmortem-2026-04-01.md
```

### 1-2. 타입 정의 (`src/types.ts`)

```typescript
// ── 프로젝트 ──

interface Project {
  version: 1                       // 스키마 버전 (향후 마이그레이션용)
  id: string                       // UUID
  name: string                     // 프로젝트 표시명
  description?: string             // 한 줄 설명
  createdAt: string                // ISO 8601
  updatedAt: string                // ISO 8601
}

// ── 커넥션 ──

// Git 커넥션: 로컬과 리모트 두 상태를 가짐
interface GitConnection {
  id: string                       // 커넥션 고유 ID (UUID)
  type: 'git'
  local?: {
    path: string                   // 로컬 레포 절대 경로
  }
  remote?: {
    provider: 'github' | 'gitlab' | 'bitbucket'
    owner: string
    repo: string
    url: string
  }
}

// 외부 서비스 커넥션 (Linear, Notion, Jira 등)
interface ServiceConnection {
  id: string                       // 커넥션 고유 ID (UUID)
  type: 'linear' | 'notion' | 'jira'
  resourceId: string               // 프로젝트/페이지/보드 ID
  resourceName?: string            // 표시용 이름
  url?: string                     // 웹 링크
}

type Connection = GitConnection | ServiceConnection

// connections.json은 Connection[] 배열
// → 같은 타입 커넥션 여러 개 가능 (멀티레포, 멀티 워크스페이스)

// ── 인증 (전역, 프로젝트 무관) ──
// MVP에서는 단일 계정 전제. 멀티 계정은 이후 확장.

interface Credentials {
  github?: { token: string }
  linear?: { apiKey: string }
  notion?: { token: string }
  jira?: { token: string; domain: string }
}

// ── 보고서 ──

type DiagnosisMode = 'postmortem' | 'emergency' | 'checkup'

interface ReportMeta {
  mode: DiagnosisMode
  date: string
  status: string
  summary?: string
  repo?: string                    // 스킬이 실행된 레포 경로 (inbox 매칭용)
}

interface Report {
  filename: string
  meta: ReportMeta
  content: string
  raw: string
}
```

### 1-3. project.json 예시

```json
{
  "version": 1,
  "id": "a1b2c3d4-...",
  "name": "vitals",
  "description": "프로젝트 의사 Mac 앱",
  "createdAt": "2026-04-04T09:00:00Z",
  "updatedAt": "2026-04-04T09:00:00Z"
}
```

### 1-4. connections.json 예시

```json
[
  {
    "id": "conn-abc123",
    "type": "git",
    "local": {
      "path": "/Users/e2/Projects/vitals"
    },
    "remote": {
      "provider": "github",
      "owner": "eraser3031",
      "repo": "vitals",
      "url": "https://github.com/eraser3031/vitals"
    }
  },
  {
    "id": "conn-def456",
    "type": "git",
    "local": {
      "path": "/Users/e2/Projects/vitals-skill"
    },
    "remote": {
      "provider": "github",
      "owner": "eraser3031",
      "repo": "vitals-skill",
      "url": "https://github.com/eraser3031/vitals-skill"
    }
  },
  {
    "id": "conn-ghi789",
    "type": "linear",
    "resourceId": "project-xxx",
    "resourceName": "VITALS",
    "url": "https://linear.app/team/VITALS"
  }
]
```

- Git 커넥션의 `local` 존재 → UI에 서버 아이콘 (로컬 연결됨)
- Git 커넥션의 `remote` 존재 → UI에 구름 아이콘 (리모트 연결됨)
- 같은 타입 커넥션이 여러 개 가능 (위 예시: git 2개, linear 1개)

### 1-5. inbox 보고서 매칭 흐름

스킬은 앱 내부 구조를 모른다. 보고서를 `~/.vitals/inbox/`에 플랫하게 생성한다.

**보고서 frontmatter (스킬이 작성):**

```yaml
mode: postmortem
date: 2026-04-04
status: "사망 확인"
summary: "방향성 상실로 인한 프로젝트 중단"
repo: /Users/e2/Projects/vitals    # 스킬이 실행된 cwd
```

**앱의 inbox 처리 흐름 (앱 실행 시):**

1. `~/.vitals/inbox/` 스캔
2. 각 보고서의 `meta.repo` 경로 읽기
3. 모든 프로젝트의 `connections.json`에서 `type: 'git'`인 커넥션의 `local.path` 수집
4. `meta.repo`와 일치하는 `local.path`를 가진 프로젝트로 자동 귀속
5. 보고서를 해당 프로젝트의 `reports/` 폴더로 이동
6. inbox 원본 삭제
7. 매칭 실패 시 → 앱 UI에서 "이 보고서를 어느 프로젝트에 넣을까요?" 선택

### 1-6. 인증 저장 (`credentials.dat`)

```typescript
// electron/main/credentials.ts

import { safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'

const CREDENTIALS_PATH = path.join(os.homedir(), '.vitals', 'credentials.dat')

export function saveCredentials(credentials: Credentials): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available')
  }
  const json = JSON.stringify(credentials)
  const encrypted = safeStorage.encryptString(json)
  fs.writeFileSync(CREDENTIALS_PATH, encrypted)
}

export function loadCredentials(): Credentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) return {}
  if (!safeStorage.isEncryptionAvailable()) return {}
  const buffer = fs.readFileSync(CREDENTIALS_PATH)
  const json = safeStorage.decryptString(buffer)
  return JSON.parse(json)
}
```

- `safeStorage`는 macOS Keychain 기반 — 해당 앱만 복호화 가능
- `isEncryptionAvailable()` 체크 포함
- 프로젝트 커넥션은 `type`/`provider`로 credentials의 키를 참조

### 1-7. IPC 핸들러 추가 (main process)

기존 보고서 관련 핸들러를 프로젝트 중심으로 교체:

```typescript
// ── 프로젝트 CRUD ──
ipcMain.handle('get-projects', () => getAllProjects())
ipcMain.handle('get-project', (_, id: string) => getProject(id))
ipcMain.handle('create-project', (_, data: CreateProjectInput) => createProject(data))
ipcMain.handle('update-project', (_, id: string, data: Partial<Project>) => updateProject(id, data))
ipcMain.handle('delete-project', (_, id: string) => deleteProject(id))

// ── 커넥션 ──
ipcMain.handle('get-connections', (_, projectId: string) => getConnections(projectId))
ipcMain.handle('save-connection', (_, projectId: string, connection: Connection) => saveConnection(projectId, connection))
ipcMain.handle('delete-connection', (_, projectId: string, connectionId: string) => deleteConnection(projectId, connectionId))

// ── 보고서 (프로젝트 귀속) ──
ipcMain.handle('get-reports', (_, projectId: string) => getReports(projectId))
ipcMain.handle('delete-report', (_, projectId: string, filename: string) => deleteReport(projectId, filename))

// ── inbox ──
ipcMain.handle('process-inbox', () => processInbox())
ipcMain.handle('get-unmatched-reports', () => getUnmatchedReports())
ipcMain.handle('assign-report', (_, filename: string, projectId: string) => assignReport(filename, projectId))

// ── 인증 (전역) ──
ipcMain.handle('get-credential', (_, provider: string) => getCredential(provider))
ipcMain.handle('save-credential', (_, provider: string, data: object) => saveCredential(provider, data))
ipcMain.handle('delete-credential', (_, provider: string) => deleteCredential(provider))

// ── Git 스캔 ──
ipcMain.handle('scan-directory', () => scanForGitRepos())
```

### 1-8. Preload 업데이트 (`global.d.ts`)

```typescript
interface VitalsAPI {
  // 프로젝트
  getProjects(): Promise<Project[]>
  getProject(id: string): Promise<Project>
  createProject(data: CreateProjectInput): Promise<Project>
  updateProject(id: string, data: Partial<Project>): Promise<Project>
  deleteProject(id: string): Promise<boolean>

  // 커넥션
  getConnections(projectId: string): Promise<Connection[]>
  saveConnection(projectId: string, connection: Connection): Promise<boolean>
  deleteConnection(projectId: string, connectionId: string): Promise<boolean>

  // 보고서
  getReports(projectId: string): Promise<Report[]>
  deleteReport(projectId: string, filename: string): Promise<boolean>

  // inbox
  processInbox(): Promise<{ matched: number; unmatched: number }>
  getUnmatchedReports(): Promise<Report[]>
  assignReport(filename: string, projectId: string): Promise<boolean>

  // 인증
  getCredential(provider: string): Promise<object | null>
  saveCredential(provider: string, data: object): Promise<boolean>
  deleteCredential(provider: string): Promise<boolean>

  // Git 스캔
  scanDirectory(): Promise<ScannedRepo[]>

  // 스킬
  checkSkill(): Promise<boolean>
  installSkill(): Promise<{ success: boolean; message: string }>
}
```

### 1-9. 주요 main process 함수

```typescript
const VITALS_DIR = path.join(os.homedir(), '.vitals')
const PROJECTS_DIR = path.join(VITALS_DIR, 'projects')
const INBOX_DIR = path.join(VITALS_DIR, 'inbox')

// ── 프로젝트 ──

function getAllProjects(): Project[] {
  // PROJECTS_DIR 하위 디렉토리 순회
  // 각 디렉토리의 project.json 읽어서 Project[] 반환
  // updatedAt 기준 내림차순 정렬
}

function createProject(data: CreateProjectInput): Project {
  // UUID 생성
  // projects/{uuid}/ 디렉토리 생성
  // projects/{uuid}/reports/ 디렉토리 생성
  // project.json 작성 (version: 1 포함)
  // connections.json 작성 (빈 배열 [])
}

function deleteProject(id: string): boolean {
  // projects/{id}/ 디렉토리 통째 삭제
  // ⚠️ 보고서 포함 전부 삭제됨
  // UI에서 삭제 전 확인 다이얼로그 + "보고서 N개가 함께 삭제됩니다" 경고 필수
}

// ── 커넥션 ──

function getConnections(projectId: string): Connection[] {
  // projects/{projectId}/connections.json 읽어서 배열 반환
}

function saveConnection(projectId: string, connection: Connection): boolean {
  // connections.json 읽기 → 배열에 추가/업데이트 → 저장
  // connection.id로 기존 항목 업데이트 판별
}

function deleteConnection(projectId: string, connectionId: string): boolean {
  // connections.json 읽기 → id로 필터링 → 저장
}

// ── inbox ──

function processInbox(): { matched: number; unmatched: number } {
  // 1. INBOX_DIR 내 모든 .md 스캔
  // 2. 각 보고서의 meta.repo 추출
  // 3. 모든 프로젝트의 connections.json에서 git local.path 수집
  // 4. meta.repo === local.path 매칭
  // 5. 매칭된 보고서 → 해당 프로젝트의 reports/로 이동 + inbox 원본 삭제
  // 6. 매칭 안 된 보고서는 inbox에 유지
  // 7. { matched, unmatched } 반환
}

// ── 보고서 ──

function getReports(projectId: string): Report[] {
  // projects/{projectId}/reports/ 내 모든 .md 읽기
  // gray-matter로 frontmatter 파싱
}
```

---

## 2단계: UI 전환 — 사이드바를 프로젝트 리스트로

### 2-1. 컴포넌트 변경 계획

| 기존 | 변경 후 | 역할 |
|------|---------|------|
| `ReportList.tsx` | `ProjectList.tsx` | 사이드바에 프로젝트 목록 표시 |
| `ReportDetail.tsx` | `ProjectDetail.tsx` | 프로젝트 상세 (커넥션 + 보고서) |
| — | `ConnectionList.tsx` | 프로젝트 내 커넥션 목록 |
| — | `ReportList.tsx` (재활용) | 프로젝트 내 보고서 목록 |

### 2-2. 사이드바 (`ProjectList.tsx`)

```
┌─────────────────────┐
│  ● ● ●   Vitals     │  ← 드래그 영역
├─────────────────────┤
│  🔍 검색              │
├─────────────────────┤
│  ▸ vitals            │  ← 선택된 프로젝트
│  ▸ my-blog           │
│  ▸ side-project-x    │
│                      │
│                      │
├─────────────────────┤
│  + 프로젝트 추가       │
└─────────────────────┘
```

### 2-3. 프로젝트 상세 (`ProjectDetail.tsx`)

```
┌──────────────────────────────────────────┐
│  vitals                                  │
│  프로젝트 의사 Mac 앱                       │
├──────────────────────────────────────────┤
│                                          │
│  연결                                     │
│  ┌────────────────────────────────────┐  │
│  │  🖥️ ☁️  Git — vitals              │  │
│  │  /Users/e2/Projects/vitals         │  │
│  ├────────────────────────────────────┤  │
│  │  🖥️ ☁️  Git — vitals-skill        │  │
│  │  /Users/e2/Projects/vitals-skill   │  │
│  ├────────────────────────────────────┤  │
│  │  ▧  Linear — VITALS               │  │
│  ├────────────────────────────────────┤  │
│  │  + 연결 추가                         │  │
│  └────────────────────────────────────┘  │
│                                          │
│  보고서                                   │
│  ┌────────────────────────────────────┐  │
│  │  ⚰️ 부검  2026-04-01               │  │
│  │  🩺 검진  2026-03-15               │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

- Git 커넥션 행: 🖥️(서버, 로컬 연결) + ☁️(구름, 리모트 연결) 아이콘 조합
  - 로컬만: 🖥️ 활성 / ☁️ 비활성(회색)
  - 리모트만: 🖥️ 비활성 / ☁️ 활성
  - 둘 다: 🖥️ ☁️ 모두 활성
- 같은 타입 커넥션이 여러 행으로 표시 (멀티레포)
- 나머지 커넥션: 서비스별 아이콘 하나

### 2-4. App.tsx 상태 변경

```typescript
// 기존
const [reports, setReports] = useState<Report[]>([])
const [selected, setSelected] = useState<Report | null>(null)

// 변경
const [projects, setProjects] = useState<Project[]>([])
const [selectedProject, setSelectedProject] = useState<Project | null>(null)
const [connections, setConnections] = useState<Connection[]>([])
const [reports, setReports] = useState<Report[]>([])
```

- 앱 실행 시 → `processInbox()` 호출하여 inbox 처리
- 미매칭 보고서 있으면 → 알림 또는 배정 UI 표시
- 프로젝트 선택 시 → 해당 프로젝트의 커넥션 + 보고서 로드
- 라우팅: 기본 → 프로젝트 뷰, `#settings` → 설정

---

## 3단계: Git 스캔 자동 감지

### 3-1. 스캔 흐름

1. 사용자가 "프로젝트 추가" 또는 최초 실행 시
2. `dialog.showOpenDialog`로 루트 디렉토리 선택
3. 해당 디렉토리 **1depth** 하위 폴더에서 `.git` **디렉토리** 존재 여부 확인
4. 발견된 레포 목록을 UI에 표시
5. 사용자가 선택/확인하면 각 레포마다:
   - 프로젝트 생성 (`project.json`)
   - `connections.json`에 git 커넥션 추가 (`local.path` 설정)
   - `.git/config`에서 `remote "origin"` URL 파싱 → `remote` 자동 설정

### 3-2. main process 함수

```typescript
interface ScannedRepo {
  name: string           // 폴더명
  path: string           // 절대 경로
  remoteUrl?: string     // origin URL (있으면)
}

async function scanForGitRepos(): Promise<ScannedRepo[]> {
  // 1. dialog.showOpenDialog({ properties: ['openDirectory'] })
  // 2. 선택된 디렉토리의 1depth 하위 폴더 순회
  // 3. 각 폴더에 .git 디렉토리 존재 확인 (파일 포인터, symlink 무시)
  // 4. .git/config 파싱하여 remote origin URL 추출
  // 5. ScannedRepo[] 반환
}

function parseGitRemote(remoteUrl: string): GitConnection['remote'] | undefined {
  // https://github.com/owner/repo.git → { provider: 'github', owner, repo, url }
  // git@github.com:owner/repo.git → 동일 파싱
  // GitHub/GitLab/Bitbucket 판별
  // 알 수 없는 provider → undefined (local만 설정)
}
```

### 3-3. config.json에 스캔 경로 기억

```json
{
  "scanRoots": ["/Users/e2/Projects"],
  "lastScanAt": "2026-04-04T09:00:00Z"
}
```

- 다음 실행 시 자동으로 새 레포 감지 가능 (선택적)

---

## 4단계: 프로젝트 수동 관리

### 4-1. 기능 목록

- **프로젝트 추가**: 이름 입력으로 빈 프로젝트 생성
- **프로젝트 삭제**: 확인 다이얼로그 필수 ("보고서 N개가 함께 삭제됩니다" 경고) → 디렉토리 통째 삭제
- **프로젝트 이름/설명 변경**: 인라인 편집 또는 설정 패널 (repo 경로 기반 매칭이라 이름 변경이 보고서 귀속에 영향 없음)
- **커넥션 수동 추가**: Git 로컬 경로 직접 지정, 외부 서비스 연결
- **커넥션 제거**: 연결 해제 (credentials는 유지)

### 4-2. UI 인터랙션

- 사이드바 하단 "+ 프로젝트 추가" 버튼
- 프로젝트 우클릭 → 컨텍스트 메뉴 (이름 변경, 삭제)
- 프로젝트 상세 뷰 내 "+ 연결 추가" 버튼
- 커넥션 항목 hover 시 제거 버튼

---

## 삭제 대상 (기존 구조 말소)

| 대상 | 처리 |
|------|------|
| `~/.vitals/reports/` (플랫 구조) | 앱 첫 실행 시 존재하면 무시, 새 구조만 사용 |
| `ReportList.tsx` (보고서 사이드바) | `ProjectList.tsx`로 교체 |
| `ReportDetail.tsx` | `ProjectDetail.tsx`로 교체 |
| IPC: `get-reports` (전체 보고서) | `get-reports(projectId)`로 교체 |
| IPC: `get-reports-dir` | 제거 (프로젝트별 경로로 대체) |

---

## 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 스킬 ↔ 앱 연결 | inbox 패턴. 스킬은 `~/.vitals/inbox/`에 쓰고, 앱이 실행 시 스캔하여 프로젝트에 귀속 |
| 보고서 매칭 기준 | 보고서 frontmatter의 `repo` 경로 ↔ 프로젝트 git 커넥션의 `local.path` |
| 커넥션 저장 방식 | 단일 `connections.json` 파일에 배열로 저장. 같은 타입 여러 개 가능 |
| 프로젝트 삭제 정책 | 보고서 포함 전체 삭제. 삭제 전 "보고서 N개 함께 삭제" 경고 필수 |
| 인증 저장 | `safeStorage` (macOS Keychain 기반 암호화). `isEncryptionAvailable()` 체크 |
| 스키마 버전 | `project.json`에 `version: 1` 필드. 마이그레이션 러너는 이후 필요 시 추가 |
| Git 스캔 범위 | 1depth `.git` 디렉토리만. worktree/symlink/bare repo는 MVP에서 무시 |
| 멀티 계정 | MVP 생략. 서비스당 단일 계정 전제 |
| inbox 처리 시점 | 앱 실행 시. 실시간 파일 워처는 이후 확장 |
| inbox 원본 | 프로젝트에 귀속 후 삭제 |

---

## 구현 순서 요약

```
1단계 ─ 데이터 구조 + 저장소
  ├─ 1-1. 디렉토리 구조 생성 로직
  ├─ 1-2. 타입 정의 (version 필드 포함)
  ├─ 1-3~4. JSON 읽기/쓰기 함수
  ├─ 1-5. inbox 매칭 로직 (repo 경로 기반)
  ├─ 1-6. credentials safeStorage
  ├─ 1-7~8. IPC 핸들러 + Preload (inbox 포함)
  └─ 1-9. main process CRUD 함수

2단계 ─ UI 전환
  ├─ 2-1. ProjectList 컴포넌트
  ├─ 2-2. ProjectDetail 컴포넌트
  ├─ 2-3. ConnectionList (Git 아이콘 2개 + 멀티 행)
  ├─ 2-4. App.tsx 상태 관리 변경 + inbox 처리
  └─ 2-5. 미매칭 보고서 배정 UI

3단계 ─ Git 스캔 자동 감지
  ├─ 3-1. 디렉토리 선택 + 1depth .git 디렉토리 스캔
  ├─ 3-2. remote URL 파싱
  └─ 3-3. config.json 스캔 경로 저장

4단계 ─ 프로젝트 수동 관리
  ├─ 4-1. 프로젝트 추가/삭제(경고 포함)/수정
  └─ 4-2. 커넥션 수동 추가/제거
```
