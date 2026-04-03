import Markdown from 'react-markdown'
import type { Report } from '../types'
import { MODE_LABELS } from '../types'

interface Props {
  report: Report
}

export function ReportDetail({ report }: Props) {
  const mode = MODE_LABELS[report.meta.mode]

  return (
    <div className="report-detail">
      <header className="report-detail-header">
        <div className="report-detail-title">
          <span className="report-detail-icon">{mode.icon}</span>
          <h2>{report.meta.project}</h2>
        </div>
        <div className="report-detail-meta">
          <span className="badge">{mode.label}</span>
          {report.meta.date && <span className="report-detail-date">{report.meta.date}</span>}
          {report.meta.status && <span className="badge badge-status">{report.meta.status}</span>}
        </div>
      </header>
      <div className="report-detail-content">
        <Markdown>{report.content}</Markdown>
      </div>
    </div>
  )
}
