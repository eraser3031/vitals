import { useEffect, useState } from 'react'
import { ReportList } from './components/ReportList'
import { ReportDetail } from './components/ReportDetail'
import { Settings } from './components/Settings'
import { SkillInstaller } from './components/SkillInstaller'
import type { Report } from './types'

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
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [skillInstalled, setSkillInstalled] = useState<boolean | null>(null)

  async function loadReports() {
    const parsed = await window.vitalsAPI.getReports()
    parsed.sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''))
    setReports(parsed)
    setLoading(false)
  }

  async function checkSkill() {
    const installed = await window.vitalsAPI.checkSkill()
    setSkillInstalled(installed)
  }

  useEffect(() => {
    loadReports()
    checkSkill()
  }, [])

  function handleSelect(report: Report) {
    setSelected(report)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-muted text-sm bg-white">불러오는 중...</div>
  }

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans">
      <aside className="w-[280px] min-w-[280px] border-r border-border flex flex-col bg-surface">
        <div className="pt-5 pr-4 pb-3 pl-[78px] border-b border-border [-webkit-app-region:drag]">
          <h1 className="text-lg font-bold text-gray-900">Vitals</h1>
          <span className="text-xs text-muted">{reports.length}개 보고서</span>
        </div>
        <ReportList
          reports={reports}
          selected={selected}
          onSelect={handleSelect}
        />
      </aside>
      <div className="fixed top-0 left-[280px] right-0 h-[38px] [-webkit-app-region:drag] z-10" />
      <main className="flex-1 overflow-y-auto pt-[38px]">
        {selected ? (
          <ReportDetail report={selected} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted text-center p-10">
            <div className="text-5xl mb-4">🩺</div>
            <h2 className="text-lg text-soft mb-2">보고서를 선택하세요</h2>
            <p className="text-[13px]">
              왼쪽 목록에서 보고서를 클릭하면 여기에 내용이 표시됩니다.
            </p>
            {reports.length === 0 && (
              <div className="mt-6 px-5 py-4 bg-surface rounded-lg border border-border">
                <p className="text-[13px]">아직 보고서가 없어요.</p>
                <p className="text-[13px]">Claude Code에서 부검 스킬을 실행해보세요:</p>
                <code className="inline-block mt-2 px-2.5 py-1 bg-primary-light rounded text-primary text-[13px]">/vitals-postmortem</code>
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
