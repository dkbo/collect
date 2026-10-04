import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * 認得 toybox token 的 tailwind-merge。
 * 預設的 twMerge 會把 text-heading-m 當成文字色、shadow-hard-s 當成陰影色，
 * 跟 text-ink／shadow-destructive 合併時會被吃掉；混用 toybox utility 時改用這個。
 */
const twMergeToy = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display-xl', 'display-l', 'heading-l', 'heading-m', 'button', 'button-s', 'body-l', 'body', 'body-s', 'label', 'caption', 'pixel-xl', 'pixel-l', 'pixel-m'],
      shadow: ['hard-s', 'hard-m', 'hard-l', 'hard-xl', 'hard-action'],
      radius: ['toy-sm', 'toy-md', 'toy-lg', 'toy-xl', 'toy-console', 'toy-pill'],
      font: ['display', 'body', 'pixel'],
      container: ['site'],
    },
  },
})

export function tbCn(...inputs: ClassValue[]) {
  return twMergeToy(clsx(inputs))
}
