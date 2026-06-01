export function AuthorSection() {
  return (
    <section className="resume-card" data-testid="resume-author">
      <h2 className="resume-card-header">人物介紹</h2>
      <div className="p-6 md:p-8 space-y-5 text-left">
        <div className="relative pl-4 border-l-4 border-purple-500 py-1">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium">
            個性率真不做作，平常喜歡聽聽音樂哼哼歌、玩玩遊戲、吸收新知等來紓解壓力，不喜歡拖泥帶水的事情纏身。
          </p>
        </div>
        <div className="relative pl-4 border-l-4 border-indigo-500 py-1">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium">
            主要志向是以 Javascript 來開發前端、後端、桌面 APP、手機 APP，未來勢必會成為不可或缺的人才。
          </p>
        </div>
      </div>
    </section>
  )
}

export default AuthorSection
