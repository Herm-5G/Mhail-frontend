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
let presenceInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let replyToMsg = null; 
let isBlocked = false;

function applyTheme() {
  const theme = localStorage.getItem('ehdra-theme') || 'neon';
  const accent1 = localStorage.getItem('ehdra-accent1') || '#00f3ff';
  const accent2 = localStorage.getItem('ehdra-accent2') || '#ff9900';
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
  block: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>`,
  forward: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
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
        <div id="forgot-pass-btn" style="text-align:center; margin-top:15px; font-size:13px; color:var(--user-accent-2); cursor:pointer">Forgot Password?</div>
        <div class="error" id="err"></div>
      </form>
    </div></div>`;

  let isLogin = true;
  const uField = document.getElementById('username');
  const sBtn = document.getElementById('submit-btn');
  
  document.getElementById('tab-login').onclick = () => { isLogin = true; uField.style.display='none'; sBtn.textContent='Login'; document.getElementById('tab-login').classList.add('active'); document.getElementById('tab-reg').classList.remove('active'); };
  document.getElementById('tab-reg').onclick = () => { isLogin = false; uField.style.display='block'; sBtn.textContent='Create Account'; document.getElementById('tab-reg').classList.add('active'); document.getElementById('tab-login').classList.remove('active'); };

  // Forgot Password Logic
  document.getElementById('forgot-pass-btn').onclick = async () => {
    const email = document.getElementById('email').value.trim();
    if (!email) return alert("Please enter your email address first.");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox.");
    } catch (error) {
      alert("Error: " + error.message);
    }
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
            <button class="icon" id="new-group-btn" title="New Group">${ICONS.group}</button>
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
          <div style="flex:1; min-width:0;">
            <div class="chat-name" id="other-name">Select Chat</div>
            <div class="chat-status" id="other-status"></div>
            <div class="timer-btn" id="timer-btn" style="display:none" onclick="openTimerModal()">
              ${ICONS.clock} <span id="timer-text">Off</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon" id="group-info-btn" title="Group Info" style="display:none">${ICONS.info}</button>
            <button class="icon" id="block-btn" title="Block User" style="display:none">${ICONS.block}</button>
            <button class="icon" id="delete-chat-btn" title="Delete/Clear Chat">${ICONS.trash}</button>
          </div>
        </div>
        <div class="messages" id="messages"></div>
        
        <div class="blocked-banner" id="blocked-banner">You have blocked this user. Unblock to send messages.</div>

        <div class="reply-banner" id="reply-banner">
          <div class="rb-content"><div class="rb-text" id="rb-text"></div></div>
          <button class="rb-close" onclick="cancelReply()">✕</button>
        </div>

        <div class="composer" id="composer">
          <button class="icon" id="attach-btn">${ICONS.attach}</button>
          <div class="input-wrap"><input id="msg-input" placeholder="Message" autocomplete="off"></div>
          <button class="send-btn" id="send-btn">${ICONS.mic}</button>
        </div>
      </main>
    </div>`;

  document.getElementById('settings-btn').onclick = openSettingsModal;
  document.getElementById('new-group-btn').onclick = openNewGroupModal;
  document.getElementById('back-btn').onclick = () => { document.getElementById('chat-window').classList.remove('active'); cancelReply(); };
  document.getElementById('new-chat-btn').onclick = () => document.getElementById('search').focus();
  
  // Group Info Button Logic
  document.getElementById('group-info-btn').onclick = openGroupInfoModal;

  document.getElementById('delete-chat-btn').onclick = async () => {
    if (!currentChatId) return;
    const convSnap = await getDoc(doc(db, "conversations", currentChatId));
    if (!convSnap.exists()) return;
    const convData = convSnap.data();
    
    if (convData.isGroup) {
      if (convData.createdBy === currentUser.uid) {
        if (confirm("⚠️ You are the admin. Do you want to DELETE this group for everyone permanently?")) {
          const messagesRef = collection(db, "conversations", currentChatId, "messages");
          const snap = await getDocs(messagesRef);
          const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
          await Promise.all(deletePromises);
          await deleteDoc(doc(db, "conversations", currentChatId));
          document.getElementById('chat-window').classList.remove('active');
          alert("Group deleted permanently.");
        }
      } else {
        if (confirm("Leave this group?")) {
          await updateDoc(doc(db, "conversations", currentChatId), { participants: arrayRemove(currentUser.uid) });
          document.getElementById('chat-window').classList.remove('active');
        }
      }
    } else {
      if (confirm("⚠️ WARNING: This will PERMANENTLY delete all messages in this chat.")) {
        try {
          const messagesRef = collection(db, "conversations", currentChatId, "messages");
          const snap = await getDocs(messagesRef);
          const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
          await Promise.all(deletePromises);
          await updateDoc(doc(db, "conversations", currentChatId), { lastMessage: "Chat cleared", lastMessageTime: serverTimestamp(), clearedBy: arrayUnion(currentUser.uid) });
          document.getElementById('chat-window').classList.remove('active');
        } catch (err) { alert("Error: " + err.message); }
      }
    }
  };

  document.getElementById('block-btn').onclick = async () => {
    if (!currentOtherId) return;
    const myRef = doc(db, "users", currentUser.uid);
    
    if (isBlocked) {
      await updateDoc(myRef, { blockedUsers: arrayRemove(currentOtherId) });
      currentUser.blockedUsers = currentUser.blockedUsers.filter(id => id !== currentOtherId);
      alert("User Unblocked");
    } else {
      await updateDoc(myRef, { blockedUsers: arrayUnion(currentOtherId) });
      if (!currentUser.blockedUsers) currentUser.blockedUsers = [];
      currentUser.blockedUsers.push(currentOtherId);
      alert("User Blocked");
    }
    openChat(currentChatId, currentOtherId, document.getElementById('other-name').textContent, document.getElementById('other-av').querySelector('img')?.src, false);
  };

  document.getElementById('search').oninput = async (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const list = document.getElementById('chats-list');
    if (searchTerm.length < 2) { loadMyChats(); return; }
    
    const q = query(collection(db, "users"), where("username", ">=", searchTerm), where("username", "<=", searchTerm + '\uf8ff'));
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
      li.onclick = () => startDM(u.uid, u.displayName, u.photoURL);
      list.appendChild(li);
    });
  };

  const sendAction = async (e) => {
    if (e) e.preventDefault();
    if (isBlocked) return alert("Unblock the user to send messages.");
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    if (!text || !currentChatId) return;
    
    const convSnap = await getDoc(doc(db, "conversations", currentChatId));
    if (!convSnap.exists()) return;
    const convData = convSnap.data();
    const timerMs = convData.timer || 0; 
    let expireAt = null;
    if (timerMs > 0) expireAt = Date.now() + timerMs;

    const msgData = { text: text, senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'text', expireAt, reactions: {} };
    if (replyToMsg) { msgData.replyToId = replyToMsg.id; msgData.replyToText = replyToMsg.text; msgData.replyToSender = replyToMsg.senderName; }
    
    try {
      await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
      const updates = { lastMessage: text, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
      convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
      await updateDoc(doc(db, "conversations", currentChatId), updates);
      
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
    if (isBlocked) return alert("Unblock the user to send media.");
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    
    try {
      document.getElementById('attach-btn').style.opacity = '0.5';
      const url = await uploadToCloudinary(file);
      const convSnap = await getDoc(doc(db, "conversations", currentChatId));
      if (!convSnap.exists()) return;
      const convData = convSnap.data();
      const timerMs = convData.timer || 0;
      let expireAt = null;
      if (timerMs > 0) expireAt = Date.now() + timerMs;

      const msgData = { text: '📷 Image', senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'image', mediaUrl: url, expireAt, reactions: {} };
      if (replyToMsg) { msgData.replyToId = replyToMsg.id; msgData.replyToText = replyToMsg.text; msgData.replyToSender = replyToMsg.senderName; }

      await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
      const updates = { lastMessage: '📷 Image', lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
      convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
      await updateDoc(doc(db, "conversations", currentChatId), updates);
      
      cancelReply();
    } catch(err) { alert("Upload error: " + err.message); }
    document.getElementById('attach-btn').style.opacity = '1';
    e.target.value = '';
  };

  loadMyChats();
}

// --- GROUP INFO MODAL ---
window.openGroupInfoModal = async () => {
  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  if (!convSnap.exists()) return;
  const convData = convSnap.data();
  const isAdmin = convData.createdBy === currentUser.uid;
  
  // Fetch all members
  const membersHTML = await Promise.all(convData.participants.map(async (uid) => {
    const uSnap = await getDoc(doc(db, "users", uid));
    const u = uSnap.data();
    const isCreator = uid === convData.createdBy;
    return `<div class="member-item">
      <div class="avatar">${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : u.displayName[0]}</div>
      <div class="name">${u.displayName} ${isCreator ? '(Admin)' : ''}</div>
      ${(isAdmin && !isCreator) ? `<button class="btn-remove" onclick="removeMember('${uid}')">Remove</button>` : ''}
    </div>`;
  }));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Group Info</h3>
      
      <div class="group-info-avatar" onclick="${isAdmin ? "document.getElementById('group-upload').click()" : ''}">
        ${convData.groupPhotoURL ? `<img src="${convData.groupPhotoURL}">` : convData.groupName[0]}
        ${isAdmin ? `<div style="position:absolute; bottom:0; right:0; background:var(--user-accent-1); color:var(--bg-main); border-radius:50%; padding:6px; font-size:12px;">✎</div>` : ''}
      </div>
      
      <input id="group-name-input" placeholder="Group Name" value="${convData.groupName}" ${isAdmin ? '' : 'disabled'}>
      <input id="group-bio-input" placeholder="Group Bio / Description" value="${convData.groupBio || ''}" ${isAdmin ? '' : 'disabled'}>
      
      ${isAdmin ? `<button class="btn-primary" id="save-group-info" style="margin-bottom:15px">Save Changes</button>` : ''}
      
      <h4 style="text-align:left; margin-bottom:10px; color:var(--text-muted)">Members (${convData.participants.length})</h4>
      <div class="member-list">${membersHTML.join('')}</div>
      
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  // Upload Group Photo
  if (isAdmin) {
    document.getElementById('group-upload').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const url = await uploadToCloudinary(file);
        await updateDoc(doc(db, "conversations", currentChatId), { groupPhotoURL: url });
        overlay.remove();
        openGroupInfoModal(); // refresh modal
      } catch(err) { alert("Error: " + err.message); }
    };

    document.getElementById('save-group-info').onclick = async () => {
      const newName = document.getElementById('group-name-input').value.trim();
      const newBio = document.getElementById('group-bio-input').value.trim();
      if (!newName) return alert("Group name cannot be empty");
      await updateDoc(doc(db, "conversations", currentChatId), { groupName: newName, groupBio: newBio });
      alert("Group info updated!");
      overlay.remove();
      document.getElementById('other-name').textContent = newName;
      loadMyChats();
    };
  }
};

window.removeMember = async (uid) => {
  if (confirm("Remove this member from the group?")) {
    await updateDoc(doc(db, "conversations", currentChatId), { participants: arrayRemove(uid) });
    document.querySelector('.modal-overlay').remove();
    openGroupInfoModal(); // Refresh modal
  }
};

// --- GROUP CREATION ---
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
  if (!name) return alert("Please enter a group name");
  if (window.selectedGroupUsers.size === 0) return alert("Select at least one person");

  const participants = [currentUser.uid, ...Array.from(window.selectedGroupUsers.keys())];
  
  try {
    const newChatRef = doc(collection(db, "conversations"));
    await setDoc(newChatRef, {
      isGroup: true, groupName: name, groupBio: "", groupPhotoURL: null, participants, createdBy: currentUser.uid,
      updatedAt: serverTimestamp(), lastMessage: "Group created", lastMessageTime: serverTimestamp(),
      clearedBy: [], unreadCounts: {}, timer: 0
    });
    document.querySelector('.modal-overlay').remove();
    openChat(newChatRef.id, null, name, null, true);
    loadMyChats();
  } catch(e) { alert("Error creating group: " + e.message); }
};

async function startDM(otherUid, otherName, photoURL) {
  const participants = [currentUser.uid, otherUid].sort();
  const chatId = participants.join('_');
  
  if (!(await getDoc(doc(db, "conversations", chatId))).exists()) {
    await setDoc(doc(db, "conversations", chatId), { 
      participants, updatedAt: serverTimestamp(), lastMessage: "New Chat", clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
    });
  }
  openChat(chatId, otherUid, otherName, photoURL, false);
  document.getElementById('search').value = '';
  loadMyChats();
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
    list.innerHTML = '';
    
    for (const d of sortedDocs) {
      const data = d.data();
      if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue; 
      
      let displayName, photoURL, online = false;
      const isGroup = data.isGroup;

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

      const li = document.createElement('li');
      li.className = 'chat-item';
      li.innerHTML = `<div class="avatar-wrap">
        <div class="avatar">${photoURL ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : displayName[0]}</div>
        ${isGroup ? '' : `<div class="status-dot ${online ? 'online' : 'offline'}"></div>`}
      </div>
      <div class="chat-info"><div class="chat-top"><span class="chat-name">${displayName}</span>${badgeHTML}</div><div class="chat-bottom"><span class="chat-preview">${data.lastMessage || ''}</span></div></div>`;
        
      li.onclick = () => openChat(d.id, isGroup ? null : data.participants.find(id => id !== currentUser.uid), displayName, photoURL, isGroup);
      list.appendChild(li);
    }
  });
}

async function openChat(chatId, otherId, name, photoURL, isGroup) {
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
  
  if (!isGroup) {
    document.getElementById('group-info-btn').style.display = 'none';
    document.getElementById('block-btn').style.display = 'block';
    const otherData = (await getDoc(doc(db, "users", otherId))).data();
    const iBlockedThem = currentUser.blockedUsers && currentUser.blockedUsers.includes(otherId);
    const theyBlockedMe = otherData && otherData.blockedUsers && otherData.blockedUsers.includes(currentUser.uid);
    isBlocked = iBlockedThem || theyBlockedMe;

    if (isBlocked) {
      document.getElementById('blocked-banner').classList.add('show');
      document.getElementById('composer').style.display = 'none';
      document.getElementById('block-btn').style.color = 'var(--user-accent-2)';
    } else {
      document.getElementById('blocked-banner').classList.remove('show');
      document.getElementById('composer').style.display = 'flex';
      document.getElementById('block-btn').style.color = '';
    }
  } else {
    document.getElementById('group-info-btn').style.display = 'block';
    document.getElementById('block-btn').style.display = 'none';
    document.getElementById('blocked-banner').classList.remove('show');
    document.getElementById('composer').style.display = 'flex';
    isBlocked = false;
  }

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
      document.getElementById('other-name').textContent = convData.groupName;
      document.getElementById('other-av').innerHTML = convData.groupPhotoURL ? `<img src="${convData.groupPhotoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : convData.groupName[0];
    } else {
      const otherUser = (await getDoc(doc(db, "users", otherId))).data();
      const online = isUserOnline(otherUser?.lastSeen);
      document.getElementById('other-status').textContent = online ? 'online' : 'offline';
      document.getElementById('header-status-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
      document.getElementById('header-status-dot').style.display = 'block';
    }
    
    msgsEl.innerHTML = '<div class="system-msg">🔒 Messages are end-to-end encrypted.</div>';
    const docs = snap.docs;
    const lastMsgId = docs.length > 0 ? docs[docs.length - 1].id : null;

    docs.forEach(doc => {
      const m = doc.data();
      if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return; 
      if (m.expireAt && m.expireAt < Date.now()) { deleteDoc(doc.ref).catch(e => {}); return; }
      
      const isMe = m.senderId === currentUser.uid;
      const isNew = doc.id === lastMsgId;
      
      let tickHTML = '';
      if (isMe) {
        const otherReadTime = convData.readAt && convData.readAt[otherId] ? convData.readAt[otherId].toMillis() : 0;
        const msgTime = m.createdAt ? m.createdAt.toMillis() : Date.now();
        if (!isGroup && msgTime <= otherReadTime) tickHTML = `<span class="tick read">${ICONS.tickDouble}</span>`;
        else tickHTML = `<span class="tick">${ICONS.tickSingle}</span>`;
      }

      const timeStr = m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
      let contentHTML = m.text;
      if (m.type === 'image') contentHTML = `<img src="${m.mediaUrl}" style="max-width:100%;border-radius:8px;">`;
      else if (m.type === 'audio') contentHTML = `<audio controls src="${m.mediaUrl}" style="max-width:100%;"></audio>`;
      
      let replyHTML = '';
      if (m.replyToId) replyHTML = `<div class="reply-quote"><div class="q-name">${m.replyToSender}</div><div class="q-text">${m.replyToText}</div></div>`;
      let expireHTML = m.expireAt ? `<span style="font-size:10px; color:var(--user-accent-2); margin-left:4px;">⏱️</span>` : '';
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

      const div = document.createElement('div');
      div.className = `msg-row ${isMe ? 'me' : 'them'} ${isNew ? 'new-msg' : ''}`;
      div.innerHTML = `<div class="bubble">${senderNameHTML}${replyHTML}${contentHTML}<div class="msg-meta">${expireHTML}${timeStr}${tickHTML}</div></div>${reactionsHTML}`;
      
      let msgPressTimer;
      div.querySelector('.bubble').addEventListener('touchstart', () => {
        msgPressTimer = setTimeout(() => { showMessageMenu(chatId, doc.id, isMe, m, isMe ? currentUser.displayName : name); }, 600);
      }, { passive: true });
      div.querySelector('.bubble').addEventListener('touchend', () => clearTimeout(msgPressTimer));
      div.querySelector('.bubble').addEventListener('touchmove', () => clearTimeout(msgPressTimer));
      
      msgsEl.appendChild(div);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
    await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp(), [`unreadCounts.${currentUser.uid}`]: 0 });
  });
}

