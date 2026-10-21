import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔴 ENSURE THIS MATCHES YOUR FIREBASE CONSOLE
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
let unsubMessages = null;
let presenceInterval = null;

function initTheme() {
  const savedTheme = localStorage.getItem('mhail-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mhail-theme', next);
  renderMain();
}

const ICONS = {
  back: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
  call: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.2 2.2z"/></svg>`,
  dots: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  attach: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
  tickSingle: `<svg viewBox="0 0 16 16"><path d="M11.071 3.929L5.5 9.5 3.5 7.5l-1.414 1.414L5.5 12.328l6.985-6.985z"/></svg>`,
  tickDouble: `<svg viewBox="0 0 16 16"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>`,
  block: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`
};

initTheme();

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
      <h1>MHail</h1><div class="auth-tagline">Fast, private messaging.</div>
      <div class="tabs">
        <button id="tab-login" class="active">Login</button>
        <button id="tab-reg">Register</button>
      </div>
      <form class="form" id="auth-form">
        <input id="email" type="email" placeholder="Email" required>
        <input id="username" placeholder="Username (a-z, 0-9)" style="display:none" required>
        <input id="pass" type="password" placeholder="Password" required>
        <button type="submit" id="submit-btn">Login</button>
        <div class="error" id="err"></div>
      </form>
    </div></div>`;

  let isLogin = true;
  const uField = document.getElementById('username');
  const sBtn = document.getElementById('submit-btn');
  
  document.getElementById('tab-login').onclick = () => { isLogin = true; uField.style.display='none'; sBtn.textContent='Login'; document.getElementById('tab-login').classList.add('active'); document.getElementById('tab-reg').classList.remove('active'); };
  document.getElementById('tab-reg').onclick = () => { isLogin = false; uField.style.display='block'; sBtn.textContent='Create Account'; document.getElementById('tab-reg').classList.add('active'); document.getElementById('tab-login').classList.remove('active'); };

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;
    const username = document.getElementById('username').value.toLowerCase().trim();
    const err = document.getElementById('err');
    err.textContent = "Please wait...";

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        if (username.length < 3) throw new Error("Username too short");
        const usernameRef = doc(db, "usernames", username);
        if ((await getDoc(usernameRef)).exists()) throw new Error("Username taken!");
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(usernameRef, { uid: userCred.user.uid });
        await setDoc(doc(db, "users", userCred.user.uid), { username, email, displayName: username, uid: userCred.user.uid, lastSeen: serverTimestamp() });
      }
    } catch (error) {
      err.textContent = error.message.replace('Firebase: ', '');
    }
  };
}

