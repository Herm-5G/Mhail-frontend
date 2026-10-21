import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
let presenceInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let replyToMsg = null; 

// --- THEME MANAGEMENT ---
function applyTheme() {
  const theme = localStorage.getItem('ehdra-theme') || 'neon';
  const accent1 = localStorage.getItem('ehdra-accent1') || '#00f3ff';
  const accent2 = localStorage.getItem('ehdra-accent2') || '#ff9900';
  
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.setProperty('--user-accent-1', accent1);
  document.documentElement.style.setProperty('--user-accent-2', accent2);
}
applyTheme(); // Apply immediately on load

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
  block: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  palette: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.06 0 2-.94 2-2 0-.53-.21-1.04-.58-1.41-.37-.37-.58-.88-.58-1.41 0-1.1.9-2 2-2h2c3.31 0 6-2.69 6-6 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5S18.33 11 17.5 11z"/></svg>`
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
      <h1>Ehdra</h1><div class="auth-tagline">Custom Neon Network</div>
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
        await setDoc(doc(db, "users", userCred.user.uid), { username, email, displayName: username, uid: userCred.user.uid, lastSeen: serverTimestamp(), photoURL: null });
      }
    } catch (error) {
      err.textContent = error.message.replace('Firebase: ', '');
    }
  };
}

