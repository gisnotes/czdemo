import defAva from '@/assets/logo/avatar.png'

// 登录方法（纯前端免登录模式）
export function login(username, password, code, uuid) {
  return Promise.resolve({
    code: 200,
    msg: '登录成功',
    token: 'admin-local-token'
  })
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
  return Promise.resolve({
    code: 200,
    msg: '操作成功',
    permissions: ['*:*:*'],
    roles: ['admin'],
    user: {
      userId: 1,
      userName: 'admin',
      nickName: '不如吃茶去',
      avatar: defAva,
      email: 'cesium@local.dev',
      phonenumber: '15888888888',
      sex: '1'
    },
    pwdChrtype: '0',
    isDefaultModifyPwd: false,
    isPasswordExpired: false
  })
}

// 退出方法
export function logout() {
  return Promise.resolve({
    code: 200,
    msg: '退出成功'
  })
}

// 获取验证码（纯前端禁用验证码）
export function getCodeImg() {
  return Promise.resolve({
    code: 200,
    msg: '操作成功',
    captchaEnabled: false
  })
}
