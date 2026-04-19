import { app, BrowserWindow, shell, ipcMain, Menu, safeStorage, net } from 'electron'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// ── Paths ──

const VITALS_DIR = path.join(os.homedir(), '.vitals')
const CREDENTIALS_PATH = path.join(VITALS_DIR, 'credentials.dat')
const POSTS_PATH = path.join(VITALS_DIR, 'posts.json')

function ensureDir() {
  if (!fs.existsSync(VITALS_DIR)) {
    fs.mkdirSync(VITALS_DIR, { recursive: true })
  }
}

// ── Credentials (OAuth tokens) ──

function loadCredentials(): Record<string, unknown> {
  if (!fs.existsSync(CREDENTIALS_PATH)) return {}
  if (!safeStorage.isEncryptionAvailable()) return {}
  try {
    const buffer = fs.readFileSync(CREDENTIALS_PATH)
    const json = safeStorage.decryptString(buffer)
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function saveCredentialsFile(credentials: Record<string, unknown>): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available')
  }
  const json = JSON.stringify(credentials)
  const encrypted = safeStorage.encryptString(json)
  fs.writeFileSync(CREDENTIALS_PATH, encrypted)
}

function getCredential(provider: string): unknown {
  const creds = loadCredentials()
  return creds[provider] || null
}

function saveCredential(provider: string, data: unknown): void {
  ensureDir()
  const creds = loadCredentials()
  creds[provider] = data
  saveCredentialsFile(creds)
}

function deleteCredential(provider: string): void {
  const creds = loadCredentials()
  if (!(provider in creds)) return
  delete creds[provider]
  saveCredentialsFile(creds)
}

// ── Post CRUD ──

interface ContextData {
  id: string
  type: 'github' | 'notion'
  label: string
  data: Record<string, unknown>
}

interface ReplyData {
  id: string
  author: 'user' | 'ai'
  content: string
  createdAt: string
  updatedAt: string
}

interface EntryData {
  id: string
  category?: string
  question: string
  replies: ReplyData[]
  createdAt: string
}

interface PostData {
  id: string
  title: string
  project: string
  contexts: ContextData[]
  entries: EntryData[]
  createdAt: string
  updatedAt: string
}

// posts.json 마이그레이션:
//  - 과거 { content: string } 본문 → entries[0] 에 user reply 로 승격
//  - IPC 시그니처 과도기에 title 필드에 patch 객체가 잘못 저장된 경우 → entries 로 복원
function migratePost(raw: Record<string, unknown>): PostData {
  // 방어: title/project 가 문자열이 아니면 "" 로.
  let title = typeof raw.title === 'string' ? raw.title : ''
  const project = typeof raw.project === 'string' ? raw.project : ''

  // title 이 { entries: [...] } 객체로 잘못 저장된 케이스에서 entries 복원.
  let salvagedEntries: EntryData[] | undefined
  if (
    raw.title &&
    typeof raw.title === 'object' &&
    !Array.isArray(raw.title) &&
    Array.isArray((raw.title as { entries?: unknown }).entries)
  ) {
    salvagedEntries = (raw.title as { entries: EntryData[] }).entries
    title = ''
  }

  const rawEntries = Array.isArray(raw.entries) ? (raw.entries as EntryData[]) : undefined
  const rawContexts = Array.isArray(raw.contexts) ? (raw.contexts as ContextData[]) : []
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt
  const id = typeof raw.id === 'string' ? raw.id : randomUUID()

  let entries: EntryData[] = []
  if (rawEntries && rawEntries.length > 0) {
    entries = rawEntries
  } else if (salvagedEntries && salvagedEntries.length > 0) {
    entries = salvagedEntries
  } else if (rawEntries) {
    entries = []
  } else {
    // legacy content: string → 단일 엔트리로 승격
    const legacyContent = typeof raw.content === 'string' ? raw.content.trim() : ''
    if (legacyContent.length > 0) {
      entries = [
        {
          id: randomUUID(),
          question: '(마이그레이션 전 본문)',
          replies: [
            {
              id: randomUUID(),
              author: 'user',
              content: legacyContent,
              createdAt: updatedAt,
              updatedAt,
            },
          ],
          createdAt: updatedAt,
        },
      ]
    }
  }

  // 기존 reply 에 updatedAt 없으면 createdAt 으로 채움
  entries = entries.map(entry => ({
    ...entry,
    replies: (entry.replies || []).map(r => ({
      ...r,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : r.createdAt,
    })),
  }))

  return { id, title, project, contexts: rawContexts, entries, createdAt, updatedAt }
}