window.openForwardModal = (msgData) => {
  document.querySelector('.modal-overlay').remove();
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

      let name = "Unknown";
      if (data.isGroup) name = data.groupName;
      else {
        const otherId = data.participants.find(id => id !== currentUser.uid);
        name = (await getDoc(doc(db, "users", otherId))).data().displayName;
      }

      const item = document.createElement('div');
      item.className = 'forward-item';
      item.innerHTML = `<div style="flex:1; font-weight:600;">${name}</div>`;
      item.onclick = async () => {
        await addDoc(collection(db, "conversations", d.id, "messages"), {
          text: msgData.text, senderId: currentUser.uid, senderName: currentUser.displayName,
          createdAt: serverTimestamp(), type: msgData.type, mediaUrl: msgData.mediaUrl || null, forwarded: true
        });
        await updateDoc(doc(db, "conversations", d.id), { lastMessage: msgData.text || 'Media', lastMessageTime: serverTimestamp() });
        alert("Forwarded!");
        overlay.remove();
      };
      list.appendChild(item);
    });
  });
};

function showMessageMenu(chatId, msgId, isMe, msgData, senderName) {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:350px;text-align:center">
      <div class="emoji-picker">${emojis.map(e => `<span onclick="toggleReaction('${chatId}', '${msgId}', '${e}'); this.closest('.modal-overlay').remove()">${e}</span>`).join('')}</div>
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
  document.querySelector('.modal-overlay').remove();
};

