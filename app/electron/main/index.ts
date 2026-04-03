import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import matter from 'gray-matter'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Reports directory
const REPORTS_DIR = path.join(os.homedir(), '.vitals', 'reports')

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

interface ParsedReport {
  filename: string
  meta: {
    project: string
    mode: string
    date: string
    status: string
    summary?: string
  }
  content: string
}

function inferMode(filename: string, data: Record<string, unknown>): string {
  if (data.mode) return data.mode as string
  if (filename.startsWith('postmortem-')) return 'postmortem'
  if (filename.startsWith('emergency-')) return 'emergency'
  if (filename.startsWith('checkup-')) return 'checkup'
  return 'postmortem'
}

function readReportFiles(): ParsedReport[] {
  ensureReportsDir()
  const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'))
  return files.map(filename => {
    const raw = fs.readFileSync(path.join(REPORTS_DIR, filename), 'utf-8')
    const { data, content } = matter(raw)
    return {
      filename,
      meta: {
        project: (data.project as string) || filename.replace(/\.md$/, ''),
        mode: inferMode(filename, data),
        date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : (data.date as string) || '',
        status: (data.status as string) || '',
        summary: data.summary as string | undefined,
      },
      content,
    }
  })
}

function deleteReportFile(filename: string): boolean {
  const filepath = path.join(REPORTS_DIR, filename)
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
    return true
  }
  return false
}

// Skill installation
function checkSkillInstalled(): boolean {
  const skillPath = path.join(os.homedir(), '.claude', 'skills', 'vitals-postmortem', 'SKILL.md')
  return fs.existsSync(skillPath)
}

async function installSkill(): Promise<{ success: boolean; message: string }> {
  const { exec } = await import('node:child_process')
  return new Promise((resolve) => {
    exec('npx skills add eraser3031/vitals-skill -g -y', { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, message: error.message })
      } else {
        resolve({ success: true, message: '스킬이 설치되었습니다' })
      }
    })
  })
}

// IPC handlers
ipcMain.handle('get-reports', () => readReportFiles())
ipcMain.handle('delete-report', (_, filename: string) => deleteReportFile(filename))
ipcMain.handle('get-reports-dir', () => REPORTS_DIR)
ipcMain.handle('check-skill', () => checkSkillInstalled())
ipcMain.handle('install-skill', () => installSkill())

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

  // Apply custom corner radius after window is ready, then show
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

  ensureReportsDir()
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