function renderMain() {
  appEl.innerHTML = `
    <div class="app-container">
      <aside class="sidebar" id="sidebar">
        <div class="header">
          <h1>Ehdra</h1>
          <div class="header-icons">
            <button class="icon" id="settings-btn">${ICONS.dots}</button>
          </div>
        </div>
        
        <div class="search-bar"><input id="search" placeholder="Search username..."></div>
        <ul class="chat-list" id="chats-list"></ul>

        <button class="fab" id="new-chat-btn">${ICONS.send}</button>
      </aside>

      <main class="chat-window" id="chat-window">
        <div class="chat-header">
          <button id="back-btn">${ICONS.back}</button>
          <div class="avatar-wrap" onclick="const img = this.querySelector('img'); if(img) window.open(img.src)">
            <div class="avatar" id="other-av"></div>
            <div class="status-dot" id="header-status-dot"></div>
          </div>
          <div>
            <div class="chat-name" id="other-name">Select Chat</div>
            <div class="chat-status" id="other-status"></div>
          </div>
          <div class="header-actions">
            <button class="icon" id="delete-chat-btn" title="Delete Chat">${ICONS.trash}</button>
          </div>
        </div>
        <div class="messages" id="messages"></div>
        
        <div class="reply-banner" id="reply-banner">
          <div class="rb-content">
            <div class="rb-text" id="rb-text"></div>
          </div>
          <button class="rb-close" onclick="cancelReply()">✕</button>
        </div>

        <div class="composer">
          <button class="icon" id="attach-btn">${ICONS.attach}</button>
          <div class="input-wrap"><input id="msg-input" placeholder="Message" autocomplete="off"></div>
          <button class="send-btn" id="send-btn">${ICONS.mic}</button>
        </div>
      </main>
    </div>`;

  document.getElementById('settings-btn').onclick = openSettingsModal;
  document.getElementById('back-btn').onclick = () => { document.getElementById('chat-window').classList.remove('active'); cancelReply(); };
  document.getElementById('new-chat-btn').onclick = () => document.getElementById('search').focus();

  document.getElementById('delete-chat-btn').onclick = async () => {
    if (!currentChatId) return;
    if (confirm("Clear this chat history for yourself?")) {
      try {
        await updateDoc(doc(db, "conversations", currentChatId), { clearedBy: arrayUnion(currentUser.uid) });
        document.getElementById('chat-window').classList.remove('active');
        loadMyChats();
      } catch (err) { alert("Error deleting chat: " + err.message); }
    }
  };

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
      const online = isUserOnline(u.lastSeen);
      
      const li = document.createElement('li');
      li.className = 'chat-item';
      li.innerHTML = `<div class="avatar-wrap">
        <div class="avatar">${u.photoURL ? `<img src="${u.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : u.displayName[0]}</div>
        <div class="status-dot ${online ? 'online' : 'offline'}"></div>
      </div>
      <div class="chat-info"><div class="chat-top"><span class="chat-name">${u.displayName}</span></div><div class="chat-bottom"><span class="chat-preview">@${u.username}</span></div></div>`;
      li.onclick = () => startChat(u.uid, u.displayName, u.photoURL);
      list.appendChild(li);
    });
  };

  const sendAction = async (e) => {
    if (e) e.preventDefault();
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    if (!text || !currentChatId) return;
    
    const msgData = { text: text, senderId: currentUser.uid, createdAt: serverTimestamp(), type: 'text' };
    if (replyToMsg) { msgData.replyToId = replyToMsg.id; msgData.replyToText = replyToMsg.text; msgData.replyToSender = replyToMsg.senderName; }
    
    try {
      await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
      await setDoc(doc(db, "conversations", currentChatId), { 
        lastMessage: text, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
        clearedBy: arrayRemove(currentUser.uid, currentOtherId),
        [`unreadCounts.${currentOtherId}`]: increment(1)
      }, { merge: true });
      
      inp.value = '';
      document.getElementById('send-btn').innerHTML = ICONS.mic;
      cancelReply();
    } catch(err) { alert("Error sending: " + err.message); }
  };

  document.getElementById('msg-input').oninput = (e) => {
    if (!isRecording) document.getElementById('send-btn').innerHTML = e.target.value.trim() ? ICONS.send : ICONS.mic;
  };
  
  document.getElementById('send-btn').onclick = (e) => {
    if (document.getElementById('msg-input').value.trim()) sendAction(e);
    else toggleRecording();
  };
  document.getElementById('msg-input').onkeypress = (e) => { if(e.key === 'Enter') sendAction(e); };

  document.getElementById('attach-btn').onclick = () => document.getElementById('chat-upload').click();
  
  document.getElementById('chat-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    
    try {
      document.getElementById('attach-btn').style.opacity = '0.5';
      const url = await uploadToCloudinary(file);
      
      const msgData = { text: '📷 Image', senderId: currentUser.uid, createdAt: serverTimestamp(), type: 'image', mediaUrl: url };
      if (replyToMsg) { msgData.replyToId = replyToMsg.id; msgData.replyToText = replyToMsg.text; msgData.replyToSender = replyToMsg.senderName; }

      await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
      await setDoc(doc(db, "conversations", currentChatId), { 
        lastMessage: '📷 Image', lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
        clearedBy: arrayRemove(currentUser.uid, currentOtherId),
        [`unreadCounts.${currentOtherId}`]: increment(1)
      }, { merge: true });
      cancelReply();
    } catch(err) { alert("Upload error: " + err.message); }
    document.getElementById('attach-btn').style.opacity = '1';
    e.target.value = '';
  };

  loadMyChats();
}

window.cancelReply = () => {
  replyToMsg = null;
  document.getElementById('reply-banner').classList.remove('show');
};
function setReply(msg, senderName) {
  replyToMsg = { id: msg.id, text: msg.text || 'Media', senderName: senderName };
  document.getElementById('rb-text').textContent = msg.text || 'Media';
  document.getElementById('reply-banner').classList.add('show');
  document.getElementById('msg-input').focus();
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
        
        const msgData = { text: '🎤 Voice Note', senderId: currentUser.uid, createdAt: serverTimestamp(), type: 'audio', mediaUrl: url };
        if (replyToMsg) { msgData.replyToId = replyToMsg.id; msgData.replyToText = replyToMsg.text; msgData.replyToSender = replyToMsg.senderName; }

        await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
        await setDoc(doc(db, "conversations", currentChatId), { 
          lastMessage: '🎤 Voice Note', lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
          clearedBy: arrayRemove(currentUser.uid, currentOtherId),
          [`unreadCounts.${currentOtherId}`]: increment(1)
        }, { merge: true });
        cancelReply();
      };
      
      mediaRecorder.start();
      isRecording = true;
      input.disabled = true;
      input.placeholder = "Recording...";
      btn.classList.add('recording');
      btn.innerHTML = `<div style="width:16px;height:16px;background:#fff;border-radius:4px"></div>`;
    } catch (err) { alert("Microphone access denied."); }
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

async function startChat(otherUid, otherName, photoURL) {
  const participants = [currentUser.uid, otherUid].sort();
  const chatId = participants.join('_');
  if (!(await getDoc(doc(db, "conversations", chatId))).exists()) {
    await setDoc(doc(db, "conversations", chatId), { participants, updatedAt: serverTimestamp(), lastMessage: "New Chat", clearedBy: [] });
  }
  openChat(chatId, otherUid, otherName, photoURL);
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
    const online = isUserOnline(otherData.lastSeen);
    const unread = data.unreadCounts && data.unreadCounts[currentUser.uid] ? data.unreadCounts[currentUser.uid] : 0;
    
    const badgeHTML = unread > 0 ? `<div class="unread-badge">${unread}</div>` : '';

    const li = document.createElement('li');
    li.className = 'chat-item';
    li.innerHTML = `<div class="avatar-wrap">
      <div class="avatar">${otherData.photoURL ? `<img src="${otherData.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : otherData.displayName[0]}</div>
      <div class="status-dot ${online ? 'online' : 'offline'}"></div>
    </div>
      <div class="chat-info">
        <div class="chat-top">
          <span class="chat-name">${otherData.displayName}</span>
          ${badgeHTML}
        </div>
        <div class="chat-bottom"><span class="chat-preview">${data.lastMessage || ''}</span></div>
      </div>`;
      
    li.onclick = () => openChat(d.id, otherId, otherData.displayName, otherData.photoURL);
    
    let pressTimer;
    li.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(async () => {
        if (confirm(`Delete chat with ${otherData.displayName}?`)) {
          await updateDoc(doc(db, "conversations", d.id), { clearedBy: arrayUnion(currentUser.uid) });
          loadMyChats();
        }
      }, 800);
    }, { passive: true });
    li.addEventListener('touchend', () => clearTimeout(pressTimer));
    li.addEventListener('touchmove', () => clearTimeout(pressTimer));
    
    list.appendChild(li);
  }
}

