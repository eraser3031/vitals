import { useState } from 'react'
import { Trash2, Stethoscope, Syringe, FileSearch } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Project, Connection, Report, DiagnosisMode } from '../types'
import { MODE_LABELS } from '../types'
import { ConnectionList } from './ConnectionList'

const MODE_BADGE: Record<DiagnosisMode, string> = {
  postmortem: 'bg-primary-light text-primary',
  treatment: 'bg-danger-light text-danger',
  checkup: 'bg-success-light text-success',
}

const FAB_MODES: { key: DiagnosisMode; label: string; Icon: LucideIcon; prompt: string }[] = [
  { key: 'checkup', label: '검진', Icon: Stethoscope, prompt: '프로젝트 검진해줘' },
  { key: 'treatment', label: '치료', Icon: Syringe, prompt: '프로젝트 치료해줘' },
  { key: 'postmortem', label: '부검', Icon: FileSearch, prompt: '프로젝트 부검해줘' },
]

interface Props {
  project: Project
  connections: Connection[]
  reports: Report[]
  loadingData: boolean
  selectedReport: Report | null
  onSelectReport: (report: Report | null) => void
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: () => void
  onConnectionsChanged: () => void
}

export function ProjectDetail({
  project, connections, reports, loadingData, selectedReport, onSelectReport,
  onProjectUpdated, onProjectDeleted, onConnectionsChanged,
}: Props) {
  const [addingGit, setAddingGit] = useState(false)
  const [generatingContext, setGeneratingContext] = useState(false)
  const [contextGenerated, setContextGenerated] = useState(false)
  const [selectedMode, setSelectedMode] = useState<DiagnosisMode>('checkup')

  // Report detail view
  if (selectedReport) {
    const mode = MODE_LABELS[selectedReport.meta.mode]
    return (
      <div className="px-8 py-6 max-w-[800px]">
        <button
          className="text-[13px] text-primary hover:text-primary-hover mb-4 cursor-pointer bg-transparent border-none p-0"
          onClick={() => onSelectReport(null)}
        >
          &larr; {project.name}
        </button>
        <header className="mb-6 pb-4 border-b border-border">
          <h2 className="text-[22px] font-bold text-gray-900">{selectedReport.filename.replace(/\.md$/, '')}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] px-2 py-0.5 rounded ${MODE_BADGE[selectedReport.meta.mode]}`}>{mode.label}</span>
            {selectedReport.meta.date && <span className="text-xs text-subtle">{selectedReport.meta.date}</span>}
            {selectedReport.meta.status && <span className="text-[11px] px-2 py-0.5 rounded bg-success-light text-success">{selectedReport.meta.status}</span>}
          </div>
        </header>
        <div className="prose prose-sm prose-gray max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{selectedReport.content}</Markdown>
        </div>
      </div>
    )
  }

  async function handleFieldSave(field: 'name' | 'description', value: string) {
    const trimmed = value.trim()
    if (field === 'name' && !trimmed) return
    const updated = await window.vitalsAPI.updateProject(project.id, {
      [field]: field === 'description' && !trimmed ? undefined : trimmed,
    })
    onProjectUpdated(updated)
  }

  async function handleDelete() {
    const reportCount = reports.length
    const msg = reportCount > 0
      ? `"${project.name}" 프로젝트와 보고서 ${reportCount}개가 함께 삭제됩니다. 계속하시겠습니까?`
      : `"${project.name}" 프로젝트를 삭제하시겠습니까?`

    if (!window.confirm(msg)) return

    await window.vitalsAPI.deleteProject(project.id)
    onProjectDeleted()
  }

  async function handlePickGitRepo() {
    setAddingGit(true)
    try {
      const conn = await window.vitalsAPI.pickGitRepo()
      if (!conn) return
      await window.vitalsAPI.saveConnection(project.id, conn)
      onConnectionsChanged()
    } finally {
      setAddingGit(false)
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    await window.vitalsAPI.deleteConnection(project.id, connectionId)
    onConnectionsChanged()
  }

  async function handleGenerateContext(mode: DiagnosisMode) {
    const fab = FAB_MODES.find(m => m.key === mode)!
    setGeneratingContext(true)
    const result = await window.vitalsAPI.generateDiagnosisContext(project.id)
    setGeneratingContext(false)
    if (result.success && result.repoPath) {
      await window.vitalsAPI.openTerminal(result.repoPath, `claude "${fab.prompt}"`)
      setContextGenerated(true)
      setTimeout(() => setContextGenerated(false), 5000)
    }
  }

  // Project overview
  const hasGitConnection = connections.some(c => c.type === 'git')

  return (
    <div className={`px-8 py-6 pb-28 max-w-[800px] transition-opacity duration-150 ${loadingData ? 'opacity-60' : 'opacity-100'}`}>
      <header className="mb-6 pb-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <input
              key={`${project.id}-name`}
              className="w-full text-[22px] font-bold text-gray-900 bg-transparent border-none outline-none px-0 py-0"
              defaultValue={project.name}
              placeholder="프로젝트 이름"
              onBlur={e => handleFieldSave('name', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
            <input
              key={`${project.id}-desc`}
              className="w-full text-sm text-soft placeholder:text-muted bg-transparent border-none outline-none px-0 py-0 mt-1"
              defaultValue={project.description || ''}
              placeholder="설명 추가..."
              onBlur={e => handleFieldSave('description', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </div>
          <button
            className="text-muted hover:text-danger bg-transparent border-none cursor-pointer p-0 shrink-0 ml-2 transition-colors"
            onClick={handleDelete}
            title="프로젝트 삭제"
          >
            <Trash2 size={16} strokeWidth={3.0} />
          </button>
        </div>
      </header>

      {/* Connections */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-faded uppercase tracking-wider">연결</h3>
        </div>
        <ConnectionList connections={connections} onDelete={handleDeleteConnection} />
        <button
          className="mt-2 text-[13px] text-primary hover:text-primary-hover cursor-pointer bg-transparent border-none p-0 disabled:opacity-50"
          onClick={handlePickGitRepo}
          disabled={addingGit}
        >
          {addingGit ? '폴더 선택 중...' : '+ Git 레포 연결'}
        </button>
      </section>

      {/* Reports */}
      <section>
        <h3 className="text-xs font-semibold text-faded uppercase tracking-wider mb-3">
          보고서 {reports.length > 0 && <span className="text-muted font-normal">({reports.length})</span>}
        </h3>
        {reports.length === 0 ? (
          <div className="text-[13px] text-subtle py-2 leading-relaxed">
            아직 보고서가 없습니다.<br />
            {hasGitConnection
              ? <>우하단 <span className="text-soft font-medium">진단 시작</span> 버튼으로 첫 보고서를 만들어보세요.</>
              : <>먼저 Git 레포를 연결한 뒤 진단을 시작해보세요.</>}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pt-2 pb-4 -mx-8 px-8">
            {reports.map((report, idx) => {
              const mode = MODE_LABELS[report.meta.mode]
              const h1 = report.content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
              const title = h1 || report.filename.replace(/\.md$/, '')
              const description = report.meta.summary
              const isLatest = idx === 0
              return (
                <button
                  key={report.filename}
                  className="group shrink-0 w-[196px] aspect-[210/297] bg-white rounded-[20px] border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 cursor-pointer flex flex-col p-5 text-left"
                  onClick={() => onSelectReport(report)}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${MODE_BADGE[report.meta.mode]}`}>{mode.label}</span>
                    {isLatest && <span className="text-[10px] text-subtle tracking-wide">최근</span>}
                  </div>
                  <div className="flex-1 mt-4 min-h-0 flex flex-col">
                    <p className="text-[13px] leading-[1.4] text-gray-900 font-semibold overflow-hidden line-clamp-3">
                      {title}
                    </p>
                    {description && (
                      <p className="mt-1.5 text-[11px] leading-[1.5] text-subtle overflow-hidden line-clamp-4">
                        {description}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-subtle mt-3 shrink-0 tabular-nums">{report.meta.date}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {hasGitConnection && (
        <div className="fixed bottom-6 right-6 flex items-center gap-1 bg-white border border-border rounded-full p-1 shadow-lg shadow-black/[0.06] z-20">
          {FAB_MODES.map(({ key, label, Icon }) => {
            const isSelected = selectedMode === key
            return (
              <button
                key={key}
                onClick={() => isSelected ? handleGenerateContext(key) : setSelectedMode(key)}
                disabled={isSelected && generatingContext}
                title={label}
                className={
                  isSelected
                    ? 'flex items-center gap-2 h-9 pl-3 pr-3.5 rounded-full bg-primary text-white cursor-pointer hover:bg-primary-hover disabled:opacity-60'
                    : 'flex items-center justify-center w-9 h-9 rounded-full text-dim cursor-pointer hover:bg-hover-bg'
                }
              >
                <Icon size={15} strokeWidth={2} />
                {isSelected && (
                  <span className="text-[13px] font-medium whitespace-nowrap">
                    {generatingContext ? '생성 중...' : contextGenerated ? '실행됨' : `${label} 시작`}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
