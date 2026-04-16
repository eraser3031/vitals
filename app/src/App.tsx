import { useEffect, useState, useRef } from 'react'
import type { Post } from './types'

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [content, setContent] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = posts.find(p => p.id === selectedId) ?? null

  useEffect(() => {
    window.vitalsAPI.getPosts().then(list => {
      setPosts(list)
      if (list.length > 0) {
        setSelectedId(list[0].id)
        setTitle(list[0].title)
        setProject(list[0].project || '')
        setContent(list[0].content)
      }
    })
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
    if (selectedId && selected && (title !== (selected.title || '') || project !== (selected.project || '') || content !== selected.content)) {
      window.vitalsAPI.updatePost(selectedId, title, project, content)
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, title, project, content } : p))
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
    scheduleSave(value, project, content)
  }

  function handleProjectChange(value: string) {
    setProject(value)
    scheduleSave(title, value, content)
  }

  function handleContentChange(value: string) {
    setContent(value)
    scheduleSave(title, project, value)
  }

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
            <textarea
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              className="flex-1 resize-none border-none outline-none px-6 pt-4 pb-6 text-[15px] leading-relaxed font-sans bg-white"
              placeholder="내용을 입력하세요..."
            />
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