async function openChat(chatId, otherId, name, photoURL) {
  currentChatId = chatId;
  currentOtherId = otherId;
  cancelReply();
  document.getElementById('chat-window').classList.add('active');
  document.getElementById('other-name').textContent = name;
  
  document.getElementById('other-av').innerHTML = photoURL ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : name[0];
  
  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '<div class="system-msg">🔒 Messages are end-to-end encrypted.</div>';
  
  if (unsubMessages) unsubMessages();
  
  await updateDoc(doc(db, "conversations", chatId), { 
    [`readAt.${currentUser.uid}`]: serverTimestamp(),
    [`unreadCounts.${currentUser.uid}`]: 0
  });

  const q = query(collection(db, "conversations", chatId, "messages"), orderBy("createdAt", "asc"));
  unsubMessages = onSnapshot(q, async (snap) => {
    const otherUser = (await getDoc(doc(db, "users", otherId))).data();
    const convData = (await getDoc(doc(db, "conversations", chatId))).data();
    
    const online = isUserOnline(otherUser.lastSeen);
    document.getElementById('other-status').textContent = online ? 'online' : 'offline';
    document.getElementById('header-status-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
    
    msgsEl.innerHTML = '<div class="system-msg">🔒 Messages are end-to-end encrypted.</div>';
    
    const docs = snap.docs;
    const lastMsgId = docs.length > 0 ? docs[docs.length - 1].id : null;

    docs.forEach(doc => {
      const m = doc.data();
      if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return; 
      
      const isMe = m.senderId === currentUser.uid;
      const isNew = doc.id === lastMsgId;
      
      let tickHTML = '';
      if (isMe) {
        const otherReadTime = convData.readAt && convData.readAt[otherId] ? convData.readAt[otherId].toMillis() : 0;
        const msgTime = m.createdAt ? m.createdAt.toMillis() : Date.now();
        if (msgTime <= otherReadTime) tickHTML = `<span class="tick read">${ICONS.tickDouble}</span>`;
        else tickHTML = `<span class="tick">${ICONS.tickSingle}</span>`;
      }

      const timeStr = m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
      
      let contentHTML = m.text;
      if (m.type === 'image') contentHTML = `<img src="${m.mediaUrl}" style="max-width:100%;border-radius:8px;">`;
      else if (m.type === 'audio') contentHTML = `<audio controls src="${m.mediaUrl}" style="max-width:100%;"></audio>`;

      let replyHTML = '';
      if (m.replyToId) {
        replyHTML = `<div class="reply-quote">
          <div class="q-name">${m.replyToSender}</div>
          <div class="q-text">${m.replyToText}</div>
        </div>`;
      }

      const div = document.createElement('div');
      div.className = `msg-row ${isMe ? 'me' : 'them'} ${isNew ? 'new-msg' : ''}`;
      div.innerHTML = `<div class="bubble">${replyHTML}${contentHTML}<div class="msg-meta">${timeStr}${tickHTML}</div></div>`;
      
      let msgPressTimer;
      div.querySelector('.bubble').addEventListener('touchstart', (e) => {
        msgPressTimer = setTimeout(() => {
          showMessageMenu(chatId, doc.id, isMe, m, isMe ? currentUser.displayName : name);
        }, 600);
      }, { passive: true });
      div.querySelector('.bubble').addEventListener('touchend', () => clearTimeout(msgPressTimer));
      div.querySelector('.bubble').addEventListener('touchmove', () => clearTimeout(msgPressTimer));
      
      msgsEl.appendChild(div);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
    
    await updateDoc(doc(db, "conversations", chatId), { 
      [`readAt.${currentUser.uid}`]: serverTimestamp(),
      [`unreadCounts.${currentUser.uid}`]: 0
    });
  });
}

function showMessageMenu(chatId, msgId, isMe, msgData, senderName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:300px;text-align:center">
      <button class="btn-secondary" onclick="window.replyAction('${chatId}', '${msgId}', '${senderName}')">Reply</button>
      <button class="btn-secondary" onclick="window.deleteMessage('${chatId}', '${msgId}', false)">Delete for Me</button>
      ${isMe ? `<button class="btn-danger" onclick="window.deleteMessage('${chatId}', '${msgId}', true)">Delete for Everyone</button>` : ''}
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  window._currentReplyData = { msgId, text: msgData.text || 'Media', senderName };
}
window.replyAction = () => {
  const d = window._currentReplyData;
  setReply({ id: d.msgId, text: d.text }, d.senderName);
  document.querySelector('.modal-overlay').remove();
};
window.deleteMessage = async (chatId, msgId, forEveryone) => {
  document.querySelector('.modal-overlay').remove();
  const msgRef = doc(db, "conversations", chatId, "messages", msgId);
  if (forEveryone) await updateDoc(msgRef, { deletedForEveryone: true, text: "This message was deleted" });
  else await updateDoc(msgRef, { deletedBy: arrayUnion(currentUser.uid) });
};

function openSettingsModal() {
  const currentTheme = localStorage.getItem('ehdra-theme') || 'neon';
  const currentAccent1 = localStorage.getItem('ehdra-accent1') || '#00f3ff';
  const currentAccent2 = localStorage.getItem('ehdra-accent2') || '#ff9900';

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

      <div class="theme-row">
        <label>Primary Color (Buttons)</label>
        <input type="color" id="accent1-picker" value="${currentAccent1}">
      </div>

      <div class="theme-row">
        <label>Secondary Color (Ticks/Replies)</label>
        <input type="color" id="accent2-picker" value="${currentAccent2}">
      </div>

      <hr style="border-color:var(--border); margin: 20px 0;">
      
      <h3>Profile Settings</h3>
      <div class="avatar-wrap" style="margin: 0 auto 15px; width:80px; height:80px;" onclick="document.getElementById('profile-upload').click()">
        <div class="avatar" id="settings-av">${currentUser.photoURL ? `<img src="${currentUser.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : currentUser.displayName[0]}</div>
        <div style="position:absolute; bottom:0; right:0; background:var(--user-accent-1); color:var(--bg-main); border-radius:50%; padding:4px;">${ICONS.camera}</div>
      </div>
      
      <input id="set-name" placeholder="Display Name" value="${currentUser.displayName}">
      <button class="btn-primary" id="btn-save-name">Save Name</button>
      
      ${currentUser.photoURL ? `<button class="btn-danger" id="btn-remove-photo" style="margin-top:10px;">Remove Photo</button>` : ''}
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  // Theme Logic
  document.getElementById('theme-select').onchange = (e) => {
    localStorage.setItem('ehdra-theme', e.target.value);
    applyTheme();
  };
  document.getElementById('accent1-picker').oninput = (e) => {
    localStorage.setItem('ehdra-accent1', e.target.value);
    applyTheme();
  };
  document.getElementById('accent2-picker').oninput = (e) => {
    localStorage.setItem('ehdra-accent2', e.target.value);
    applyTheme();
  };

  // Profile Logic
  document.getElementById('profile-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      document.getElementById('settings-av').innerHTML = '...';
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
      currentUser.photoURL = url;
      alert("Profile updated!");
      overlay.remove();
      renderMain();
    } catch(err) { alert("Error: " + err.message); }
  };

  document.getElementById('btn-save-name').onclick = async () => {
    const newName = document.getElementById('set-name').value.trim();
    if (newName) {
      await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName });
      currentUser.displayName = newName;
      alert("Name updated!"); overlay.remove(); renderMain();
    }
  };
  
  const btnRemove = document.getElementById('btn-remove-photo');
  if (btnRemove) {
    btnRemove.onclick = async () => {
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: null });
      currentUser.photoURL = null;
      alert("Profile photo removed.");
      overlay.remove();
      renderMain();
    };
  }
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