import { useState } from 'react'
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
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: () => void
  onConnectionsChanged: () => void
}

export function ProjectDetail({
  project, connections, reports, selectedReport, onSelectReport,
  onProjectUpdated, onProjectDeleted, onConnectionsChanged,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [editDesc, setEditDesc] = useState(project.description || '')
  const [addingGit, setAddingGit] = useState(false)

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

  async function handleSave() {
    const updated = await window.vitalsAPI.updateProject(project.id, {
      name: editName.trim() || project.name,
      description: editDesc.trim() || undefined,
    })
    setEditing(false)
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

  // Project overview
  return (
    <div className="px-8 py-6 max-w-[800px]">
      <header className="mb-6 pb-4 border-b border-border">
        {editing ? (
          <div className="space-y-2">
            <input
              className="w-full text-[22px] font-bold text-gray-900 bg-transparent border border-border rounded-md px-2 py-1 outline-none focus:border-primary"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="프로젝트 이름"
              autoFocus
            />
            <input
              className="w-full text-sm text-muted bg-transparent border border-border rounded-md px-2 py-1 outline-none focus:border-primary"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="설명 (선택)"
            />
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 text-[13px] text-white bg-primary border-none rounded-md cursor-pointer hover:bg-primary-hover transition-colors"
                onClick={handleSave}
              >
                저장
              </button>
              <button
                className="px-3 py-1.5 text-[13px] text-mid bg-transparent border border-border rounded-md cursor-pointer hover:bg-hover-bg transition-colors"
                onClick={() => { setEditing(false); setEditName(project.name); setEditDesc(project.description || '') }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[22px] font-bold text-gray-900">{project.name}</h2>
              {project.description && (
                <p className="text-sm text-muted mt-1">{project.description}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                className="px-2.5 py-1 text-[11px] text-dim bg-transparent border border-border rounded-md cursor-pointer hover:bg-hover-bg transition-colors"
                onClick={() => setEditing(true)}
              >
                수정
              </button>
              <button
                className="px-2.5 py-1 text-[11px] text-danger bg-transparent border border-border rounded-md cursor-pointer hover:bg-danger-light transition-colors"
                onClick={handleDelete}
              >
                삭제
              </button>
            </div>
          </div>
        )}
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
