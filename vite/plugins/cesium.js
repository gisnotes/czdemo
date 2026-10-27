import { viteExternalsPlugin } from 'vite-plugin-externals'
import { createHtmlPlugin } from 'vite-plugin-html'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default function createCesium(viteEnv, isBuild = false, base = '/') {
  const cesiumBaseUrl = viteEnv['VITE_CESIUM_BASE_URL']
  const plugins = [
    // 外部化 cesium 依赖，之后全局访问形式是 window['Cesium']
    viteExternalsPlugin({
      cesium: 'Cesium'
    }),
    createHtmlPlugin({
      minify: isBuild,
      inject: {
        // 生产构建使用 CDN 链接，开发模式用拷贝的库文件，根据 VITE_CESIUM_BASE_URL 自动拼接
        tags: [
          {
            tag: 'link',
            attrs: {
              rel: 'stylesheet',
              href: isBuild
                ? `${cesiumBaseUrl}Widgets/widgets.css`
                : `${base}${cesiumBaseUrl}Widgets/widgets.css`
            },
            injectTo: 'head'
          },
          {
            tag: 'script',
            attrs: {
              src: isBuild
                ? `${cesiumBaseUrl}Cesium.js`
                : `${base}${cesiumBaseUrl}Cesium.js`
            },
            injectTo: 'head'
          },
          {
            tag: 'script',
            children: `window.CESIUM_BASE_URL = "${isBuild ? cesiumBaseUrl : `${base}${cesiumBaseUrl}`}";`,
            injectTo: 'head-prepend'
          }
        ]
      }
    })
  ]

  if (!isBuild) {
    // 开发模式，复制 node_modules 下的 cesium 依赖
    const cesiumLibraryRoot = 'node_modules/cesium/Build/CesiumUnminified/'
    const cesiumLibraryCopyToRootPath = 'libs/cesium/' // 相对于打包后的路径
    const cesiumStaticSourceCopyOptions = [
      'Assets',
      'ThirdParty',
      'Workers',
      'Widgets'
    ].map((dirName) => {
      return {
        src: `${cesiumLibraryRoot}${dirName}/*`, // 文件夹全量复制
        dest: `${cesiumLibraryCopyToRootPath}${dirName}`
      }
    })
    plugins.push(
      viteStaticCopy({
        targets: [
          // 主库文件，开发时选用非压缩版的 IIFE 格式主库文件
          {
            src: `${cesiumLibraryRoot}Cesium.js`,
            dest: cesiumLibraryCopyToRootPath
          },
          // 四大静态文件夹
          ...cesiumStaticSourceCopyOptions
        ]
      })
    )
  }

  return plugins
}
