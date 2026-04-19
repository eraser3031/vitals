import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('vitalsAPI', {
  // Project
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getProject: (id: string) => ipcRenderer.invoke('get-project', id),
  createProject: (data: { name: string; description?: string }) => ipcRenderer.invoke('create-project', data),
  updateProject: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('update-project', id, data),
  deleteProject: (id: string) => ipcRenderer.invoke('delete-project', id),

  // Connection
  getConnections: (projectId: string) => ipcRenderer.invoke('get-connections', projectId),
  saveConnection: (projectId: string, connection: unknown) => ipcRenderer.invoke('save-connection', projectId, connection),
  deleteConnection: (projectId: string, connectionId: string) => ipcRenderer.invoke('delete-connection', projectId, connectionId),

  // Report
  getReports: (projectId: string) => ipcRenderer.invoke('get-reports', projectId),
  deleteReport: (projectId: string, filename: string) => ipcRenderer.invoke('delete-report', projectId, filename),

  // Inbox
  processInbox: () => ipcRenderer.invoke('process-inbox'),
  getUnmatchedReports: () => ipcRenderer.invoke('get-unmatched-reports'),
  assignReport: (filename: string, projectId: string) => ipcRenderer.invoke('assign-report', filename, projectId),

  // Credential
  getCredential: (provider: string) => ipcRenderer.invoke('get-credential', provider),
  saveCredential: (provider: string, data: unknown) => ipcRenderer.invoke('save-credential', provider, data),
  deleteCredential: (provider: string) => ipcRenderer.invoke('delete-credential', provider),

  // Diagnosis
  generateDiagnosisContext: (projectId: string) => ipcRenderer.invoke('generate-diagnosis-context', projectId),
  openTerminal: (dirPath: string, command: string) => ipcRenderer.invoke('open-terminal', dirPath, command),

  // Git
  pickGitRepo: () => ipcRenderer.invoke('pick-git-repo'),
  scanDirectory: () => ipcRenderer.invoke('scan-directory'),
  importScannedRepos: (repos: unknown[]) => ipcRenderer.invoke('import-scanned-repos', repos),

  // Skill
  checkSkill: () => ipcRenderer.invoke('check-skill'),
  checkSkillUpdate: () => ipcRenderer.invoke('check-skill-update'),
  installSkill: () => ipcRenderer.invoke('install-skill'),

  // GitHub OAuth
  githubStartOAuth: () => ipcRenderer.invoke('github-start-oauth'),
  githubGetToken: () => ipcRenderer.invoke('github-get-token'),
  githubLogout: () => ipcRenderer.invoke('github-logout'),
  githubGetUser: () => ipcRenderer.invoke('github-get-user'),
  githubGetRepos: () => ipcRenderer.invoke('github-get-repos'),
  githubGetCommits: (owner: string, repo: string, branch?: string) => ipcRenderer.invoke('github-get-commits', owner, repo, branch),
  githubGetBranches: (owner: string, repo: string) => ipcRenderer.invoke('github-get-branches', owner, repo),
  githubGetCommitDetail: (owner: string, repo: string, sha: string) => ipcRenderer.invoke('github-get-commit-detail', owner, repo, sha),
  onGitHubOAuthSuccess: (callback: () => void) => {
    ipcRenderer.on('github-oauth-success', callback)
    return () => ipcRenderer.removeListener('github-oauth-success', callback)
  },

  // Notion OAuth
  notionStartOAuth: () => ipcRenderer.invoke('notion-start-oauth'),
  notionGetToken: () => ipcRenderer.invoke('notion-get-token'),
  notionLogout: () => ipcRenderer.invoke('notion-logout'),
  notionGetUser: () => ipcRenderer.invoke('notion-get-user'),
  notionSearch: (query: string) => ipcRenderer.invoke('notion-search', query),
  notionGetPage: (pageId: string) => ipcRenderer.invoke('notion-get-page', pageId),
  notionGetBlockChildren: (blockId: string) => ipcRenderer.invoke('notion-get-block-children', blockId),
  notionGetDatabase: (databaseId: string) => ipcRenderer.invoke('notion-get-database', databaseId),
  notionQueryDatabase: (databaseId: string, filter?: unknown) => ipcRenderer.invoke('notion-query-database', databaseId, filter),
  onNotionOAuthSuccess: (callback: () => void) => {
    ipcRenderer.on('notion-oauth-success', callback)
    return () => ipcRenderer.removeListener('notion-oauth-success', callback)
  },

  // Fact-check & Refine
  factCheck: (postContent: string, postTitle: string, contexts: unknown[]) => ipcRenderer.invoke('fact-check', postContent, postTitle, contexts),
  refine: (selectedText: string, postTitle: string, contexts: unknown[]) => ipcRenderer.invoke('refine', selectedText, postTitle, contexts),

  // Post
  getPosts: () => ipcRenderer.invoke('get-posts'),
  createPost: (title: string, project: string, content: string) => ipcRenderer.invoke('create-post', title, project, content),
  updatePost: (id: string, title: string, project: string, content: string, contexts?: unknown[]) => ipcRenderer.invoke('update-post', id, title, project, content, contexts),
  deletePost: (id: string) => ipcRenderer.invoke('delete-post', id),

  // Events
  onInboxChanged: (callback: () => void) => {
    ipcRenderer.on('inbox-changed', callback)
    return () => ipcRenderer.removeListener('inbox-changed', callback)
  },
})

// Loading screen
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

function useLoading() {
  const styleContent = `
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  z-index: 9;
  color: #999;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
}
  `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div>Loading...</div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)
