async function openGroupCreator() {
  const ov = document.createElement('div')
  ov.className = 'modal-overlay'
  ov.innerHTML = `
    <div class="modal">
      <h2>New group</h2>
      <input id="g-name" placeholder="Group name" maxlength="40">
      <input id="g-search" placeholder="Search users to add…" style="margin-top:8px">
      <div id="g-results" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px"></div>
      <div id="g-chosen" class="chosen"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="g-cancel">Cancel</button>
        <button class="btn-primary" id="g-create">Create group</button>
      </div>
    </div>`
  document.body.appendChild(ov)
  const chosen = new Map()
  const resultsEl = ov.querySelector('#g-results')
  const chosenEl = ov.querySelector('#g-chosen')

  const renderChosen = () => {
    chosenEl.innerHTML = Array.from(chosen.values()).map(u =>
      `<span class="chip">${esc(u.displayName)} <button data-uid="${u.id}">✕</button></span>`
    ).join('')
    chosenEl.querySelectorAll('button[data-uid]').forEach(b => {
      b.onclick = () => { chosen.delete(b.dataset.uid); renderChosen() }
    })
  }

  const doSearch = async () => {
    const q = ov.querySelector('#g-search').value.trim().toLowerCase()
    if (!q) { resultsEl.innerHTML = ''; return }
    try {
      const users = await api('/api/users/search?q=' + encodeURIComponent(q))
      resultsEl.innerHTML = users.length ? users.map(u =>
        `<div class="sr-hit" data-uid="${u.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border)">
          <div class="avatar" style="width:32px;height:32px;font-size:14px">${initial(u.displayName)}</div>
          <div style="flex:1"><div style="font-weight:500;font-size:14px">${esc(u.displayName)}</div>
            <div style="font-size:12px;color:var(--text2)">@${esc(u.username)}</div></div>
          <div class="check">${chosen.has(u.id) ? '✓' : ''}</div>
        </div>`
      ).join('') : '<div class="empty">No users found</div>'
      resultsEl.querySelectorAll('[data-uid]').forEach(el => {
        el.onclick = () => {
          const id = el.dataset.uid
          const user = users.find(u => u.id === id)
          if (chosen.has(id)) chosen.delete(id); else chosen.set(id, user)
          doSearch(); renderChosen()
        }
      })
    } catch (e) { resultsEl.innerHTML = '<div class="empty">' + esc(e.message) + '</div>' }
  }
  ov.querySelector('#g-search').oninput = doSearch

  ov.querySelector('#g-cancel').onclick = () => ov.remove()
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  ov.querySelector('#g-create').onclick = async () => {
    const name = ov.querySelector('#g-name').value.trim()
    if (!name) return toast('Group name required')
    if (!chosen.size) return toast('Add at least one member')
    try {
      const conv = await api('/api/conversations/group', {
        method: 'POST',
        body: { name, userIds: Array.from(chosen.keys()) }
      })
      if (!state.conversations.find(c => c.id === conv.id)) state.conversations.unshift(conv)
      ov.remove()
      renderConversationList()
      openConvById(conv.id)
      toast('Group created')
    } catch (e) { toast(e.message) }
  }
}

function openSettings() {
  const ov = document.createElement('div')
  ov.className = 'modal-overlay'
  const theme = document.documentElement.getAttribute('data-theme') || 'light'
  ov.innerHTML = `
    <div class="modal">
      <h2>Settings</h2>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="mi btn-secondary" id="s-theme" style="padding:12px;text-align:left;border-radius:10px">
          ${theme === 'dark' ? '☀️ Switch to Light mode' : '🌙 Switch to Dark mode'}
        </button>
        <button class="mi btn-secondary" id="s-wall" style="padding:12px;text-align:left;border-radius:10px">🎨 Change wallpaper</button>
        <button class="mi btn-secondary" id="s-logout" style="padding:12px;text-align:left;border-radius:10px;color:var(--danger)">🚪 Log out</button>
      </div>
      <div class="modal-actions"><button class="btn-secondary" id="s-close">Close</button></div>
    </div>`
  document.body.appendChild(ov)
  ov.querySelector('#s-close').onclick = () => ov.remove()
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  ov.querySelector('#s-theme').onclick = () => { toggleTheme(); ov.remove(); openSettings() }
  ov.querySelector('#s-wall').onclick = () => { ov.remove(); openWallpaperPicker() }
  ov.querySelector('#s-logout').onclick = () => {
    ov.remove(); clearAuth(); state.conversations=[]; state.messages={}; state.activeConvId=null; renderAuth()
  }
}