import router from './router'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { isHttp } from '@/utils/validate'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'

NProgress.configure({ showSpinner: false })

router.beforeEach(async (to, from) => {
  NProgress.start()

  // 纯前端模式：如果访问登录页，直接跳转到首页
  if (to.path === '/login') {
    NProgress.done()
    return { path: '/' }
  }

  to.meta.title && useSettingsStore().setTitle(to.meta.title)

  // 若尚未加载用户权限与动态路由，则自动初始化
  if (useUserStore().roles.length === 0) {
    try {
      // 1. 初始化本地用户信息（超管权限）
      await useUserStore().getInfo()
      // 2. 根据本地配置生成可访问的路由（如 Cesium 案例菜单）
      const accessRoutes = await usePermissionStore().generateRoutes()
      accessRoutes.forEach(route => {
        if (!isHttp(route.path)) {
          router.addRoute(route)
        }
      })
      // 3. 重新导航到目标路由，确保动态路由已注册生效
      return { ...to, replace: true }
    } catch (err) {
      ElMessage.error(err.message || '初始化本地路由失败')
      return { path: '/' }
    }
  }

  return true
})

router.afterEach(() => {
  NProgress.done()
})
