async function loadConversations() {
  try {
    state.conversations = await api('/api/conversations')
  } catch (e) {
    console.error('Load convs:', e)
    state.conversations = []
  }
}

function renderChat() {
  if (!state.user) return renderAuth()
  app.innerHTML = `
    <div class="chat-wrap">
      <aside class="sidebar">
        <div class="me">
          <div class="avatar">${initial(state.user.displayName)}</div>
          <div class="me-info">
            <div class="name">${esc(state.user.displayName)}</div>
            <div class="username">@${esc(state.user.username)}</div>
          </div>
          <button class="icon-btn" id="btn-new-group" title="New group">👥</button>
          <button class="icon-btn" id="btn-settings" title="Settings">⚙️</button>
        </div>
        <div class="search-row"><input id="search" placeholder="Search users by username" value="${esc(state.search)}"></div>
        <div class="actions-row"><button class="btn-primary" id="btn-new-chat">+ New chat</button></div>
        <div class="sidebar-scroll">
          <div class="label" id="res-label" style="display:none">Results</div>
          <ul class="list" id="res"></ul>
          <div class="label">Chats</div>
          <ul class="list" id="convs"></ul>
        </div>
      </aside>
      <main class="chat" id="chat-main">
        <div class="chat-empty" id="chat-empty">
          <div class="big">💬</div>
          <h2>Welcome to MHail</h2>
          <p>Search a username or start a new chat. Your messages sync instantly across devices.</p>
        </div>
        <div id="chat-active" style="display:none;flex:1;flex-direction:column;min-height:0">
          <div class="chat-header" id="chat-header">
            <button id="back-btn">←</button>
            <div class="avatar" id="c-avatar">?</div>
            <div>
              <div class="name" id="c-name"></div>
              <div class="sub" id="c-sub"></div>
            </div>
            <div class="prem-actions" style="display:flex;gap:4px;margin-left:auto">
              <button class="icon-btn" id="btn-search-chat" title="Search in chat">🔍</button>
              <button class="icon-btn" id="btn-wallpaper" title="Wallpaper">🎨</button>
              <button class="icon-btn" id="btn-theme" title="Toggle theme">🌙</button>
            </div>
          </div>
          <div class="messages" id="msgs"></div>
          <div class="typing-ind" id="typing-ind"></div>
          <div class="reply-banner" id="reply-banner">
            <div class="rb-body"><div class="rb-name"></div><div class="rb-text"></div></div>
            <button class="rb-close" id="rb-close">✕</button>
          </div>
          <form class="composer" id="composer">
            <input id="msg-in" placeholder="Type a message" autocomplete="off">
            <button type="submit">➤</button>
          </form>
        </div>
      </main>
    </div>`

  // Sidebar wiring
  app.querySelector('#search').oninput = e => {
    state.search = e.target.value
    updateSearchResults()
  }
  app.querySelector('#btn-new-chat').onclick = () => {
    app.querySelector('#search').focus()
    toast('Type a username to find someone')
  }
  app.querySelector('#btn-new-group').onclick = openGroupCreator
  app.querySelector('#btn-settings').onclick = openSettings

  // Chat panel wiring
  app.querySelector('#back-btn').onclick = () => {
    document.body.classList.remove('chat-open')
    state.activeConvId = null
    renderConversationList()
    renderChatPanel()
  }
  app.querySelector('#rb-close').onclick = clearReply
  const mi = app.querySelector('#msg-in')
  mi.oninput = () => {
    if (!state.activeConvId) return
    if (state.socket) state.socket.emit('typing', { conversationId: state.activeConvId, isTyping: true })
    clearTimeout(mi._t)
    mi._t = setTimeout(() => {
      if (state.socket) state.socket.emit('typing', { conversationId: state.activeConvId, isTyping: false })
    }, 1500)
  }
  app.querySelector('#composer').onsubmit = e => {
    e.preventDefault()
    const t = mi.value.trim()
    if (!t || !state.activeConvId) return
    state.socket.emit('message:send', {
      conversationId: state.activeConvId,
      content: t,
      replyToId: state.replyTo?.id || null
    })
    mi.value = ''
    clearReply()
  }

  // Header buttons (also re-wired by premium.js for consistency)
  app.querySelector('#btn-theme').onclick = toggleTheme
  app.querySelector('#btn-search-chat').onclick = openChatSearch
  app.querySelector('#btn-wallpaper').onclick = openWallpaperPicker

  updateSearchResults()
  renderConversationList()
  renderChatPanel()
  applyWallpaper()
}

