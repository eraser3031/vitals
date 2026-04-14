// ── 프로젝트 ──

export interface Project {
  version: 1
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  description?: string
}

// ── 커넥션 ──

export interface GitConnection {
  id: string
  type: 'git'
  local?: {
    path: string
  }
  remote?: {
    provider: 'github' | 'gitlab' | 'bitbucket'
    owner: string
    repo: string
    url: string
  }
}

export interface ServiceConnection {
  id: string
  type: 'linear' | 'notion' | 'jira'
  resourceId: string
  resourceName?: string
  url?: string
}

export type Connection = GitConnection | ServiceConnection

// ── 보고서 ──

export type DiagnosisMode = 'postmortem' | 'treatment' | 'checkup'

export interface ReportMeta {
  mode: DiagnosisMode
  date: string
  status: string
  summary?: string
  repo?: string
}

export interface Report {
  filename: string
  meta: ReportMeta
  content: string
  raw: string
}

export const MODE_LABELS: Record<DiagnosisMode, { label: string }> = {
  postmortem: { label: '부검' },
  treatment: { label: '치료' },
  checkup: { label: '검진' },
}

// ── Git 스캔 ──

export interface ScannedRepo {
  name: string
  path: string
  remoteUrl?: string
}

// ── 인증 ──

export interface Credentials {
  github?: { token: string }
  linear?: { apiKey: string }
  notion?: { token: string }
  jira?: { token: string; domain: string }
}
