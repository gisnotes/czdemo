import vue from '@vitejs/plugin-vue'

import createAutoImport from './auto-import'
import createSvgIcon from './svg-icon'
import createCompression from './compression'
import createSetupExtend from './setup-extend'
import createCesium from './cesium'

export default function createVitePlugins(viteEnv, isBuild = false, base = '/') {
  const vitePlugins = [vue()]
  vitePlugins.push(createAutoImport())
  vitePlugins.push(createSetupExtend())
  vitePlugins.push(createSvgIcon(isBuild))
  vitePlugins.push(...createCesium(viteEnv, isBuild, base))
  isBuild && vitePlugins.push(...createCompression(viteEnv))
  return vitePlugins
}
