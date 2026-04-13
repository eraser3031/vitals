import { Monitor, Cloud, Link as LinkIcon } from 'lucide-react'
import type { Connection, GitConnection } from '../types'

interface Props {
  connections: Connection[]
  onDelete?: (connectionId: string) => void
}

function GitRow({ conn, onDelete }: { conn: GitConnection; onDelete?: (id: string) => void }) {
  const hasLocal = !!conn.local
  const hasRemote = !!conn.remote

  const repoName = conn.remote?.repo || conn.local?.path.split('/').pop() || 'Git'

  return (
    <div className="group px-3.5 py-2.5 bg-surface rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <span className={hasLocal ? 'text-gray-900' : 'text-border'} title={hasLocal ? '로컬 연결됨' : '로컬 없음'}>
          <Monitor size={14} strokeWidth={1.8} />
        </span>
        <span className={hasRemote ? 'text-gray-900' : 'text-border'} title={hasRemote ? '리모트 연결됨' : '리모트 없음'}>
          <Cloud size={14} strokeWidth={1.8} />
        </span>
        <span className="text-sm font-medium text-gray-900">Git</span>
        <span className="text-[11px] text-muted">— {repoName}</span>
        {onDelete && (
          <button
            className="ml-auto text-[11px] text-danger opacity-0 group-hover:opacity-100 bg-transparent border-none cursor-pointer p-0 transition-opacity"
            onClick={() => onDelete(conn.id)}
          >
            제거
          </button>
        )}
      </div>
      <div className="pl-[52px] mt-1 space-y-0.5">
        {conn.local && (
          <div className="text-[11px] text-dim truncate">{conn.local.path}</div>
        )}
        {conn.remote && (
          <div className="text-[11px] text-dim truncate">{conn.remote.url}</div>
        )}
      </div>
    </div>
  )
}

function ServiceRow({ conn, onDelete }: { conn: Exclude<Connection, GitConnection>; onDelete?: (id: string) => void }) {
  return (
    <div className="group px-3.5 py-2.5 bg-surface rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <LinkIcon size={14} strokeWidth={1.8} className="text-muted" />
        <span className="text-sm font-medium text-gray-900 capitalize">{conn.type}</span>
        {conn.resourceName && (
          <span className="text-[11px] text-muted">— {conn.resourceName}</span>
        )}
        {onDelete && (
          <button
            className="ml-auto text-[11px] text-danger opacity-0 group-hover:opacity-100 bg-transparent border-none cursor-pointer p-0 transition-opacity"
            onClick={() => onDelete(conn.id)}
          >
            제거
          </button>
        )}
      </div>
    </div>
  )
}

export function ConnectionList({ connections, onDelete }: Props) {
  if (connections.length === 0) {
    return (
      <div className="text-[13px] text-muted py-2">연결된 소스가 없습니다</div>
    )
  }

  return (
    <div className="space-y-1.5">
      {connections.map(conn =>
        conn.type === 'git' ? (
          <GitRow key={conn.id} conn={conn as GitConnection} onDelete={onDelete} />
        ) : (
          <ServiceRow key={conn.id} conn={conn as Exclude<Connection, GitConnection>} onDelete={onDelete} />
        )
      )}
    </div>
  )
}
