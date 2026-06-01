import { Flame } from 'lucide-react'

export function FirebaseSection() {
  return (
    <section
      className="home-card group"
      data-testid="home-firebase"
    >
      <h2 className="home-card-header">
        <Flame className="w-5 h-5 inline-block mr-2 -mt-0.5" />
        關於 Firebase
      </h2>

      <div className="p-6 md:p-8 space-y-6">
        <div className="space-y-4 text-left">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
            最近才接觸 <code className="home-inline-code">firebase</code>，主要是看重了 <code className="home-inline-code">Google</code> 這招牌，以及 <code className="home-inline-code">realtime database</code> 便捷性質，讓我覺得前端在製作簡易的即時互動的頁面時，可以更簡單更容易了，當然功能還不只這些，還提供網頁架設、授權管理、檔案上傳..等，在跨平台方面也變得相對容易。
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
            目前這網頁只用即時資料庫跟授權管理的部分，剛好看到有人用 google map 做生活聊天室，自己也稍微玩一下，也做個衛星定位及多人聊天室不過很陽春就是了!
          </p>
        </div>

        {/* Direction Screenshot Placeholder */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 aspect-video group/img shadow-md transition-all duration-300">
          <img 
            src="/direction_pc.jpg" 
            alt="Firebase Location Realtime Tracking Dashboard Screen" 
            className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
            data-testid="firebase-pc-image"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  )
}

export default FirebaseSection