window.deleteMessage = async (chatId, msgId, forEveryone) => {
  document.querySelector('.modal-overlay').remove();
  const msgRef = doc(db, "conversations", chatId, "messages", msgId);
  if (forEveryone) { try { await deleteDoc(msgRef); } catch (e) { alert("Error: " + e.message); } }
  else { await updateDoc(msgRef, { deletedBy: arrayUnion(currentUser.uid) }); }
};

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

window.cancelReply = () => { replyToMsg = null; document.getElementById('reply-banner').classList.remove('show'); };
function setReply(msg, senderName) {
  replyToMsg = { id: msg.id, text: msg.text || 'Media', senderName: senderName };
  document.getElementById('rb-text').textContent = msg.text || 'Media';
  document.getElementById('reply-banner').classList.add('show');
  document.getElementById('msg-input').focus();
}

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
      <div class="theme-row"><label>Primary Color</label><input type="color" id="accent1-picker" value="${currentAccent1}"></div>
      <div class="theme-row"><label>Secondary Color</label><input type="color" id="accent2-picker" value="${currentAccent2}"></div>
      <hr style="border-color:var(--border); margin: 20px 0;">
      <h3>Profile Settings</h3>
      <div class="avatar-wrap" style="margin: 0 auto 15px; width:80px; height:80px;" onclick="document.getElementById('profile-upload').click()">
        <div class="avatar" id="settings-av">${currentUser.photoURL ? `<img src="${currentUser.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : currentUser.displayName[0]}</div>
        <div style="position:absolute; bottom:0; right:0; background:var(--user-accent-1); color:var(--bg-main); border-radius:50%; padding:4px;">${ICONS.camera}</div>
      </div>
      <input id="set-name" placeholder="Display Name" value="${currentUser.displayName}">
      <button class="btn-primary" id="btn-save-name" style="margin-bottom:10px">Save Name</button>
      
      ${currentUser.photoURL ? `<button class="btn-danger" id="btn-remove-photo" style="margin-bottom:10px;">Remove Photo</button>` : ''}
      
      <hr style="border-color:var(--border); margin: 20px 0;">
      <h3>Security</h3>
      <input id="set-password" type="password" placeholder="New Password (min 6 chars)">
      <button class="btn-primary" id="btn-change-password">Change Password</button>
      
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('theme-select').onchange = (e) => { localStorage.setItem('ehdra-theme', e.target.value); applyTheme(); };
  document.getElementById('accent1-picker').oninput = (e) => { localStorage.setItem('ehdra-accent1', e.target.value); applyTheme(); };
  document.getElementById('accent2-picker').oninput = (e) => { localStorage.setItem('ehdra-accent2', e.target.value); applyTheme(); };

  document.getElementById('profile-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      document.getElementById('settings-av').innerHTML = '...';
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
      currentUser.photoURL = url;
      alert("Profile updated!"); overlay.remove(); renderMain();
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
      alert("Profile photo removed."); overlay.remove(); renderMain();
    };
  }

  // Change Password Logic
  document.getElementById('btn-change-password').onclick = async () => {
    const newPass = document.getElementById('set-password').value;
    if (newPass.length < 6) return alert("Password must be at least 6 characters.");
    try {
      await updatePassword(auth.currentUser, newPass);
      alert("Password successfully changed!");
      overlay.remove();
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        alert("For security reasons, please log out and log back in before changing your password.");
      } else {
        alert("Error changing password: " + error.message);
      }
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
    if (unsubChats) unsubChats();
    if (unsubConvMeta) unsubConvMeta();
    renderAuth();
  }
});