import { Mail, MapPin, User, Calendar, ExternalLink, Award, Sparkles } from 'lucide-react'
import useScrollAnimation from '@/lib/useScrollAnimation'

interface SkillRingProps {
  percentage: number
  radius: number
  strokeWidth: number
  colorClass: string
  label: string
}

function SkillRing({ percentage, radius, strokeWidth, colorClass, label }: SkillRingProps) {
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1 group/ring">
      <div className="relative w-18 h-18 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-800/80 fill-none"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle with glow and animation */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            className={`fill-none transition-all duration-1000 ease-out ${colorClass}`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
          {percentage}%
        </span>
      </div>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover/ring:text-purple-500 dark:group-hover/ring:text-purple-400 transition-colors duration-200 text-center w-20 truncate">
        {label}
      </span>
    </div>
  )
}

export function AboutSection() {
  const containerRef = useScrollAnimation()

  const competencies = [
    { id: 'arch', percentage: 95, label: '前端架構', colorClass: 'stroke-purple-600 dark:stroke-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.4)]', radius: 28, strokeWidth: 5.5 },
    { id: 'uiux', percentage: 90, label: '介面互動', colorClass: 'stroke-indigo-600 dark:stroke-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.4)]', radius: 28, strokeWidth: 5.5 },
    { id: 'perf', percentage: 88, label: '效能優化', colorClass: 'stroke-emerald-600 dark:stroke-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]', radius: 28, strokeWidth: 5.5 },
    { id: 'ai', percentage: 92, label: 'AI 協作開發', colorClass: 'stroke-amber-500 dark:stroke-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]', radius: 28, strokeWidth: 5.5 }
  ]

  const bioText = "擁有超過 13 年資訊相關經驗，其中 10 年以上專注於前端開發與系統架構設計。熟悉 Vue、React、Nuxt、Next.js 等主流框架，參與過大型 B2B / B2C 平台、財務系統與遊戲平台開發，並擔任技術帶領角色，負責程式碼審查與新人培訓。近兩年深耕 AI 輔助開發流程（Claude Code、AI Agent Workflow、Vibe Coding），致力打造穩定、高效且具長期維護性的產品。"

  return (
    <section 
      ref={containerRef}
      className="resume-card animate-on-scroll animate-fade-in-up shadow-purple-500/5 dark:shadow-indigo-500/5" 
      data-testid="resume-about"
    >
      <h2 className="resume-card-header flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" aria-hidden="true" />
        <span>關於我 (About Me)</span>
      </h2>
      
      <div className="p-6 md:p-8 space-y-6">
        {/* Profile Card and Bio */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Container with hover scale and glowing ring */}
          <div className="relative group shrink-0 animate-on-scroll animate-scale-in">
            {/* Outer glowing ring */}
            <div className="absolute -inset-1.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-500 rounded-full blur opacity-25 group-hover:opacity-75 transition-opacity duration-300" />
            
            {/* Tech rotating border effect */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-purple-500/40 group-hover:rotate-90 transition-transform duration-[4000ms] ease-linear" />
            
            <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl bg-slate-100 dark:bg-slate-800">
              <img 
                src="https://avatars.githubusercontent.com/u/10608131?v=3" 
                alt="盧宏寶 頭像" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-115"
                data-testid="resume-avatar-image"
                loading="lazy"
              />
            </div>
          </div>
  
          {/* Profile Name & Tagline */}
          <div className="flex-1 w-full space-y-3 text-center sm:text-left">
            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 justify-center sm:justify-start">
                <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5 justify-center sm:justify-start">
                  盧宏寶
                  <Award className="w-5 h-5 text-amber-500 animate-bounce" style={{ animationDuration: '3s' }} aria-hidden="true" />
                </h3>
                <div className="flex justify-center sm:justify-start">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Open to Work / 歡迎聯繫
                  </span>
                </div>
              </div>
              
              <p className="text-xs md:text-sm font-extrabold uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-500 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Senior Frontend Architect
              </p>
            </div>
            
            {/* Bio introduction */}
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
              {bioText}
            </p>
          </div>
        </div>

        {/* Core Competencies (SVG Rings) */}
        <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/40 shadow-inner flex justify-around items-center gap-2">
          {competencies.map((comp) => (
            <SkillRing
              key={comp.id}
              percentage={comp.percentage}
              radius={comp.radius}
              strokeWidth={comp.strokeWidth}
              colorClass={comp.colorClass}
              label={comp.label}
            />
          ))}
        </div>
        
        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm w-full">
          {/* Class Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:shadow-md hover:border-purple-500/20 dark:hover:border-purple-400/20 transition-all duration-300 group/item cursor-pointer">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 group-hover/item:bg-purple-500/20 transition-colors duration-300">
              <User className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
            </div>
            <div className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Class
              </span>
              <span className="font-semibold text-xs md:text-sm text-slate-800 dark:text-slate-200">
                資深前端工程師
              </span>
            </div>
          </div>

          {/* Level Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:shadow-md hover:border-purple-500/20 dark:hover:border-purple-400/20 transition-all duration-300 group/item cursor-pointer">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 group-hover/item:bg-purple-500/20 transition-colors duration-300">
              <Calendar className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
            </div>
            <div className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Level
              </span>
              <span className="font-semibold text-xs md:text-sm text-slate-800 dark:text-slate-200">
                13+ 年資歷
              </span>
            </div>
          </div>

          {/* Email Card (Clickable) */}
          <a 
            href="mailto:dk880842@gmail.com" 
            className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:shadow-md hover:border-purple-500/30 dark:hover:border-purple-400/30 hover:bg-purple-500/5 dark:hover:bg-purple-500/5 transition-all duration-300 group/item cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            aria-label="寄信給盧宏寶"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 group-hover/item:bg-purple-500/20 transition-colors duration-300">
              <Mail className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
            </div>
            <div className="overflow-hidden text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Email
                <ExternalLink className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" aria-hidden="true" />
              </span>
              <span className="font-semibold text-xs md:text-sm text-slate-800 dark:text-slate-200 block truncate group-hover/item:text-purple-600 dark:group-hover/item:text-purple-400 transition-colors duration-300">
                dk880842@gmail.com
              </span>
            </div>
          </a>

          {/* Location Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:shadow-md hover:border-purple-500/20 dark:hover:border-purple-400/20 transition-all duration-300 group/item cursor-pointer">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 group-hover/item:bg-purple-500/20 transition-colors duration-300">
              <MapPin className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
            </div>
            <div className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Location
              </span>
              <span className="font-semibold text-xs md:text-sm text-slate-800 dark:text-slate-200">
                台灣高雄市
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutSection
