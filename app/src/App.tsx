import { useEffect, useState } from 'react'
import { ProjectList } from './components/ProjectList'
import { ProjectDetail } from './components/ProjectDetail'
import { Settings } from './components/Settings'
import { SkillInstaller } from './components/SkillInstaller'
import type { Project, Connection, Report } from './types'

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
    // Clear stale data immediately
    setConnections([])
    setReports([])
    setSelectedReport(null)

    const [conns, reps] = await Promise.all([
      window.vitalsAPI.getConnections(projectId),
      window.vitalsAPI.getReports(projectId),
    ])

    // Guard against stale response: only apply if still selected
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

  function handleSelectProject(project: Project) {
    setSelectedProject(project)
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
          onSelect={handleSelectProject}
        />
      </aside>
      <div className="fixed top-0 left-[280px] right-0 h-[38px] [-webkit-app-region:drag] z-10" />
      <main className="flex-1 overflow-y-auto pt-[38px]">
        {selectedProject ? (
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
                <p className="text-[13px]">3단계에서 Git 스캔으로 프로젝트를 추가할 수 있습니다.</p>
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
