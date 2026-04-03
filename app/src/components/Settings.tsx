import { SkillInstaller } from './SkillInstaller'

interface Props {
  skillInstalled: boolean | null
  onSkillInstalled: () => void
}

export function Settings({ skillInstalled, onSkillInstalled }: Props) {
  return (
    <div className="settings">
      <div className="settings-header">
        <h2>설정</h2>
      </div>

      <div className="settings-section">
        <h3>스킬 상태</h3>
        <div className="settings-row">
          <span className="settings-label">vitals-postmortem</span>
          <span className={`settings-status ${skillInstalled ? 'installed' : 'not-installed'}`}>
            {skillInstalled === null ? '확인 중...' : skillInstalled ? '설치됨' : '미설치'}
          </span>
        </div>
        {skillInstalled === false && (
          <SkillInstaller onInstalled={onSkillInstalled} />
        )}
      </div>

      <div className="settings-section">
        <h3>저장 경로</h3>
        <div className="settings-row">
          <span className="settings-label">보고서</span>
          <code className="settings-path">~/.vitals/reports/</code>
        </div>
        <div className="settings-row">
          <span className="settings-label">스킬</span>
          <code className="settings-path">~/.claude/skills/vitals-postmortem/</code>
        </div>
      </div>
    </div>
  )
}
