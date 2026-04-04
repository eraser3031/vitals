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
      <div className="py-6 px-4 text-center text-[#999] text-[13px]">
        보고서가 없습니다
      </div>
    )
  }

  return (
    <ul className="list-none m-0 p-2 overflow-y-auto flex-1">
      {reports.map(report => {
        const mode = MODE_LABELS[report.meta.mode]
        const isSelected = selected?.filename === report.filename
        return (
          <li
            key={report.filename}
            className={`px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-colors ${isSelected ? 'bg-[#dde3f0]' : 'hover:bg-[#eaeaec]'}`}
            onClick={() => onSelect(report)}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{mode.icon}</span>
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{report.meta.project}</span>
            </div>
            <div className="flex gap-2 mt-1 pl-6">
              <span className="text-[11px] text-[#666]">{mode.label}</span>
              {report.meta.date && (
                <span className="text-[11px] text-[#999]">{report.meta.date}</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
