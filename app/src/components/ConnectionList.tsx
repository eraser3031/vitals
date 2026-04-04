import type { Connection, GitConnection } from '../types'

interface Props {
  connections: Connection[]
}

function GitRow({ conn }: { conn: GitConnection }) {
  const hasLocal = !!conn.local
  const hasRemote = !!conn.remote

  const repoName = conn.remote?.repo || conn.local?.path.split('/').pop() || 'Git'

  return (
    <div className="px-3.5 py-2.5 bg-surface rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <span className={`text-sm ${hasLocal ? 'text-gray-900' : 'text-border'}`} title={hasLocal ? '로컬 연결됨' : '로컬 없음'}>
          🖥️
        </span>
        <span className={`text-sm ${hasRemote ? 'text-gray-900' : 'text-border'}`} title={hasRemote ? '리모트 연결됨' : '리모트 없음'}>
          ☁️
        </span>
        <span className="text-sm font-medium text-gray-900">Git</span>
        <span className="text-[11px] text-muted">— {repoName}</span>
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

function ServiceRow({ conn }: { conn: Exclude<Connection, GitConnection> }) {
  const icons: Record<string, string> = {
    linear: '▧',
    notion: '📝',
    jira: '🔷',
  }

  return (
    <div className="px-3.5 py-2.5 bg-surface rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <span className="text-sm">{icons[conn.type] || '🔗'}</span>
        <span className="text-sm font-medium text-gray-900 capitalize">{conn.type}</span>
        {conn.resourceName && (
          <span className="text-[11px] text-muted">— {conn.resourceName}</span>
        )}
      </div>
    </div>
  )
}

export function ConnectionList({ connections }: Props) {
  if (connections.length === 0) {
    return (
      <div className="text-[13px] text-muted py-2">연결된 소스가 없습니다</div>
    )
  }

  return (
    <div className="space-y-1.5">
      {connections.map(conn =>
        conn.type === 'git' ? (
          <GitRow key={conn.id} conn={conn as GitConnection} />
        ) : (
          <ServiceRow key={conn.id} conn={conn as Exclude<Connection, GitConnection>} />
        )
      )}
    </div>
  )
}