function renderConversationList() {
  const el = document.getElementById('convs')
  if (!el) return
  const me = state.user
  const sorted = state.conversations.slice().sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (b.pinned && !a.pinned) return 1
    const at = a.lastMessage?.createdAt || a.createdAt
    const bt = b.lastMessage?.createdAt || b.createdAt
    return new Date(bt) - new Date(at)
  })
  const visible = sorted.filter(c => !c.archived)
  if (!visible.length) {
    el.innerHTML = '<div class="empty">No chats yet. Search someone above.</div>'
    return
  }
  el.innerHTML = visible.map(c => {
    const other = c.others?.[0] || {}
    const display = c.isGroup ? (c.name || 'Group') : (other.displayName || 'Unknown')
    const preview = c.lastMessage
      ? (c.lastMessage.deletedAt ? '🚫 message deleted' : (c.lastMessage.senderId === me.id ? 'You: ' : '') + (c.lastMessage.content || ''))
      : 'No messages yet'
    const t = c.lastMessage ? fmtTime(c.lastMessage.createdAt) : ''
    const pin = c.pinned ? '<div class="pin-tag">📌</div>' : ''
    return `<li data-conv="${c.id}" class="${c.id === state.activeConvId ? 'active' : ''}">
      ${pin}
      <div class="avatar">${initial(display)}</div>
      <div class="info">
        <div class="name">${esc(display)}</div>
        <div class="preview">${esc(preview)}</div>
      </div>
      <div class="right-col">
        <div class="time">${t}</div>
        ${c.unread > 0 ? `<div class="badge">${c.unread}</div>` : ''}
      </div>
    </li>`
  }).join('')
  el.querySelectorAll('li[data-conv]').forEach(li => {
    li.onclick = () => openConvById(li.dataset.conv)
  })
}

function renderChatPanel() {
  const empty = document.getElementById('chat-empty')
  const active = document.getElementById('chat-active')
  if (!empty || !active) return
  if (!state.activeConvId) {
    empty.style.display = 'block'
    active.style.display = 'none'
    document.body.classList.remove('chat-open')
    return
  }
  const conv = state.conversations.find(c => c.id === state.activeConvId)
  if (!conv) { state.activeConvId = null; return renderChatPanel() }
  empty.style.display = 'none'
  active.style.display = 'flex'
  document.body.classList.add('chat-open')
  document.getElementById('c-avatar').textContent = initial(conv.isGroup ? conv.name : conv.others?.[0]?.displayName)
  document.getElementById('c-name').textContent = conv.isGroup ? conv.name : (conv.others?.[0]?.displayName || 'Chat')
  renderHeader()
  renderMessages()
  renderTyping()
}

function renderHeader() {
  const conv = state.conversations.find(c => c.id === state.activeConvId)
  if (!conv) return
  const subEl = document.getElementById('c-sub')
  if (!subEl) return
  if (conv.isGroup) {
    subEl.textContent = `${conv.participants.length} members`
    subEl.className = 'sub'
    return
  }
  const other = conv.others?.[0]
  if (!other) return
  const p = state.presence[other.id]
  if (p?.online) { subEl.textContent = 'online'; subEl.className = 'sub status-online' }
  else { subEl.textContent = fmtLastSeen(p?.lastSeen || other.lastSeen); subEl.className = 'sub' }
}

async function openConvById(convId) {
  state.activeConvId = convId
  document.body.classList.add('chat-open')
  const conv = state.conversations.find(c => c.id === convId)
  if (conv) conv.unread = 0
  renderConversationList()
  renderChatPanel()
  markRead(convId)
  if (state.socket) state.socket.emit('conversation:join', { conversationId: convId })
  try {
    const ms = await api(`/api/conversations/${convId}/messages`)
    state.messages[convId] = ms
    renderMessages()
    // Ack deliveries
    const undelivered = ms.filter(m => m.senderId !== state.user.id && !m.deliveredAt).map(m => m.id)
    if (undelivered.length) api('/api/messages/delivered', { method: 'POST', body: { ids: undelivered } }).catch(() => {})
  } catch (e) { toast(e.message) }
}

async function updateSearchResults() {
  const q = state.search.trim().toLowerCase()
  const res = document.getElementById('res')
  const lab = document.getElementById('res-label')
  if (!res) return
  if (!q) { res.innerHTML = ''; lab.style.display = 'none'; return }
  try {
    const users = await api('/api/users/search?q=' + encodeURIComponent(q))
    lab.style.display = users.length ? 'block' : 'none'
    res.innerHTML = users.length
      ? users.map(u => `<li data-uid="${u.id}">
          <div class="avatar">${initial(u.displayName)}</div>
          <div class="info"><div class="name">${esc(u.displayName)}</div><div class="preview">@${esc(u.username)}</div></div>
        </li>`).join('')
      : '<div class="empty">No users found</div>'
    res.querySelectorAll('li[data-uid]').forEach(li => {
      li.onclick = () => startDM(li.dataset.uid)
    })
  } catch (e) {
    res.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'
  }
}

async function startDM(userId) {
  try {
    const conv = await api('/api/conversations', { method: 'POST', body: { userId } })
    if (!state.conversations.find(c => c.id === conv.id)) state.conversations.unshift(conv)
    state.search = ''
    document.getElementById('search').value = ''
    renderConversationList()
    updateSearchResults()
    openConvById(conv.id)
  } catch (e) { toast(e.message) }
}

function setReply(msg) {
  state.replyTo = msg
  const banner = document.getElementById('reply-banner')
  if (!banner) return
  const senderName = msg.senderId === state.user.id ? 'You' : (msg.sender?.displayName || 'Unknown')
  banner.querySelector('.rb-name').textContent = senderName
  banner.querySelector('.rb-text').textContent = msg.content || '[deleted]'
  banner.classList.add('show')
  document.getElementById('msg-in')?.focus()
}
function clearReply() {
  state.replyTo = null
  document.getElementById('reply-banner')?.classList.remove('show')
}