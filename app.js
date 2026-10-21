import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let unsubMessages = null;

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
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", userCred.user.uid), { username, email, displayName: username, uid: userCred.user.uid });
      }
    } catch (error) {
      err.textContent = error.message.replace('Firebase: ', '');
    }
  };
}

// --- CHAT UI ---
function renderChat() {
  appEl.innerHTML = `
    <div class="chat-wrap">
      <aside class="sidebar">
        <div class="me">
          <div class="avatar" id="me-av">?</div>
          <div style="flex:1;font-weight:600" id="me-name">Loading...</div>
          <button id="logout" style="background:none;border:none;color:red;font-size:13px">Logout</button>
        </div>
        <div class="search-row">
          <input id="search" placeholder="Search username to chat...">
        </div>
        <ul class="list" id="chats-list"></ul>
      </aside>
      <main class="chat" id="main-chat">
        <div class="chat-header" id="chat-header" style="display:none">
           <button id="back-btn">←</button>
           <span id="chat-name">Chat</span>
        </div>
        <div class="messages" id="messages"></div>
        <form class="composer" id="composer" style="display:none">
          <input id="msg-input" placeholder="Type a message..." autocomplete="off">
          <button type="submit">➤</button>
        </form>
        <div style="margin:auto;color:#667781;text-align:center;padding:20px" id="empty-state">
           Search for a user to start chatting
        </div>
      </main>
    </div>`;

  document.getElementById('me-name').textContent = currentUser.displayName;
  document.getElementById('me-av').textContent = currentUser.displayName[0].toUpperCase();
  document.getElementById('logout').onclick = () => signOut(auth);

  // Search Users
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
        const li = document.createElement('li');
        li.innerHTML = `<div class="avatar">${u.displayName[0].toUpperCase()}</div>
          <div class="info"><div class="name">${u.displayName}</div><div class="preview">@${u.username}</div></div>`;
        li.onclick = () => startChat(u.uid, u.displayName);
        list.appendChild(li);
      });
    } catch(err) { alert("Search error: " + err.message); }
  };

  // Send Message
  document.getElementById('composer').onsubmit = async (e) => {
    e.preventDefault();
    const inp = document.getElementById('msg-input');
    if (!inp.value.trim() || !currentChatId) return;
    try {
      await addDoc(collection(db, "conversations", currentChatId, "messages"), {
        text: inp.value.trim(), senderId: currentUser.uid, createdAt: serverTimestamp()
      });
      inp.value = '';
    } catch(err) { alert("Send error: " + err.message); }
  };

  document.getElementById('back-btn').onclick = () => document.body.classList.remove('chat-open');
  loadMyChats();
}

async function startChat(otherUid, otherName) {
  try {
    const participants = [currentUser.uid, otherUid].sort();
    const chatId = participants.join('_');
    const chatRef = doc(db, "conversations", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      await setDoc(chatRef, { participants, updatedAt: serverTimestamp() });
    }
    openChat(chatId, otherName);
    document.getElementById('search').value = '';
    loadMyChats();
  } catch(err) { alert("Could not start chat: " + err.message); }
}

async function loadMyChats() {
  const list = document.getElementById('chats-list');
  if (!list) return;
  try {
    const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
    const snap = await getDocs(q);
    
    if (snap.empty) { list.innerHTML = '<div style="padding:20px;color:#667781;text-align:center">No chats yet. Search above!</div>'; return; }
    
    list.innerHTML = '';
    for (const d of snap.docs) {
      const data = d.data();
      const otherId = data.participants.find(id => id !== currentUser.uid);
      const otherSnap = await getDoc(doc(db, "users", otherId));
      const otherName = otherSnap.exists() ? otherSnap.data().displayName : "Unknown";
      
      const li = document.createElement('li');
      li.innerHTML = `<div class="avatar">${otherName[0].toUpperCase()}</div>
        <div class="info"><div class="name">${otherName}</div></div>`;
      li.onclick = () => openChat(d.id, otherName);
      list.appendChild(li);
    }
  } catch(err) { alert("Load chats error: " + err.message); }
}

function openChat(chatId, name) {
  currentChatId = chatId;
  document.body.classList.add('chat-open');
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('chat-header').style.display = 'flex';
  document.getElementById('composer').style.display = 'flex';
  document.getElementById('chat-name').textContent = name;

  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '<div style="text-align:center;color:#888">Loading messages...</div>';
  
  if (unsubMessages) unsubMessages();
  
  try {
    const q = query(collection(db, "conversations", chatId, "messages"), orderBy("createdAt", "asc"));
    unsubMessages = onSnapshot(q, (snap) => {
      msgsEl.innerHTML = '';
      snap.forEach(doc => {
        const m = doc.data();
        const isMe = m.senderId === currentUser.uid;
        msgsEl.innerHTML += `<div class="msg-row ${isMe ? 'me' : 'them'}"><div class="bubble">${m.text}</div></div>`;
      });
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }, (error) => {
      alert("Snapshot error: " + error.message);
    });
  } catch (err) { alert("Chat error: " + err.message); }
}

// --- INIT ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        currentUser = snap.data();
      } else {
        // Fallback if user document was deleted or didn't save
        currentUser = { uid: user.uid, displayName: user.email.split('@')[0], username: user.email.split('@')[0] };
      }
      renderChat();
    } catch (err) {
      alert("Auth error: " + err.message);
    }
  } else {
    currentUser = null;
    if (unsubMessages) unsubMessages();
    renderAuth();
  }
});
