import { app, BrowserWindow, shell, ipcMain, Menu, safeStorage, dialog, net } from 'electron'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { randomUUID, createHash } from 'node:crypto'
import matter from 'gray-matter'

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
const PROJECTS_DIR = path.join(VITALS_DIR, 'projects')
const INBOX_DIR = path.join(VITALS_DIR, 'inbox')
const CREDENTIALS_PATH = path.join(VITALS_DIR, 'credentials.dat')
const CONFIG_PATH = path.join(VITALS_DIR, 'config.json')

function ensureDirs() {
  for (const dir of [VITALS_DIR, PROJECTS_DIR, INBOX_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

// ── Project CRUD ──

interface ProjectData {
  version: 1
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

function getAllProjects(): ProjectData[] {
  ensureDirs()
  if (!fs.existsSync(PROJECTS_DIR)) return []

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
  const projects: ProjectData[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const projectJsonPath = path.join(PROJECTS_DIR, entry.name, 'project.json')
    if (!fs.existsSync(projectJsonPath)) continue
    try {
      const data = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'))
      projects.push(data)
    } catch {
      // skip corrupt files
    }
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function getProject(id: string): ProjectData | null {
  const projectJsonPath = path.join(PROJECTS_DIR, id, 'project.json')
  if (!fs.existsSync(projectJsonPath)) return null
  try {
    return JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'))
  } catch {
    return null
  }
}

function createProject(input: { name: string; description?: string }): ProjectData {
  const id = randomUUID()
  const now = new Date().toISOString()
  const projectDir = path.join(PROJECTS_DIR, id)
  const reportsDir = path.join(projectDir, 'reports')

  fs.mkdirSync(reportsDir, { recursive: true })

  const project: ProjectData = {
    version: 1,
    id,
    name: input.name,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  }

  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(project, null, 2))
  fs.writeFileSync(path.join(projectDir, 'connections.json'), '[]')

  return project
}

function updateProject(id: string, updates: Partial<ProjectData>): ProjectData | null {
  const project = getProject(id)
  if (!project) return null

  const updated = {
    ...project,
    ...updates,
    id: project.id, // prevent id overwrite
    version: project.version, // prevent version overwrite
    updatedAt: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(PROJECTS_DIR, id, 'project.json'),
    JSON.stringify(updated, null, 2),
  )
  return updated
}

function deleteProject(id: string): boolean {
  const projectDir = path.join(PROJECTS_DIR, id)
  if (!fs.existsSync(projectDir)) return false
  fs.rmSync(projectDir, { recursive: true, force: true })
  return true
}

// ── Connections ──

interface ConnectionData {
  id: string
  type: string
  [key: string]: unknown
}

function getConnections(projectId: string): ConnectionData[] {
  const filePath = path.join(PROJECTS_DIR, projectId, 'connections.json')
  if (!fs.existsSync(filePath)) return []
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return []
  }
}

function saveConnection(projectId: string, connection: ConnectionData): boolean {
  const filePath = path.join(PROJECTS_DIR, projectId, 'connections.json')
  const connections = getConnections(projectId)

  const idx = connections.findIndex(c => c.id === connection.id)
  if (idx >= 0) {
    connections[idx] = connection
  } else {
    connections.push(connection)
  }

  fs.writeFileSync(filePath, JSON.stringify(connections, null, 2))

  // update project timestamp
  updateProject(projectId, {})

  return true
}

function deleteConnection(projectId: string, connectionId: string): boolean {
  const filePath = path.join(PROJECTS_DIR, projectId, 'connections.json')
  const connections = getConnections(projectId)
  const filtered = connections.filter(c => c.id !== connectionId)

  if (filtered.length === connections.length) return false

  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2))
  updateProject(projectId, {})
  return true
}

// ── Reports ──

function inferMode(filename: string, data: Record<string, unknown>): string {
  if (data.mode) return data.mode as string
  if (filename.startsWith('postmortem-')) return 'postmortem'
  if (filename.startsWith('emergency-')) return 'emergency'
  if (filename.startsWith('checkup-')) return 'checkup'
  return 'postmortem'
}

interface ParsedReport {
  filename: string
  meta: {
    mode: string
    date: string
    status: string
    summary?: string
    repo?: string
  }
  content: string
  raw: string
}

function readReportsFromDir(dir: string): ParsedReport[] {
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
  return files.map(filename => {
    const raw = fs.readFileSync(path.join(dir, filename), 'utf-8')
    const { data, content } = matter(raw)
    return {
      filename,
      meta: {
        mode: inferMode(filename, data),
        date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : (data.date as string) || '',
        status: (data.status as string) || '',
        summary: data.summary as string | undefined,
        repo: data.repo as string | undefined,
      },
      content,
      raw,
    }
  })
}

function getReports(projectId: string): ParsedReport[] {
  const reportsDir = path.join(PROJECTS_DIR, projectId, 'reports')
  return readReportsFromDir(reportsDir)
}

function deleteReport(projectId: string, filename: string): boolean {
  const filepath = path.join(PROJECTS_DIR, projectId, 'reports', filename)
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
    return true
  }
  return false
}

// ── Inbox ──

function processInbox(): { matched: number; unmatched: number } {
  ensureDirs()
  const inboxReports = readReportsFromDir(INBOX_DIR)
  if (inboxReports.length === 0) return { matched: 0, unmatched: 0 }

  // Build lookup: local.path → projectId
  const pathToProject = new Map<string, string>()
  const projects = getAllProjects()
  for (const project of projects) {
    const connections = getConnections(project.id)
    for (const conn of connections) {
      if (conn.type === 'git' && conn.local && typeof conn.local === 'object') {
        const localPath = (conn.local as { path: string }).path
        if (localPath) {
          pathToProject.set(localPath, project.id)
        }
      }
    }
  }

  let matched = 0
  let unmatched = 0

  for (const report of inboxReports) {
    const repoPath = report.meta.repo
    const projectId = repoPath ? pathToProject.get(repoPath) : undefined

    if (projectId) {
      // Move to project reports dir
      const src = path.join(INBOX_DIR, report.filename)
      const destDir = path.join(PROJECTS_DIR, projectId, 'reports')
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
      const dest = path.join(destDir, report.filename)
      fs.renameSync(src, dest)
      matched++
    } else {
      unmatched++
    }
  }

  return { matched, unmatched }
}

function getUnmatchedReports(): ParsedReport[] {
  return readReportsFromDir(INBOX_DIR)
}

function assignReport(filename: string, projectId: string): boolean {
  const src = path.join(INBOX_DIR, filename)
  if (!fs.existsSync(src)) return false

  const destDir = path.join(PROJECTS_DIR, projectId, 'reports')
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  fs.renameSync(src, path.join(destDir, filename))
  return true
}

// ── Credentials ──

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

function saveCredential(provider: string, data: unknown): boolean {
  const creds = loadCredentials()
  creds[provider] = data
  saveCredentialsFile(creds)
  return true
}

function deleteCredential(provider: string): boolean {
  const creds = loadCredentials()
  if (!(provider in creds)) return false
  delete creds[provider]
  saveCredentialsFile(creds)
  return true
}

// ── Git Scan ──

interface ScannedRepo {
  name: string
  path: string
  remoteUrl?: string
}

function parseGitRemote(remoteUrl: string): { provider: 'github' | 'gitlab' | 'bitbucket'; owner: string; repo: string; url: string } | undefined {
  // Normalize: git@host:owner/repo.git → https://host/owner/repo
  let normalized = remoteUrl.trim()
  if (normalized.startsWith('git@')) {
    normalized = normalized.replace('git@', 'https://').replace(':', '/')
  }
  normalized = normalized.replace(/\.git$/, '')

  let provider: 'github' | 'gitlab' | 'bitbucket' | undefined
  if (normalized.includes('github.com')) provider = 'github'
  else if (normalized.includes('gitlab.com')) provider = 'gitlab'
  else if (normalized.includes('bitbucket.org')) provider = 'bitbucket'

  if (!provider) return undefined

  const match = normalized.match(/(?:github\.com|gitlab\.com|bitbucket\.org)[/:]([^/]+)\/([^/]+)/)
  if (!match) return undefined

  return {
    provider,
    owner: match[1],
    repo: match[2],
    url: `https://${provider === 'bitbucket' ? 'bitbucket.org' : provider + '.com'}/${match[1]}/${match[2]}`,
  }
}

function readGitRemoteUrl(repoPath: string): string | undefined {
  const configPath = path.join(repoPath, '.git', 'config')
  if (!fs.existsSync(configPath)) return undefined
  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    const match = content.match(/\[remote "origin"\][^[]*url\s*=\s*(.+)/m)
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

async function scanForGitRepos(): Promise<{ repos: ScannedRepo[]; rootPath: string | null }> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    message: '프로젝트들이 있는 디렉토리를 선택하세요',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { repos: [], rootPath: null }
  }

  const rootPath = result.filePaths[0]
  const entries = fs.readdirSync(rootPath, { withFileTypes: true })
  const repos: ScannedRepo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    const entryPath = path.join(rootPath, entry.name)
    const gitDir = path.join(entryPath, '.git')

    // Only check for .git directories (skip file pointers, symlinks)
    try {
      const stat = fs.statSync(gitDir)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }

    const remoteUrl = readGitRemoteUrl(entryPath)
    repos.push({
      name: entry.name,
      path: entryPath,
      remoteUrl: remoteUrl || undefined,
    })
  }

  // Save scan root to config
  saveConfig({ scanRoots: [rootPath] })

  return { repos, rootPath }
}

