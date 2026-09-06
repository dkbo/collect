const TECH_ITEMS = [
  { label: 'Vue', color: '#42b883' },
  { label: 'React 19', color: '#61dafb' },
  { label: 'TypeScript', color: '#3178c6' },
  { label: 'Babylon.js', color: '#bb464b' },
  { label: 'Godot 4', color: '#478cbf' },
  { label: 'WebRTC', color: '#333333' },
  { label: 'Firebase', color: '#ffca28' },
  { label: 'Zustand', color: '#443e38' },
  { label: 'Tailwind v4', color: '#38bdf8' },
  { label: 'Claude Code', color: '#d97757' },
] as const

function MarqueeRow({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div className={ariaHidden ? 'marquee-clone flex gap-12 items-center' : 'flex gap-12 items-center'} aria-hidden={ariaHidden}>
      {TECH_ITEMS.map(({ label, color }) => (
        <span key={label} className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  )
}

export function TechMarquee() {
  return (
    <section className="marquee-mask pb-16" data-testid="home-marquee" aria-label="使用技術">
      <div className="marquee-track">
        <MarqueeRow />
        <MarqueeRow ariaHidden />
      </div>
    </section>
  )
}

export default TechMarquee
