import { SkillInstaller } from './SkillInstaller'

interface Props {
  skillInstalled: boolean | null
  onSkillInstalled: () => void
}

export function Settings({ skillInstalled, onSkillInstalled }: Props) {
  return (
    <div className="px-8 py-6 max-w-[600px]">
      <div className="mb-6 pb-4 border-b border-[#e5e5e5]">
        <h2 className="text-[22px] font-bold text-gray-900">설정</h2>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-3">스킬 상태</h3>
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#f5f5f7] rounded-lg mb-2 border border-[#e5e5e5]">
          <span className="text-sm text-[#444]">vitals-postmortem</span>
          <span className={`text-xs px-2.5 py-0.5 rounded font-medium ${skillInstalled ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
            {skillInstalled === null ? '확인 중...' : skillInstalled ? '설치됨' : '미설치'}
          </span>
        </div>
        {skillInstalled === false && (
          <SkillInstaller onInstalled={onSkillInstalled} />
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-3">저장 경로</h3>
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#f5f5f7] rounded-lg mb-2 border border-[#e5e5e5]">
          <span className="text-sm text-[#444]">보고서</span>
          <code className="text-[13px] px-2 py-0.5 bg-primary-light rounded text-primary">~/.vitals/reports/</code>
        </div>
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#f5f5f7] rounded-lg mb-2 border border-[#e5e5e5]">
          <span className="text-sm text-[#444]">스킬</span>
          <code className="text-[13px] px-2 py-0.5 bg-primary-light rounded text-primary">~/.claude/skills/vitals-postmortem/</code>
        </div>
      </div>
    </div>
  )
}