function renderMain() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  appEl.innerHTML = `
    <div class="app-container">
      <aside class="sidebar" id="sidebar">
        <div class="header">
          <h1>MHail</h1>
          <div class="header-icons">
            <button class="icon" id="theme-btn">${isDark ? ICONS.sun : ICONS.moon}</button>
            <button class="icon" id="settings-btn">${ICONS.dots}</button>
          </div>
        </div>
        <div class="search-bar">
          <input id="search" placeholder="Search username...">
        </div>
        <ul class="chat-list" id="chats-list"></ul>
        
        <button class="fab" id="new-chat-btn">${ICONS.send}</button>
        
        <div class="bottom-nav">
          <div class="nav-item active">${ICONS.dots}<span>Chats</span></div>
          <div class="nav-item">${ICONS.call}<span>Calls</span></div>
          <div class="nav-item">${ICONS.camera}<span>Updates</span></div>
          <div class="nav-item">${ICONS.mic}<span>Tools</span></div>
        </div>
      </aside>

      <main class="chat-window" id="chat-window">
        <div class="chat-header">
          <button id="back-btn">${ICONS.back}</button>
          <div class="avatar-wrap"><div class="avatar" id="other-av"></div></div>
          <div>
            <div class="chat-name" id="other-name">Select Chat</div>
            <div class="chat-status" id="other-status"></div>
          </div>
          <div class="header-actions">
            <button class="icon">${ICONS.video}</button>
            <button class="icon">${ICONS.call}</button>
          </div>
        </div>
        <div class="messages" id="messages">
           <div class="system-msg">🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.</div>
        </div>
        <div class="composer">
          <button class="icon">${ICONS.attach}</button>
          <div class="input-wrap">
            <input id="msg-input" placeholder="Message" autocomplete="off">
          </div>
          <button class="send-btn" id="send-btn">${ICONS.mic}</button>
        </div>
      </main>
    </div>`;

  document.getElementById('theme-btn').onclick = toggleTheme;
  document.getElementById('back-btn').onclick = () => document.getElementById('chat-window').classList.remove('active');
  document.getElementById('settings-btn').onclick = openSettingsModal;
  document.getElementById('new-chat-btn').onclick = () => document.getElementById('search').focus();
  
  document.getElementById('search').oninput = async (e) => {
    const val = e.target.value.toLowerCase().trim();
    const list = document.getElementById('chats-list');
    if (val.length < 2) { loadMyChats(); return; }
    
    const q = query(collection(db, "users"), where("username", ">=", val), where("username", "<=", val + '\uf8ff'));
    const snap = await getDocs(q);
    list.innerHTML = '';
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      const li = document.createElement('li');
      li.className = 'chat-item';
      li.innerHTML = `<div class="avatar-wrap"><div class="avatar">${u.displayName[0]}</div></div>
        <div class="chat-info"><div class="chat-top"><span class="chat-name">${u.displayName}</span></div><div class="chat-bottom"><span class="chat-preview">@${u.username}</span></div></div>`;
      li.onclick = () => startChat(u.uid, u.displayName);
      list.appendChild(li);
    });
  };

  const sendAction = async (e) => {
    if (e) e.preventDefault();
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    if (!text || !currentChatId) return;
    
    try {
      await addDoc(collection(db, "conversations", currentChatId, "messages"), {
        text: text, senderId: currentUser.uid, createdAt: serverTimestamp(), deletedForEveryone: false
      });
      await setDoc(doc(db, "conversations", currentChatId), {
        lastMessage: text, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge: true });
      inp.value = '';
      document.getElementById('send-btn').innerHTML = ICONS.mic;
    } catch(err) { alert("Error sending: " + err.message); }
  };

  document.getElementById('msg-input').oninput = (e) => {
    document.getElementById('send-btn').innerHTML = e.target.value.trim() ? ICONS.send : ICONS.mic;
  };
  document.getElementById('send-btn').onclick = sendAction;
  document.getElementById('msg-input').onkeypress = (e) => { if(e.key === 'Enter') sendAction(e); };

  loadMyChats();
}

async function startChat(otherUid, otherName) {
  const participants = [currentUser.uid, otherUid].sort();
  const chatId = participants.join('_');
  if (!(await getDoc(doc(db, "conversations", chatId))).exists()) {
    await setDoc(doc(db, "conversations", chatId), { participants, updatedAt: serverTimestamp(), lastMessage: "New Chat", clearedBy: [] });
  }
  openChat(chatId, otherUid, otherName);
  document.getElementById('search').value = '';
}

async function loadMyChats() {
  const list = document.getElementById('chats-list');
  if (!list) return;
  const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
  const snap = await getDocs(q);
  
  if (snap.empty) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No chats yet. Search above!</div>'; return; }
  list.innerHTML = '';
  
  for (const d of snap.docs) {
    const data = d.data();
    if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue; 
    const otherId = data.participants.find(id => id !== currentUser.uid);
    const otherData = (await getDoc(doc(db, "users", otherId))).data() || { displayName: "Unknown" };
    
    const li = document.createElement('li');
    li.className = 'chat-item';
    li.innerHTML = `<div class="avatar-wrap"><div class="avatar">${otherData.displayName[0]}</div></div>
      <div class="chat-info">
        <div class="chat-top"><span class="chat-name">${otherData.displayName}</span></div>
        <div class="chat-bottom"><span class="chat-preview">${data.lastMessage || ''}</span></div>
      </div>`;
    li.onclick = () => openChat(d.id, otherId, otherData.displayName);
    list.appendChild(li);
  }
}

