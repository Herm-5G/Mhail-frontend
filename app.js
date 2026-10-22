import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, deleteUser, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc, deleteDoc, arrayUnion, increment, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const CLOUD_NAME = "rirfqxoz"; 
const UPLOAD_PRESET = "Ehdra_Preset"; 

const firebaseConfig = {
  apiKey: "AIzaSyBxfzb0kvBoTErQTkB_UH33-RTMpd0NjNs",
  authDomain: "mhail-fdb0f.firebaseapp.com",
  projectId: "mhail-fdb0f",
  storageBucket: "mhail-fdb0f.firebasestorage.app",
  messagingSenderId: "850385336150",
  appId: "1:850385336150:web:594aa53199a318209f08f7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appEl = document.getElementById('app');

let currentUser = null;
let currentChatId = null;
let currentOtherId = null;
let unsubMessages = null;
let unsubChats = null; 
let unsubConvMeta = null; 
let unsubBroadcast = null;
let presenceInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let replyToMsg = null; 
let currentTab = 'friends';
let isSending = false; 

// Default Emojis & Stickers
const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'];
const STICKERS = [
  "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif",
  "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif",
  "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif",
  "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif",
  "https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif",
  "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif",
  "https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/512.gif",
  "https://fonts.gstatic.com/s/e/notoemoji/latest/1f621/512.gif"
];

// --- UI HELPERS ---
window.showAlert = (title, message, isConfirm = false, onConfirm = null) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center; border: 1px solid var(--border);">
      <h3 style="color: var(--text); margin-bottom: 15px;">${title}</h3>
      <p style="font-size: 14px; margin-bottom: 20px; color: var(--text-muted);">${message}</p>
      <div style="display: flex; gap: 10px;">
        ${isConfirm ? `<button class="btn-secondary" style="flex:1; margin:0;" onclick="this.closest('.modal-overlay').remove()">Cancel</button>` : ''}
        <button class="btn-primary" id="alert-ok" style="flex:1; margin:0;">${isConfirm ? 'Confirm' : 'OK'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#alert-ok').onclick = () => { if (onConfirm) onConfirm(); overlay.remove(); };
};

function applyTheme() {
  const theme = localStorage.getItem('mofie-theme') || 'dark'; 
  const accent1 = localStorage.getItem('mofie-accent1') || '#00a884';
  const accent2 = localStorage.getItem('mofie-accent2') || '#53bdeb';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.setProperty('--user-accent-1', accent1);
  document.documentElement.style.setProperty('--user-accent-2', accent2);
}
applyTheme();

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  if (data.secure_url) return data.secure_url;
  throw new Error(data.error?.message || "Upload failed");
}

const ICONS = {
  back: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
  dots: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  attach: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
  tickSingle: `<svg viewBox="0 0 16 16"><path d="M11.071 3.929L5.5 9.5 3.5 7.5l-1.414 1.414L5.5 12.328l6.985-6.985z"/></svg>`,
  tickDouble: `<svg viewBox="0 0 16 16"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
  group: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  forward: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  addUser: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  emoji: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>`
};

function startPresence() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const updatePresence = () => setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
  updatePresence();
  clearInterval(presenceInterval);
  presenceInterval = setInterval(updatePresence, 30000);
}

function isUserOnline(lastSeen) {
  if (!lastSeen) return false;
  return (Date.now() - lastSeen.toMillis()) < 60000;
}

