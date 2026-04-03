import { useEffect, useState } from 'react'
import { ReportList } from './components/ReportList'
import { ReportDetail } from './components/ReportDetail'
import type { Report } from './types'
import './App.css'

function App() {
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadReports() {
    const parsed = await window.vitalsAPI.getReports()
    parsed.sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''))
    setReports(parsed)
    setLoading(false)
  }

  useEffect(() => {
    loadReports()
  }, [])

  function handleSelect(report: Report) {
    setSelected(report)
  }

  if (loading) {
    return <div className="app-loading">불러오는 중...</div>
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">Vitals</h1>
          <span className="report-count">{reports.length}개 보고서</span>
        </div>
        <ReportList
          reports={reports}
          selected={selected}
          onSelect={handleSelect}
        />
      </aside>
      <main className="main">
        {selected ? (
          <ReportDetail report={selected} />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🩺</div>
            <h2>보고서를 선택하세요</h2>
            <p>
              왼쪽 목록에서 보고서를 클릭하면 여기에 내용이 표시됩니다.
            </p>
            {reports.length === 0 && (
              <div className="empty-hint">
                <p>아직 보고서가 없어요.</p>
                <p>Claude Code에서 부검 스킬을 실행해보세요:</p>
                <code>/project-postmortem</code>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
