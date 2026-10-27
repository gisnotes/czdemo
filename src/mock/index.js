import { mockRoutes } from './menuData'

/**
 * 纯前端本地登录模拟
 * 默认账号：admin
 * 默认密码：admin123
 * 纯前端模式下输入任意非空账号密码均可登录
 */
export function mockLogin(username, password) {
  return new Promise((resolve, reject) => {
    if (!username || !password) {
      reject(new Error('请输入账号和密码'))
      return
    }
    // 模拟成功返回 token
    resolve({
      code: 200,
      msg: '登录成功',
      token: 'admin-mock-token-' + Date.now()
    })
  })
}

/**
 * 获取当前登录用户信息模拟（超管权限，具备全部操作权限与路由加载权限）
 */
export function mockGetInfo() {
  return Promise.resolve({
    code: 200,
    msg: '操作成功',
    permissions: ['*:*:*'],
    roles: ['admin'],
    user: {
      userId: 1,
      userName: 'admin',
      nickName: 'Cesium 开发者',
      avatar: '',
      email: 'admin@cesium.dev',
      phonenumber: '15888888888',
      sex: '1'
    },
    pwdChrtype: '0',
    isDefaultModifyPwd: false,
    isPasswordExpired: false
  })
}

/**
 * 退出登录模拟
 */
export function mockLogout() {
  return Promise.resolve({
    code: 200,
    msg: '退出成功'
  })
}

/**
 * 验证码接口模拟（纯前端关闭验证码）
 */
export function mockGetCodeImg() {
  return Promise.resolve({
    code: 200,
    msg: '操作成功',
    captchaEnabled: false
  })
}

/**
 * 锁屏解锁模拟
 */
export function mockUnlockScreen(password) {
  return new Promise((resolve, reject) => {
    if (!password) {
      reject(new Error('请输入密码'))
      return
    }
    resolve({
      code: 200,
      msg: '解锁成功'
    })
  })
}

/**
 * 获取系统路由菜单模拟
 */
export function mockGetRouters() {
  return Promise.resolve({
    code: 200,
    msg: '操作成功',
    data: mockRoutes
  })
}
