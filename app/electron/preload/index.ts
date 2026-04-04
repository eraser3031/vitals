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

  // Skill
  checkSkill: () => ipcRenderer.invoke('check-skill'),
  installSkill: () => ipcRenderer.invoke('install-skill'),
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