async function importScannedRepos(repos: ScannedRepo[]): Promise<{ created: number; skipped: number }> {
  // Get existing git local paths to avoid duplicates
  const existingPaths = new Set<string>()
  const projects = getAllProjects()
  for (const project of projects) {
    const connections = getConnections(project.id)
    for (const conn of connections) {
      if (conn.type === 'git' && conn.local && typeof conn.local === 'object') {
        existingPaths.add((conn.local as { path: string }).path)
      }
    }
  }

  let created = 0
  let skipped = 0

  for (const repo of repos) {
    if (existingPaths.has(repo.path)) {
      skipped++
      continue
    }

    // Create project
    const project = createProject({ name: repo.name })

    // Create git connection
    const gitConn: ConnectionData = {
      id: randomUUID(),
      type: 'git',
      local: { path: repo.path },
    }

    // Parse remote if available
    if (repo.remoteUrl) {
      const remote = parseGitRemote(repo.remoteUrl)
      if (remote) {
        (gitConn as any).remote = remote
      }
    }

    saveConnection(project.id, gitConn)
    created++
  }

  return { created, skipped }
}

async function pickGitRepo(): Promise<ConnectionData | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    message: 'Git 레포지토리 폴더를 선택하세요',
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const repoPath = result.filePaths[0]
  const gitDir = path.join(repoPath, '.git')

  // Validate: must be a git repo
  try {
    const stat = fs.statSync(gitDir)
    if (!stat.isDirectory()) return null
  } catch {
    return null
  }

  const conn: ConnectionData = {
    id: randomUUID(),
    type: 'git',
    local: { path: repoPath },
  }

  const remoteUrl = readGitRemoteUrl(repoPath)
  if (remoteUrl) {
    const remote = parseGitRemote(remoteUrl)
    if (remote) {
      (conn as any).remote = remote
    }
  }

  return conn
}