function needsRewrite(raw: Record<string, unknown>): boolean {
  if (typeof raw.title !== 'string') return true
  if (typeof raw.project !== 'string') return true
  if (!Array.isArray(raw.entries)) return true
  if ('content' in raw) return true
  // reply 에 updatedAt 누락된 경우
  for (const entry of raw.entries as { replies?: unknown[] }[]) {
    const replies = Array.isArray(entry?.replies) ? entry.replies : []
    for (const r of replies) {
      if (!r || typeof (r as { updatedAt?: unknown }).updatedAt !== 'string') return true
    }
  }
  return false
}

function readPosts(): PostData[] {
  ensureDir()
  if (!fs.existsSync(POSTS_PATH)) return []
  let parsed: Record<string, unknown>[]
  try {
    parsed = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf-8'))
  } catch {
    return []
  }

  const migrated = parsed.map(migratePost)
  if (parsed.some(needsRewrite)) {
    fs.writeFileSync(POSTS_PATH, JSON.stringify(migrated, null, 2))
  }
  return migrated
}

function writePosts(posts: PostData[]): void {
  ensureDir()
  fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2))
}

function getAllPosts(): PostData[] {
  return readPosts().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function createPost(title: string, project: string): PostData {
  const now = new Date().toISOString()
  const post: PostData = {
    id: randomUUID(),
    title,
    project,
    contexts: [],
    entries: [],
    createdAt: now,
    updatedAt: now,
  }
  const posts = readPosts()
  posts.push(post)
  writePosts(posts)
  return post
}

interface PostPatch {
  title?: string
  project?: string
  entries?: EntryData[]
  contexts?: ContextData[]
}

function updatePost(id: string, patch: PostPatch): PostData | null {
  const posts = readPosts()
  const idx = posts.findIndex(p => p.id === id)
  if (idx < 0) return null
  posts[idx] = {
    ...posts[idx],
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.project !== undefined ? { project: patch.project } : {}),
    ...(patch.entries !== undefined ? { entries: patch.entries } : {}),
    ...(patch.contexts !== undefined ? { contexts: patch.contexts } : {}),
    updatedAt: new Date().toISOString(),
  }
  writePosts(posts)
  return posts[idx]
}

function deletePost(id: string): boolean {
  const posts = readPosts()
  const filtered = posts.filter(p => p.id !== id)
  if (filtered.length === posts.length) return false
  writePosts(filtered)
  return true
}

// ── GitHub API ──

async function githubFetch(endpoint: string): Promise<unknown> {
  const cred = getCredential('github') as { accessToken?: string } | null
  if (!cred?.accessToken) throw new Error('GitHub not connected')

  const res = await net.fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${cred.accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Vitals-App',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub API ${res.status}: ${body}`)
  }

  return res.json()
}

// ── Notion API ──

