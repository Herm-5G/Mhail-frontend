function renderMessages() {
  const el = document.getElementById('msgs')
  if (!el) return
  const me = state.user
  const convId = state.activeConvId
  const ms = (state.messages[convId] || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const conv = state.conversations.find(c => c.id === convId)
  const isGroup = conv?.isGroup

  if (!ms.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:13px;margin-top:40px">No messages yet. Say hi 👋</div>'
    return
  }

  let lastDate = '', prevSender = ''
  el.innerHTML = ms.map(m => {
    const d = new Date(m.createdAt)
    const dateKey = d.toDateString()
    let sep = ''
    if (dateKey !== lastDate) { lastDate = dateKey; sep = `<div class="date-sep"><span>${esc(fmtDate(d))}</span></div>` }
    const isMe = m.senderId === me.id
    const isFirstOfRun = prevSender !== m.senderId
    prevSender = m.senderId
    const tail = isFirstOfRun ? 'tail' : ''

    let tick = ''
    if (isMe && !m.deletedAt) {
      if (m.deliveredAt) tick = '<span class="tick read">✓✓</span>'
      else tick = '<span class="tick">✓</span>'
    }

    let quote = ''
    if (m.replyToId) {
      const orig = ms.find(x => x.id === m.replyToId)
      const qName = orig ? (orig.senderId === me.id ? 'You' : (orig.sender?.displayName || 'Unknown')) : ''
      const qText = orig ? (orig.deletedAt ? '[deleted]' : (orig.content || '')) : '[message not loaded]'
      quote = `<div class="reply-quote"><div class="qname">${esc(qName)}</div><div class="qtext">${esc(String(qText).slice(0, 60))}</div></div>`
    }

    let react = ''
    if (m.reactions && m.reactions.length) {
      const grouped = {}
      m.reactions.forEach(r => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1 })
      react = '<div class="reactions">' + Object.entries(grouped).map(([e, c]) =>
        `<span class="r">${e}${c > 1 ? `<span class="cnt">${c}</span>` : ''}</span>`
      ).join('') + '</div>'
    }

    const cls = 'bubble ' + (m.deletedAt ? 'deleted ' : '') + tail
    const content = m.deletedAt ? '<span class="content">This message was deleted</span>' : `<span class="content">${esc(m.content || '')}</span>`
    const edit = m.editedAt && !m.deletedAt ? ' <em>edited</em>' : ''
    const senderLabel = (!isMe && isFirstOfRun && isGroup && !m.deletedAt)
      ? `<div class="sender">${esc(m.sender?.displayName || '')}</div>` : ''

    return sep + `<div class="msg-row ${isMe ? 'me' : 'them'}" data-mid="${m.id}"><div class="${cls}">${senderLabel}${quote}${content}${edit}<span class="time">${fmtTime(m.createdAt)}${tick}</span>${react}</div></div>`
  }).join('')
  el.scrollTop = el.scrollHeight
}

function renderTyping() {
  const el = document.getElementById('typing-ind')
  if (!el) return
  if (!state.activeConvId) { el.style.display = 'none'; return }
  const t = state.typing[state.activeConvId]
  if (!t) { el.style.display = 'none'; return }
  const userIds = Object.keys(t).filter(k => t[k] > Date.now() && k !== state.user.id)
  if (!userIds.length) { el.style.display = 'none'; return }
  const conv = state.conversations.find(c => c.id === state.activeConvId)
  const names = userIds.map(id => {
    const p = conv?.participants?.find(x => x.id === id)
    return p?.displayName || 'Someone'
  })
  el.innerHTML = `${esc(names.join(', '))} is typing<span class="dots">…</span>`
  el.style.display = 'block'
  clearTimeout(window._typingHide)
  window._typingHide = setTimeout(() => { el.style.display = 'none' }, 3500)
}