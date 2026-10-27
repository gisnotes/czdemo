import {
  mockLogin,
  mockGetInfo,
  mockLogout,
  mockGetCodeImg,
  mockUnlockScreen
} from '@/mock'

// 登录方法（纯前端本地登录）
export function login(username, password, code, uuid) {
  return mockLogin(username, password)
}

// 注册方法
export function register(data) {
  return Promise.resolve({
    code: 200,
    msg: '注册成功'
  })
}

// 获取用户详细信息（纯前端直接返回用户信息与超管权限）
export function getInfo() {
  return mockGetInfo()
}

// 解锁屏幕
export function unlockScreen(password) {
  return mockUnlockScreen(password)
}

// 退出方法
export function logout() {
  return mockLogout()
}

// 获取验证码（纯前端禁用验证码）
export function getCodeImg() {
  return mockGetCodeImg()
}
