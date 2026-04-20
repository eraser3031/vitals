import { useEffect, useState, useRef, useCallback } from 'react'
import type { Post, Context, Entry, Reply } from './types'

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function newId() {
  return crypto.randomUUID()
}

// ── Entry Card ─────────────────────────────────

function EntryCard({
  entry,
  contexts,
  postTitle,
  onChange,
  onRemove,
}: {
  entry: Entry
  contexts: Context[]
  postTitle: string
  onChange: (next: Entry) => void
  onRemove: () => void
}) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [refining, setRefining] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const clearReplyDraft = (replyId: string) => {
    setReplyDrafts(prev => {
      if (!(replyId in prev)) return prev
      const next = { ...prev }
      delete next[replyId]
      return next
    })
  }

  const addReply = (author: 'user' | 'ai', content: string) => {
    const now = new Date().toISOString()
    const reply: Reply = {
      id: newId(),
      author,
      content,
      createdAt: now,
      updatedAt: now,
    }
    onChange({ ...entry, replies: [...entry.replies, reply] })
  }

  const updateReplyContent = (replyId: string, content: string) => {
    onChange({
      ...entry,
      replies: entry.replies.map(r =>
        r.id === replyId ? { ...r, content, updatedAt: new Date().toISOString() } : r,
      ),
    })
  }

  const removeReply = (replyId: string) => {
    onChange({ ...entry, replies: entry.replies.filter(r => r.id !== replyId) })
  }

  const submitDraft = () => {
    const text = draft.trim()
    if (!text) return
    addReply('user', text)
    setDraft('')
    setComposerOpen(false)
  }

  const askAI = async () => {
    const ta = textareaRef.current
    const selected = ta && ta.selectionStart !== ta.selectionEnd
      ? draft.substring(ta.selectionStart, ta.selectionEnd).trim()
      : ''
    if (contexts.length === 0) return

    setRefining(true)
    try {
      if (selected) {
        const result = await window.vitalsAPI.refine(selected, postTitle, contexts)
        const suggestion = result.suggestions[0]
        if (suggestion && ta) {
          const before = draft.substring(0, ta.selectionStart)
          const after = draft.substring(ta.selectionEnd)
          setDraft(before + suggestion + after)
        }
      } else {
        const res = await window.vitalsAPI.factCheck([entry], postTitle, contexts)
        addReply('ai', res)
        setComposerOpen(false)
      }
    } catch {
      addReply('ai', '_응답을 가져오지 못했어요._')
    } finally {
      setRefining(false)
    }
  }

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  return (
    <div>
      {/* question */}
      <div className="group/entry flex items-start gap-2 hover:bg-surface focus-within:bg-surface px-6 -mx-6 py-2 transition-colors">
        <textarea
          value={entry.question}
          onChange={e => { onChange({ ...entry, question: e.target.value }); autoGrow(e.target) }}
          ref={el => { if (el) autoGrow(el) }}
          placeholder="질문"
          rows={1}
          className="flex-1 text-[15px] font-medium resize-none border-none outline-none bg-transparent leading-relaxed"
        />
        <button
          onClick={onRemove}
          className="opacity-0 group-hover/entry:opacity-100 text-[11px] text-muted hover:text-danger bg-transparent border-none cursor-pointer mt-1"
        >
          삭제
        </button>
      </div>

      {/* replies */}
      <div>
        {entry.replies.map(reply => {
          const replyDraft = replyDrafts[reply.id]
          const displayValue = replyDraft ?? reply.content
          const isDirty = replyDraft !== undefined && replyDraft !== reply.content
          return (
            <div key={reply.id} className="flex items-start gap-2 py-2 pl-12 pr-6 -mx-6 hover:bg-surface focus-within:bg-surface transition-colors group/reply">
              <span className="text-dim text-[13px] select-none leading-relaxed pt-0.5">↳</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-muted leading-none">
                  <span>{reply.author === 'ai' ? 'AI' : '나'}</span>
                  <span className="text-dim">수정 {formatDateTime(reply.updatedAt || reply.createdAt)}</span>
                </div>
                <textarea
                  value={displayValue}
                  onChange={e => {
                    setReplyDrafts(prev => ({ ...prev, [reply.id]: e.target.value }))
                    autoGrow(e.target)
                  }}
                  ref={el => { if (el) autoGrow(el) }}
                  rows={1}
                  className="w-full text-[13px] leading-relaxed resize-none border-none outline-none bg-transparent mt-0.5"
                />
                {isDirty && (
                  <div className="flex items-center gap-3 text-[11px] mt-0.5">
                    <button
                      onClick={() => {
                        updateReplyContent(reply.id, replyDraft.trim())
                        clearReplyDraft(reply.id)
                      }}
                      disabled={!replyDraft.trim()}
                      className="text-primary hover:opacity-80 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"
                    >
                      확인
                    </button>
                    <button
                      onClick={() => clearReplyDraft(reply.id)}
                      className="text-muted hover:text-primary cursor-pointer bg-transparent border-none p-0"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeReply(reply.id)}
                className="opacity-0 group-hover/reply:opacity-100 text-[11px] text-muted hover:text-danger bg-transparent border-none cursor-pointer"
              >
                삭제
              </button>
            </div>
          )
        })}

        {/* composer */}
        {composerOpen ? (
          <div className="flex items-start gap-2 py-2 pl-12 pr-6 -mx-6 focus-within:bg-surface transition-colors">
            <span className="text-dim text-[13px] select-none leading-relaxed">↳</span>
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => { setDraft(e.target.value); autoGrow(e.target) }}
                placeholder="코멘트 입력"
                rows={1}
                autoFocus
                className="w-full text-[13px] leading-relaxed resize-none border-none outline-none bg-transparent"
              />
              <div className="flex items-center gap-3 text-[11px] mt-0.5">
                <button
                  onClick={submitDraft}
                  disabled={!draft.trim()}
                  className="text-primary hover:opacity-80 disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"
                >
                  등록
                </button>
                {contexts.length > 0 && (
                  <button
                    onClick={askAI}
                    disabled={refining}
                    className="text-muted hover:text-primary disabled:opacity-30 cursor-pointer bg-transparent border-none p-0"
                  >
                    {refining ? '···' : 'AI'}
                  </button>
                )}
                <button
                  onClick={() => { setDraft(''); setComposerOpen(false) }}
                  className="text-muted hover:text-primary cursor-pointer bg-transparent border-none p-0"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setComposerOpen(true)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setComposerOpen(true) } }}
            className="flex items-center gap-2 text-[13px] text-dim hover:text-muted hover:bg-surface focus:bg-surface cursor-pointer py-2 pl-12 pr-6 -mx-6 transition-colors outline-none"
          >
            <span className="select-none">↳</span>
            <span>코멘트 입력</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── App ─────────────────────────────────

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [contexts, setContexts] = useState<Context[]>([])
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showGithubPicker, setShowGithubPicker] = useState(false)
  const [showNotionPicker, setShowNotionPicker] = useState(false)
  const [githubRepos, setGithubRepos] = useState<{ full_name: string; owner: { login: string }; name: string; default_branch: string; description: string | null }[]>([])
  const [githubQuery, setGithubQuery] = useState('')
  const [notionResults, setNotionResults] = useState<{ id: string; object: string; url: string; properties?: Record<string, unknown> }[]>([])
  const [notionQuery, setNotionQuery] = useState('')
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string } | null>(null)
  const [notionUser, setNotionUser] = useState<{ name: string; avatar_url: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = posts.find(p => p.id === selectedId) ?? null

  // Load posts + OAuth states
  useEffect(() => {
    window.vitalsAPI.getPosts().then(list => {
      setPosts(list)
      if (list.length > 0) {
        selectPost(list[0])
      }
    })

    window.vitalsAPI.githubGetToken().then(token => {
      if (token) {
        window.vitalsAPI.githubGetUser()
          .then(user => setGithubUser(user))
          .catch(() => setGithubUser(null))
      }
    })

    window.vitalsAPI.notionGetToken().then(token => {
      if (token) {
        window.vitalsAPI.notionGetUser()
          .then(user => setNotionUser({ name: user.bot.owner.user.name, avatar_url: user.bot.owner.user.avatar_url }))
          .catch(() => setNotionUser(null))
      }
    })

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectPost(post: Post) {
    flushSave()
    setSelectedId(post.id)
    setTitle(post.title || '')
    setProject(post.project || '')
    setEntries(post.entries || [])
    setContexts(post.contexts || [])
  }

  async function addPost() {
    flushSave()
    const post = await window.vitalsAPI.createPost('', '')
    setPosts(prev => [post, ...prev])
    setSelectedId(post.id)
    setTitle('')
    setProject('')
    setEntries([])
    setContexts([])
    setTimeout(() => titleRef.current?.focus(), 0)
  }

  async function deleteSelected() {
    if (!selectedId) return
    await window.vitalsAPI.deletePost(selectedId)
    setPosts(prev => {
      const next = prev.filter(p => p.id !== selectedId)
      if (next.length > 0) {
        selectPost(next[0])
      } else {
        setSelectedId(null)
        setTitle('')
        setProject('')
        setEntries([])
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
  }

  function scheduleSave(patch: { title?: string; project?: string }) {
    flushSave()
    if (!selectedId) return
    saveTimer.current = setTimeout(() => {
      window.vitalsAPI.updatePost(selectedId, patch)
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, ...patch } : p))
    }, 400)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    scheduleSave({ title: value })
  }

  function handleProjectChange(value: string) {
    setProject(value)
    scheduleSave({ project: value })
  }

  // entries persistence — immediate save on structural change
  const commitEntries = useCallback(async (next: Entry[]) => {
    setEntries(next)
    if (!selectedId) return
    await window.vitalsAPI.updatePost(selectedId, { entries: next })
    setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, entries: next } : p))
  }, [selectedId])

  function addEntry() {
    const entry: Entry = {
      id: newId(),
      question: '',
      replies: [],
      createdAt: new Date().toISOString(),
    }
    commitEntries([...entries, entry])
  }

  function updateEntry(entryId: string, next: Entry) {
    commitEntries(entries.map(e => e.id === entryId ? next : e))
  }

  function removeEntry(entryId: string) {
    commitEntries(entries.filter(e => e.id !== entryId))
  }

  // contexts
  async function addContext(ctx: Context) {
    const next = [...contexts, ctx]
    setContexts(next)
    if (selectedId) {
      await window.vitalsAPI.updatePost(selectedId, { contexts: next })
      setPosts(prev => prev.map(p => p.id === selectedId ? { ...p, contexts: next } : p))
    }
  }

  async function removeContext(ctxId: string) {
    const next = contexts.filter(c => c.id !== ctxId)
    setContexts(next)
    if (selectedId) {
      await window.vitalsAPI.updatePost(selectedId, { contexts: next })
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
      id: newId(),
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
      id: newId(),
      type: 'notion',
      label: getNotionPageTitle(page),
      data: { pageId: page.id, url: page.url },
    })
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
                onClick={() => selectPost(post)}
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

      {/* drag region */}
      <div className="fixed top-0 left-[240px] right-0 h-[38px] [-webkit-app-region:drag] z-10" />

      {/* main */}
      <main className="flex-1 pt-[38px] flex flex-col overflow-hidden">
        {selected ? (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
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

              <div className="border-b border-border mb-6" />

              {/* entries */}
              {entries.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  contexts={contexts}
                  postTitle={title}
                  onChange={next => updateEntry(entry.id, next)}
                  onRemove={() => removeEntry(entry.id)}
                />
              ))}

              <button
                onClick={addEntry}
                className="text-[13px] text-dim hover:text-muted bg-transparent border-none cursor-pointer py-2"
              >
                + 질문 추가
              </button>
            </div>
          </div>
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