function renderAuth() {
  appEl.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="logo-container">
        <svg class="butterfly-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
        <h1 class="logo-text">Mofie</h1>
      </div>
      <div class="auth-tagline">Pure, Fast and convenient</div>
      <div class="tabs">
        <button id="tab-login" class="active">Login</button>
        <button id="tab-reg">Register</button>
      </div>
      <form class="form" id="auth-form">
        <input id="email" type="email" placeholder="Email" required>
        <input id="username" placeholder="Username (a-z, 0-9)" style="display:none" required>
        <input id="pass" type="password" placeholder="Password" required>
        <button type="submit" id="submit-btn">Login</button>
        <div id="forgot-pass-btn" style="text-align:center; margin-top:15px; font-size:13px; color:var(--user-accent-2); cursor:pointer">Forgot Password?</div>
        <div class="error" id="err"></div>
      </form>
    </div></div>`;

  let isLogin = true;
  const uField = document.getElementById('username');
  const sBtn = document.getElementById('submit-btn');
  
  document.getElementById('tab-login').onclick = () => { isLogin = true; uField.style.display='none'; sBtn.textContent='Login'; document.getElementById('tab-login').classList.add('active'); document.getElementById('tab-reg').classList.remove('active'); };
  document.getElementById('tab-reg').onclick = () => { isLogin = false; uField.style.display='block'; sBtn.textContent='Create Account'; document.getElementById('tab-reg').classList.add('active'); document.getElementById('tab-login').classList.remove('active'); };

  document.getElementById('forgot-pass-btn').onclick = async () => {
    const email = document.getElementById('email').value.trim();
    if (!email) return showAlert("Email Required", "Please enter your email address first.");
    try { await sendPasswordResetEmail(auth, email); showAlert("Email Sent", "Password reset email sent!"); } catch (error) { showAlert("Error", error.message); }
  };

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;
    const username = document.getElementById('username').value.toLowerCase().trim();
    const err = document.getElementById('err');
    err.textContent = "Connecting...";

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        if (username.length < 3) throw new Error("Username too short");
        const usernameRef = doc(db, "usernames", username);
        if ((await getDoc(usernameRef)).exists()) throw new Error("Username taken!");
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(usernameRef, { uid: userCred.user.uid });
        await setDoc(doc(db, "users", userCred.user.uid), { username, email, displayName: username, uid: userCred.user.uid, lastSeen: serverTimestamp(), photoURL: null, blockedUsers: [] });
      }
    } catch (error) { err.textContent = error.message.replace('Firebase: ', ''); }
  };
}

function renderMain() {
  appEl.innerHTML = `
    <div class="app-container">
      <aside class="sidebar" id="sidebar">
        <div class="header">
          <div style="display:flex; align-items:center; gap:8px;">
            <svg class="butterfly-svg" style="width:24px; height:24px;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
            <h1>Mofie</h1>
          </div>
          <div class="header-icons">
            <button class="icon" id="new-group-btn" title="New Group">${ICONS.group}</button>
            <button class="icon" id="settings-btn">${ICONS.dots}</button>
          </div>
        </div>
        
        <div class="search-bar"><input id="search" placeholder="Search username..."></div>
        
        <div class="tabs-row">
          <button class="tab-btn" data-tab="groups">Groups</button>
          <button class="tab-btn" data-tab="unread">Unread</button>
          <button class="tab-btn active" data-tab="friends">Friends</button>
        </div>

        <ul class="chat-list" id="chats-list"></ul>
        <button class="fab" id="new-chat-btn">${ICONS.send}</button>
      </aside>

      <main class="chat-window" id="chat-window">
        <div class="chat-header">
          <button id="back-btn">${ICONS.back}</button>
          <div class="avatar-wrap" id="header-profile-btn">
            <div class="avatar" id="other-av"></div>
            <div class="status-dot" id="header-status-dot"></div>
          </div>
          <div style="flex:1; min-width:0;">
            <div class="chat-name" id="other-name">Select Chat</div>
            <div class="chat-status" id="other-status"></div>
            <div class="timer-btn" id="timer-btn" style="display:none" onclick="openTimerModal()">
              ${ICONS.clock} <span id="timer-text">Off</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon" id="group-info-btn" title="Group Info" style="display:none">${ICONS.info}</button>
            <button class="icon" id="delete-chat-btn" title="Delete/Clear Chat">${ICONS.trash}</button>
          </div>
        </div>
        <div class="messages" id="messages"></div>
        
        <div class="reply-banner" id="reply-banner">
          <div class="rb-content"><div class="rb-text" id="rb-text"></div></div>
          <button class="rb-close" onclick="cancelReply()">✕</button>
        </div>

        <!-- EMOJI & STICKER PANEL -->
        <div class="emoji-panel" id="emoji-panel">
          <div class="panel-tabs">
            <button id="tab-emojis" class="active" onclick="switchPanelTab('emoji')">😀 Emojis</button>
            <button id="tab-stickers" onclick="switchPanelTab('sticker')">🖼️ Stickers</button>
          </div>
          <div class="panel-content">
            <div class="emoji-grid" id="emoji-grid"></div>
            <div class="sticker-grid" id="sticker-grid" style="display:none;"></div>
          </div>
        </div>

        <div class="composer" id="composer">
          <button class="icon" id="attach-btn">${ICONS.attach}</button>
          <button class="icon" id="emoji-btn" style="margin-right:4px;">${ICONS.emoji}</button>
          <div class="input-wrap"><input id="msg-input" placeholder="Message" autocomplete="off"></div>
          <button class="send-btn" id="send-btn">${ICONS.mic}</button>
        </div>
      </main>

      <!-- SETTINGS PAGE -->
      <div id="settings-page" class="settings-page">
        <div class="settings-header">
          <button class="icon" id="close-settings-btn">${ICONS.back}</button>
          <h2>Settings</h2>
        </div>
        <div class="settings-list">
          <div class="settings-profile" onclick="openEditProfileModal()">
            <div class="avatar-wrap"><div class="avatar">${currentUser.photoURL ? `<img src="${currentUser.photoURL}" style="width:100%; height:100%; object-fit:cover;">` : currentUser.displayName[0]}</div></div>
            <div style="flex:1"><div class="name">${currentUser.displayName}</div><div class="username">@${currentUser.username}</div></div>
            <div style="font-size:20px; color:var(--text-muted);">✎</div>
          </div>
          <div class="settings-item" onclick="openThemeModal()"><div class="icon-wrap">🎨</div><div class="info"><h4>Appearance</h4><p>Theme, Colors</p></div></div>
          <div class="settings-item" onclick="openAccountModal()"><div class="icon-wrap">🔑</div><div class="info"><h4>Account</h4><p>Security, Delete Account</p></div></div>
          
          ${currentUser.email === 'hermanedaru@gmail.com' ? `
          <div class="settings-item" onclick="openAdminModal()" style="background: rgba(255, 153, 0, 0.1); border-color: #ff9900;">
            <div class="icon-wrap" style="color: #ff9900;">⚡</div>
            <div class="info"><h4 style="color: #ff9900;">Admin Panel</h4><p>Send Global Broadcast</p></div>
          </div>` : ''}

          <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px; border-top: 1px solid var(--border); margin-top: 20px;">
            <p style="margin-bottom: 5px;">Developed and maintained by <b>Herman</b></p>
            <p style="margin-bottom: 5px;">Contact: +256790311166</p>
            <p>Email: hermanedaru@gmail.com</p>
          </div>
        </div>
      </div>
    </div>`;

  const emojiGrid = document.getElementById('emoji-grid');
  EMOJIS.forEach(e => { emojiGrid.innerHTML += `<span onclick="insertEmoji('${e}')">${e}</span>`; });

  const stickerGrid = document.getElementById('sticker-grid');
  STICKERS.forEach(s => { stickerGrid.innerHTML += `<img src="${s}" onclick="sendSticker('${s}')" />`; });

  document.getElementById('settings-btn').onclick = () => document.getElementById('settings-page').classList.add('active');
  document.getElementById('close-settings-btn').onclick = () => document.getElementById('settings-page').classList.remove('active');
  document.getElementById('new-group-btn').onclick = openNewGroupModal;
  document.getElementById('new-chat-btn').onclick = () => document.getElementById('search').focus();
  document.getElementById('back-btn').onclick = () => { document.getElementById('chat-window').classList.remove('active'); cancelReply(); };
  document.getElementById('group-info-btn').onclick = openGroupInfoModal;
  document.getElementById('delete-chat-btn').onclick = handleDeleteChat;
  document.getElementById('search').oninput = handleSearch;
  document.getElementById('send-btn').onclick = handleSendOrRecord;
  document.getElementById('msg-input').oninput = handleInputTyping;
  document.getElementById('attach-btn').onclick = () => document.getElementById('chat-upload').click();
  document.getElementById('chat-upload').onchange = handleChatUpload;
  document.getElementById('emoji-btn').onclick = toggleEmojiPanel;

  document.getElementById('header-profile-btn').onclick = () => {
    if (!currentChatId) return;
    openFriendProfileModal(currentOtherId, document.getElementById('other-name').textContent, document.getElementById('other-av').querySelector('img')?.src);
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      loadMyChats();
    };
  });

  loadMyChats();
}

// --- EMOJI & STICKER FUNCTIONS ---
window.toggleEmojiPanel = () => {
  const panel = document.getElementById('emoji-panel');
  panel.classList.toggle('show');
  if (panel.classList.contains('show')) {
    document.getElementById('msg-input').blur(); // Hide device keyboard
  }
};

window.switchPanelTab = (tab) => {
  document.getElementById('tab-emojis').classList.remove('active');
  document.getElementById('tab-stickers').classList.remove('active');
  document.getElementById('emoji-grid').style.display = 'none';
  document.getElementById('sticker-grid').style.display = 'none';

  if (tab === 'emoji') {
    document.getElementById('tab-emojis').classList.add('active');
    document.getElementById('emoji-grid').style.display = 'grid';
  } else {
    document.getElementById('tab-stickers').classList.add('active');
    document.getElementById('sticker-grid').style.display = 'grid';
  }
};

window.insertEmoji = (emoji) => {
  const input = document.getElementById('msg-input');
  input.value += emoji;
  input.focus();
};

window.sendSticker = async (stickerUrl) => {
  if (!currentChatId || isSending) return;
  isSending = true;
  document.getElementById('emoji-panel').classList.remove('show');

  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  const convData = convSnap.data();
  
  const msgData = { text: 'Sticker', senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'sticker', mediaUrl: stickerUrl };
  
  try {
    await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
    const updates = { lastMessage: '🖼️ Sticker', lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
    convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
  } catch(err) { showAlert("Error", err.message); }
  
  isSending = false;
};

// --- ADMIN BROADCAST ---
window.openAdminModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3 style="color: #ff9900;">⚡ Admin Broadcast</h3>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">This will send a pop-up to every user currently on Mofie.</p>
      <textarea id="broadcast-msg" placeholder="Type your announcement here..." style="width:100%; height:100px; padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-main); color:var(--text); margin-bottom:10px; resize:none;"></textarea>
      <button class="btn-primary" id="send-broadcast-btn" style="background:#ff9900;">Send to All Users</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('send-broadcast-btn').onclick = async () => {
    const msg = document.getElementById('broadcast-msg').value.trim();
    if (!msg) return showAlert("Error", "Please type a message.");
    try {
      await setDoc(doc(db, "system", "broadcast"), { message: msg, timestamp: Date.now() });
      showAlert("Sent!", "Your broadcast has been sent to all users.");
      overlay.remove();
    } catch(e) { showAlert("Error", e.message); }
  };
};

function listenForBroadcasts() {
  if (unsubBroadcast) unsubBroadcast();
  unsubBroadcast = onSnapshot(doc(db, "system", "broadcast"), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const lastSeen = localStorage.getItem('mofie_last_broadcast') || 0;
      if (data.timestamp > lastSeen) {
        localStorage.setItem('mofie_last_broadcast', data.timestamp);
        showAlert("Mofie Update", data.message);
      }
    }
  });
}

// --- FRIEND PROFILE & CONTACT SAVING ---
window.openFriendProfileModal = (uid, name, photoURL) => {
  if (!uid) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <div class="avatar-wrap" style="width:100px; height:100px; margin:0 auto 15px;">
        <div class="avatar" style="font-size:40px;">${photoURL ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover;">` : name[0]}</div>
      </div>
      <h3 style="margin-bottom:5px;">${name}</h3>
      <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">@${uid}</p>
      
      <button class="btn-primary" id="save-contact-btn" style="margin-bottom:10px;">📇 Save to Contacts</button>
      <button class="btn-danger" id="delete-thread-btn">🗑️ Delete Chat History</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('save-contact-btn').onclick = () => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name} (Mofie)\nTEL;TYPE=CELL:${uid}\nNOTE:Mofie ID: @${uid}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_Mofie.vcf`;
    a.click();
    showAlert("Contact Saved", "Contact card downloaded. Open it to add to your phonebook.");
  };

  document.getElementById('delete-thread-btn').onclick = () => {
    showAlert("Delete Chat", "Are you sure you want to delete this chat history for yourself?", true, async () => {
      await updateDoc(doc(db, "conversations", currentChatId), { clearedBy: arrayUnion(currentUser.uid) });
      document.getElementById('chat-window').classList.remove('active');
      overlay.remove();
      loadMyChats();
    });
  };
};

// --- SEARCH & CHAT LOGIC ---
async function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase().trim();
  const list = document.getElementById('chats-list');
  if (searchTerm.length < 2) { loadMyChats(); return; }
  
  const q = query(collection(db, "users"), where("username", ">=", searchTerm), where("username", "<=", searchTerm + '\uf8ff'));
  const snap = await getDocs(q);
  
  let resultsHTML = '';
  let hasResults = false;
  let seenUsernames = new Set();
  
  snap.forEach(d => {
    if (d.id === currentUser.uid) return;
    const u = d.data();
    const actualUid = d.id;
    
    if (seenUsernames.has(u.username)) return;
    seenUsernames.add(u.username);

    hasResults = true;
    resultsHTML += `<li class="chat-item" onclick="startDM('${actualUid}', '${u.displayName}', '${u.photoURL || ''}')">
      <div class="avatar-wrap"><div class="avatar">${u.photoURL ? `<img src="${u.photoURL}" style="width:100%; height:100%; object-fit:cover;">` : u.displayName[0]}</div></div>
      <div class="chat-info"><div class="chat-top"><span class="chat-name">${u.displayName}</span></div><div class="chat-bottom"><span class="chat-preview">@${u.username}</span></div></div>
    </li>`;
  });
  
  list.innerHTML = hasResults ? resultsHTML : '<div style="text-align:center;padding:20px;color:var(--text-muted)">No users found</div>';
}

async function loadMyChats() {
  const list = document.getElementById('chats-list');
  if (!list) return;
  
  const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
  if (unsubChats) unsubChats(); 
  
  unsubChats = onSnapshot(q, async (snap) => {
    if (snap.empty) { 
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No chats yet.</div>'; 
      return; 
    }
    
    const sortedDocs = snap.docs.sort((a, b) => (b.data().lastMessageTime?.toMillis() || 0) - (a.data().lastMessageTime?.toMillis() || 0));
    
    const uniqueConvs = new Map();
    for (const d of sortedDocs) {
      const data = d.data();
      if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue; 
      
      let dedupeKey;
      if (data.isGroup) {
        dedupeKey = d.id;
      } else {
        const otherId = data.participants.find(id => id !== currentUser.uid);
        if (!otherId) continue; 
        dedupeKey = otherId;
      }
      
      if (!uniqueConvs.has(dedupeKey)) {
        uniqueConvs.set(dedupeKey, { id: d.id, data, isGroup: data.isGroup });
      }
    }
    
    let listHTML = '';
    for (const conv of uniqueConvs.values()) {
      const { id, data, isGroup } = conv;
      
      if (currentTab === 'groups' && !isGroup) continue;
      if (currentTab === 'unread' && (!data.unreadCounts || !data.unreadCounts[currentUser.uid] || data.unreadCounts[currentUser.uid] === 0)) continue;
      
      let displayName, photoURL, online = false;
      if (isGroup) {
        displayName = data.groupName;
        photoURL = data.groupPhotoURL;
      } else {
        const otherId = data.participants.find(id => id !== currentUser.uid);
        const otherData = (await getDoc(doc(db, "users", otherId))).data() || { displayName: "Unknown" };
        displayName = otherData.displayName;
        photoURL = otherData.photoURL;
        online = isUserOnline(otherData.lastSeen);
      }
      
      const unread = (data.unreadCounts && data.unreadCounts[currentUser.uid]) ? data.unreadCounts[currentUser.uid] : 0;
      const badgeHTML = unread > 0 ? `<div class="unread-badge">${unread}</div>` : '';
      const otherIdForClick = isGroup ? '' : data.participants.find(id => id !== currentUser.uid);

      listHTML += `<li class="chat-item" onclick="openChat('${id}', '${otherIdForClick}', '${displayName}', '${photoURL || ''}', ${isGroup})">
        <div class="avatar-wrap">
          <div class="avatar">${photoURL ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover;">` : displayName[0]}</div>
          ${isGroup ? '' : `<div class="status-dot ${online ? 'online' : 'offline'}"></div>`}
        </div>
        <div class="chat-info"><div class="chat-top"><span class="chat-name">${displayName}</span>${badgeHTML}</div><div class="chat-bottom"><span class="chat-preview">${data.lastMessage || ''}</span></div></div>
      </li>`;
    }
    
    list.innerHTML = listHTML || '<div style="text-align:center;padding:20px;color:var(--text-muted)">No chats found.</div>';
  });
}

window.openChat = async function(chatId, otherId, name, photoURL, isGroup) {
  currentChatId = chatId;
  currentOtherId = otherId;
  cancelReply();
  document.getElementById('chat-window').classList.add('active');
  document.getElementById('other-name').textContent = name;
  document.getElementById('other-av').innerHTML = photoURL ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : name[0];
  document.getElementById('timer-btn').style.display = 'flex';
  
  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '<div class="system-msg">🔒 Messages are end-to-end encrypted.</div>';
  
  if (unsubMessages) unsubMessages();
  if (unsubConvMeta) unsubConvMeta(); 
  
  unsubConvMeta = onSnapshot(doc(db, "conversations", chatId), (docSnap) => { 
    if (docSnap.exists()) {
      updateTimerUI(docSnap.data().timer || 0); 
    } else {
      document.getElementById('chat-window').classList.remove('active');
    }
  });
  
  await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp(), [`unreadCounts.${currentUser.uid}`]: 0 });

  const q = query(collection(db, "conversations", chatId, "messages"), orderBy("createdAt", "asc"));
  unsubMessages = onSnapshot(q, async (snap) => {
    const convSnap = await getDoc(doc(db, "conversations", chatId));
    if (!convSnap.exists()) return;
    const convData = convSnap.data();

    if (isGroup) {
      document.getElementById('other-status').textContent = `${convData.participants.length} members`;
      document.getElementById('header-status-dot').style.display = 'none';
      document.getElementById('group-info-btn').style.display = 'block';
    } else {
      const otherUser = (await getDoc(doc(db, "users", otherId))).data();
      const online = isUserOnline(otherUser?.lastSeen);
      document.getElementById('other-status').textContent = online ? 'online' : 'offline';
      document.getElementById('header-status-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
      document.getElementById('header-status-dot').style.display = 'block';
      document.getElementById('group-info-btn').style.display = 'none';
    }
    
    let messagesHTML = '<div class="system-msg">🔒 Messages are end-to-end encrypted.</div>';
    const docs = snap.docs;
    
    docs.forEach(doc => {
      const m = doc.data();
      if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return; 
      if (m.expireAt && m.expireAt < Date.now()) { deleteDoc(doc.ref).catch(e => {}); return; }
      
      const isMe = m.senderId === currentUser.uid;
      
      let tickHTML = '';
      if (isMe) {
        const otherReadTime = convData.readAt && convData.readAt[otherId] ? convData.readAt[otherId].toMillis() : 0;
        const msgTime = m.createdAt ? m.createdAt.toMillis() : Date.now();
        if (!isGroup && msgTime <= otherReadTime) tickHTML = `<span class="tick read">${ICONS.tickDouble}</span>`;
        else tickHTML = `<span class="tick">${ICONS.tickSingle}</span>`;
      }

      const timeStr = m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
      
      let contentHTML = m.text;
      let bubbleClass = 'bubble';
      if (m.type === 'image') contentHTML = `<img src="${m.mediaUrl}" style="max-width:100%;border-radius:8px;">`;
      else if (m.type === 'audio') contentHTML = `<audio controls src="${m.mediaUrl}" style="max-width:100%;"></audio>`;
      else if (m.type === 'sticker') {
        contentHTML = `<img src="${m.mediaUrl}" class="sticker-img">`;
        bubbleClass = 'bubble sticker-bubble';
      }
      
      let replyHTML = '';
      if (m.replyToId) replyHTML = `<div class="reply-quote"><div class="q-name">${m.replyToSender}</div><div class="q-text">${m.replyToText}</div></div>`;
      let senderNameHTML = (!isMe && isGroup) ? `<div class="sender-name">${m.senderName}</div>` : '';

      let reactionsHTML = '';
      if (m.reactions && Object.keys(m.reactions).length > 0) {
        const counts = {};
        Object.values(m.reactions).forEach(emoji => { counts[emoji] = (counts[emoji] || 0) + 1; });
        reactionsHTML = '<div class="reactions-container">';
        Object.keys(counts).forEach(emoji => {
          const hasReacted = m.reactions[currentUser.uid] === emoji;
          reactionsHTML += `<div class="reaction-pill ${hasReacted ? 'active' : ''}" onclick="toggleReaction('${chatId}', '${doc.id}', '${emoji}')">${emoji} ${counts[emoji]}</div>`;
        });
        reactionsHTML += '</div>';
      }

      messagesHTML += `<div class="msg-row ${isMe ? 'me' : 'them'}" data-msg-id="${doc.id}">
        <div class="${bubbleClass}">${senderNameHTML}${replyHTML}${contentHTML}<div class="msg-meta">${timeStr}${tickHTML}</div></div>${reactionsHTML}
      </div>`;
    });
    
    msgsEl.innerHTML = messagesHTML;

    msgsEl.querySelectorAll('.bubble').forEach((bubble) => {
      const docId = bubble.closest('.msg-row').dataset.msgId;
      const m = docs.find(d => d.id === docId).data();
      const isMe = m.senderId === currentUser.uid;
      
      let startX = 0;
      bubble.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      bubble.addEventListener('touchmove', (e) => {
        const diffX = e.touches[0].clientX - startX;
        if (diffX > 50) bubble.style.transform = `translateX(${diffX}px)`;
      }, { passive: true });
      bubble.addEventListener('touchend', (e) => {
        bubble.style.transform = 'translateX(0)';
        if (e.changedTouches[0].clientX - startX > 50) setReply({ id: docId, text: m.text || 'Media' }, isMe ? currentUser.displayName : name);
      });
      
      let pressTimer;
      bubble.addEventListener('mousedown', () => { pressTimer = setTimeout(() => { showMessageMenu(chatId, docId, isMe, m, isMe ? currentUser.displayName : name); }, 600); });
      bubble.addEventListener('mouseup', () => clearTimeout(pressTimer));
      bubble.addEventListener('touchstart', () => { pressTimer = setTimeout(() => { showMessageMenu(chatId, docId, isMe, m, isMe ? currentUser.displayName : name); }, 600); }, { passive: true });
      bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    });

    msgsEl.scrollTop = msgsEl.scrollHeight;
    await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp(), [`unreadCounts.${currentUser.uid}`]: 0 });
  });
};

// --- MESSAGE MENU & REACTIONS ---
window.toggleReaction = async (chatId, msgId, emoji) => {
  const msgRef = doc(db, "conversations", chatId, "messages", msgId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) return;
  
  const currentReactions = msgSnap.data().reactions || {};
  
  if (currentReactions[currentUser.uid] === emoji) {
    const updates = {};
    updates[`reactions.${currentUser.uid}`] = null;
    await updateDoc(msgRef, updates);
  } else {
    await updateDoc(msgRef, { [`reactions.${currentUser.uid}`]: emoji });
  }
};

function showMessageMenu(chatId, msgId, isMe, msgData, senderName) {
  if (document.querySelector('.msg-menu-overlay')) return;
  
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay msg-menu-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:350px;text-align:center">
      <div class="emoji-picker">${emojis.map(e => `<span onclick="window.toggleReaction('${chatId}', '${msgId}', '${e}'); this.closest('.modal-overlay').remove()">${e}</span>`).join('')}</div>
      <button class="btn-secondary" onclick="window.openForwardModal(window._currentMsgData)">${ICONS.forward} Forward</button>
      <button class="btn-secondary" onclick="window.replyAction('${chatId}', '${msgId}', '${senderName}')">Reply</button>
      <button class="btn-secondary" onclick="window.deleteMessage('${chatId}', '${msgId}', false)">Delete for Me</button>
      ${isMe ? `<button class="btn-danger" onclick="window.deleteMessage('${chatId}', '${msgId}', true)">Delete for Everyone</button>` : ''}
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  window._currentReplyData = { msgId, text: msgData.text || 'Media', senderName };
  window._currentMsgData = msgData;
}

window.replyAction = () => {
  const d = window._currentReplyData;
  setReply({ id: d.msgId, text: d.text }, d.senderName);
  document.querySelector('.msg-menu-overlay').remove();
};

window.deleteMessage = async (chatId, msgId, forEveryone) => {
  document.querySelector('.msg-menu-overlay').remove();
  const msgRef = doc(db, "conversations", chatId, "messages", msgId);
  if (forEveryone) { try { await deleteDoc(msgRef); } catch (e) { showAlert("Error", e.message); } }
  else { await updateDoc(msgRef, { deletedBy: arrayUnion(currentUser.uid) }); }
};

window.openForwardModal = (msgData) => {
  document.querySelector('.msg-menu-overlay').remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:left">
      <h3 style="text-align:center">Forward Message</h3>
      <div class="forward-list" id="forward-list">
         <div style="padding:10px;text-align:center">Loading chats...</div>
      </div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);

  const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
  getDocs(q).then(snap => {
    const list = document.getElementById('forward-list');
    list.innerHTML = '';
    snap.forEach(async (d) => {
      const data = d.data();
      if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) return;
      let name = data.isGroup ? data.groupName : (await getDoc(doc(db, "users", data.participants.find(id => id !== currentUser.uid)))).data().displayName;
      const item = document.createElement('div');
      item.className = 'forward-item';
      item.innerHTML = `<div style="flex:1; font-weight:600;">${name}</div>`;
      item.onclick = async () => {
        await addDoc(collection(db, "conversations", d.id, "messages"), {
          text: msgData.text, senderId: currentUser.uid, senderName: currentUser.displayName,
          createdAt: serverTimestamp(), type: msgData.type, mediaUrl: msgData.mediaUrl || null, forwarded: true
        });
        await updateDoc(doc(db, "conversations", d.id), { lastMessage: msgData.text || 'Media', lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp() });
        showAlert("Success", "Forwarded!"); overlay.remove();
      };
      list.appendChild(item);
    });
  });
};

// --- TIMERS ---
window.openTimerModal = async () => {
  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  if (!convSnap.exists()) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:left">
      <h3 style="text-align:center">Disappearing Messages</h3>
      <div class="timer-options">
        <button class="timer-option" onclick="setTimer(0)">Off (Keep messages)</button>
        <button class="timer-option" onclick="setTimer(300000)">5 Minutes</button>
        <button class="timer-option" onclick="setTimer(3600000)">1 Hour</button>
        <button class="timer-option" onclick="setTimer(86400000)">24 Hours (1 Day)</button>
      </div>
      <button class="btn-secondary" style="margin-top:15px" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
};

window.setTimer = async (ms) => {
  document.querySelector('.modal-overlay').remove();
  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  if (convSnap.exists()) {
    await updateDoc(doc(db, "conversations", currentChatId), { timer: ms });
    updateTimerUI(ms);
  }
};

function updateTimerUI(ms) {
  const timerText = document.getElementById('timer-text');
  if (!timerText) return;
  if (ms === 0) timerText.textContent = "Off";
  else if (ms === 300000) timerText.textContent = "5 Mins";
  else if (ms === 3600000) timerText.textContent = "1 Hour";
  else if (ms === 86400000) timerText.textContent = "24 Hours";
}

// --- ACTIONS & HELPERS ---
async function handleDeleteChat() {
  if (!currentChatId) return;
  showAlert("Delete Chat", "Are you sure you want to delete this chat history for yourself?", true, async () => {
    await updateDoc(doc(db, "conversations", currentChatId), { clearedBy: arrayUnion(currentUser.uid) });
    document.getElementById('chat-window').classList.remove('active');
    loadMyChats();
  });
}

window.startDM = async function(otherUid, otherName, photoURL) {
  if (!otherUid) return showAlert("Error", "User not found");
  const participants = [currentUser.uid, otherUid].sort();
  const chatId = participants.join('_');
  if (!(await getDoc(doc(db, "conversations", chatId))).exists()) {
    await setDoc(doc(db, "conversations", chatId), { participants, updatedAt: serverTimestamp(), lastMessage: "New Chat", clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false });
  }
  openChat(chatId, otherUid, otherName, photoURL, false);
  document.getElementById('search').value = '';
  loadMyChats();
};

function handleInputTyping(e) {
  if (!isRecording) document.getElementById('send-btn').innerHTML = e.target.value.trim() ? ICONS.send : ICONS.mic;
}

function handleSendOrRecord(e) {
  if (document.getElementById('msg-input').value.trim()) sendAction(e);
  else toggleRecording();
}

async function sendAction(e) {
  if (e) e.preventDefault();
  if (isSending) return; 
  
  const inp = document.getElementById('msg-input');
  const text = inp.value.trim();
  if (!text || !currentChatId) return;
  
  isSending = true;
  document.getElementById('send-btn').style.opacity = '0.5';
  
  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  if (!convSnap.exists()) { isSending = false; return; }
  const convData = convSnap.data();
  const timerMs = convData.timer || 0; 
  let expireAt = null;
  if (timerMs > 0) expireAt = Date.now() + timerMs;

  const msgData = { text: text, senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'text', expireAt, reactions: {} };
  if (replyToMsg) { msgData.replyToId = replyToMsg.id; msgData.replyToText = replyToMsg.text; msgData.replyToSender = replyToMsg.senderName; }
  
  try {
    await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
    const updates = { lastMessage: text, lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
    convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
    
    inp.value = '';
    document.getElementById('send-btn').innerHTML = ICONS.mic;
    cancelReply();
  } catch(err) { showAlert("Error", err.message); }
  
  isSending = false;
  document.getElementById('send-btn').style.opacity = '1';
}

async function handleChatUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentChatId) return;
  try {
    const url = await uploadToCloudinary(file);
    const convSnap = await getDoc(doc(db, "conversations", currentChatId));
    const convData = convSnap.data();
    const timerMs = convData.timer || 0;
    let expireAt = null;
    if (timerMs > 0) expireAt = Date.now() + timerMs;

    const msgData = { text: '📷 Image', senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'image', mediaUrl: url, expireAt, reactions: {} };
    await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
    const updates = { lastMessage: '📷 Image', lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
    convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
    cancelReply();
  } catch(err) { showAlert("Upload Error", err.message); }
  e.target.value = '';
}

async function toggleRecording() {
  const btn = document.getElementById('send-btn');
  const input = document.getElementById('msg-input');
  
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        if (!currentChatId) return;
        
        const file = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });
        const url = await uploadToCloudinary(file);
        
        const convSnap = await getDoc(doc(db, "conversations", currentChatId));
        const convData = convSnap.data();
        const timerMs = convData.timer || 0;
        let expireAt = null;
        if (timerMs > 0) expireAt = Date.now() + timerMs;

        const msgData = { text: '🎤 Voice Note', senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'audio', mediaUrl: url, expireAt, reactions: {} };
        await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
        const updates = { lastMessage: '🎤 Voice Note', lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
        convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
        await updateDoc(doc(db, "conversations", currentChatId), updates);
        cancelReply();
      };
      
      mediaRecorder.start();
      isRecording = true;
      input.disabled = true;
      input.placeholder = "Recording...";
      btn.classList.add('recording');
      btn.innerHTML = `<div style="width:16px;height:16px;background:#fff;border-radius:4px"></div>`;
    } catch (err) { showAlert("Microphone Error", "Microphone access denied."); }
  } else {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    isRecording = false;
    input.disabled = false;
    input.placeholder = "Message";
    btn.classList.remove('recording');
    btn.innerHTML = ICONS.mic;
  }
}

window.cancelReply = () => { replyToMsg = null; document.getElementById('reply-banner').classList.remove('show'); };
function setReply(msg, senderName) {
  replyToMsg = { id: msg.id, text: msg.text || 'Media', senderName: senderName };
  document.getElementById('rb-text').textContent = msg.text || 'Media';
  document.getElementById('reply-banner').classList.add('show');
  document.getElementById('msg-input').focus();
}

// --- SETTINGS MODALS ---
window.openThemeModal = () => {
  const currentTheme = localStorage.getItem('mofie-theme') || 'dark';
  const currentAccent1 = localStorage.getItem('mofie-accent1') || '#00a884';
  const currentAccent2 = localStorage.getItem('mofie-accent2') || '#53bdeb';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Appearance</h3>
      <div class="theme-row">
        <label>Theme</label>
        <select id="theme-select">
          <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light Mode</option>
          <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark Mode</option>
          <option value="neon" ${currentTheme === 'neon' ? 'selected' : ''}>Neon Mode</option>
        </select>
      </div>
      <div class="theme-row"><label>Primary Color</label><input type="color" id="accent1-picker" value="${currentAccent1}"></div>
      <div class="theme-row"><label>Secondary Color</label><input type="color" id="accent2-picker" value="${currentAccent2}"></div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('theme-select').onchange = (e) => { localStorage.setItem('mofie-theme', e.target.value); applyTheme(); };
  document.getElementById('accent1-picker').oninput = (e) => { localStorage.setItem('mofie-accent1', e.target.value); applyTheme(); };
  document.getElementById('accent2-picker').oninput = (e) => { localStorage.setItem('mofie-accent2', e.target.value); applyTheme(); };
};

window.openEditProfileModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Edit Profile</h3>
      <div class="avatar-wrap" style="margin: 0 auto 15px; width:80px; height:80px;" onclick="document.getElementById('profile-upload').click()">
        <div class="avatar" id="settings-av">${currentUser.photoURL ? `<img src="${currentUser.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : currentUser.displayName[0]}</div>
        <div style="position:absolute; bottom:0; right:0; background:var(--user-accent-1); color:var(--bg-main); border-radius:50%; padding:4px;">${ICONS.camera}</div>
      </div>
      <input id="set-name" placeholder="Display Name" value="${currentUser.displayName}">
      <button class="btn-primary" id="btn-save-name" style="margin-bottom:10px">Save Name</button>
      ${currentUser.photoURL ? `<button class="btn-danger" id="btn-remove-photo" style="margin-bottom:10px;">Remove Photo</button>` : ''}
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('profile-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      document.getElementById('settings-av').innerHTML = '...';
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
      currentUser.photoURL = url;
      showAlert("Success", "Profile updated!"); overlay.remove(); renderMain();
    } catch(err) { showAlert("Error", err.message); }
  };

  document.getElementById('btn-save-name').onclick = async () => {
    const newName = document.getElementById('set-name').value.trim();
    if (newName) {
      await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName });
      currentUser.displayName = newName;
      showAlert("Success", "Name updated!"); overlay.remove(); renderMain();
    }
  };
  
  const btnRemove = document.getElementById('btn-remove-photo');
  if (btnRemove) {
    btnRemove.onclick = async () => {
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: null });
      currentUser.photoURL = null;
      showAlert("Removed", "Profile photo removed."); overlay.remove(); renderMain();
    };
  }
};

