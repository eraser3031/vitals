import { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { SectionBlock } from './extensions/SectionBlock'
import { SlashCommand } from './extensions/SlashCommand'
import { SlashMenu } from './components/SlashMenu'
import type { Post, Context } from './types'

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function PostEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '내용을 입력하세요... (/ 로 섹션 추가)' }),
      SectionBlock,
      SlashCommand,
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
    <div className="relative flex-1 overflow-y-auto">
      <EditorContent
        editor={editor}
        className="px-6 pt-4 pb-6 prose prose-sm max-w-none text-[15px] leading-relaxed h-full"
      />
      <SlashMenu editor={editor} />
    </div>
  )
}

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [content, setContent] = useState('')
  const [contexts, setContexts] = useState<Context[]>([])
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showGithubPicker, setShowGithubPicker] = useState(false)
  const [showNotionPicker, setShowNotionPicker] = useState(false)
  const [githubRepos, setGithubRepos] = useState<{ full_name: string; owner: { login: string }; name: string; default_branch: string; description: string | null }[]>([])
  const [githubQuery, setGithubQuery] = useState('')
  const [notionResults, setNotionResults] = useState<{ id: string; object: string; url: string; properties?: Record<string, unknown> }[]>([])
  const [notionQuery, setNotionQuery] = useState('')
  const [factCheckResult, setFactCheckResult] = useState<string | null>(null)
  const [factChecking, setFactChecking] = useState(false)
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
        setContexts(list[0].contexts || [])
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
    setContexts(post.contexts || [])
    setFactCheckResult(null)
  }

  async function addPost() {
    flushSave()
    const post = await window.vitalsAPI.createPost('', '', '')
    setPosts(prev => [post, ...prev])
    setSelectedId(post.id)
    setTitle('')
    setProject('')
    setContent('')
    setContexts([])
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
        setContexts(next[0].contexts || [])
      } else {
        setSelectedId(null)
        setTitle('')
        setProject('')
        setContent('')
        setContexts([])
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

  async function addContext(ctx: Context) {
    const next = [...contexts, ctx]
    setContexts(next)
    if (selectedId) {
      await window.vitalsAPI.updatePost(selectedId, title, project, contentRef.current, next)
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, contexts: next } : p))
    }
  }

  async function removeContext(ctxId: string) {
    const next = contexts.filter(c => c.id !== ctxId)
    setContexts(next)
    if (selectedId) {
      await window.vitalsAPI.updatePost(selectedId, title, project, contentRef.current, next)
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, contexts: next } : p))
    }
  }

  async function openGithubPicker() {
    setShowContextMenu(false)
    setShowGithubPicker(true)
    try {
      const repos = await window.vitalsAPI.githubGetRepos()
      setGithubRepos(repos)
    } catch { setGithubRepos([]) }
  }

  async function pickGithubRepo(repo: typeof githubRepos[0]) {
    setShowGithubPicker(false)
    await addContext({
      id: crypto.randomUUID(),
      type: 'github',
      label: repo.full_name,
      data: { owner: repo.owner.login, repo: repo.name, defaultBranch: repo.default_branch },
    })
  }

  async function searchNotion() {
    if (!notionQuery.trim()) return
    try {
      const res = await window.vitalsAPI.notionSearch(notionQuery)
      setNotionResults(res.results)
    } catch { setNotionResults([]) }
  }

  function getNotionPageTitle(page: typeof notionResults[0]): string {
    if (!page.properties) return 'Untitled'
    const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any
    if (!titleProp?.title?.[0]?.plain_text) return 'Untitled'
    return titleProp.title[0].plain_text
  }

  async function pickNotionPage(page: typeof notionResults[0]) {
    setShowNotionPicker(false)
    setNotionQuery('')
    setNotionResults([])
    await addContext({
      id: crypto.randomUUID(),
      type: 'notion',
      label: getNotionPageTitle(page),
      data: { pageId: page.id, url: page.url },
    })
  }

  async function runFactCheck() {
    if (contexts.length === 0 || !contentRef.current.trim()) return
    setFactChecking(true)
    setFactCheckResult(null)
    try {
      // HTML 태그 제거해서 순수 텍스트로 보냄
      const plainContent = contentRef.current.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      const result = await window.vitalsAPI.factCheck(plainContent, title, contexts)
      setFactCheckResult(result)
    } catch (err) {
      setFactCheckResult('팩트체크 실행 중 오류가 발생했습니다.')
    } finally {
      setFactChecking(false)
    }
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
              {/* 컨텍스트 */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {contexts.map(ctx => (
                  <span
                    key={ctx.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-700"
                  >
                    <span className="text-[10px] text-muted">{ctx.type === 'github' ? 'GH' : 'NT'}</span>
                    {ctx.label}
                    <button
                      onClick={() => removeContext(ctx.id)}
                      className="text-muted hover:text-danger bg-transparent border-none cursor-pointer text-[11px] p-0 ml-0.5"
                    >
                      x
                    </button>
                  </span>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setShowContextMenu(!showContextMenu)}
                    className="text-[11px] text-muted hover:text-primary cursor-pointer bg-transparent border-none"
                  >
                    + 컨텍스트
                  </button>
                  {showContextMenu && (
                    <div className="absolute left-0 top-6 bg-white border border-border rounded shadow-sm z-20 py-1 min-w-[120px]">
                      {githubUser && (
                        <button
                          onClick={openGithubPicker}
                          className="block w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 bg-transparent border-none cursor-pointer"
                        >
                          GitHub
                        </button>
                      )}
                      {notionUser && (
                        <button
                          onClick={() => { setShowContextMenu(false); setShowNotionPicker(true) }}
                          className="block w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 bg-transparent border-none cursor-pointer"
                        >
                          Notion
                        </button>
                      )}
                      {!githubUser && !notionUser && (
                        <div className="px-3 py-1.5 text-[12px] text-muted">연결된 서비스 없음</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* GitHub 레포 선택 */}
              {showGithubPicker && (
                <div className="mb-4 border border-border rounded p-3 max-h-[240px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium">레포 선택</span>
                    <button onClick={() => { setShowGithubPicker(false); setGithubQuery('') }} className="text-[11px] text-muted hover:text-primary bg-transparent border-none cursor-pointer">닫기</button>
                  </div>
                  <input
                    value={githubQuery}
                    onChange={e => setGithubQuery(e.target.value)}
                    className="w-full text-[12px] border border-border rounded px-2 py-1 outline-none mb-2"
                    placeholder="레포 검색..."
                    autoFocus
                  />
                  {githubRepos
                    .filter(r => !githubQuery || r.full_name.toLowerCase().includes(githubQuery.toLowerCase()) || (r.description || '').toLowerCase().includes(githubQuery.toLowerCase()))
                    .map(repo => (
                    <button
                      key={repo.full_name}
                      onClick={() => { pickGithubRepo(repo); setGithubQuery('') }}
                      className="block w-full text-left px-2 py-1.5 hover:bg-gray-50 bg-transparent border-none cursor-pointer"
                    >
                      <div className="text-[12px] truncate">{repo.full_name}</div>
                      {repo.description && <div className="text-[11px] text-muted truncate">{repo.description}</div>}
                    </button>
                  ))}
                  {githubRepos.length === 0 && <div className="text-[12px] text-muted">로딩중...</div>}
                </div>
              )}

              {/* Notion 페이지 검색 */}
              {showNotionPicker && (
                <div className="mb-4 border border-border rounded p-3 max-h-[200px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium">Notion 검색</span>
                    <button onClick={() => { setShowNotionPicker(false); setNotionQuery(''); setNotionResults([]) }} className="text-[11px] text-muted hover:text-primary bg-transparent border-none cursor-pointer">닫기</button>
                  </div>
                  <div className="flex gap-1 mb-2">
                    <input
                      value={notionQuery}
                      onChange={e => setNotionQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchNotion()}
                      className="flex-1 text-[12px] border border-border rounded px-2 py-1 outline-none"
                      placeholder="페이지 검색..."
                    />
                    <button onClick={searchNotion} className="text-[11px] text-primary bg-transparent border border-border rounded px-2 cursor-pointer">검색</button>
                  </div>
                  {notionResults.map(page => (
                    <button
                      key={page.id}
                      onClick={() => pickNotionPage(page)}
                      className="block w-full text-left px-2 py-1.5 text-[12px] hover:bg-gray-50 bg-transparent border-none cursor-pointer truncate"
                    >
                      {getNotionPageTitle(page)}
                    </button>
                  ))}
                </div>
              )}

              {/* 팩트체크 */}
              {contexts.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={runFactCheck}
                    disabled={factChecking}
                    className="text-[11px] px-2.5 py-1 rounded border border-border text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer bg-white"
                  >
                    {factChecking ? '체크 중...' : '팩트체크'}
                  </button>
                  {factCheckResult && (
                    <button
                      onClick={() => setFactCheckResult(null)}
                      className="text-[11px] text-muted hover:text-primary bg-transparent border-none cursor-pointer"
                    >
                      결과 닫기
                    </button>
                  )}
                </div>
              )}

              {factCheckResult && (
                <div className="mb-4 p-3 rounded bg-gray-50 border border-border text-[13px] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {factCheckResult}
                </div>
              )}

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
