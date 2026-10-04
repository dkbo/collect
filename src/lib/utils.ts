import type { ClassValue } from "clsx"
import { tbCn } from "@/components/toybox/cn"

// 與 tbCn 同一套 extendTailwindMerge：預設 twMerge 會把 text-heading-m／shadow-hard-s 等 toybox token 當成色彩吃掉
export function cn(...inputs: ClassValue[]) {
  return tbCn(...inputs)
}
