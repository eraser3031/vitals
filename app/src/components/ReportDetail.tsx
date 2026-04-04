import Markdown from 'react-markdown'
import type { Report } from '../types'
import { MODE_LABELS } from '../types'

interface Props {
  report: Report
}

export function ReportDetail({ report }: Props) {
  const mode = MODE_LABELS[report.meta.mode]

  return (
    <div className="px-8 py-6 max-w-[800px]">
      <header className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{mode.icon}</span>
          <h2 className="text-[22px] font-bold text-gray-900">{report.filename.replace(/\.md$/, '')}</h2>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] px-2 py-0.5 rounded bg-primary-light text-primary">{mode.label}</span>
          {report.meta.date && <span className="text-xs text-muted">{report.meta.date}</span>}
          {report.meta.status && <span className="text-[11px] px-2 py-0.5 rounded bg-success-light text-success">{report.meta.status}</span>}
        </div>
      </header>
      <div className="prose prose-sm prose-gray max-w-none">
        <Markdown>{report.content}</Markdown>
      </div>
    </div>
  )
}
