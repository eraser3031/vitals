import Markdown from 'react-markdown'
import type { Project, Connection, Report } from '../types'
import { MODE_LABELS } from '../types'
import { ConnectionList } from './ConnectionList'

interface Props {
  project: Project
  connections: Connection[]
  reports: Report[]
  selectedReport: Report | null
  onSelectReport: (report: Report | null) => void
}

export function ProjectDetail({ project, connections, reports, selectedReport, onSelectReport }: Props) {
  // Report detail view
  if (selectedReport) {
    const mode = MODE_LABELS[selectedReport.meta.mode]
    return (
      <div className="px-8 py-6 max-w-[800px]">
        <button
          className="text-[13px] text-primary hover:text-primary-hover mb-4 cursor-pointer bg-transparent border-none p-0"
          onClick={() => onSelectReport(null)}
        >
          ← {project.name}
        </button>
        <header className="mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{mode.icon}</span>
            <h2 className="text-[22px] font-bold text-gray-900">{selectedReport.filename.replace(/\.md$/, '')}</h2>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary-light text-primary">{mode.label}</span>
            {selectedReport.meta.date && <span className="text-xs text-muted">{selectedReport.meta.date}</span>}
            {selectedReport.meta.status && <span className="text-[11px] px-2 py-0.5 rounded bg-success-light text-success">{selectedReport.meta.status}</span>}
          </div>
        </header>
        <div className="prose prose-sm prose-gray max-w-none">
          <Markdown>{selectedReport.content}</Markdown>
        </div>
      </div>
    )
  }

  // Project overview
  return (
    <div className="px-8 py-6 max-w-[800px]">
      <header className="mb-6 pb-4 border-b border-border">
        <h2 className="text-[22px] font-bold text-gray-900">{project.name}</h2>
        {project.description && (
          <p className="text-sm text-muted mt-1">{project.description}</p>
        )}
      </header>

      {/* Connections */}
      <section className="mb-8">
        <h3 className="text-xs font-semibold text-faded uppercase tracking-wider mb-3">연결</h3>
        <ConnectionList connections={connections} />
      </section>

      {/* Reports */}
      <section>
        <h3 className="text-xs font-semibold text-faded uppercase tracking-wider mb-3">
          보고서 {reports.length > 0 && <span className="text-muted font-normal">({reports.length})</span>}
        </h3>
        {reports.length === 0 ? (
          <div className="text-[13px] text-muted py-2">
            아직 보고서가 없습니다. Claude Code에서 스킬을 실행해보세요.
          </div>
        ) : (
          <div className="space-y-1">
            {reports.map(report => {
              const mode = MODE_LABELS[report.meta.mode]
              return (
                <div
                  key={report.filename}
                  className="flex items-center gap-3 px-3.5 py-2.5 bg-surface rounded-lg border border-border cursor-pointer hover:bg-hover-bg transition-colors"
                  onClick={() => onSelectReport(report)}
                >
                  <span className="text-base">{mode.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-900">{mode.label}</span>
                    {report.meta.summary && (
                      <span className="text-[11px] text-muted ml-2">{report.meta.summary}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted shrink-0">{report.meta.date}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
