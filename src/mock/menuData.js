// 纯前端模式 - 动态路由与菜单配置
// 如需添加新的 Cesium 案例：在此数组中添加一项，并在 src/views/cesium/ 创建对应的 .vue 文件即可
export const mockRoutes = [
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