async function notionFetch(endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
  const cred = getCredential('notion') as { accessToken?: string } | null
  if (!cred?.accessToken) throw new Error('Notion not connected')

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${cred.accessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await net.fetch(`https://api.notion.com${endpoint}`, opts)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Notion API ${res.status}: ${text}`)
  }

  return res.json()
}

async function readNotionBlocksRecursive(blockId: string, depth: number, maxDepth: number): Promise<string> {
  const blocks = (await notionFetch(`/v1/blocks/${blockId}/children?page_size=100`)) as {
    results: { id: string; type: string; has_children: boolean; [key: string]: unknown }[]
  }

  const indent = '  '.repeat(depth)
  const lines: string[] = []

  for (const block of blocks.results) {
    const content = (block as any)[block.type]
    if (content?.rich_text) {
      const text = content.rich_text.map((t: any) => t.plain_text).join('')
      if (text) lines.push(`${indent}${text}`)
    }

    if (block.type === 'child_page') {
      const title = (block as any).child_page?.title || 'Untitled'
      lines.push(`${indent}[하위 페이지: ${title}]`)
    }

    if (block.has_children && depth < maxDepth) {
      const childText = await readNotionBlocksRecursive(block.id, depth + 1, maxDepth)
      if (childText) lines.push(childText)
    }
  }

  return lines.join('\n')
}

// ── IPC Handlers ──

// Post
ipcMain.handle('get-posts', () => getAllPosts())
ipcMain.handle('create-post', (_, title: string, project: string) => createPost(title, project))
ipcMain.handle('update-post', (_, id: string, patch: PostPatch) => updatePost(id, patch))
ipcMain.handle('delete-post', (_, id: string) => deletePost(id))

// GitHub OAuth
ipcMain.handle('github-start-oauth', () => {
  const scope = 'repo'
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=vitals://oauth/callback&scope=${scope}`
  shell.openExternal(url)
})
ipcMain.handle('github-get-token', () => {
  const cred = getCredential('github') as { accessToken?: string } | null
  return cred?.accessToken ?? null
})
ipcMain.handle('github-logout', () => {
  deleteCredential('github')
  return true
})
ipcMain.handle('github-get-user', () => githubFetch('/user'))
ipcMain.handle('github-get-repos', async () => {
  const repos: unknown[] = []
  let page = 1
  while (true) {
    const batch = (await githubFetch(`/user/repos?per_page=100&sort=updated&page=${page}`)) as unknown[]
    repos.push(...batch)
    if (batch.length < 100) break
    page++
  }
  return repos
})

// Notion OAuth (폴링 방식 — 개발 모드에서 딥링크 안 되므로)
ipcMain.handle('notion-start-oauth', async () => {
  const state = randomUUID()
  const redirectUri = encodeURIComponent(`${WORKER_URL}/notion/oauth/callback`)
  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${redirectUri}&state=${state}`
  shell.openExternal(url)

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const res = await net.fetch(`${WORKER_URL}/notion/oauth/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      })
      const data = await res.json() as { access_token: string | null }
      if (data.access_token) {
        saveCredential('notion', { accessToken: data.access_token })
        if (win && !win.isDestroyed()) {
          win.webContents.send('notion-oauth-success')
        }
        return
      }
    } catch { /* retry */ }
  }
})
ipcMain.handle('notion-get-token', () => {
  const cred = getCredential('notion') as { accessToken?: string } | null
  return cred?.accessToken ?? null
})
ipcMain.handle('notion-logout', () => {
  deleteCredential('notion')
  return true
})
ipcMain.handle('notion-get-user', () => notionFetch('/v1/users/me'))
ipcMain.handle('notion-search', (_, query: string) => {
  return notionFetch('/v1/search', 'POST', {
    query,
    page_size: 20,
  })
})

function serializeEntriesForAI(entries: EntryData[]): string {
  return entries
    .map((entry, i) => {
      const heading = entry.category ? `${entry.category} — ${entry.question}` : entry.question
      const replyLines = entry.replies.map(r => {
        const who = r.author === 'ai' ? 'AI' : '사용자'
        return `  [${who}] ${r.content}`
      })
      return `Q${i + 1}. ${heading}\n${replyLines.join('\n')}`
    })
    .join('\n\n')
}