window.openAccountModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Account Security</h3>
      <input id="set-password" type="password" placeholder="New Password (min 6 chars)">
      <button class="btn-primary" id="btn-change-password" style="margin-bottom:10px">Change Password</button>
      
      <hr style="border-color:var(--border); margin: 20px 0;">
      
      <button class="btn-secondary" id="btn-logout" style="color: var(--user-accent-1); border-color: var(--user-accent-1); margin-bottom:10px;">Log Out</button>
      <button class="btn-danger" id="btn-delete-acc">Delete Account Permanently</button>
      
      <button class="btn-secondary" style="margin-top:10px" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('btn-change-password').onclick = async () => {
    const newPass = document.getElementById('set-password').value;
    if (newPass.length < 6) return showAlert("Error", "Password must be at least 6 characters.");
    try {
      await updatePassword(auth.currentUser, newPass);
      showAlert("Success", "Password successfully changed!");
      overlay.remove();
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        showAlert("Security Check", "Please log out and log back in before changing your password.");
      } else {
        showAlert("Error", error.message);
      }
    }
  };

  document.getElementById('btn-logout').onclick = () => { signOut(auth); overlay.remove(); };

  document.getElementById('btn-delete-acc').onclick = () => {
    showAlert("Delete Account", "Are you absolutely sure? This will permanently delete your profile and account. This cannot be undone.", true, async () => {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid));
        await deleteDoc(doc(db, "usernames", currentUser.username));
        await deleteUser(auth.currentUser);
        showAlert("Deleted", "Your account has been permanently deleted.");
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
          showAlert("Security Check", "Please log out and log back in before deleting your account for security reasons.");
        } else {
          showAlert("Error", error.message);
        }
      }
    });
  };
};
// --- GROUPS ---
window.openNewGroupModal = async () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:left">
      <h3 style="text-align:center">Create Group</h3>
      <input id="group-name" placeholder="Group Name" style="margin-bottom:15px">
      <input id="group-search" placeholder="Search users to add...">
      <div class="user-select-list" id="group-user-list"></div>
      <button class="btn-primary" onclick="createGroup()" style="margin-top:10px">Create Group</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);

  window.selectedGroupUsers = new Map();

  document.getElementById('group-search').oninput = async (e) => {
    const groupSearchTerm = e.target.value.toLowerCase().trim();
    if (groupSearchTerm.length < 2) return;
    const q = query(collection(db, "users"), where("username", ">=", groupSearchTerm), where("username", "<=", groupSearchTerm + '\uf8ff'));
    const snap = await getDocs(q);
    
    const list = document.getElementById('group-user-list');
    list.innerHTML = '';
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      const isSelected = window.selectedGroupUsers.has(u.uid);
      
      const item = document.createElement('div');
      item.className = `user-select-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="avatar">${u.photoURL ? `<img src="${u.photoURL}">` : u.displayName[0]}</div>
        <div style="flex:1">${u.displayName}</div>
        <div style="font-size:18px; color:var(--user-accent-1)">${isSelected ? '✓' : '+'}</div>
      `;
      item.onclick = () => {
        if (window.selectedGroupUsers.has(u.uid)) window.selectedGroupUsers.delete(u.uid);
        else window.selectedGroupUsers.set(u.uid, u.displayName);
        document.getElementById('group-search').dispatchEvent(new Event('input'));
      };
      list.appendChild(item);
    });
  };
};

