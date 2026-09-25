/**
 * 卡通兩階 ramp（spec §6，裁定④：不裝 @babylonjs/materials）：掛在 StandardMaterial 上的 material plugin，
 * 在所有光源（含陰影）累加完之後，把 diffuseBase 的亮度壓成亮 1.0／暗 0.62 兩階，交界柔化 0.05。
 * 沿用 StandardMaterial 的 thin instance、頂點色、貼圖與陰影取樣，不另寫整套光照 shader。
 */
import { MaterialPluginBase, ShaderLanguage, type Material, type MaterialDefines } from '@/babylon/babylonCore'

/** 亮暗兩階與交界（對應 spec §6：亮 1.0／暗 0.62，柔化 0.05） */
export const TOON_RAMP = { lit: 1.0, dark: 0.62, soft: 0.05 } as const
/**
 * 亮暗分界（diffuseBase 亮度）。雙光下：頂面受光約 1.3、頂面落影約 0.75、側面約 0.6–0.9，
 * 取 0.95 讓頂面與朝光的臉走亮階、落影與背光側走暗階。
 */
export const TOON_THRESHOLD = 0.95
/** 暗階保留多少光源色相（1 = 完全保留冷色環境光，0 = 純灰） */
const HUE_KEEP = 0.35

const f = (n: number): string => n.toFixed(3)

const RAMP_GLSL = `
#ifdef BOMBER_TOON
{
  float toonL = dot(diffuseBase, vec3(0.299, 0.587, 0.114));
  vec3 toonHue = mix(vec3(1.0), diffuseBase / max(toonL, 1e-4), ${f(HUE_KEEP)});
  float toonK = mix(${f(TOON_RAMP.dark)}, ${f(TOON_RAMP.lit)}, smoothstep(${f(TOON_THRESHOLD - TOON_RAMP.soft / 2)}, ${f(TOON_THRESHOLD + TOON_RAMP.soft / 2)}, toonL));
  diffuseBase = toonHue * toonK;
#ifdef SPECULARTERM
  specularBase = vec3(smoothstep(0.42, 0.48, dot(specularBase, vec3(0.333))));
#endif
}
#endif
`

class BomberToonPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, 'BomberToon', 200, { BOMBER_TOON: false }, true, true)
  }

  override getClassName(): string {
    return 'BomberToonPlugin'
  }

  override isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines.BOMBER_TOON = true
  }

  override getCustomCode(shaderType: string): { [pointName: string]: string } | null {
    if (shaderType !== 'fragment') return null
    // 所有光源與陰影累加完的那一行之後（default.fragment 的 lightFragment 迴圈結尾）
    return { '!aggShadow=aggShadow\\/numLights;': `$0${RAMP_GLSL}` }
  }
}

/** 替材質掛上卡通 ramp；同一個材質重複呼叫只掛一次 */
export function applyToon(material: Material): void {
  if (material.pluginManager?.getPlugin('BomberToon')) return
  new BomberToonPlugin(material)
}
