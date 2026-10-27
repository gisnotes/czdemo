/**
 * 菜单路由配置中心
 * 后续新增 Cesium 案例时，只需在此数组中添加一项，并在 src/views/cesium/ 创建对应的 .vue 页面即可
 */
export const menuRoutes = [
  {
    name: 'Cesium',
    path: '/cesium',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: {
      title: 'Cesium 案例',
      icon: 'guide',
      noCache: false,
      link: null
    },
    children: [
      {
        name: 'CesiumDemo1',
        path: 'demo1',
        hidden: false,
        component: 'cesium/demo1/index',
        meta: {
          title: '地球基础展示',
          icon: 'international',
          noCache: false,
          link: null
        }
      }
    ]
  }
]

export default menuRoutes
