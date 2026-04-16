import type { Project, CreateProjectInput, Connection, Report, ScannedRepo, Post } from './types'

declare global {
  interface VitalsAPI {
    // Project
    getProjects(): Promise<Project[]>
    getProject(id: string): Promise<Project>
    createProject(data: CreateProjectInput): Promise<Project>
    updateProject(id: string, data: Partial<Project>): Promise<Project>
    deleteProject(id: string): Promise<boolean>

    // Connection
    getConnections(projectId: string): Promise<Connection[]>
    saveConnection(projectId: string, connection: Connection): Promise<boolean>
    deleteConnection(projectId: string, connectionId: string): Promise<boolean>

    // Report
    getReports(projectId: string): Promise<Report[]>
    deleteReport(projectId: string, filename: string): Promise<boolean>

    // Inbox
    processInbox(): Promise<{ matched: number; unmatched: number }>
    getUnmatchedReports(): Promise<Report[]>
    assignReport(filename: string, projectId: string): Promise<boolean>

    // Credential
    getCredential(provider: string): Promise<unknown>
    saveCredential(provider: string, data: unknown): Promise<boolean>
    deleteCredential(provider: string): Promise<boolean>

    // Diagnosis
    generateDiagnosisContext(projectId: string): Promise<{ success: boolean; path: string; repoPath?: string }>
    openTerminal(dirPath: string, command: string): Promise<void>

    // Git
    pickGitRepo(): Promise<Connection | null>
    scanDirectory(): Promise<{ repos: ScannedRepo[]; rootPath: string | null }>
    importScannedRepos(repos: ScannedRepo[]): Promise<{ created: number; skipped: number }>

    // Post
    getPosts(): Promise<Post[]>
    createPost(content: string): Promise<Post>
    updatePost(id: string, content: string): Promise<Post>
    deletePost(id: string): Promise<boolean>

    // Skill
    // Events
    onInboxChanged(callback: () => void): () => void

    checkSkill(): Promise<boolean>
    checkSkillUpdate(): Promise<{ installed: boolean; updateAvailable: boolean }>
    installSkill(): Promise<{ success: boolean; message: string }>
  }

  interface Window {
    vitalsAPI: VitalsAPI
  }
}

export {}
