/**
 * 道具代幣共用一組 thin instance（AC10 省 draw call）：每個實例帶一個浮點屬性 `tankItemIcon`（道具序 0..4），
 * 掛在 StandardMaterial 上的 material plugin 把整顆代幣的 uv.x 平移到圖集裡那一欄（圖示與外殼色都在同一欄）。
 * 5 種道具因此只算 1 個 mesh：主畫面、描邊、陰影、Glow 各 1 次，而不是各 5 次。
 */
import { MaterialPluginBase, ShaderLanguage, type Material, type MaterialDefines } from '@/babylon/babylonCore'
import { ITEM_ORDER } from '@/babylon/games/tankFx/palette'

/** 實例屬性名（thinInstanceSetBuffer 的 kind） */
export const ITEM_ICON_ATTR = 'tankItemIcon'

/** 圖集一欄一種道具（textures.ts 的 createItemAtlas 同序）；getCustomCode 在 super() 內就會被呼叫，不能放實例欄位 */
const STEP = (1 / ITEM_ORDER.length).toFixed(6)

class ItemIconPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, 'TankItemIcon', 210, { TANK_ITEMICON: false }, true, true)
  }

  override getClassName(): string {
    return 'TankItemIconPlugin'
  }

  override isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines.TANK_ITEMICON = true
  }

  override getAttributes(attributes: string[]): void {
    attributes.push(ITEM_ICON_ATTR)
  }

  override getCustomCode(shaderType: string): { [pointName: string]: string } | null {
    if (shaderType !== 'vertex') return null
    return {
      CUSTOM_VERTEX_DEFINITIONS: `#ifdef TANK_ITEMICON\nattribute float ${ITEM_ICON_ATTR};\n#endif`,
      CUSTOM_VERTEX_UPDATE_POSITION: `#if defined(TANK_ITEMICON) && defined(UV1)\nuvUpdated.x += ${ITEM_ICON_ATTR} * ${STEP};\n#endif`,
    }
  }
}

/** 替材質掛上「依實例換圖集欄」 */
export function applyItemIcon(material: Material): void {
  if (material.pluginManager?.getPlugin('TankItemIcon')) return
  new ItemIconPlugin(material)
}
