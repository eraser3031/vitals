import type { Post, Context, Entry } from './types'

declare global {
  interface VitalsAPI {
    // GitHub OAuth
    githubStartOAuth(): Promise<void>
    githubGetToken(): Promise<string | null>
    githubLogout(): Promise<boolean>
    githubGetUser(): Promise<{ login: string; avatar_url: string; name: string | null }>
    githubGetRepos(): Promise<{ full_name: string; name: string; owner: { login: string }; private: boolean; updated_at: string; default_branch: string; description: string | null }[]>
    onGitHubOAuthSuccess(callback: () => void): () => void

    // Notion OAuth
    notionStartOAuth(): Promise<void>
    notionGetToken(): Promise<string | null>
    notionLogout(): Promise<boolean>
    notionGetUser(): Promise<{ bot: { owner: { user: { name: string; avatar_url: string } } } }>
    notionSearch(query: string): Promise<{ results: { id: string; object: string; url: string; properties?: Record<string, unknown> }[] }>
    onNotionOAuthSuccess(callback: () => void): () => void

    // Fact-check & Refine
    factCheck(entries: Entry[], postTitle: string, contexts: Context[]): Promise<string>
    refine(selectedText: string, postTitle: string, contexts: Context[]): Promise<{
      suggestions: string[]
      evidence: { text: string; url?: string }[]
    }>

    // Post
    getPosts(): Promise<Post[]>
    createPost(title: string, project: string): Promise<Post>
    updatePost(
      id: string,
      patch: { title?: string; project?: string; entries?: Entry[]; contexts?: Context[] }
    ): Promise<Post>
    deletePost(id: string): Promise<boolean>
  }

  interface Window {
    vitalsAPI: VitalsAPI
  }
}

export {}
