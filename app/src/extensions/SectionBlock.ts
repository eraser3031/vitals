import { Node, mergeAttributes } from '@tiptap/core'

export interface SectionBlockOptions {
  types: { id: string; label: string }[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sectionBlock: {
      insertSectionBlock: (sectionType: string) => ReturnType
    }
  }
}

export const SectionBlock = Node.create<SectionBlockOptions>({
  name: 'sectionBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      types: [
        { id: 'background', label: '배경' },
      ],
    }
  },

  addAttributes() {
    return {
      sectionType: {
        default: 'background',
        parseHTML: (element) => element.getAttribute('data-section-type'),
        renderHTML: (attributes) => ({ 'data-section-type': attributes.sectionType }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-section-type]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'section-block' }), 0]
  },

  addCommands() {
    return {
      insertSectionBlock:
        (sectionType: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { sectionType },
            content: [{ type: 'paragraph' }],
          })
        },
    }
  },
})
