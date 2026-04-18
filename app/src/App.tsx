import { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { Post } from './types'

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function PostEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '내용을 입력하세요...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <EditorContent
      editor={editor}
      className="flex-1 overflow-y-auto px-6 pt-4 pb-6 prose prose-sm max-w-none text-[15px] leading-relaxed"
    />
  )
}

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [content, setContent] = useState('')
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string } | null>(null)
  const [notionUser, setNotionUser] = useState<{ name: string; avatar_url: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  contentRef.current = content

  const selected = posts.find(p => p.id === selectedId) ?? null

  useEffect(() => {
    window.vitalsAPI.getPosts().then(list => {
      setPosts(list)
      if (list.length > 0) {
        setSelectedId(list[0].id)
        setTitle(list[0].title || '')
        setProject(list[0].project || '')
        setContent(list[0].content)
      }
    })

    // GitHub 토큰 있으면 유저 정보 로드
    window.vitalsAPI.githubGetToken().then(token => {
      if (token) {
        window.vitalsAPI.githubGetUser()
          .then(user => setGithubUser(user))
          .catch(() => setGithubUser(null))
      }
    })

    // Notion 토큰 있으면 유저 정보 로드
    window.vitalsAPI.notionGetToken().then(token => {
      if (token) {
        window.vitalsAPI.notionGetUser()
          .then(user => setNotionUser({ name: user.bot.owner.user.name, avatar_url: user.bot.owner.user.avatar_url }))
          .catch(() => setNotionUser(null))
      }
    })

    // OAuth 완료 이벤트 수신
    const unsubGithub = window.vitalsAPI.onGitHubOAuthSuccess(() => {
      window.vitalsAPI.githubGetUser()
        .then(user => setGithubUser(user))
        .catch(() => {})
    })
    const unsubNotion = window.vitalsAPI.onNotionOAuthSuccess(() => {
      window.vitalsAPI.notionGetUser()
        .then(user => setNotionUser({ name: user.bot.owner.user.name, avatar_url: user.bot.owner.user.avatar_url }))
        .catch(() => {})
    })
    return () => { unsubGithub(); unsubNotion() }
  }, [])

  function select(post: Post) {
    flushSave()
    setSelectedId(post.id)
    setTitle(post.title || '')
    setProject(post.project || '')
    setContent(post.content)
  }

  async function addPost() {
    flushSave()
    const post = await window.vitalsAPI.createPost('', '', '')
    setPosts(prev => [post, ...prev])
    setSelectedId(post.id)
    setTitle('')
    setProject('')
    setContent('')
    setTimeout(() => titleRef.current?.focus(), 0)
  }

  async function deleteSelected() {
    if (!selectedId) return
    await window.vitalsAPI.deletePost(selectedId)
    setPosts(prev => {
      const next = prev.filter(p => p.id !== selectedId)
      if (next.length > 0) {
        setSelectedId(next[0].id)
        setTitle(next[0].title || '')
        setProject(next[0].project || '')
        setContent(next[0].content)
      } else {
        setSelectedId(null)
        setTitle('')
        setProject('')
        setContent('')
      }
      return next
    })
  }

  function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (selectedId && selected && (title !== (selected.title || '') || project !== (selected.project || '') || contentRef.current !== selected.content)) {
      window.vitalsAPI.updatePost(selectedId, title, project, contentRef.current)
      const c = contentRef.current
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, title, project, content: c } : p))
    }
  }

  function scheduleSave(t: string, p: string, c: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (selectedId) {
        window.vitalsAPI.updatePost(selectedId, t, p, c)
        setPosts(prev => prev.map(post => post.id === selectedId ? { ...post, title: t, project: p, content: c } : post))
      }
    }, 400)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    scheduleSave(value, project, contentRef.current)
  }

  function handleProjectChange(value: string) {
    setProject(value)
    scheduleSave(title, value, contentRef.current)
  }

  const handleContentChange = useCallback((html: string) => {
    setContent(html)
    contentRef.current = html
    scheduleSave(title, project, html)
  }, [selectedId, title, project])

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans">
      {/* sidebar */}
      <aside className="w-[240px] min-w-[240px] border-r border-border flex flex-col bg-surface">
        <div className="h-[38px] flex items-center justify-end gap-1 pt-[18px] pr-3 [-webkit-app-region:drag]">
          <button
            onClick={deleteSelected}
            disabled={!selectedId}
            className="text-[11px] text-muted hover:text-danger disabled:opacity-30 cursor-pointer bg-transparent border-none [-webkit-app-region:no-drag]"
          >
            삭제
          </button>
          <button
            onClick={addPost}
            className="text-[18px] leading-none text-muted hover:text-primary cursor-pointer bg-transparent border-none p-0 [-webkit-app-region:no-drag]"
          >
            +
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto list-none m-0 p-0 pt-2">
          {posts.map(post => {
            const isSelected = post.id === selectedId
            const displayTitle = isSelected ? title : (post.title || '')
            return (
              <li
                key={post.id}
                onClick={() => select(post)}
                className={`px-4 py-2.5 text-[13px] cursor-pointer truncate ${
                  isSelected ? 'bg-selected font-medium' : 'hover:bg-hover-bg'
                }`}
              >
                {displayTitle.trim() || '제목 없음'}
              </li>
            )
          })}
        </ul>

        {/* 연결 상태 */}
        <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
          {githubUser ? (
            <div className="flex items-center gap-2">
              <img src={githubUser.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              <span className="text-[12px] text-gray-700 flex-1 truncate">{githubUser.login}</span>
              <button
                onClick={async () => {
                  await window.vitalsAPI.githubLogout()
                  setGithubUser(null)
                }}
                className="text-[11px] text-muted hover:text-danger cursor-pointer bg-transparent border-none"
              >
                연결 해제
              </button>
            </div>
          ) : (
            <button
              onClick={() => window.vitalsAPI.githubStartOAuth()}
              className="w-full text-[12px] text-muted hover:text-primary cursor-pointer bg-transparent border-none text-left"
            >
              GitHub 연결
            </button>
          )}
          {notionUser ? (
            <div className="flex items-center gap-2">
              {notionUser.avatar_url ? (
                <img src={notionUser.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">N</div>
              )}
              <span className="text-[12px] text-gray-700 flex-1 truncate">{notionUser.name}</span>
              <button
                onClick={async () => {
                  await window.vitalsAPI.notionLogout()
                  setNotionUser(null)
                }}
                className="text-[11px] text-muted hover:text-danger cursor-pointer bg-transparent border-none"
              >
                연결 해제
              </button>
            </div>
          ) : (
            <button
              onClick={() => window.vitalsAPI.notionStartOAuth()}
              className="w-full text-[12px] text-muted hover:text-primary cursor-pointer bg-transparent border-none text-left"
            >
              Notion 연결
            </button>
          )}
        </div>
      </aside>

      {/* drag region for right pane */}
      <div className="fixed top-0 left-[240px] right-0 h-[38px] [-webkit-app-region:drag] z-10" />

      {/* editor */}
      <main className="flex-1 pt-[38px] flex flex-col">
        {selected ? (
          <>
            <div className="px-6 pt-6">
              <input
                ref={titleRef}
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                className="w-full text-[22px] font-bold border-none outline-none bg-white mb-3"
                placeholder="제목"
              />
              <div className="flex items-center gap-4 text-[12px] text-muted mb-4">
                <label className="flex items-center gap-1.5">
                  <span className="text-dim">프로젝트</span>
                  <input
                    value={project}
                    onChange={e => handleProjectChange(e.target.value)}
                    className="border-none outline-none bg-transparent text-[12px] text-gray-900 w-[120px]"
                    placeholder="-"
                  />
                </label>
                <span className="text-dim">작성 {formatDate(selected.createdAt)}</span>
                <span className="text-dim">수정 {formatDate(selected.updatedAt)}</span>
              </div>
              <div className="border-b border-border" />
            </div>
            <PostEditor key={selectedId} content={content} onChange={handleContentChange} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            포스트를 선택하거나 추가하세요
          </div>
        )}
      </main>
    </div>
  )
}

export default App
