import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxfzb0kvBoTErQTkB_UH33-RTMpd0NjNs",
  authDomain: "mhail-fdb0f.firebaseapp.com",
  projectId: "mhail-fdb0f",
  storageBucket: "mhail-fdb0f.firebasestorage.app",
  messagingSenderId: "850385336150",
  appId: "1:850385336150:web:594aa53199a318209f08f7",
  measurementId: "G-VTSX3KBY8N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appEl = document.getElementById('app');
let currentUser = null;
let currentChatId = null;
let currentOtherId = null;
let unsubMessages = null;

// --- PRESENCE SYSTEM (Online/Offline) ---
let presenceInterval;
function startPresence() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const updatePresence = () => setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
  updatePresence();
  clearInterval(presenceInterval);
  presenceInterval = setInterval(updatePresence, 30000); // Update every 30s
}
function isUserOnline(lastSeenTimestamp) {
  if (!lastSeenTimestamp) return false;
  const diff = Date.now() - lastSeenTimestamp.toMillis();
  return diff < 60000; // Online if active in the last 60 seconds
}

// --- AUTHENTICATION ---
function renderAuth() {
  appEl.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <h1>M-Hail</h1><div class="auth-tagline">Fast, private messaging.</div>
      <div class="tabs">
        <button id="tab-login" class="active">Login</button>
        <button id="tab-reg">Register</button>
      </div>
      <form class="form" id="auth-form">
        <input id="email" type="email" placeholder="Email" required>
        <input id="username" placeholder="Username (for search)" style="display:none" required>
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
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists()) throw new Error("Username is already taken!");

        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(usernameRef, { uid: userCred.user.uid });
        await setDoc(doc(db, "users", userCred.user.uid), { username, email, displayName: username, uid: userCred.user.uid, lastSeen: serverTimestamp() });
      }
    } catch (error) {
      err.textContent = error.message.replace('Firebase: ', '');
    }
  };
}

// --- MAIN CHAT UI ---
function renderChat() {
  appEl.innerHTML = `
    <div class="chat-wrap">
      <aside class="sidebar">
        <div class="me">
          <div class="avatar" id="me-av">?</div>
          <div style="flex:1;font-weight:600" id="me-name">Loading...</div>
          <button id="profile-btn" style="background:none;border:none;font-size:18px;cursor:pointer">⚙️</button>
          <button id="logout" style="background:none;border:none;color:red;font-size:13px;margin-left:8px">Logout</button>
        </div>
        <div class="search-row"><input id="search" placeholder="Search username..."></div>
        <ul class="list" id="chats-list"></ul>
      </aside>
      <main class="chat" id="main-chat">
        <div class="chat-header" id="chat-header" style="display:none">
           <div style="display:flex;align-items:center">
             <button id="back-btn">←</button>
             <span id="chat-name">Chat</span>
           </div>
           <button id="clear-chat" style="background:none;border:none;font-size:20px" title="Clear Chat">🗑️</button>
        </div>
        <div class="messages" id="messages"></div>
        <form class="composer" id="composer" style="display:none">
          <input id="msg-input" placeholder="Type a message..." autocomplete="off">
          <button type="submit">➤</button>
        </form>
        <div style="margin:auto;color:#667781;text-align:center;padding:20px" id="empty-state">
           Select a chat or search for a user
        </div>
      </main>
    </div>`;

  document.getElementById('me-name').textContent = currentUser.displayName;
  document.getElementById('me-av').textContent = currentUser.displayName[0].toUpperCase();
  document.getElementById('logout').onclick = () => signOut(auth);
  document.getElementById('profile-btn').onclick = openSettingsModal;
  document.getElementById('back-btn').onclick = () => document.body.classList.remove('chat-open');
  document.getElementById('clear-chat').onclick = clearChat;
  
  document.getElementById('search').oninput = async (e) => {
    const val = e.target.value.toLowerCase().trim();
    const list = document.getElementById('chats-list');
    if (val.length < 2) { loadMyChats(); return; }
    
    try {
      const q = query(collection(db, "users"), where("username", ">=", val), where("username", "<=", val + '\uf8ff'));
      const snap = await getDocs(q);
      list.innerHTML = '';
      snap.forEach(d => {
        if (d.id === currentUser.uid) return;
        const u = d.data();
        const online = isUserOnline(u.lastSeen);
        const li = document.createElement('li');
        li.innerHTML = `<div class="avatar-wrap"><div class="avatar">${u.displayName[0].toUpperCase()}</div><div class="online-dot ${online?'on':'off'}"></div></div>
          <div class="info"><div class="name">${u.displayName}</div><div class="preview">@${u.username}</div></div>`;
        li.onclick = () => startChat(u.uid, u.displayName);
        list.appendChild(li);
      });
    } catch(err) { alert("Search error: " + err.message); }
  };

  document.getElementById('composer').onsubmit = async (e) => {
    e.preventDefault();
    const inp = document.getElementById('msg-input');
    if (!inp.value.trim() || !currentChatId) return;
    try {
      const text = inp.value.trim();
      await addDoc(collection(db, "conversations", currentChatId, "messages"), {
        text: text, senderId: currentUser.uid, createdAt: serverTimestamp(), deletedForEveryone: false
      });
      await setDoc(doc(db, "conversations", currentChatId), {
        lastMessage: text, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge: true });
      inp.value = '';
    } catch(err) { alert("Send error: " + err.message); }
  };

  loadMyChats();
}

