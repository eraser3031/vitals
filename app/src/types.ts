// ── 컨텍스트 ──

export interface Context {
  id: string
  type: 'github' | 'notion'
  label: string
  data: Record<string, unknown>
}

// ── 질문/댓글 ──

export interface Reply {
  id: string
  author: 'user' | 'ai'
  content: string              // 마크다운
  createdAt: string
  updatedAt: string
}

export interface Entry {
  id: string
  category?: string            // 진단 렌즈 라벨 (선택)
  question: string
  replies: Reply[]
  createdAt: string
}

// ── 포스트 ──

export interface Post {
  id: string
  title: string
  project: string
  contexts: Context[]
  entries: Entry[]
  createdAt: string
  updatedAt: string
}
