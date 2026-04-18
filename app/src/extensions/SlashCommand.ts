import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface SlashMenuItem {
  id: string
  label: string
  description: string
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  { id: 'background', label: '배경', description: '포스트모템을 이해하기 위한 최소한의 설명' },
]

export interface SlashMenuState {
  active: boolean
  query: string
  from: number
  top: number
  left: number
  selectedIndex: number
}

const INITIAL_STATE: SlashMenuState = {
  active: false, query: '', from: 0, top: 0, left: 0, selectedIndex: 0,
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addStorage() {
    return {
      menuState: { ...INITIAL_STATE } as SlashMenuState,
      onUpdate: null as ((state: SlashMenuState) => void) | null,
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const storage = (this.editor.storage as any).slashCommand

    function update(patch: Partial<SlashMenuState>) {
      storage.menuState = { ...storage.menuState, ...patch }
      storage.onUpdate?.(storage.menuState)
    }

    function close() {
      update({ active: false, query: '', selectedIndex: 0 })
    }

    function getFiltered(): SlashMenuItem[] {
      return SLASH_MENU_ITEMS.filter(item =>
        item.label.includes(storage.menuState.query)
      )
    }

    return [
      new Plugin({
        key: new PluginKey('slashCommand'),
        props: {
          handleKeyDown(view, event) {
            if (!storage.menuState.active) {
              if (event.key === '/') {
                const { $from } = view.state.selection
                const textBefore = view.state.doc.textBetween($from.start(), $from.pos, '', '')

                if (textBefore.trim() === '') {
                  const coords = view.coordsAtPos($from.pos)
                  const editorRect = view.dom.getBoundingClientRect()

                  update({
                    active: true,
                    query: '',
                    from: $from.pos,
                    top: coords.bottom - editorRect.top,
                    left: coords.left - editorRect.left,
                    selectedIndex: 0,
                  })
                }
              }
              return false
            }

            // 메뉴 활성 상태
            const filtered = getFiltered()

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              update({ selectedIndex: (storage.menuState.selectedIndex + 1) % filtered.length })
              return true
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              update({ selectedIndex: (storage.menuState.selectedIndex - 1 + filtered.length) % filtered.length })
              return true
            }

            if (event.key === 'Enter') {
              event.preventDefault()
              if (filtered.length > 0) {
                const item = filtered[storage.menuState.selectedIndex] || filtered[0]
                const { state } = view
                const tr = state.tr.delete(storage.menuState.from, state.selection.$from.pos)
                view.dispatch(tr)
                editor.commands.insertSectionBlock(item.id)
              }
              close()
              return true
            }

            if (event.key === 'Escape') {
              close()
              return true
            }

            if (event.key === 'Backspace') {
              if (storage.menuState.query === '') {
                close()
                return false
              }
              update({
                query: storage.menuState.query.slice(0, -1),
                selectedIndex: 0,
              })
              return false
            }

            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
              update({
                query: storage.menuState.query + event.key,
                selectedIndex: 0,
              })
            }

            return false
          },
        },
      }),
    ]
  },
})
