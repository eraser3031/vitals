// ── 포스트 ──

export interface Context {
  id: string
  type: 'github' | 'notion'
  label: string
  data: Record<string, unknown>
}

export interface Post {
  id: string
  title: string
  project: string
  content: string
  contexts: Context[]
  createdAt: string
  updatedAt: string
}
