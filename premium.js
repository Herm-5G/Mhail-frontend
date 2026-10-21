// Theme
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light'
  const next = cur === 'dark' ? 'light' : 'dark'
  localStorage.setItem('mhail_theme', next)
  document.documentElement.setAttribute('data-theme', next)
  toast(next === 'dark' ? '🌙 Dark mode' : '☀️ Light mode')
}

// Wallpaper
const WALLPAPERS = {
  default: '',
  green: 'linear-gradient(135deg,#0b4a3e,#075e54,#128c7e)',
  sunset: 'linear-gradient(135deg,#ff7e5f,#feb47b)',
  ocean: 'linear-gradient(135deg,#2193b0,#6dd5ed)',
  purple: 'linear-gradient(135deg,#3a1c71,#d76d77,#ffaf7b)',
  dark: 'linear-gradient(135deg,#0a1014,#1a1a2e,#16213e)'
}
function applyWallpaper() {
  const k = localStorage.getItem('mhail_wallpaper') || 'default'
  const wp = WALLPAPERS[k]
  const el = document.querySelector('.chat')
  if (!el) return
  if (wp && wp.startsWith('linear-gradient')) {
    el.style.backgroundImage = wp
    el.style.backgroundSize = 'cover'
  } else if (wp) {
    el.style.backgroundImage = ''
    el.style.background = wp
  } else {
    el.style.backgroundImage = ''
    el.style.background = ''
  }
}
function openWallpaperPicker() {
  const ov = document.createElement('div')
  ov.className = 'modal-overlay'
  const cur = localStorage.getItem('mhail_wallpaper') || 'default'
  ov.innerHTML = `<div class="modal">
    <h2>🎨 Wallpaper</h2>
    <div class="wallpaper-grid">
      ${Object.keys(WALLPAPERS).map(k => `<div class="wp-option" data-wp="${k}" style="background:${WALLPAPERS[k] || 'var(--chat-bg)'};border-color:${k === cur ? 'var(--green)' : 'transparent'}"></div>`).join('')}
    </div>
    <div class="modal-actions"><button class="btn-secondary" id="wp-close">Close</button></div>
  </div>`
  document.body.appendChild(ov)
  ov.querySelector('#wp-close').onclick = () => ov.remove()
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  ov.querySelectorAll('[data-wp]').forEach(o => {
    o.onclick = () => {
      localStorage.setItem('mhail_wallpaper', o.dataset.wp)
      applyWallpaper()
      ov.querySelectorAll('.wp-option').forEach(x => x.style.borderColor = 'transparent')
      o.style.borderColor = 'var(--green)'
      toast('Wallpaper applied')
    }
  })
}

// In-chat search
function openChatSearch() {
  const convId = state.activeConvId
  if (!convId) return
  const ov = document.createElement('div')
  ov.className = 'search-overlay'
  ov.innerHTML = `<div class="sr-head">
    <button class="icon-btn" id="sr-close">←</button>
    <input id="sr-q" placeholder="Search in this chat" autofocus>
  </div><div class="sr-results" id="sr-res"></div>`
  document.body.appendChild(ov)
  const q = ov.querySelector('#sr-q'), res = ov.querySelector('#sr-res')
  ov.querySelector('#sr-close').onclick = () => ov.remove()
  q.focus()
  q.oninput = () => {
    const term = q.value.trim().toLowerCase()
    if (!term) { res.innerHTML = ''; return }
    const hits = (state.messages[convId] || []).filter(m => !m.deletedAt && (m.content || '').toLowerCase().includes(term))
    res.innerHTML = hits.length ? hits.map(m => {
      const name = m.senderId === state.user.id ? 'You' : (m.sender?.displayName || 'Unknown')
      return `<div class="sr-hit" data-mid="${m.id}"><div class="sr-name">${esc(name)}</div><div class="sr-text">${esc(m.content || '')}</div><div class="sr-time">${fmtDate(m.createdAt)} ${fmtTime(m.createdAt)}</div></div>`
    }).join('') : '<div style="padding:20px;text-align:center;color:var(--text2)">No messages found</div>'
    res.querySelectorAll('.sr-hit').forEach(h => {
      h.onclick = () => {
        ov.remove()
        const row = document.querySelector(`[data-mid="${h.dataset.mid}"]`)
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' })
          row.querySelector('.bubble').style.outline = '2px solid var(--green)'
          setTimeout(() => row.querySelector('.bubble').style.outline = '', 1500)
        }
      }
    })
  }
}