window.createGroup = async () => {
  const name = document.getElementById('group-name').value.trim();
  if (!name) return showAlert("Error", "Please enter a group name");
  if (window.selectedGroupUsers.size === 0) return showAlert("Error", "Select at least one person");

  const participants = [currentUser.uid, ...Array.from(window.selectedGroupUsers.keys())];
  
  try {
    const newChatRef = doc(collection(db, "conversations"));
    await setDoc(newChatRef, {
      isGroup: true, groupName: name, groupBio: "", groupPhotoURL: null, 
      participants, createdBy: currentUser.uid, admins: [currentUser.uid],
      restricted: false, pendingMembers: [],
      updatedAt: serverTimestamp(), lastMessage: "Group created", lastMessageTime: serverTimestamp(),
      clearedBy: [], unreadCounts: {}, timer: 0
    });
    document.querySelector('.modal-overlay').remove();
    openChat(newChatRef.id, null, name, null, true);
    loadMyChats();
  } catch(e) { showAlert("Error", e.message); }
};

window.openGroupInfoModal = async () => {
  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  if (!convSnap.exists()) return;
  const convData = convSnap.data();
  
  const isAdmin = convData.admins && convData.admins.includes(currentUser.uid);
  const restricted = convData.restricted || false;
  
  const membersHTML = await Promise.all(convData.participants.map(async (uid) => {
    const uSnap = await getDoc(doc(db, "users", uid));
    const u = uSnap.data();
    const memberIsAdmin = convData.admins && convData.admins.includes(uid);
    
    let controls = '';
    if (isAdmin && !memberIsAdmin && !(uid === convData.createdBy)) {
      controls = `<button class="btn-remove" onclick="removeMember('${uid}')" style="margin-right:4px">Remove</button>
                  <button class="btn-approve" onclick="makeAdmin('${uid}')">Make Admin</button>`;
    } else if (isAdmin && memberIsAdmin && !(uid === convData.createdBy)) {
      controls = `<button class="btn-reject" onclick="removeAdmin('${uid}')">Remove Admin</button>`;
    }

    return `<div class="member-item">
      <div class="avatar">${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : u.displayName[0]}</div>
      <div class="name">${u.displayName} ${memberIsAdmin ? '<span class="admin-badge">Admin</span>' : ''}</div>
      ${controls}
    </div>`;
  }));

  let pendingHTML = '';
  if (isAdmin && convData.pendingMembers && convData.pendingMembers.length > 0) {
    const pendingItems = await Promise.all(convData.pendingMembers.map(async (uid) => {
      const uSnap = await getDoc(doc(db, "users", uid));
      const u = uSnap.data();
      return `<div class="pending-item" style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span>${u.displayName}</span>
        <div>
          <button class="btn-approve" onclick="approveMember('${uid}')">Approve</button>
          <button class="btn-reject" onclick="rejectMember('${uid}')">Reject</button>
        </div>
      </div>`;
    }));
    pendingHTML = `<div class="pending-list" style="background: rgba(255, 153, 0, 0.1); border: 1px solid var(--user-accent-2); border-radius: 8px; padding: 10px; margin-bottom: 15px;"><h4 style="margin:0 0 10px 0; color:var(--user-accent-2)">Pending Requests</h4>${pendingItems.join('')}</div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Group Info</h3>
      <div class="group-info-avatar" onclick="${isAdmin ? "document.getElementById('group-upload').click()" : ''}" style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 15px; background: var(--bg-main); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 40px; color: var(--text-muted); overflow: hidden; position: relative; cursor: pointer;">
        ${convData.groupPhotoURL ? `<img src="${convData.groupPhotoURL}" style="width:100%;height:100%;object-fit:cover;">` : convData.groupName[0]}
        ${isAdmin ? `<div style="position:absolute; bottom:0; right:0; background:var(--user-accent-1); color:var(--bg-main); border-radius:50%; padding:6px; font-size:12px;">✎</div>` : ''}
      </div>
      
      <input id="group-name-input" placeholder="Group Name" value="${convData.groupName}" ${isAdmin ? '' : 'disabled'}>
      <input id="group-bio-input" placeholder="Group Bio / Description" value="${convData.groupBio || ''}" ${isAdmin ? '' : 'disabled'}>
      
      ${isAdmin ? `<button class="btn-primary" id="save-group-info" style="margin-bottom:15px">Save Info</button>` : ''}
      
      <div class="group-settings-row" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border);">
        <label style="font-size:14px">Restrict Joining (Admin Approval)</label>
        <input type="checkbox" id="restrict-toggle" ${restricted ? 'checked' : ''} ${isAdmin ? '' : 'disabled'}>
      </div>

      ${pendingHTML}
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h4 style="margin:0; color:var(--text-muted)">Members (${convData.participants.length})</h4>
        <button class="btn-primary" style="width:auto; padding:6px 12px; margin:0;" onclick="openAddMemberModal()">${ICONS.addUser} Add</button>
      </div>
      <div class="member-list">${membersHTML.join('')}</div>
      
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="margin-top:15px">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  if (isAdmin) {
    document.getElementById('group-upload').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const url = await uploadToCloudinary(file);
        await updateDoc(doc(db, "conversations", currentChatId), { groupPhotoURL: url });
        overlay.remove(); openGroupInfoModal();
      } catch(err) { showAlert("Error", err.message); }
    };

    document.getElementById('save-group-info').onclick = async () => {
      const newName = document.getElementById('group-name-input').value.trim();
      const newBio = document.getElementById('group-bio-input').value.trim();
      if (!newName) return showAlert("Error", "Group name cannot be empty");
      await updateDoc(doc(db, "conversations", currentChatId), { groupName: newName, groupBio: newBio });
      showAlert("Success", "Group info updated!");
      overlay.remove();
      document.getElementById('other-name').textContent = newName;
      loadMyChats();
    };

    document.getElementById('restrict-toggle').onchange = async (e) => {
      await updateDoc(doc(db, "conversations", currentChatId), { restricted: e.target.checked });
      showAlert("Updated", e.target.checked ? "Joining is now restricted." : "Joining is now open.");
    };
  }
};

window.makeAdmin = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { admins: arrayUnion(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };
window.removeAdmin = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { admins: arrayRemove(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };
window.removeMember = async (uid) => { if (confirm("Remove this member from the group?")) { await updateDoc(doc(db, "conversations", currentChatId), { participants: arrayRemove(uid), admins: arrayRemove(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); } };
window.approveMember = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { pendingMembers: arrayRemove(uid), participants: arrayUnion(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };
window.rejectMember = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { pendingMembers: arrayRemove(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };

window.openAddMemberModal = async () => {
  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  const convData = convSnap.data();
  const isRestricted = convData.restricted || false;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:left">
      <h3 style="text-align:center">Add Members</h3>
      <input id="add-member-search" placeholder="Search users...">
      <div class="user-select-list" id="add-member-list"></div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Done</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('add-member-search').oninput = async (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    if (searchTerm.length < 2) return;
    const q = query(collection(db, "users"), where("username", ">=", searchTerm), where("username", "<=", searchTerm + '\uf8ff'));
    const snap = await getDocs(q);
    
    const list = document.getElementById('add-member-list');
    list.innerHTML = '';
    snap.forEach(d => {
      if (d.id === currentUser.uid || convData.participants.includes(d.id) || (convData.pendingMembers && convData.pendingMembers.includes(d.id))) return;
      const u = d.data();
      const item = document.createElement('div');
      item.className = 'user-select-item';
      item.innerHTML = `
        <div class="avatar">${u.photoURL ? `<img src="${u.photoURL}">` : u.displayName[0]}</div>
        <div style="flex:1">${u.displayName}</div>
        <button class="btn-primary" style="width:auto; padding:4px 8px; margin:0;" onclick="addMemberToGroup('${u.uid}', ${isRestricted})">Add</button>
      `;
      list.appendChild(item);
    });
  };
};

window.addMemberToGroup = async (uid, isRestricted) => {
  try {
    if (isRestricted) {
      await updateDoc(doc(db, "conversations", currentChatId), { pendingMembers: arrayUnion(uid) });
      showAlert("Request Sent", "An admin must approve this user.");
    } else {
      await updateDoc(doc(db, "conversations", currentChatId), { participants: arrayUnion(uid) });
      showAlert("Success", "Member added successfully!");
    }
    document.querySelector('.modal-overlay').remove();
    openGroupInfoModal();
  } catch(e) { showAlert("Error", e.message); }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = { uid: user.uid, displayName: "Loading...", username: "loading", email: user.email }; 
    renderMain();
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      currentUser = snap.data();
      startPresence();
      listenForBroadcasts();
      renderMain();
    }
  } else {
    currentUser = null;
    clearInterval(presenceInterval);
    if (unsubMessages) unsubMessages();
    if (unsubChats) unsubChats();
    if (unsubBroadcast) unsubBroadcast();
    renderAuth();
  }
});