async function startChat(otherUid, otherName) {
  try {
    const participants = [currentUser.uid, otherUid].sort();
    const chatId = participants.join('_');
    const chatRef = doc(db, "conversations", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      await setDoc(chatRef, { participants, updatedAt: serverTimestamp(), lastMessage: "New Chat", clearedBy: [] });
    }
    openChat(chatId, otherUid, otherName);
    document.getElementById('search').value = '';
  } catch(err) { alert("Could not start chat: " + err.message); }
}

async function loadMyChats() {
  const list = document.getElementById('chats-list');
  if (!list) return;
  try {
    const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
    const snap = await getDocs(q);
    
    if (snap.empty) { list.innerHTML = '<div style="padding:20px;text-align:center">No chats yet</div>'; return; }
    list.innerHTML = '';
    
    for (const d of snap.docs) {
      const data = d.data();
      if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue; 

      const otherId = data.participants.find(id => id !== currentUser.uid);
      const otherSnap = await getDoc(doc(db, "users", otherId));
      const otherData = otherSnap.exists() ? otherSnap.data() : { displayName: "Unknown", lastSeen: null };
      const online = isUserOnline(otherData.lastSeen);
      
      const li = document.createElement('li');
      li.innerHTML = `<div class="avatar-wrap"><div class="avatar">${otherData.displayName[0].toUpperCase()}</div><div class="online-dot ${online?'on':'off'}"></div></div>
        <div class="info"><div class="name">${otherData.displayName}</div><div class="preview">${data.lastMessage || ''}</div></div>`;
      li.onclick = () => openChat(d.id, otherId, otherData.displayName);
      list.appendChild(li);
    }
  } catch(err) { console.error(err); }
}

async function openChat(chatId, otherId, name) {
  currentChatId = chatId;
  currentOtherId = otherId;
  document.body.classList.add('chat-open');
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('chat-header').style.display = 'flex';
  document.getElementById('composer').style.display = 'flex';
  document.getElementById('chat-name').textContent = name;

  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '<div style="text-align:center;color:#888">Loading...</div>';
  
  if (unsubMessages) unsubMessages();
  
  // 1. Mark conversation as read right now
  await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp() });

  // 2. Listen to Messages
  const q = query(collection(db, "conversations", chatId, "messages"), orderBy("createdAt", "asc"));
  unsubMessages = onSnapshot(q, async (snap) => {
    const otherUserSnap = await getDoc(doc(db, "users", otherId));
    const otherUser = otherUserSnap.data();
    const convSnap = await getDoc(doc(db, "conversations", chatId));
    const convData = convSnap.data();
    
    msgsEl.innerHTML = '';
    snap.forEach(doc => {
      const m = doc.data();
      if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return; // Hidden for me

      const isMe = m.senderId === currentUser.uid;
      let tickHTML = '';
      
      // --- READ RECEIPTS LOGIC ---
      if (isMe) {
        const otherReadTime = convData.readAt && convData.readAt[otherId] ? convData.readAt[otherId].toMillis() : 0;
        const msgTime = m.createdAt ? m.createdAt.toMillis() : Date.now();
        
        if (msgTime <= otherReadTime) {
          tickHTML = `<span class="tick green">✓✓</span>`; // Read
        } else if (isUserOnline(otherUser.lastSeen)) {
          tickHTML = `<span class="tick yellow">✓</span>`; // Sent, Online
        } else {
          tickHTML = `<span class="tick red">✓</span>`; // Sent, Offline
        }
      }

      const textContent = m.deletedForEveryone ? '<i style="color:#888">This message was deleted</i>' : m.text;
      
      const div = document.createElement('div');
      div.className = `msg-row ${isMe ? 'me' : 'them'}`;
      div.innerHTML = `<div class="bubble">${textContent}<div class="msg-meta">${tickHTML}</div></div>`;
      
      if (!m.deletedForEveryone) {
        div.querySelector('.bubble').onclick = () => showMessageMenu(chatId, doc.id, isMe, m.text);
      }
      msgsEl.appendChild(div);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
    
    // Mark as read again in case new messages arrived while looking
    await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp() });
  });
}

