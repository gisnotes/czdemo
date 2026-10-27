import menuRoutes from '@/menu'

// 获取路由（直接读取 src/menu 目录下的菜单配置）
export const getRouters = () => {
  return Promise.resolve({
    code: 200,
    msg: '操作成功',
    data: menuRoutes
  })
}
