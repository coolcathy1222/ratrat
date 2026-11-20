const shared = wx.getSharedCanvas()
const ctx = shared.getContext('2d')

function paint(rows, width) {
  const w = width || shared.width || 600
  const h = shared.height || 680
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#353E50'
  ctx.font = '28px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (!rows.length) {
    ctx.fillStyle = '#73665B'
    ctx.textAlign = 'center'
    ctx.fillText('还没有好友成绩', w / 2, 48)
    return
  }
  rows.forEach((row, index) => {
    const y = 36 + index * 72
    ctx.fillStyle = '#FFF7E7'
    round(16, y - 26, w - 32, 60, 16)
    ctx.fill()
    ctx.fillStyle = '#353E50'
    ctx.textAlign = 'left'
    ctx.fillText(`${index + 1}  ${row.name}`, 36, y)
    ctx.textAlign = 'right'
    ctx.fillText(String(row.score), w - 36, y)
  })
}

function round(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function scoreOf(user, kind, today) {
  const kv = {}
  ;(user.KVDataList || []).forEach((item) => {
    kv[item.key] = item.value
  })
  if (kind === 'daily') return kv.date === today ? Number(kv.daily) || 0 : 0
  return Number(kv.total) || 0
}

wx.onMessage((message) => {
  if (!message || message.type !== 'rank') return
  const kind = message.kind === 'daily' ? 'daily' : 'total'
  const today = message.today || ''
  wx.getFriendCloudStorage({
    keyList: ['total', 'daily', 'date'],
    success(res) {
      const rows = (res.data || [])
        .map((user) => ({
          name: user.nickname || '好友',
          score: scoreOf(user, kind, today),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
      paint(rows, shared.width)
    },
    fail() {
      paint([], shared.width)
    },
  })
})