// Message context menu
const PICKER = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉']
function openMessageMenu(mid) {
  const convId = state.activeConvId
  const msg = (state.messages[convId] || []).find(m => m.id === mid)
  if (!msg || msg.deletedAt) return
  const isMine = msg.senderId === state.user.id
  const ov = document.createElement('div')
  ov.className = 'msg-menu-overlay'
  ov.innerHTML = `<div class="msg-menu">
    <div class="emoji-row">${PICKER.map(e => `<button data-emoji="${e}">${e}</button>`).join('')}</div>
    <button class="mi" data-act="reply">↩️ Reply</button>
    <button class="mi" data-act="star">${msg.starred ? '⭐ Unstar' : '⭐ Star'}</button>
    ${isMine ? '<button class="mi" data-act="edit">✏️ Edit</button>' : ''}
    ${isMine ? '<button class="mi danger" data-act="delete">🗑️ Delete</button>' : ''}
    <button class="mi" data-act="cancel">Cancel</button>
  </div>`
  document.body.appendChild(ov)
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  ov.querySelectorAll('[data-emoji]').forEach(b => {
    b.onclick = async () => {
      try { await api(`/api/messages/${mid}/react`, { method: 'POST', body: { emoji: b.dataset.emoji } }) } catch (e) { toast(e.message) }
      ov.remove()
    }
  })
  ov.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = async () => {
      const act = b.dataset.act
      ov.remove()
      if (act === 'cancel') return
      if (act === 'reply') { setReply(msg); return }
      if (act === 'star') {
        try { const r = await api(`/api/messages/${mid}/star`, { method: 'POST' }); msg.starred = r.starred; toast(r.starred ? '⭐ Starred' : 'Unstarred') } catch (e) { toast(e.message) }
        return
      }
      if (act === 'edit') {
        const nc = prompt('Edit message:', msg.content || '')
        if (!nc || nc === msg.content) return
        try { await api(`/api/messages/${mid}`, { method: 'PATCH', body: { content: nc } }) } catch (e) { toast(e.message) }
        return
      }
      if (act === 'delete') {
        if (!confirm('Delete this message?')) return
        try { await api(`/api/messages/${mid}`, { method: 'DELETE' }) } catch (e) { toast(e.message) }
      }
    }
  })
}

// Long press / right-click on messages
document.addEventListener('contextmenu', e => {
  const b = e.target.closest('.bubble'); if (!b) return
  const row = b.closest('.msg-row'); if (!row) return
  e.preventDefault()
  openMessageMenu(row.dataset.mid)
})
let _pt = null
document.addEventListener('touchstart', e => {
  const b = e.target.closest('.bubble'); if (!b) return
  const row = b.closest('.msg-row'); if (!row) return
  _pt = setTimeout(() => { openMessageMenu(row.dataset.mid); _pt = null }, 500)
}, { passive: true })
document.addEventListener('touchend', () => { if (_pt) { clearTimeout(_pt); _pt = null } })
document.addEventListener('touchmove', () => { if (_pt) { clearTimeout(_pt); _pt = null } })

// Conversation context menu (pin/archive)
document.addEventListener('contextmenu', e => {
  const li = e.target.closest('li[data-conv]'); if (!li) return
  const convId = li.dataset.conv
  const conv = state.conversations.find(c => c.id === convId)
  if (!conv) return
  e.preventDefault()
  const ov = document.createElement('div')
  ov.className = 'msg-menu-overlay'
  ov.innerHTML = `<div class="msg-menu">
    <button class="mi" data-act="pin">${conv.pinned ? '📌 Unpin' : '📌 Pin chat'}</button>
    <button class="mi" data-act="archive">${conv.archived ? '📥 Unarchive' : '📥 Archive'}</button>
    <button class="mi" data-act="cancel">Cancel</button>
  </div>`
  document.body.appendChild(ov)
  ov.onclick = ev => { if (ev.target === ov) ov.remove() }
  ov.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = async () => {
      const act = b.dataset.act; ov.remove()
      if (act === 'cancel') return
      try {
        if (act === 'pin') { await api(`/api/conversations/${convId}/pin`, { method: 'POST', body: { pinned: !conv.pinned } }); conv.pinned = !conv.pinned; toast(conv.pinned ? 'Pinned' : 'Unpinned') }
        else { await api(`/api/conversations/${convId}/archive`, { method: 'POST', body: { archived: !conv.archived } }); conv.archived = !conv.archived; toast(conv.archived ? 'Archived' : 'Unarchived') }
        renderConversationList()
      } catch (e) { toast(e.message) }
    }
  })
})

// Persist last wallpaper on boot
setTimeout(applyWallpaper, 300)