async function openChat(chatId, otherId, name) {
  currentChatId = chatId;
  document.getElementById('chat-window').classList.add('active');
  document.getElementById('other-name').textContent = name;
  document.getElementById('other-av').textContent = name[0];
  
  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '<div class="system-msg">🔒 Messages are end-to-end encrypted. Only people in this chat can read them.</div>';
  
  if (unsubMessages) unsubMessages();
  await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp() });

  const q = query(collection(db, "conversations", chatId, "messages"), orderBy("createdAt", "asc"));
  unsubMessages = onSnapshot(q, async (snap) => {
    const otherUser = (await getDoc(doc(db, "users", otherId))).data();
    const convData = (await getDoc(doc(db, "conversations", chatId))).data();
    
    document.getElementById('other-status').textContent = isUserOnline(otherUser.lastSeen) ? 'online' : 'offline';
    
    msgsEl.innerHTML = '<div class="system-msg">🔒 Messages are end-to-end encrypted. Only people in this chat can read them.</div>';
    snap.forEach(doc => {
      const m = doc.data();
      if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return; 
      
      const isMe = m.senderId === currentUser.uid;
      let tickHTML = '';
      
      if (isMe) {
        const otherReadTime = convData.readAt && convData.readAt[otherId] ? convData.readAt[otherId].toMillis() : 0;
        const msgTime = m.createdAt ? m.createdAt.toMillis() : Date.now();
        
        if (msgTime <= otherReadTime) {
          tickHTML = `<span class="tick read">${ICONS.tickDouble}</span>`;
        } else {
          tickHTML = `<span class="tick">${ICONS.tickSingle}</span>`;
        }
      }

      const isDeleted = m.deletedForEveryone;
      const textContent = isDeleted ? `${ICONS.block} This message was deleted` : m.text;
      const timeStr = m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
      
      const div = document.createElement('div');
      div.className = `msg-row ${isMe ? 'me' : 'them'}`;
      div.innerHTML = `<div class="bubble ${isDeleted?'deleted':''}">${textContent}<div class="msg-meta">${timeStr}${tickHTML}</div></div>`;
      
      if (!isDeleted) {
        div.querySelector('.bubble').onclick = () => showMessageMenu(chatId, doc.id, isMe);
      }
      msgsEl.appendChild(div);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
    await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp() });
  });
}

function showMessageMenu(chatId, msgId, isMe) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:300px;text-align:center">
      <button class="btn-secondary" onclick="deleteMessage('${chatId}', '${msgId}', false)">Delete for Me</button>
      ${isMe ? `<button class="btn-primary" style="background:var(--danger);color:#fff" onclick="deleteMessage('${chatId}', '${msgId}', true)">Delete for Everyone</button>` : ''}
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
}
window.deleteMessage = async (chatId, msgId, forEveryone) => {
  document.querySelector('.modal-overlay').remove();
  const msgRef = doc(db, "conversations", chatId, "messages", msgId);
  if (forEveryone) await updateDoc(msgRef, { deletedForEveryone: true, text: "This message was deleted" });
  else await updateDoc(msgRef, { deletedBy: arrayUnion(currentUser.uid) });
};

function openSettingsModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Settings</h3>
      <input id="set-name" placeholder="Display Name" value="${currentUser.displayName}">
      <button class="btn-primary" id="btn-save-name">Save Name</button>
      <hr style="border-color:var(--border)">
      <input id="set-pass" type="password" placeholder="New Password (min 6 chars)">
      <button class="btn-primary" id="btn-save-pass">Update Password</button>
      <hr style="border-color:var(--border)">
      <button class="btn-danger" id="btn-del-acc">Delete Account</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('btn-save-name').onclick = async () => {
    const newName = document.getElementById('set-name').value.trim();
    if (newName) {
      await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName });
      currentUser.displayName = newName;
      alert("Name updated!"); overlay.remove(); renderMain();
    }
  };
  document.getElementById('btn-save-pass').onclick = async () => {
    const newPass = document.getElementById('set-pass').value;
    if (newPass.length < 6) return alert("6+ chars required");
        try { await updatePassword(auth.currentUser, newPass); alert("Password updated!"); overlay.remove(); } 
    catch (e) { alert(e.message); }
  };
  
  document.getElementById('btn-del-acc').onclick = async () => {
    if (confirm("Delete account permanently?")) {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid));
        await deleteDoc(doc(db, "usernames", currentUser.username));
        await deleteUser(auth.currentUser);
        window.location.reload();
      } catch(e) { alert("Log out and back in before deleting."); }
    }
  };
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      currentUser = snap.data();
      startPresence();
      renderMain();
    }
  } else {
    currentUser = null;
    clearInterval(presenceInterval);
    if (unsubMessages) unsubMessages();
    renderAuth();
  }
});
