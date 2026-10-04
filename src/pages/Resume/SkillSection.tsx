import { Tag } from '@/components/toybox'
import PanelHead from '@/pages/Resume/PanelHead'
import { SKILL_ITEMS, skillTagStyle } from '@/pages/Resume/skills'

// 同權重內的序號（weight 4 依序輪替貼紙色）
const SKILL_TAGS = SKILL_ITEMS.map((item, i) => ({
  ...item,
  ...skillTagStyle(item.weight, SKILL_ITEMS.slice(0, i).filter((s) => s.weight === item.weight).length),
}))

export function SkillSection() {
  return (
    <section className="resume-panel" data-testid="resume-skills">
      <PanelHead title="技能" code="SKILLS" />
      <div className="resume-panel__body">
        <div className="resume-skills">
          {SKILL_TAGS.map((item) => (
            <span key={item.text} data-testid={`skill-tag-${item.text}`} className="contents">
              <Tag tone={item.tone} size={item.size}>
                {item.text}
              </Tag>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SkillSection
