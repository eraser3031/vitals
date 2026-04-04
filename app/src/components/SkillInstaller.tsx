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
    <div className="mt-6 px-6 py-5 bg-[#f5f5f7] rounded-lg border border-[#e5e5e5] text-center">
      <h3 className="text-[15px] text-[#444] mb-2">부검 스킬 설치</h3>
      <p className="text-[13px] text-[#777] my-1">Claude Code에서 프로젝트 진단을 하려면 스킬을 먼저 설치해야 해요.</p>
      <button
        className="mt-3 px-5 py-2 bg-primary text-white border-none rounded-md text-[13px] cursor-pointer transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleInstall}
        disabled={installing}
      >
        {installing ? '설치 중...' : '원클릭 설치'}
      </button>
      {error && <p className="text-danger text-xs mt-2">설치 실패: {error}</p>}
      <div className="mt-4 pt-3 border-t border-[#e5e5e5]">
        <p className="text-[13px] text-[#777] my-1">또는 터미널에서 직접:</p>
        <code className="inline-block mt-1 px-2.5 py-1 bg-primary-light rounded text-primary text-[13px]">npx skills add eraser3031/vitals-skill -g</code>
      </div>
    </div>
  )
}
