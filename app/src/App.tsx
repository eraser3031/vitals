import { useEffect, useState, useRef } from 'react'
import type { Post } from './types'

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = posts.find(p => p.id === selectedId) ?? null

  useEffect(() => {
    window.vitalsAPI.getPosts().then(list => {
      setPosts(list)
      if (list.length > 0) {
        setSelectedId(list[0].id)
        setContent(list[0].content)
      }
    })
  }, [])

  function select(post: Post) {
    flushSave()
    setSelectedId(post.id)
    setContent(post.content)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  async function addPost() {
    flushSave()
    const post = await window.vitalsAPI.createPost('')
    setPosts(prev => [post, ...prev])
    setSelectedId(post.id)
    setContent('')
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  async function deleteSelected() {
    if (!selectedId) return
    await window.vitalsAPI.deletePost(selectedId)
    setPosts(prev => {
      const next = prev.filter(p => p.id !== selectedId)
      if (next.length > 0) {
        setSelectedId(next[0].id)
        setContent(next[0].content)
      } else {
        setSelectedId(null)
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
    if (selectedId && selected && content !== selected.content) {
      window.vitalsAPI.updatePost(selectedId, content)
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, content } : p))
    }
  }

  function handleContentChange(value: string) {
    setContent(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (selectedId) {
        window.vitalsAPI.updatePost(selectedId, value)
        setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, content: value } : p))
      }
    }, 400)
  }

  function preview(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return '새 포스트'
    const firstLine = trimmed.split('\n')[0]
    return firstLine.length > 40 ? firstLine.slice(0, 40) + '...' : firstLine
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
          {posts.map(post => (
            <li
              key={post.id}
              onClick={() => select(post)}
              className={`px-4 py-2.5 text-[13px] cursor-pointer truncate ${
                post.id === selectedId
                  ? 'bg-selected font-medium'
                  : 'hover:bg-hover-bg'
              }`}
            >
              {preview(post.id === selectedId ? content : post.content)}
            </li>
          ))}
        </ul>
      </aside>

      {/* drag region for right pane */}
      <div className="fixed top-0 left-[240px] right-0 h-[38px] [-webkit-app-region:drag] z-10" />

      {/* editor */}
      <main className="flex-1 pt-[38px]">
        {selected ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            className="w-full h-full resize-none border-none outline-none p-6 text-[15px] leading-relaxed font-sans bg-white"
            placeholder="내용을 입력하세요..."
          />
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
