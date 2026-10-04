/** 貼紙色（Tag、IconBox 等色塊上的字一律 on-fill） */
export type StickerTone = 'pop' | 'sky' | 'mint' | 'pink' | 'plain'
export type TagInput = string | { label: string; tone?: StickerTone }

/** 讓元件可以接 data-testid 等 data-* 屬性 */
export type DataAttributes = { [key: `data-${string}`]: string | number | boolean | undefined }

const TAG_TONES: StickerTone[] = ['sky', 'mint', 'pink', 'pop']

/** 字串標籤依序輪替 sky／mint／pink／pop */
export function normTags(tags: TagInput[] | undefined): { label: string; tone: StickerTone }[] {
  return (tags ?? []).map((t, i) =>
    typeof t === 'string' ? { label: t, tone: TAG_TONES[i % TAG_TONES.length] } : { label: t.label, tone: t.tone ?? 'sky' },
  )
}

/** 站外連結（http、mailto、tel、//）用 <a>，其餘交給 react-router */
export function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:|\/\/)/i.test(href)
}

/** 從 props 中挑出 data-* 屬性 */
export function pickDataAttributes(props: object): DataAttributes {
  const out: DataAttributes = {}
  for (const [k, v] of Object.entries(props)) if (k.startsWith('data-')) out[k as `data-${string}`] = v
  return out
}
