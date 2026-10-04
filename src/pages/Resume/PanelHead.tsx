import { clsx } from 'clsx'

/** 履歷卡頭：左標題、右點陣代號；pop 為 About 專用黃條 */
export function PanelHead({ title, code, pop }: { title: string; code: string; pop?: boolean }) {
  return (
    <div className={clsx('resume-panel__head', pop && 'resume-panel__head--pop')}>
      <h2 className="resume-panel__title">{title}</h2>
      <span className="resume-panel__code" aria-hidden="true">
        {code}
      </span>
    </div>
  )
}

export default PanelHead
