import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('vitalsAPI', {
  // GitHub OAuth
  githubStartOAuth: () => ipcRenderer.invoke('github-start-oauth'),
  githubGetToken: () => ipcRenderer.invoke('github-get-token'),
  githubLogout: () => ipcRenderer.invoke('github-logout'),
  githubGetUser: () => ipcRenderer.invoke('github-get-user'),
  githubGetRepos: () => ipcRenderer.invoke('github-get-repos'),
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
  onNotionOAuthSuccess: (callback: () => void) => {
    ipcRenderer.on('notion-oauth-success', callback)
    return () => ipcRenderer.removeListener('notion-oauth-success', callback)
  },

  // Fact-check & Refine
  factCheck: (entries: unknown[], postTitle: string, contexts: unknown[]) => ipcRenderer.invoke('fact-check', entries, postTitle, contexts),
  refine: (selectedText: string, postTitle: string, contexts: unknown[]) => ipcRenderer.invoke('refine', selectedText, postTitle, contexts),

  // Post
  getPosts: () => ipcRenderer.invoke('get-posts'),
  createPost: (title: string, project: string) => ipcRenderer.invoke('create-post', title, project),
  updatePost: (id: string, patch: unknown) => ipcRenderer.invoke('update-post', id, patch),
  deletePost: (id: string) => ipcRenderer.invoke('delete-post', id),
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
