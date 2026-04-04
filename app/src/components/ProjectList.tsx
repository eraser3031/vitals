import type { Project } from '../types'

interface Props {
  projects: Project[]
  selected: Project | null
  onSelect: (project: Project) => void
}

export function ProjectList({ projects, selected, onSelect }: Props) {
  if (projects.length === 0) {
    return (
      <div className="py-6 px-4 text-center text-muted text-[13px]">
        프로젝트가 없습니다
      </div>
    )
  }

  return (
    <ul className="list-none m-0 p-2 overflow-y-auto flex-1">
      {projects.map(project => {
        const isSelected = selected?.id === project.id
        return (
          <li
            key={project.id}
            className={`px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-colors ${isSelected ? 'bg-selected' : 'hover:bg-hover-bg'}`}
            onClick={() => onSelect(project)}
          >
            <div className="text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
              {project.name}
            </div>
            {project.description && (
              <div className="text-[11px] text-muted mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {project.description}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