// --- MESSAGE MENU (Delete/Edit) ---
function showMessageMenu(chatId, msgId, isMe, text) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Message Options</h3>
      <button class="btn-secondary" onclick="deleteMessage('${chatId}', '${msgId}', false)">🗑️ Delete for Me</button>
      ${isMe ? `<button class="btn-danger" onclick="deleteMessage('${chatId}', '${msgId}', true)">🚨 Delete for Everyone</button>` : ''}
      <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
}

window.deleteMessage = async (chatId, msgId, forEveryone) => {
  document.querySelector('.modal-overlay').remove();
  const msgRef = doc(db, "conversations", chatId, "messages", msgId);
  if (forEveryone) {
    await updateDoc(msgRef, { deletedForEveryone: true, text: "This message was deleted" });
  } else {
    await updateDoc(msgRef, { deletedBy: arrayUnion(currentUser.uid) });
  }
};

async function clearChat() {
  if (!confirm("Clear this chat? This only deletes it for you.")) return;
  await updateDoc(doc(db, "conversations", currentChatId), { clearedBy: arrayUnion(currentUser.uid) });
  document.body.classList.remove('chat-open');
  currentChatId = null;
  loadMyChats();
}

// --- SETTINGS MODAL (Profile Management) ---
function openSettingsModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>⚙️ Account Settings</h3>
      <input id="set-name" placeholder="Display Name" value="${currentUser.displayName}">
      <button class="btn-primary" id="btn-save-name">Save Name</button>
      <hr style="border:0;border-top:1px solid #ddd;margin:15px 0">
      <input id="set-pass" type="password" placeholder="New Password (min 6 chars)">
      <button class="btn-primary" id="btn-save-pass">Update Password</button>
      <hr style="border:0;border-top:1px solid #ddd;margin:15px 0">
      <button class="btn-danger" id="btn-del-acc">Delete Account (Permanent)</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('btn-save-name').onclick = async () => {
    const newName = document.getElementById('set-name').value.trim();
    if (!newName) return;
    await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName });
    currentUser.displayName = newName;
    document.getElementById('me-name').textContent = newName;
    document.getElementById('me-av').textContent = newName[0].toUpperCase();
    alert("Name updated!");
    overlay.remove();
  };

  document.getElementById('btn-save-pass').onclick = async () => {
    const newPass = document.getElementById('set-pass').value;
    if (newPass.length < 6) return alert("Password must be 6+ chars");
    try {
      await updatePassword(auth.currentUser, newPass);
      alert("Password updated!");
      overlay.remove();
    } catch (e) {
      alert("Error: " + e.message + " (You may need to log out and log back in to change password)");
    }
  };

  document.getElementById('btn-del-acc').onclick = async () => {
    if (!confirm("Are you sure? This will delete your account forever.")) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid));
      await deleteDoc(doc(db, "usernames", currentUser.username));
      await deleteUser(auth.currentUser);
      alert("Account deleted.");
      window.location.reload();
    } catch (e) {
      alert("Please log out and log back in before deleting your account for security reasons.");
    }
  };
}

// --- INIT ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      currentUser = snap.data();
      startPresence();
      renderChat();
    } else {
      currentUser = { uid: user.uid, displayName: user.email.split('@')[0], username: user.email.split('@')[0] };
      renderChat();
    }
  } else {
    currentUser = null;
    clearInterval(presenceInterval);
    if (unsubMessages) unsubMessages();
    renderAuth();
  }
});
