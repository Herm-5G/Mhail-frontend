const API_URL = 'https://corsproxy.io/?https://mhail.onrender.com'
const TOKEN_KEY = 'mhail_token'
const USER_KEY = 'mhail_user'

const app = document.getElementById('app')
const errBar = document.getElementById('err-bar')
window.onerror = (m, s, l) => {
  errBar.style.display = 'block'
  errBar.textContent = 'MHail error: ' + m + ' (line ' + l + ')'
}

const state = {
  user: null, socket: null,
  conversations: [], activeConvId: null,
  messages: {}, typing: {}, presence: {}, search: '',
  replyTo: null
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}
function initial(n) { return String(n || '?').trim().charAt(0).toUpperCase() }
function fmtTime(ts) {
  const d = new Date(ts), n = new Date()
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function fmtDate(ts) {
  const d = new Date(ts), n = new Date(), y = new Date(n)
  y.setDate(y.getDate() - 1)
  if (d.toDateString() === n.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtLastSeen(ts) {
  if (!ts) return 'offline'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'last seen just now'
  if (diff < 3600) return 'last seen ' + Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return 'last seen ' + Math.floor(diff / 3600) + 'h ago'
  return 'last seen ' + Math.floor(diff / 86400) + 'd ago'
}

async function api(path, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: 'Bearer ' + token }),
      ...opts.headers
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  if (!res.ok) {
    let msg = 'Request failed'
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  state.user = user
}
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  state.user = null
  if (state.socket) { state.socket.disconnect(); state.socket = null }
}

function applyTheme() {
  const t = localStorage.getItem('mhail_theme') || 'light'
  document.documentElement.setAttribute('data-theme', t)
}
applyTheme()

function connectSocket() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || state.socket) return
  const socket = io(API_URL, { auth: { token } })
  state.socket = socket

  socket.on('presence', d => {
    if (!state.presence[d.userId]) state.presence[d.userId] = {}
    state.presence[d.userId].online = d.online
    if (d.lastSeen) state.presence[d.userId].lastSeen = d.lastSeen
    if (typeof renderHeader === 'function') renderHeader()
  })
  socket.on('presence:list', ids => {
    ids.forEach(id => { state.presence[id] = { online: true } })
    if (typeof renderHeader === 'function') renderHeader()
  })

  socket.on('message:new', m => {
    const arr = state.messages[m.conversationId] || []
    if (!arr.find(x => x.id === m.id)) {
      arr.push(m)
      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      state.messages[m.conversationId] = arr
    }
    const conv = state.conversations.find(c => c.id === m.conversationId)
    if (conv) {
      conv.lastMessage = m
      if (m.senderId !== state.user.id) {
        if (m.conversationId === state.activeConvId) markRead(m.conversationId)
        else conv.unread = (conv.unread || 0) + 1
      }
    }
    if (m.conversationId === state.activeConvId) renderMessages()
    renderConversationList()
  })

  socket.on('message:edit', m => {
    const arr = state.messages[m.conversationId] || []
    const i = arr.findIndex(x => x.id === m.id)
    if (i >= 0) arr[i] = { ...arr[i], ...m }
    if (m.conversationId === state.activeConvId) renderMessages()
  })

  socket.on('message:delete', d => {
    const arr = state.messages[d.conversationId] || []
    const i = arr.findIndex(x => x.id === d.id)
    if (i >= 0) arr[i] = { ...arr[i], deletedAt: new Date().toISOString(), content: null }
    if (d.conversationId === state.activeConvId) renderMessages()
    renderConversationList()
  })

  socket.on('message:reaction', d => {
    const arr = state.messages[d.conversationId] || []
    const m = arr.find(x => x.id === d.messageId)
    if (m) { m.reactions = d.reactions; if (d.conversationId === state.activeConvId) renderMessages() }
  })

  socket.on('message:delivered', d => {
    const arr = state.messages[d.conversationId] || []
    d.ids.forEach(id => {
      const m = arr.find(x => x.id === id)
      if (m) m.deliveredAt = new Date().toISOString()
    })
    if (d.conversationId === state.activeConvId) renderMessages()
  })

  socket.on('typing', d => {
    if (!state.typing[d.conversationId]) state.typing[d.conversationId] = {}
    if (d.isTyping) state.typing[d.conversationId][d.userId] = Date.now() + 3000
    else delete state.typing[d.conversationId][d.userId]
    if (d.conversationId === state.activeConvId) renderTyping()
  })

  socket.on('conversation:new', conv => {
    if (!state.conversations.find(c => c.id === conv.id)) state.conversations.unshift(conv)
    renderConversationList()
  })
}

function markRead(convId) {
  const conv = state.conversations.find(c => c.id === convId)
  if (conv) conv.unread = 0
  api(`/api/conversations/${convId}/read`, { method: 'POST' }).catch(() => {})
}

function toast(msg) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1800)
}

function boot() {
  const token = localStorage.getItem(TOKEN_KEY)
  const stored = localStorage.getItem(USER_KEY)
  if (token && stored) {
    try {
      state.user = JSON.parse(stored)
      connectSocket()
      loadConversations().then(() => renderChat())
    } catch { clearAuth(); renderAuth() }
  } else {
    renderAuth()
  }
}
