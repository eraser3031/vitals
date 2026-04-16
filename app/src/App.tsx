import { useEffect, useState, useRef } from 'react'
import type { Post } from './types'

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
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
        setContent(list[0].content)
      }
    })
  }, [])

  function select(post: Post) {
    flushSave()
    setSelectedId(post.id)
    setTitle(post.title)
    setContent(post.content)
  }

  async function addPost() {
    flushSave()
    const post = await window.vitalsAPI.createPost('', '')
    setPosts(prev => [post, ...prev])
    setSelectedId(post.id)
    setTitle('')
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
        setTitle(next[0].title)
        setContent(next[0].content)
      } else {
        setSelectedId(null)
        setTitle('')
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
    if (selectedId && selected && (title !== selected.title || content !== selected.content)) {
      window.vitalsAPI.updatePost(selectedId, title, content)
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, title, content } : p))
    }
  }

  function scheduleSave(newTitle: string, newContent: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (selectedId) {
        window.vitalsAPI.updatePost(selectedId, newTitle, newContent)
        setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, title: newTitle, content: newContent } : p))
      }
    }, 400)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    scheduleSave(value, content)
  }

  function handleContentChange(value: string) {
    setContent(value)
    scheduleSave(title, value)
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
            const displayTitle = isSelected ? title : post.title
            return (
              <li
                key={post.id}
                onClick={() => select(post)}
                className={`px-4 py-2.5 text-[13px] cursor-pointer truncate ${
                  isSelected ? 'bg-selected font-medium' : 'hover:bg-hover-bg'
                }`}
              >
                {(displayTitle || '').trim() || '제목 없음'}
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
            <input
              ref={titleRef}
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              className="px-6 pt-6 pb-2 text-[22px] font-bold border-none outline-none bg-white"
              placeholder="제목"
            />
            <textarea
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              className="flex-1 resize-none border-none outline-none px-6 pb-6 text-[15px] leading-relaxed font-sans bg-white"
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
