// 首页顶部公告列表（带已读状态）
export function listNoticeTop() {
  return Promise.resolve({
    code: 200,
    msg: '操作成功',
    data: [
      {
        noticeId: 1,
        noticeTitle: 'Cesium 纯前端分支已就绪',
        noticeType: '2',
        createTime: '2026-10-27',
        isRead: false
      }
    ],
    unreadCount: 1
  })
}

// 查询公告详细
export function getNotice(noticeId) {
  return Promise.resolve({
    code: 200,
    data: {
      noticeId: 1,
      noticeTitle: 'Cesium 纯前端分支已就绪',
      noticeType: '2',
      noticeContent: '<p>欢迎使用 Cesium 纯前端案例开发分支！当前已配置本地免后台登录、动态路由与示例页面。</p>',
      createTime: '2026-10-27'
    }
  })
}

// 标记公告已读
export function markNoticeRead(noticeId) {
  return Promise.resolve({ code: 200 })
}

// 批量标记已读
export function markNoticeReadAll(ids) {
  return Promise.resolve({ code: 200 })
}

// 查询公告列表
export function listNotice(query) {
  return Promise.resolve({
    code: 200,
    rows: [],
    total: 0
  })
}

// 新增公告
export function addNotice(data) {
  return Promise.resolve({ code: 200, msg: '新增成功' })
}

// 修改公告
export function updateNotice(data) {
  return Promise.resolve({ code: 200, msg: '修改成功' })
}

// 删除公告
export function delNotice(noticeId) {
  return Promise.resolve({ code: 200, msg: '删除成功' })
}

// 查询公告已读用户列表
export function listNoticeReadUsers(query) {
  return Promise.resolve({
    code: 200,
    rows: [],
    total: 0
  })
}
