/**
 * 菜单路由配置中心
 * 目录规范：
 * - 一级目录对应 src/views/cesium/<一级目录>/（component: 'Layout'）
 * - 若存在二级分类目录（包含三级子菜单），中间层路由设置 component: 'ParentView'
 * - 最终示例页面统一命名为对应目录下的 index.vue，例如 component: 'cesium/simple/globe-color/index'
 */
export const menuRoutes = [
  {
    name: 'SimpleExample',
    path: '/simple',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: {
      title: '简单示例',
      icon: 'guide',
      noCache: false,
      link: null
    },
    children: [
      {
        name: 'GlobeColor',
        path: 'globe-color',
        hidden: false,
        component: 'cesium/simple/globe-color/index',
        meta: {
          title: '更改地球颜色',
          icon: 'international',
          noCache: false,
          link: null
        }
      }
    ]
  }
]

export default menuRoutes
