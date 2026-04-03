import type { Report } from '../types'
import { MODE_LABELS } from '../types'

interface Props {
  reports: Report[]
  selected: Report | null
  onSelect: (report: Report) => void
}

export function ReportList({ reports, selected, onSelect }: Props) {
  if (reports.length === 0) {
    return (
      <div className="report-list-empty">
        보고서가 없습니다
      </div>
    )
  }

  return (
    <ul className="report-list">
      {reports.map(report => {
        const mode = MODE_LABELS[report.meta.mode]
        const isSelected = selected?.filename === report.filename
        return (
          <li
            key={report.filename}
            className={`report-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(report)}
          >
            <div className="report-item-header">
              <span className="report-mode-icon">{mode.icon}</span>
              <span className="report-project">{report.meta.project}</span>
            </div>
            <div className="report-item-meta">
              <span className="report-mode-label">{mode.label}</span>
              {report.meta.date && (
                <span className="report-date">{report.meta.date}</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