// ── Config ──

function loadConfig(): Record<string, unknown> {
  if (!fs.existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveConfig(updates: Record<string, unknown>): void {
  const config = { ...loadConfig(), ...updates }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

// ── Skill ──

function checkSkillInstalled(): boolean {
  const skillPath = path.join(os.homedir(), '.claude', 'skills', 'vitals-postmortem', 'SKILL.md')
  return fs.existsSync(skillPath)
}

async function checkSkillUpdate(): Promise<{ installed: boolean; updateAvailable: boolean }> {
  const skillPath = path.join(os.homedir(), '.claude', 'skills', 'vitals-postmortem', 'SKILL.md')
  if (!fs.existsSync(skillPath)) return { installed: false, updateAvailable: false }

  try {
    const localContent = fs.readFileSync(skillPath, 'utf-8')
    const localHash = createHash('sha256').update(localContent).digest('hex')

    const res = await net.fetch('https://raw.githubusercontent.com/eraser3031/vitals-skill/main/SKILL.md')
    if (!res.ok) return { installed: true, updateAvailable: false }

    const remoteContent = await res.text()
    const remoteHash = createHash('sha256').update(remoteContent).digest('hex')

    return { installed: true, updateAvailable: localHash !== remoteHash }
  } catch {
    return { installed: true, updateAvailable: false }
  }
}

async function installSkill(): Promise<{ success: boolean; message: string }> {
  const { exec } = await import('node:child_process')
  return new Promise((resolve) => {
    exec('npx skills add eraser3031/vitals-skill -g -y', { timeout: 60000 }, (error) => {
      if (error) {
        resolve({ success: false, message: error.message })
      } else {
        resolve({ success: true, message: '스킬이 설치되었습니다' })
      }
    })
  })
}

// ── IPC Handlers ──

// Project
ipcMain.handle('get-projects', () => getAllProjects())
ipcMain.handle('get-project', (_, id: string) => getProject(id))
ipcMain.handle('create-project', (_, data: { name: string; description?: string }) => createProject(data))
ipcMain.handle('update-project', (_, id: string, data: Record<string, unknown>) => updateProject(id, data as Partial<ProjectData>))
ipcMain.handle('delete-project', (_, id: string) => deleteProject(id))

// Connection
ipcMain.handle('get-connections', (_, projectId: string) => getConnections(projectId))
ipcMain.handle('save-connection', (_, projectId: string, connection: ConnectionData) => saveConnection(projectId, connection))
ipcMain.handle('delete-connection', (_, projectId: string, connectionId: string) => deleteConnection(projectId, connectionId))

// Report
ipcMain.handle('get-reports', (_, projectId: string) => getReports(projectId))
ipcMain.handle('delete-report', (_, projectId: string, filename: string) => deleteReport(projectId, filename))

// Inbox
ipcMain.handle('process-inbox', () => processInbox())
ipcMain.handle('get-unmatched-reports', () => getUnmatchedReports())
ipcMain.handle('assign-report', (_, filename: string, projectId: string) => assignReport(filename, projectId))

// Credential
ipcMain.handle('get-credential', (_, provider: string) => getCredential(provider))
ipcMain.handle('save-credential', (_, provider: string, data: unknown) => saveCredential(provider, data))
ipcMain.handle('delete-credential', (_, provider: string) => deleteCredential(provider))

// Git
ipcMain.handle('pick-git-repo', () => pickGitRepo())
ipcMain.handle('scan-directory', () => scanForGitRepos())
ipcMain.handle('import-scanned-repos', (_, repos: ScannedRepo[]) => importScannedRepos(repos))

// Skill
ipcMain.handle('check-skill', () => checkSkillInstalled())
ipcMain.handle('check-skill-update', () => checkSkillUpdate())
ipcMain.handle('install-skill', () => installSkill())

// ── App Lifecycle ──

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let settingsWin: BrowserWindow | null = null
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

function openSettings() {
  if (settingsWin) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    title: 'Settings',
    width: 480,
    height: 400,
    resizable: false,
    webPreferences: {
      preload,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}#settings`)
  } else {
    settingsWin.loadFile(indexHtml, { hash: 'settings' })
  }

  settingsWin.on('closed', () => {
    settingsWin = null
  })
}

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Vitals',
      submenu: [
        { role: 'about', label: 'About Vitals' },
        { type: 'separator' },
        { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: openSettings },
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

  ensureDirs()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
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
