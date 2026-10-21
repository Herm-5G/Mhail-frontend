function renderAuth() {
  document.body.classList.remove('chat-open')
  const tab = state.authTab || 'login'
  app.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="auth-brand">
        <div class="auth-logo">M</div>
        <h1>MHail</h1>
      </div>
      <div class="auth-tagline">Fast, private messaging. Anytime, anywhere.</div>
      <div class="tabs">
        <button data-tab="login" class="${tab==='login'?'active':''}">Login</button>
        <button data-tab="register" class="${tab==='register'?'active':''}">Register</button>
      </div>
      <form class="form" id="f">
        <input id="f-email" type="email" placeholder="Email" required>
        ${tab==='register' ? '<input id="f-username" placeholder="Username (3-20 chars, a-z 0-9 _)" required>' : ''}
        ${tab==='register' ? '<input id="f-display" placeholder="Display name">' : ''}
        <input id="f-password" type="password" placeholder="Password" required>
        <button type="submit">${tab==='login' ? 'Login to MHail' : 'Create MHail account'}</button>
        <div class="error" id="err">${esc(state.authError || '')}</div>
      </form>
    </div></div>`
  app.querySelectorAll('.tabs button').forEach(b => {
    b.onclick = () => { state.authTab = b.dataset.tab; state.authError=''; renderAuth() }
  })
  app.querySelector('#f').onsubmit = submitAuth
}

async function submitAuth(e) {
  e.preventDefault()
  const email = app.querySelector('#f-email').value.trim().toLowerCase()
  const password = app.querySelector('#f-password').value
  const errEl = app.querySelector('#err')
  const tab = state.authTab || 'login'

  try {
    if (tab === 'register') {
      const username = app.querySelector('#f-username').value.trim().toLowerCase()
      const display = (app.querySelector('#f-display').value || '').trim() || username
      const data = await api('/api/register', {
        method: 'POST',
        body: { email, username, password, displayName: display }
      })
      setAuth(data.token, data.user)
    } else {
      const data = await api('/api/login', { method: 'POST', body: { email, password } })
      setAuth(data.token, data.user)
    }
    connectSocket()
    await loadConversations()
    renderChat()
  } catch (err) {
    errEl.textContent = err.message
  }
}