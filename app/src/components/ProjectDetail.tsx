import { useState } from 'react'
import { Trash2, Stethoscope } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Project, Connection, Report } from '../types'
import { MODE_LABELS } from '../types'
import { ConnectionList } from './ConnectionList'

interface Props {
  project: Project
  connections: Connection[]
  reports: Report[]
  selectedReport: Report | null
  onSelectReport: (report: Report | null) => void
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: () => void
  onConnectionsChanged: () => void
}

export function ProjectDetail({
  project, connections, reports, selectedReport, onSelectReport,
  onProjectUpdated, onProjectDeleted, onConnectionsChanged,
}: Props) {
  const [addingGit, setAddingGit] = useState(false)
  const [generatingContext, setGeneratingContext] = useState(false)
  const [contextGenerated, setContextGenerated] = useState(false)

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
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary-light text-primary">{mode.label}</span>
            {selectedReport.meta.date && <span className="text-xs text-muted">{selectedReport.meta.date}</span>}
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

  async function handleGenerateContext() {
    setGeneratingContext(true)
    const result = await window.vitalsAPI.generateDiagnosisContext(project.id)
    setGeneratingContext(false)
    if (result.success && result.repoPath) {
      await window.vitalsAPI.openTerminal(result.repoPath, 'claude "프로젝트 진단해줘"')
      setContextGenerated(true)
      setTimeout(() => setContextGenerated(false), 5000)
    }
  }

  // Project overview
  const hasGitConnection = connections.some(c => c.type === 'git')

  return (
    <div className="px-8 py-6 pb-28 max-w-[800px]">
      <header className="mb-6 pb-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <input
              className="w-full text-[22px] font-bold text-gray-900 bg-transparent border-none outline-none px-0 py-0"
              defaultValue={project.name}
              placeholder="프로젝트 이름"
              onBlur={e => handleFieldSave('name', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
            <input
              className="w-full text-sm text-muted bg-transparent border-none outline-none px-0 py-0 mt-1"
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
                  <span className="text-[11px] px-2 py-0.5 rounded bg-primary-light text-primary shrink-0">{mode.label}</span>
                  <div className="flex-1 min-w-0">
                    {report.meta.summary && (
                      <span className="text-[13px] text-gray-900">{report.meta.summary}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted shrink-0">{report.meta.date}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {hasGitConnection && (
        <button
          className="fixed bottom-6 right-6 flex items-center gap-2 pl-4 pr-5 py-3 text-[13px] font-medium text-white bg-primary rounded-full border-none cursor-pointer hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-lg shadow-black/15 z-20"
          onClick={handleGenerateContext}
          disabled={generatingContext}
        >
          <Stethoscope size={16} strokeWidth={2} />
          {generatingContext ? '컨텍스트 생성 중...' : contextGenerated ? 'Claude Code 실행됨' : '진단 시작'}
        </button>
      )}
    </div>
  )
}
