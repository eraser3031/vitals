export type DiagnosisMode = 'postmortem' | 'emergency' | 'checkup'

export interface ReportMeta {
  project: string
  mode: DiagnosisMode
  date: string
  status: string
  summary?: string
}

export interface Report {
  filename: string
  meta: ReportMeta
  content: string // raw markdown (without frontmatter)
  raw: string     // full file content
}

export const MODE_LABELS: Record<DiagnosisMode, { icon: string; label: string }> = {
  postmortem: { icon: '⚰️', label: '부검' },
  emergency: { icon: '🚨', label: '응급' },
  checkup: { icon: '🩺', label: '검진' },
}