// Fact-check
ipcMain.handle('fact-check', async (_, entries: EntryData[], postTitle: string, contexts: ContextData[]) => {
  const postContent = serializeEntriesForAI(entries)
  const contextTexts: string[] = []
  const sources: { type: string; label: string; url: string }[] = []

  for (const ctx of contexts) {
    try {
      if (ctx.type === 'github') {
        const owner = ctx.data.owner as string
        const repo = ctx.data.repo as string
        const repoUrl = `https://github.com/${owner}/${repo}`
        sources.push({ type: 'github', label: `${owner}/${repo}`, url: repoUrl })

        const commits = (await githubFetch(`/repos/${owner}/${repo}/commits?per_page=20`)) as {
          sha: string; commit: { message: string; author: { name: string; date: string } }
        }[]
        const commitLog = commits.map(c =>
          `- ${c.commit.author.date.slice(0, 10)} ${c.commit.author.name}: ${c.commit.message.split('\n')[0]} (${repoUrl}/commit/${c.sha})`
        ).join('\n')
        contextTexts.push(`[GitHub: ${owner}/${repo}] ${repoUrl}\n${commitLog}`)
      }

      if (ctx.type === 'notion') {
        const pageId = ctx.data.pageId as string
        const pageUrl = (ctx.data.url as string) || `https://notion.so/${pageId.replace(/-/g, '')}`
        sources.push({ type: 'notion', label: ctx.label, url: pageUrl })

        const text = await readNotionBlocksRecursive(pageId, 0, 2)
        contextTexts.push(`[Notion: ${ctx.label}] ${pageUrl}\n${text}`)
      }
    } catch {
      contextTexts.push(`[${ctx.type}: ${ctx.label}] 데이터 로드 실패`)
    }
  }

  const sourceList = sources.map(s => `- ${s.label}: ${s.url}`).join('\n')

  const systemPrompt = `당신은 포스트모템 작성을 도와주는 동료입니다. 사용자가 작성 중인 내용을 아래 컨텍스트(GitHub 커밋 기록, Notion 문서)와 대조하여 기억을 확인해주세요.

톤:
- 친절하고 협력적으로. "이건 틀렸습니다"가 아니라 "이 부분은 기록과 좀 다른 것 같아요" 식으로
- 사용자가 "이게 맞았나?" 싶을 때 도움받는 느낌
- 확인된 부분은 "맞아요, 기록에도 이렇게 나와요" 식으로 안심시켜주기

규칙:
- 각 항목에 근거가 된 출처를 링크로 표시 (GitHub 커밋 URL 또는 Notion 페이지 URL)
- 컨텍스트에서 확인 가능한 부분, 기록과 다른 부분, 확인이 안 되는 부분을 구분
- 간결하게 항목별로 정리
- 한국어로 답변

참조한 소스:
${sourceList}`

  const userMessage = `# 포스트 제목: ${postTitle}

# 확인할 내용:
${postContent}

# 컨텍스트:
${contextTexts.join('\n\n')}`

  const res = await net.fetch(`${WORKER_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) throw new Error(`AI request failed: ${res.status}`)

  const text = await res.text()
  return text
})

// 정교화하기
ipcMain.handle('refine', async (_, selectedText: string, postTitle: string, contexts: ContextData[]) => {
  const contextTexts: string[] = []
  const sources: { type: string; label: string; url: string }[] = []

  for (const ctx of contexts) {
    try {
      if (ctx.type === 'github') {
        const owner = ctx.data.owner as string
        const repo = ctx.data.repo as string
        const repoUrl = `https://github.com/${owner}/${repo}`
        sources.push({ type: 'github', label: `${owner}/${repo}`, url: repoUrl })

        const commits = (await githubFetch(`/repos/${owner}/${repo}/commits?per_page=20`)) as {
          sha: string; commit: { message: string; author: { name: string; date: string } }
        }[]
        const commitLog = commits.map(c =>
          `- ${c.commit.author.date.slice(0, 10)} ${c.commit.author.name}: ${c.commit.message.split('\n')[0]} (${repoUrl}/commit/${c.sha})`
        ).join('\n')
        contextTexts.push(`[GitHub: ${owner}/${repo}] ${repoUrl}\n${commitLog}`)
      }

      if (ctx.type === 'notion') {
        const pageId = ctx.data.pageId as string
        const pageUrl = (ctx.data.url as string) || `https://notion.so/${pageId.replace(/-/g, '')}`
        sources.push({ type: 'notion', label: ctx.label, url: pageUrl })
        const text = await readNotionBlocksRecursive(pageId, 0, 2)
        contextTexts.push(`[Notion: ${ctx.label}] ${pageUrl}\n${text}`)
      }
    } catch {
      contextTexts.push(`[${ctx.type}: ${ctx.label}] 데이터 로드 실패`)
    }
  }

  const systemPrompt = `사용자가 선택한 문장을 컨텍스트(GitHub 커밋 기록, Notion 문서)와 대조하여 더 정확한 표현을 제안하세요.

- suggestions: 제안 문장 1~2개. 원문과 같은 톤과 문체로, 사실에 맞게 수정한 버전. 원문이 맞으면 그대로 1개만.
- evidence: 각 제안의 근거. 어떤 기록을 참고했는지 간결하게, 출처 URL 포함.`

  const userMessage = `선택한 문장: ${selectedText}

컨텍스트:
${contextTexts.join('\n\n')}`

  const res = await net.fetch(`${WORKER_URL}/ai/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
  return await res.json()
})

// ── OAuth callback ──

const GITHUB_CLIENT_ID = 'Ov23liF9ANZ7qbKTd9aS'
const NOTION_CLIENT_ID = '346d872b-594c-8160-bd38-0037c475a1f0'
const WORKER_URL = 'http://localhost:8787' // dev, 배포 후 변경

app.setAsDefaultProtocolClient('vitals')

function handleOAuthCallback(url: string) {
  const parsed = new URL(url)
  const pathname = parsed.hostname + parsed.pathname

  if (pathname === 'oauth/callback') {
    const code = parsed.searchParams.get('code')
    if (!code) return

    net.fetch(`${WORKER_URL}/github/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(res => res.json() as Promise<{ access_token?: string; error?: string }>)
      .then(data => {
        if (data.access_token) {
          saveCredential('github', { accessToken: data.access_token })
          if (win && !win.isDestroyed()) {
            win.webContents.send('github-oauth-success')
          }
        }
      })
      .catch(err => console.error('GitHub OAuth failed:', err))
  }

  if (pathname === 'oauth/notion') {
    const token = parsed.searchParams.get('token')
    if (!token) return

    saveCredential('notion', { accessToken: token })
    if (win && !win.isDestroyed()) {
      win.webContents.send('notion-oauth-success')
    }
  }
}

// ── App Lifecycle ──

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// Native corner radius module
const nativeRequire = createRequire(import.meta.url)
let cornerRadius: { setCornerRadius: (handle: Buffer, radius: number) => boolean } | null = null
try {
  const nativePath = path.join(process.env.APP_ROOT, 'native')
  cornerRadius = nativeRequire(nativePath)
} catch (e: any) {
  console.warn('Corner radius module not available:', e)
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'Vitals',
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.once('ready-to-show', () => {
    if (cornerRadius && win) {
      cornerRadius.setCornerRadius(win.getNativeWindowHandle(), 24)
    }
    win?.show()
  })
}

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Vitals',
      submenu: [
        { role: 'about', label: 'About Vitals' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide Vitals' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Vitals' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)

  ensureDir()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', (_event, argv) => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
  const url = argv.find(arg => arg.startsWith('vitals://'))
  if (url) handleOAuthCallback(url)
})

app.on('open-url', (_event, url) => {
  if (url.startsWith('vitals://oauth/callback')) {
    handleOAuthCallback(url)
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
