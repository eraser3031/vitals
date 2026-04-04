import { useEffect, useState } from 'react'
import { ProjectList } from './components/ProjectList'
import { ProjectDetail } from './components/ProjectDetail'
import { Settings } from './components/Settings'
import { SkillInstaller } from './components/SkillInstaller'
import type { Project, Connection, Report, ScannedRepo } from './types'

function App() {
  const isSettings = window.location.hash === '#settings'

  if (isSettings) {
    return <SettingsPage />
  }

  return <MainApp />
}

function SettingsPage() {
  const [skillInstalled, setSkillInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    window.vitalsAPI.checkSkill().then(setSkillInstalled)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Settings
        skillInstalled={skillInstalled}
        onSkillInstalled={() => setSkillInstalled(true)}
      />
    </div>
  )
}

function MainApp() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [skillInstalled, setSkillInstalled] = useState<boolean | null>(null)
  const [inboxUnmatched, setInboxUnmatched] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ repos: ScannedRepo[]; rootPath: string } | null>(null)
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())

  async function loadProjects() {
    try {
      const inboxResult = await window.vitalsAPI.processInbox()
      setInboxUnmatched(inboxResult.unmatched)
    } catch {
      // inbox processing failure should not block app startup
    }

    try {
      const projectList = await window.vitalsAPI.getProjects()
      setProjects(projectList)
    } catch {
      // continue with empty project list
    } finally {
      setLoading(false)
    }
  }

  async function loadProjectData(projectId: string) {
    setConnections([])
    setReports([])
    setSelectedReport(null)

    const [conns, reps] = await Promise.all([
      window.vitalsAPI.getConnections(projectId),
      window.vitalsAPI.getReports(projectId),
    ])

    setSelectedProject(prev => {
      if (prev?.id !== projectId) return prev
      setConnections(conns)
      setReports(reps.sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || '')))
      return prev
    })
  }

  useEffect(() => {
    loadProjects()
    window.vitalsAPI.checkSkill().then(setSkillInstalled)
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadProjectData(selectedProject.id)
    } else {
      setConnections([])
      setReports([])
      setSelectedReport(null)
    }
  }, [selectedProject])

  async function handleScanDirectory() {
    setScanning(true)
    try {
      const result = await window.vitalsAPI.scanDirectory()
      if (result.rootPath && result.repos.length > 0) {
        setScanResult({ repos: result.repos, rootPath: result.rootPath })
        setSelectedRepos(new Set(result.repos.map(r => r.path)))
      }
    } finally {
      setScanning(false)
    }
  }

  async function handleImportRepos() {
    if (!scanResult) return
    const reposToImport = scanResult.repos.filter(r => selectedRepos.has(r.path))
    if (reposToImport.length === 0) return

    const result = await window.vitalsAPI.importScannedRepos(reposToImport)
    setScanResult(null)
    setSelectedRepos(new Set())

    // Reload projects
    const projectList = await window.vitalsAPI.getProjects()
    setProjects(projectList)
  }

  function toggleRepo(repoPath: string) {
    setSelectedRepos(prev => {
      const next = new Set(prev)
      if (next.has(repoPath)) next.delete(repoPath)
      else next.add(repoPath)
      return next
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-muted text-sm bg-white">불러오는 중...</div>
  }

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans">
      <aside className="w-[280px] min-w-[280px] border-r border-border flex flex-col bg-surface">
        <div className="pt-5 pr-4 pb-3 pl-[78px] border-b border-border [-webkit-app-region:drag]">
          <h1 className="text-lg font-bold text-gray-900">Vitals</h1>
          <span className="text-xs text-muted">{projects.length}개 프로젝트</span>
        </div>
        <ProjectList
          projects={projects}
          selected={selectedProject}
          onSelect={setSelectedProject}
        />
        <div className="p-2 border-t border-border">
          <button
            className="w-full px-3 py-2 text-[13px] text-primary hover:bg-hover-bg rounded-lg transition-colors cursor-pointer bg-transparent border-none"
            onClick={handleScanDirectory}
            disabled={scanning}
          >
            {scanning ? '스캔 중...' : '+ 프로젝트 추가'}
          </button>
        </div>
      </aside>
      <div className="fixed top-0 left-[280px] right-0 h-[38px] [-webkit-app-region:drag] z-10" />
      <main className="flex-1 overflow-y-auto pt-[38px]">
        {/* Scan result overlay */}
        {scanResult ? (
          <div className="flex flex-col items-center justify-center h-full p-10">
            <div className="w-full max-w-[500px]">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Git 레포 감지됨</h2>
              <p className="text-[13px] text-muted mb-4">{scanResult.rootPath}</p>
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                {scanResult.repos.map(repo => (
                  <label
                    key={repo.path}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-hover-bg cursor-pointer border-b border-border last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRepos.has(repo.path)}
                      onChange={() => toggleRepo(repo.path)}
                      className="accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{repo.name}</div>
                      <div className="text-[11px] text-muted truncate">{repo.path}</div>
                      {repo.remoteUrl && (
                        <div className="text-[11px] text-dim truncate">{repo.remoteUrl}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2 text-[13px] text-mid bg-transparent border border-border rounded-md cursor-pointer hover:bg-hover-bg transition-colors"
                  onClick={() => { setScanResult(null); setSelectedRepos(new Set()) }}
                >
                  취소
                </button>
                <button
                  className="px-4 py-2 text-[13px] text-white bg-primary border-none rounded-md cursor-pointer hover:bg-primary-hover transition-colors disabled:opacity-50"
                  onClick={handleImportRepos}
                  disabled={selectedRepos.size === 0}
                >
                  {selectedRepos.size}개 프로젝트 추가
                </button>
              </div>
            </div>
          </div>
        ) : selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            connections={connections}
            reports={reports}
            selectedReport={selectedReport}
            onSelectReport={setSelectedReport}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted text-center p-10">
            <div className="text-5xl mb-4">🩺</div>
            <h2 className="text-lg text-soft mb-2">프로젝트를 선택하세요</h2>
            <p className="text-[13px]">
              왼쪽 목록에서 프로젝트를 클릭하면 여기에 상세 정보가 표시됩니다.
            </p>
            {projects.length === 0 && (
              <div className="mt-6 px-5 py-4 bg-surface rounded-lg border border-border">
                <p className="text-[13px]">아직 프로젝트가 없어요.</p>
                <p className="text-[13px]">왼쪽 하단의 "프로젝트 추가" 버튼으로 시작하세요.</p>
              </div>
            )}
            {inboxUnmatched > 0 && (
              <div className="mt-4 px-5 py-4 bg-danger-light rounded-lg border border-danger/20">
                <p className="text-[13px] text-danger">inbox에 미배정 보고서가 {inboxUnmatched}개 있습니다.</p>
              </div>
            )}
            {skillInstalled === false && (
              <SkillInstaller onInstalled={() => setSkillInstalled(true)} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
