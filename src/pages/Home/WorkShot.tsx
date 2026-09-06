import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Work } from '@/pages/Home/works'

interface WorkShotProps {
  work: Work
  className?: string
}

/** 作品截圖；載入失敗或無 shot 時顯示依 id 決定的漸層佈景 */
export function WorkShot({ work, className }: WorkShotProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(work.shot) && !failed

  return (
    <div className={cn('work-shot', className)} data-testid={`work-shot-${work.id}`}>
      {showImage ? (
        <img
          src={work.shot}
          alt={`${work.title} 畫面截圖`}
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={cn('work-shot-fallback', `work-shot-fallback-${work.id}`)} aria-hidden="true" />
      )}
      <div className="work-shot-overlay" />
    </div>
  )
}

export default WorkShot
