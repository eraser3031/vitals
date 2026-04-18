import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { SLASH_MENU_ITEMS, type SlashMenuState } from '../extensions/SlashCommand'

const INITIAL: SlashMenuState = {
  active: false, query: '', from: 0, top: 0, left: 0, selectedIndex: 0,
}

export function SlashMenu({ editor }: { editor: Editor | null }) {
  const [menuState, setMenuState] = useState<SlashMenuState>(INITIAL)

  useEffect(() => {
    if (!editor) return
    ;(editor.storage as any).slashCommand.onUpdate = (state: SlashMenuState) => {
      setMenuState({ ...state })
    }
    return () => {
      ;(editor.storage as any).slashCommand.onUpdate = null
    }
  }, [editor])

  const filtered = SLASH_MENU_ITEMS.filter(item =>
    item.label.includes(menuState.query)
  )

  if (!menuState.active || filtered.length === 0) return null

  function select(index: number) {
    if (!editor) return
    const item = filtered[index]

    const { state } = editor.view
    const tr = state.tr.delete(menuState.from, state.selection.$from.pos)
    editor.view.dispatch(tr)

    ;(editor.commands as any).insertSectionBlock(item.id)

    ;(editor.storage as any).slashCommand.menuState = { ...menuState, active: false }
    setMenuState(prev => ({ ...prev, active: false }))
    editor.commands.focus()
  }

  return (
    <div
      className="absolute z-30 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[200px]"
      style={{ top: menuState.top + 4, left: menuState.left }}
    >
      {filtered.map((item, i) => (
        <button
          key={item.id}
          onMouseDown={(e) => { e.preventDefault(); select(i) }}
          className={`block w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer ${
            i === menuState.selectedIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
          }`}
        >
          <div className="text-[13px] text-gray-900">{item.label}</div>
          <div className="text-[11px] text-muted">{item.description}</div>
        </button>
      ))}
    </div>
  )
}
