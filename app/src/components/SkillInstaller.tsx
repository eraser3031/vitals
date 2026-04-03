import { useState } from 'react'

interface Props {
  onInstalled: () => void
}

export function SkillInstaller({ onInstalled }: Props) {
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInstall() {
    setInstalling(true)
    setError(null)
    const result = await window.vitalsAPI.installSkill()
    setInstalling(false)
    if (result.success) {
      onInstalled()
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="skill-installer">
      <h3>부검 스킬 설치</h3>
      <p>Claude Code에서 프로젝트 진단을 하려면 스킬을 먼저 설치해야 해요.</p>
      <button
        className="install-btn"
        onClick={handleInstall}
        disabled={installing}
      >
        {installing ? '설치 중...' : '원클릭 설치'}
      </button>
      {error && <p className="install-error">설치 실패: {error}</p>}
      <div className="install-alt">
        <p>또는 터미널에서 직접:</p>
        <code>npx skills add eraser3031/vitals -g</code>
      </div>
    </div>
  )
}
