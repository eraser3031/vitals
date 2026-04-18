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

    // GitHub OAuth
    githubStartOAuth(): Promise<void>
    githubGetToken(): Promise<string | null>
    githubLogout(): Promise<boolean>
    githubGetUser(): Promise<{ login: string; avatar_url: string; name: string | null }>
    githubGetRepos(): Promise<{ full_name: string; name: string; owner: { login: string }; private: boolean; updated_at: string; default_branch: string; description: string | null }[]>
    githubGetCommits(owner: string, repo: string, branch?: string): Promise<{ sha: string; commit: { message: string; author: { name: string; date: string } } }[]>
    githubGetBranches(owner: string, repo: string): Promise<{ name: string }[]>
    githubGetCommitDetail(owner: string, repo: string, sha: string): Promise<{ sha: string; commit: { message: string }; files: { filename: string; status: string; additions: number; deletions: number }[] }>
    onGitHubOAuthSuccess(callback: () => void): () => void

    // Notion OAuth
    notionStartOAuth(): Promise<void>
    notionGetToken(): Promise<string | null>
    notionLogout(): Promise<boolean>
    notionGetUser(): Promise<{ bot: { owner: { user: { name: string; avatar_url: string } } } }>
    notionSearch(query: string): Promise<{ results: { id: string; object: string; url: string; properties?: Record<string, unknown> }[] }>
    notionGetPage(pageId: string): Promise<unknown>
    notionGetBlockChildren(blockId: string): Promise<{ results: unknown[] }>
    notionGetDatabase(databaseId: string): Promise<unknown>
    notionQueryDatabase(databaseId: string, filter?: unknown): Promise<{ results: unknown[] }>
    onNotionOAuthSuccess(callback: () => void): () => void

    // Fact-check
    factCheck(postContent: string, postTitle: string, contexts: import('./types').Context[]): Promise<string>

    // Post
    getPosts(): Promise<Post[]>
    createPost(title: string, project: string, content: string): Promise<Post>
    updatePost(id: string, title: string, project: string, content: string, contexts?: import('./types').Context[]): Promise<Post>
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
