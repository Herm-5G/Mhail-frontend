import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updatePassword, deleteUser, sendPasswordResetEmail } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, onSnapshot, orderBy,
  serverTimestamp, updateDoc, deleteDoc, arrayUnion, increment, arrayRemove, Timestamp,
  collectionGroup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// ══════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════
const CLOUD_NAME = "rirfqxoz";
const UPLOAD_PRESET = "Ehdra_Preset";
const VAPID_KEY = ""; // ← put your FCM VAPID public key here (Firebase Console → Cloud Messaging → Web Push certificates)

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

// ── Persistent cache (huge snappiness win) ──────────────────
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const appEl = document.getElementById('app');

// ══════════════════════════════════════════════════════════════
// CONSTANTS & STATE
// ══════════════════════════════════════════════════════════════
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
const STATUS_TTL_MS  = 5 * 60 * 60 * 1000;
const MEDIA_LIMITS   = { image: 5*1024*1024, audio: 5*1024*1024, video: 3*1024*1024, document: 2*1024*1024 };

let currentUser = null;
let currentChatId = null;
let currentOtherId = null;
let currentConvData = null;
let currentChatMeta = null;
let unsubMessages = null, unsubChats = null, unsubConvMeta = null,
    unsubBroadcast = null, unsubExplore = null, unsubStatuses = null, unsubUsers = null;
let presenceInterval = null;
let mediaRecorder = null, audioChunks = [], isRecording = false;
let replyToMsg = null;
let currentTab = 'friends';
let isSending = false;
let pendingMessages = [];
let currentMessages = [];
let knownChatTimestamps = new Map();
let activeStatusUsers = new Set();
let typingTimeout = null, lastTypingUpdate = 0;
let userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000;
let chatListRenderTimer = null;

// ══════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════
function toMillis(v){ if(!v) return 0; if(typeof v==='number') return v;
  if(typeof v.toMillis==='function') return v.toMillis(); return 0; }

function isUserOnline(lastSeen){
  if(!lastSeen) return false;
  return (Date.now() - toMillis(lastSeen)) < 60000;
}

function formatDateLabel(ms){
  const d=new Date(ms), t=new Date(), y=new Date(); y.setDate(t.getDate()-1);
  const same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  if(same(d,t)) return 'Today';
  if(same(d,y)) return 'Yesterday';
  return d.toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'});
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function normalizePhone(raw){
  if(!raw) return null;
  const s=String(raw).replace(/[^\d+]/g,'');
  return s.length>=8 ? s : null;
}

function phoneMatchKey(raw){
  const s=normalizePhone(raw);
  return s ? s.replace(/\D/g,'').slice(-9) : null;
}

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════
window.showToast = (msg, ms=2200) => {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(),320); }, ms);
};

window.showAlert = (title, message, isConfirm=false, onConfirm=null) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>${escapeHtml(title)}</h3>
      <p style="font-size:14px;margin-bottom:20px;color:var(--text-muted)">${escapeHtml(message)}</p>
      <div style="display:flex;gap:10px">
        ${isConfirm ? `<button class="btn-secondary" style="flex:1;margin:0" onclick="this.closest('.modal-overlay').remove()">Cancel</button>` : ''}
        <button class="btn-primary" id="alert-ok" style="flex:1;margin:0">${isConfirm?'Confirm':'OK'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#alert-ok').onclick = () => { if(onConfirm) onConfirm(); overlay.remove(); };
};

// ══════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════
const ICONS = {
  back:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
  dots:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  attach:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`,
  mic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
  send:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
  tickSingle:`<svg viewBox="0 0 16 16"><path d="M11.071 3.929L5.5 9.5 3.5 7.5l-1.414 1.414L5.5 12.328l6.985-6.985z"/></svg>`,
  tickDouble:`<svg viewBox="0 0 16 16"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>`,
  trash:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
  group:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  forward:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>`,
  info:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  addUser:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  emoji:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>`,
  explore:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/></svg>`,
  status:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  search:`<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>`,
  pin:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>`,
  mute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
  download:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
  close:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  camera:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  phonebook:`<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-7 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm6 14H7v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`
};

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS (foreground + FCM background)
// ══════════════════════════════════════════════════════════════
let audioContext = null;
let audioUnlocked = false;

function unlockAudio(){
  if(audioUnlocked && audioContext && audioContext.state === 'running') return;
  try{
    if(!audioContext) audioContext = new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended') audioContext.resume();
    audioUnlocked = true;
  }catch(_){}
}
['pointerdown','keydown','touchstart'].forEach(ev =>
  document.addEventListener(ev, unlockAudio, { passive: true, once: false }));

function playChime(){
  try{
    unlockAudio();
    if(!audioContext) return;
    if(audioContext.state==='suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const tone = (freq, start, dur, vol=0.2) => {
      const o = audioContext.createOscillator(), g = audioContext.createGain();
      o.connect(g); g.connect(audioContext.destination);
      o.type='sine'; o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start+dur);
      o.start(start); o.stop(start+dur);
    };
    tone(880, now, 0.15);
    tone(1175, now+0.08, 0.25);
  }catch(_){}
}

async function requestNotificationPermission(){
  if('Notification' in window && Notification.permission === 'default'){
    try{ await Notification.requestPermission(); }catch(_){}
  }
}

async function registerPush(){
  if(!currentUser || !VAPID_KEY) return;
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  if(!('serviceWorker' in navigator)) return;
  try{
    const reg = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if(token){
      await setDoc(doc(db,'users',currentUser.uid), { fcmToken: token }, { merge: true });
    }
    onMessage(messaging, (payload) => {
      // Foreground: show in-app toast + chime
      const body = payload.notification?.body || 'New message';
      showToast(`${payload.notification?.title || 'Mofie'}: ${body}`);
      playChime();
    });
  }catch(e){
    console.warn('FCM init skipped:', e.message);
  }
}

function notifyForeground(senderName, text, chatId){
  if(document.visibilityState === 'visible'){
    playChime();
    return;
  }
  // Tab hidden but no FCM → fall back to system Notification
  if('Notification' in window && Notification.permission === 'granted'){
    try{
      const n = new Notification(senderName || 'Mofie', {
        body: text || 'New message',
        tag: chatId,
        silent: false
      });
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => n.close(), 8000);
    }catch(_){ playChime(); }
  } else {
    playChime();
  }
}

// ══════════════════════════════════════════════════════════════
// PHONEBOOK INTEGRATION
// ══════════════════════════════════════════════════════════════
const canPickContacts = 'contacts' in navigator && 'ContactsManager' in window;

window.openPhonebookPicker = async () => {
  // Require phone number on profile first
  if(!currentUser.phoneNumber){
    promptPhoneNumber();
    return;
  }
  if(!canPickContacts){
    showAlert(
      'Phonebook not available',
      'Your browser does not support reading the phonebook. Open this app in Chrome on Android, or manually add a contact by @username.'
    );
    return;
  }
  try{
    const contacts = await navigator.contacts.select(['name','tel'], { multiple: true });
    if(!contacts || !contacts.length) return;

    // Collect phone strings
    const phones = [];
    contacts.forEach(c => {
      (c.tel || []).forEach(t => {
        const n = normalizePhone(t);
        if(n) phones.push(n);
      });
    });
    if(!phones.length){
      showToast('No phone numbers found');
      return;
    }

    // Query in chunks of 30
    const chunks = [];
    for(let i=0; i<phones.length; i+=30) chunks.push(phones.slice(i,i+30));

    const found = new Map(); // normalized phone → user
    await Promise.all(chunks.map(async batch => {
      try{
        const snap = await getDocs(query(
          collection(db,'users'), where('phoneNumber','in',batch)
        ));
        snap.forEach(d => {
          const u = d.data();
          const n = normalizePhone(u.phoneNumber);
          if(n) found.set(n, { uid: d.id, ...u });
        });
      }catch(e){ console.warn('phone lookup', e.message); }
    }));

    // Some contacts may have stored in alternate formats — fallback last-9-digit scan
    if(found.size === 0 && phones.length > 0){
      try{
        const all = await getDocs(collection(db,'users'));
        all.forEach(d => {
          const u = d.data();
          const key = phoneMatchKey(u.phoneNumber);
          if(!key) return;
          for(const p of phones){
            if(phoneMatchKey(p) === key){
              found.set(normalizePhone(u.phoneNumber), { uid: d.id, ...u });
              break;
            }
          }
        });
      }catch(e){ console.warn('fallback lookup', e.message); }
    }

    renderPickedContacts(contacts, found);
  }catch(err){
    if(err.name !== 'AbortError') showToast('Could not open phonebook');
  }
};

function renderPickedContacts(rawContacts, foundMap){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const rows = [];
  const seen = new Set();
  rawContacts.forEach(c => {
    const name = (c.name && c.name[0]) || 'Unknown';
    (c.tel || []).forEach(t => {
      const n = normalizePhone(t);
      if(!n || seen.has(n)) return;
      seen.add(n);
      const u = foundMap.get(n);
      rows.push({ name, phone: n, user: u });
    });
  });

  overlay.innerHTML = `
    <div class="modal">
      <h3>Phonebook matches</h3>
      <div style="max-height:340px;overflow-y:auto;margin-bottom:12px">
        ${rows.map((r,i) => `
          <div class="user-select-item" data-i="${i}">
            <div class="avatar">${r.user?.photoURL
              ? `<img src="${r.user.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
              : (r.name||'?')[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">${escapeHtml(r.name)}</div>
              <div style="font-size:12px;color:var(--text-muted)">${
                r.user ? `@${escapeHtml(r.user.username)}.mofie` : escapeHtml(r.phone)
              }</div>
            </div>
            ${r.user
              ? `<span style="color:var(--user-accent-1);font-size:12px;font-weight:700">ON MOFIE</span>`
              : `<span style="color:var(--text-muted);font-size:12px">Not on Mofie</span>`}
          </div>`).join('')}
      </div>
      <button class="btn-primary" id="save-matches">Save on-Mofie contacts</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('save-matches').onclick = async () => {
    const matches = rows.filter(r => r.user);
    if(!matches.length){
      showToast('No Mofie users in your selection');
      return;
    }
    for(const m of matches){
      await saveMofieContactInternal(m.user.uid, m.user.username, m.user.displayName, m.user.photoURL);
    }
    overlay.remove();
    showToast(`Saved ${matches.length} contact${matches.length>1?'s':''}`);
    loadMyContacts();
  };
}

async function saveMofieContactInternal(uid, username, displayName, photoURL){
  await setDoc(doc(db,'users',currentUser.uid,'mofieContacts', uid), {
    mofieUsername: username,
    customName: displayName,
    photoURL: photoURL || null,
    savedAt: serverTimestamp()
  }, { merge: true });
}

// Download .vcf for a user — creates the "@username.mofie" phonebook entry
window.saveMofieContactToPhone = (user) => {
  const handle = `@${user.username}.mofie`;
const url = `${window.location.origin}/Mhail-frontend/?u=${encodeURIComponent(user.username)}`;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${handle}`,
    `ORG:Mofie`,
    `URL:${url}`,
    `NOTE:Open in Mofie → ${handle}`
  ];
  if(user.phoneNumber) lines.push(`TEL;TYPE=CELL:${user.phoneNumber}`);
  lines.push('END:VCARD');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${user.username}.vcf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast(`Contact saved as ${handle}`);
};

window.promptPhoneNumber = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Add your phone number</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Used so friends can find you in their phonebook.<br>Include country code (e.g. +256790311166).
      </p>
      <input id="phone-input" type="tel" placeholder="+256 700 000 000" value="${escapeHtml(currentUser.phoneNumber||'')}">
      <button class="btn-primary" id="save-phone">Save</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('save-phone').onclick = async () => {
    const raw = document.getElementById('phone-input').value.trim();
    const norm = normalizePhone(raw);
    if(!norm){ showToast('Invalid phone number'); return; }
    try{
      await setDoc(doc(db,'users',currentUser.uid), { phoneNumber: norm }, { merge: true });
      currentUser.phoneNumber = norm;
      overlay.remove();
      showToast('Phone number saved');
      openPhonebookPicker();
    }catch(e){ showAlert('Error', e.message); }
  };
};
// ══════════════════════════════════════════════════════════════
// DEEP LINK  (?u=username)
// ══════════════════════════════════════════════════════════════
async function handleDeepLink(){
  const params = new URLSearchParams(window.location.search);
  const username = (params.get('u') || '').toLowerCase();
  const chatParam = params.get('chat');
  if(!username && !chatParam) return;

  // Wait for auth to settle
  const ready = () => new Promise(resolve => {
    if(currentUser) return resolve(true);
    const t = setInterval(() => { if(currentUser){ clearInterval(t); resolve(true); } }, 300);
    setTimeout(() => { clearInterval(t); resolve(false); }, 15000);
  });
  const ok = await ready();
  if(!ok) return;

  if(chatParam){
    openChatById(chatParam);
  } else if(username){
    try{
      const snap = await getDocs(query(collection(db,'users'), where('username','==',username)));
      if(!snap.empty){
        const u = snap.docs[0].data();
        window.startDM(snap.docs[0].id, u.displayName, u.photoURL);
      } else {
        showToast(`No user found: @${username}.mofie`);
      }
    }catch(e){ console.warn(e); }
  }
  history.replaceState({}, '', '/');
}

async function openChatById(chatId){
  try{
    const snap = await getDoc(doc(db,'conversations', chatId));
    if(!snap.exists()) return;
    const d = snap.data();
    if(!d.participants.includes(currentUser.uid)) return;
    if(d.isGroup){
      openChat(chatId, null, d.groupName, d.groupPhotoURL, true);
    } else {
      const otherId = d.participants.find(id => id !== currentUser.uid);
      const u = await getUserCached(otherId);
      openChat(chatId, otherId, u.displayName, u.photoURL, false);
    }
  }catch(e){ console.warn(e); }
}

// ══════════════════════════════════════════════════════════════
// USER CACHE + USERS SUBSCRIPTION (batch lookup replacement)
// ══════════════════════════════════════════════════════════════
async function getUserCached(uid){
  if(!uid) return { displayName: 'Unknown' };
  const hit = userCache.get(uid);
  if(hit && Date.now() - hit.ts < USER_CACHE_TTL) return hit.data;
  try{
    const snap = await getDoc(doc(db,'users',uid));
    const data = snap.exists() ? snap.data() : { displayName: 'Unknown' };
    userCache.set(uid, { data, ts: Date.now() });
    return data;
  }catch(e){
    return (hit && hit.data) ? hit.data : { displayName: 'Unknown' };
  }
}

function subscribeToUsers(){
  if(unsubUsers) unsubUsers();
  unsubUsers = onSnapshot(collection(db,'users'), (snap) => {
    snap.forEach(d => {
      userCache.set(d.id, { data: d.data(), ts: Date.now() });
    });
    scheduleChatListRender();
  });
}

// ══════════════════════════════════════════════════════════════
// PRESENCE + SWEEP
// ══════════════════════════════════════════════════════════════
function startPresence(){
  if(!currentUser) return;
  const ref = doc(db,'users',currentUser.uid);
  const update = () => setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true });
  update();
  clearInterval(presenceInterval);
  presenceInterval = setInterval(update, 30000);
}

function startExpirySweep(){
  setInterval(async () => {
    const now = Timestamp.now();
    try{
      const st = await getDocs(query(collection(db,'statuses'), where('expireAt','<=',now)));
      st.forEach(d => deleteDoc(d.ref).catch(()=>{}));
      const ms = await getDocs(query(collectionGroup(db,'messages'), where('expireAt','<=',now)));
      ms.forEach(d => deleteDoc(d.ref).catch(()=>{}));
    }catch(_){}
  }, 15 * 60 * 1000);
}

function subscribeToStatuses(){
  if(unsubStatuses) unsubStatuses();
  unsubStatuses = onSnapshot(collection(db,'statuses'), (snap) => {
    const now = Date.now();
    activeStatusUsers.clear();
    snap.forEach(d => {
      const s = d.data();
      const ex = toMillis(s.expireAt);
      if(ex && ex < now){ deleteDoc(d.ref).catch(()=>{}); return; }
      activeStatusUsers.add(s.userId);
    });
    document.querySelectorAll('#chats-list .chat-item[data-uid]').forEach(el => {
      const uid = el.dataset.uid;
      const wrap = el.querySelector('.avatar-wrap');
      if(wrap && uid){
        if(activeStatusUsers.has(uid)) wrap.classList.add('has-status');
        else wrap.classList.remove('has-status');
      }
    });
  });
}

function applyTheme(){
  const t = localStorage.getItem('mofie-theme') || 'dark';
  const a1 = localStorage.getItem('mofie-accent1') || '#00a884';
  const a2 = localStorage.getItem('mofie-accent2') || '#53bdeb';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.setProperty('--user-accent-1', a1);
  document.documentElement.style.setProperty('--user-accent-2', a2);
}
applyTheme();

async function uploadToCloudinary(file){
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method:'POST', body: fd });
  const data = await res.json();
  if(data.secure_url) return data.secure_url;
  throw new Error(data.error ? data.error.message : 'Upload failed');
}

// ══════════════════════════════════════════════════════════════
// SPLASH
// ══════════════════════════════════════════════════════════════
function renderSplash(msg = 'Loading...'){
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card" style="text-align:center;max-width:320px">
        <div class="logo-container">
          <svg class="butterfly-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
          <h1 class="logo-text">Mofie</h1>
        </div>
        <div class="splash-loader"></div>
        <div style="color:var(--text-muted);font-size:13px;margin-top:16px">${msg}</div>
      </div>
    </div>`;
}

async function loadUserWithRetry(uid, maxTries=3){
  for(let i=0;i<maxTries;i++){
    try{
      const snap = await getDoc(doc(db,'users',uid));
      if(snap.exists()) return snap.data();
    }catch(e){ console.warn('retry', i, e.message); }
    if(i<maxTries-1) await new Promise(r => setTimeout(r, 600 * (i+1)));
  }
  return null;
}
// ══════════════════════════════════════════════════════════════
// AUTH SCREEN
// ══════════════════════════════════════════════════════════════
function renderAuth(){
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="logo-container">
          <svg class="butterfly-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
          <h1 class="logo-text">Mofie</h1>
        </div>
        <div class="auth-tagline">Pure, Fast and convenient</div>
        <div class="tabs">
          <button id="tab-login" class="active" type="button">Login</button>
          <button id="tab-reg" type="button">Register</button>
        </div>
        <form class="form" id="auth-form" novalidate>
          <div class="input-group">
            <input id="email" type="email" placeholder="Email" autocomplete="email" required>
            <div class="field-msg" id="email-msg"></div>
          </div>
          <div class="input-group" id="username-group" style="display:none">
            <input id="username" placeholder="Username (a-z, 0-9)" autocomplete="username">
            <div class="field-msg" id="username-msg"></div>
          </div>
          <div class="input-group" id="phone-group" style="display:none">
            <input id="reg-phone" type="tel" placeholder="Phone with country code (optional)">
            <div class="field-msg" id="phone-msg"></div>
          </div>
          <div class="input-group">
            <input id="pass" type="password" placeholder="Password" autocomplete="current-password" required>
            <div class="field-msg" id="pass-msg"></div>
          </div>
          <button type="submit" id="submit-btn"><span class="btn-text">Login</span></button>
          <div id="forgot-pass-btn" style="text-align:center;margin-top:15px;font-size:13px;color:var(--user-accent-2);cursor:pointer">Forgot Password?</div>
          <div class="error" id="err"></div>
          <div class="auth-status" id="auth-status"></div>
        </form>
      </div>
    </div>`;

  const $ = id => document.getElementById(id);
  const emailInput = $('email'), userInput = $('username'), passInput = $('pass'),
        phoneInput = $('reg-phone'), form = $('auth-form'), errEl = $('err'),
        authStatus = $('auth-status'), usernameGroup = $('username-group'),
        phoneGroup = $('phone-group');
  let isLogin = true, isSubmitting = false, usernameTimer;

  const lastEmail = localStorage.getItem('mofie-last-email');
  if(lastEmail) emailInput.value = lastEmail;

  const isEmailValid = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isUsernameValid = v => /^[a-z0-9]{3,20}$/.test(v);

  const setField = (inp, msgEl, state, message='') => {
    inp.classList.remove('valid','invalid');
    if(state==='valid') inp.classList.add('valid');
    if(state==='invalid') inp.classList.add('invalid');
    if(msgEl){ msgEl.textContent = message; msgEl.className = 'field-msg ' + (state||''); }
  };

  const showStatus = (msg, type='info') => {
    authStatus.textContent = msg;
    authStatus.className = 'auth-status show ' + type;
  };

  emailInput.addEventListener('input', () => {
    const v = emailInput.value;
    if(!v) return setField(emailInput, $('email-msg'), null);
    if(isEmailValid(v)) setField(emailInput, $('email-msg'), 'valid', 'Looks good');
    else setField(emailInput, $('email-msg'), 'invalid', 'Enter a valid email');
  });

  userInput.addEventListener('input', () => {
    const v = userInput.value.toLowerCase().trim();
    userInput.value = v;
    if(!v) return setField(userInput, $('username-msg'), null);
    if(!isUsernameValid(v)) return setField(userInput, $('username-msg'), 'invalid', '3–20 chars: a-z, 0-9');
    clearTimeout(usernameTimer);
    setField(userInput, $('username-msg'), null, 'Checking...');
    usernameTimer = setTimeout(async () => {
      try{
        const snap = await getDoc(doc(db,'usernames',v));
        if(snap.exists()) setField(userInput, $('username-msg'), 'invalid', 'Already taken');
        else setField(userInput, $('username-msg'), 'valid', 'Available');
      }catch(_){ setField(userInput, $('username-msg'), null, ''); }
    }, 350);
  });

  passInput.addEventListener('input', () => {
    const v = passInput.value;
    if(!v){ setField(passInput, $('pass-msg'), null); return; }
    if(v.length < 6) setField(passInput, $('pass-msg'), 'invalid', 'At least 6 characters');
    else setField(passInput, $('pass-msg'), 'valid', '');
  });

  const switchTab = (login) => {
    isLogin = login;
    $('tab-login').classList.toggle('active', login);
    $('tab-reg').classList.toggle('active', !login);
    usernameGroup.style.display = login ? 'none' : 'block';
    phoneGroup.style.display = login ? 'none' : 'block';
    $('submit-btn').querySelector('.btn-text').textContent = login ? 'Login' : 'Create Account';
    passInput.setAttribute('autocomplete', login ? 'current-password' : 'new-password');
    errEl.textContent = '';
    authStatus.className = 'auth-status';
  };
  $('tab-login').onclick = () => switchTab(true);
  $('tab-reg').onclick = () => switchTab(false);

  $('forgot-pass-btn').onclick = async () => {
    const email = emailInput.value.trim();
    if(!isEmailValid(email)){ setField(emailInput, $('email-msg'), 'invalid', 'Enter your email first'); return; }
    try{
      showStatus('Sending reset email...', 'info');
      await sendPasswordResetEmail(auth, email);
      showStatus('Reset email sent', 'success');
    }catch(e){ showStatus(e.message.replace('Firebase: ',''), 'error'); }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if(isSubmitting) return;
    errEl.textContent = '';
    const email = emailInput.value.trim();
    const username = userInput.value.toLowerCase().trim();
    const phone = phoneGroup.style.display !== 'none' ? normalizePhone(phoneInput.value) : null;
    const pass = passInput.value;

    if(!isEmailValid(email)){ setField(emailInput, $('email-msg'), 'invalid', 'Enter a valid email'); return; }
    if(!isLogin && !isUsernameValid(username)){ setField(userInput, $('username-msg'), 'invalid', '3–20 chars: a-z, 0-9'); return; }
    if(pass.length < 6){ setField(passInput, $('pass-msg'), 'invalid', 'At least 6 characters'); return; }

    isSubmitting = true;
    const btn = $('submit-btn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Please wait...';
    localStorage.setItem('mofie-last-email', email);

    try{
      if(isLogin){
        showStatus('Signing in...', 'info');
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        showStatus('Checking username...', 'info');
        const us = await getDoc(doc(db,'usernames', username));
        if(us.exists()){ setField(userInput, $('username-msg'), 'invalid', 'Taken'); throw new Error('Username already taken'); }

        showStatus('Creating account...', 'info');
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const profileData = {
          username, email, displayName: username, uid: cred.user.uid,
          lastSeen: serverTimestamp(), photoURL: null, blockedUsers: []
        };
        if(phone) profileData.phoneNumber = phone;
        await Promise.all([
          setDoc(doc(db,'usernames', username), { uid: cred.user.uid }),
          setDoc(doc(db,'users', cred.user.uid), profileData)
        ]);
        showStatus('Welcome!', 'success');
      }
    }catch(error){
      const msg = (error.message || 'Something went wrong').replace('Firebase: ','');
      errEl.textContent = msg;
      showStatus(msg, 'error');
      form.classList.add('shake');
      setTimeout(()=>form.classList.remove('shake'), 400);
    } finally {
      isSubmitting = false;
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = isLogin ? 'Login' : 'Create Account';
    }
  };
}

// ══════════════════════════════════════════════════════════════
// MAIN UI
// ══════════════════════════════════════════════════════════════
function renderMain(){
  appEl.innerHTML = `
    <div class="app-container">
      <aside class="sidebar" id="sidebar">
        <div class="header">
          <div style="display:flex;align-items:center;gap:8px">
            <svg class="butterfly-svg" style="width:24px;height:24px" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
            <h1>Mofie</h1>
          </div>
          <div class="header-icons">
            <button class="icon" id="new-group-btn" title="New Group">${ICONS.group}</button>
            <button class="icon" id="settings-btn">${ICONS.dots}</button>
          </div>
        </div>
        <div class="search-row">
          <input id="search" placeholder="Search @username...">
          <button class="icon" id="status-btn" style="width:38px;height:38px;border-radius:50%;background:var(--bg-main);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--user-accent-2)">${ICONS.status}</button>
        </div>
        <div class="tabs-row">
          <button class="tab-btn" data-tab="groups">Groups</button>
          <button class="tab-btn" data-tab="unread">Unread</button>
          <button class="tab-btn active" data-tab="friends">Chats</button>
          <button class="tab-btn" data-tab="contacts">Contacts</button>
        </div>
        <ul class="chat-list" id="chats-list"></ul>
        <button class="explore-fab" id="explore-btn">${ICONS.explore} Explore</button>
      </aside>

      <main class="chat-window" id="chat-window">
        <div class="chat-header">
          <button id="back-btn">${ICONS.back}</button>
          <div class="avatar-wrap" id="header-profile-btn">
            <div class="avatar" id="other-av"></div>
            <div class="status-dot" id="header-status-dot"></div>
          </div>
          <div style="flex:1;min-width:0">
            <div class="chat-name" id="other-name">Select Chat</div>
            <div class="chat-status" id="other-status"></div>
            <div class="timer-btn" id="timer-btn">${ICONS.clock} <span id="timer-text">24 Hours</span></div>
          </div>
          <div class="header-actions">
            <button class="icon" id="chat-search-btn" title="Search">${ICONS.search}</button>
            <button class="icon" id="group-info-btn" title="Group Info" style="display:none">${ICONS.info}</button>
            <button class="icon" id="chat-menu-btn" title="Menu">${ICONS.dots}</button>
          </div>
        </div>
        <div class="chat-search-bar" id="chat-search-bar">
          <input id="chat-search-input" placeholder="Search messages...">
          <span class="cs-count" id="cs-count"></span>
          <button class="icon" id="close-chat-search">${ICONS.close}</button>
        </div>
        <div class="messages" id="messages"></div>
        <div class="reply-banner" id="reply-banner">
          <div class="rb-content"><div class="rb-text" id="rb-text"></div></div>
          <button class="rb-close" onclick="cancelReply()">✕</button>
        </div>
        <div class="emoji-panel" id="emoji-panel">
          <div class="panel-tabs">
            <button id="tab-emojis" class="active" onclick="switchPanelTab('emoji')">😀 Emojis</button>
            <button id="tab-stickers" onclick="switchPanelTab('sticker')">🖼️ Stickers</button>
          </div>
          <div class="panel-content">
            <div class="emoji-grid" id="emoji-grid"></div>
            <div class="sticker-grid" id="sticker-grid" style="display:none"></div>
          </div>
        </div>
        <div class="composer" id="composer">
          <button class="icon" id="attach-btn">${ICONS.attach}</button>
          <button class="icon" id="emoji-btn" style="margin-right:4px">${ICONS.emoji}</button>
          <div class="input-wrap"><input id="msg-input" placeholder="Message" autocomplete="off"></div>
          <button class="send-btn" id="send-btn" data-mode="mic">${ICONS.mic}</button>
        </div>
      </main>

      <input type="file" id="chat-upload-image" accept="image/*" style="display:none">
      <input type="file" id="chat-upload-audio" accept="audio/*" style="display:none">
      <input type="file" id="chat-upload-video" accept="video/*" style="display:none">
      <input type="file" id="chat-upload-doc" style="display:none">
      <input type="file" id="status-upload" accept="image/*,video/*" style="display:none">
      <input type="file" id="profile-upload" accept="image/*" style="display:none">
      <input type="file" id="group-upload" accept="image/*" style="display:none">

      <div id="settings-page" class="settings-page">
        <div class="settings-header">
          <button class="icon" id="close-settings-btn">${ICONS.back}</button>
          <h2>Settings</h2>
        </div>
        <div class="settings-list">
          <div class="settings-profile" onclick="openEditProfileModal()">
            <div class="avatar-wrap"><div class="avatar">${currentUser.photoURL
              ? `<img src="${currentUser.photoURL}" style="width:100%;height:100%;object-fit:cover">`
              : escapeHtml(currentUser.displayName[0]||'?')}</div></div>
            <div style="flex:1"><div class="name">${escapeHtml(currentUser.displayName)}</div>
              <div class="username">@${escapeHtml(currentUser.username)}.mofie</div></div>
            <div style="font-size:20px;color:var(--text-muted)">✎</div>
          </div>
          <div class="settings-item" onclick="openThemeModal()"><div class="icon-wrap">🎨</div>
            <div class="info"><h4>Appearance</h4><p>Theme, Colors</p></div></div>
          <div class="settings-item" onclick="openAccountModal()"><div class="icon-wrap">🔒</div>
            <div class="info"><h4>Account</h4><p>Security, Delete Account</p></div></div>
          <div class="settings-item" onclick="openStarredMessages()"><div class="icon-wrap" style="color:#ff9900">★</div>
            <div class="info"><h4>Starred Messages</h4><p>Messages you starred</p></div></div>
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;border-top:1px solid var(--border);margin-top:20px">
            <p>Developed by <b>Herman</b></p><p>+256790311166 · hermanedaru@gmail.com</p>
          </div>
        </div>
      </div>
    </div>`;

  // Populate emojis + stickers
  const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😋','😎','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','😳','😱','😨','😰','🤗','🤔','🤭','😶','😐','😑','🙄','😯','😮','😲','😴','😪','😵','🤐','🤢','🤮','😷','🤒','💩','👻','💀','👽','🤖','🎃'];
  const STICKERS = [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif"
  ];
  document.getElementById('emoji-grid').innerHTML = EMOJIS.map(e =>
    `<span onclick="insertEmoji('${e}')">${e}</span>`).join('');
  document.getElementById('sticker-grid').innerHTML = STICKERS.map(s =>
    `<img src="${s}" onclick="sendSticker('${s}')" />`).join('');

  // Wire
  document.getElementById('settings-btn').onclick = () => document.getElementById('settings-page').classList.add('active');
  document.getElementById('close-settings-btn').onclick = () => document.getElementById('settings-page').classList.remove('active');
  document.getElementById('new-group-btn').onclick = openNewGroupModal;
  document.getElementById('back-btn').onclick = () => {
    document.getElementById('chat-window').classList.remove('active');
    cancelReply();
  };
  document.getElementById('group-info-btn').onclick = openGroupInfoModal;
  document.getElementById('chat-menu-btn').onclick = openChatMenu;
  document.getElementById('chat-search-btn').onclick = openChatSearch;
  document.getElementById('close-chat-search').onclick = () => {
    document.getElementById('chat-search-bar').classList.remove('show');
    document.querySelectorAll('.msg-row.search-hit').forEach(n => n.classList.remove('search-hit'));
  };
  document.getElementById('chat-search-input').addEventListener('input', e => searchInChat(e.target.value));
  document.getElementById('send-btn').onclick = handleSendOrRecord;
  document.getElementById('msg-input').oninput = handleInputTyping;
  document.getElementById('attach-btn').onclick = openAttachMenu;
  document.getElementById('emoji-btn').onclick = toggleEmojiPanel;
  document.getElementById('status-btn').onclick = openStatusTab;
  document.getElementById('explore-btn').onclick = () => {
    if(currentTab === 'explore') exitExplore();
    else activateExplore();
  };
let searchDebounce;
  document.getElementById('search').oninput = (e) => {
    clearTimeout(searchDebounce);
    const term = e.target.value.trim();
    searchDebounce = setTimeout(() => {
      if(currentTab === 'explore') loadExploreUsers();
      else if(term.length < 2) scheduleChatListRender();
      else handleSearch(term);
    }, 250);
  };

  document.getElementById('chat-upload-image').onchange = e => handleMediaUpload(e,'image');
  document.getElementById('chat-upload-audio').onchange = e => handleMediaUpload(e,'audio');
  document.getElementById('chat-upload-video').onchange = e => handleMediaUpload(e,'video');
  document.getElementById('chat-upload-doc').onchange = e => handleMediaUpload(e,'document');
  document.getElementById('status-upload').onchange = handleStatusUpload;

  document.getElementById('msg-input').addEventListener('pointerdown', () => {
    const p = document.getElementById('emoji-panel');
    if(p) p.classList.remove('show');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const fab = document.getElementById('explore-btn');
      fab.classList.remove('active');
      fab.innerHTML = `${ICONS.explore} Explore`;
      currentTab = btn.dataset.tab;
      if(unsubExplore){ unsubExplore(); unsubExplore = null; }
      if(currentTab === 'contacts') loadMyContacts();
      else scheduleChatListRender();
    };
  });

  loadMyChats();
  subscribeToUsers();
  loadMyChats_subscribe();
}

function scheduleChatListRender(){
  clearTimeout(chatListRenderTimer);
  chatListRenderTimer = setTimeout(() => {
    if(currentTab === 'explore') loadExploreUsers();
    else if(currentTab === 'contacts') loadMyContacts();
    else renderChatList();
  }, 80);
}

// ══════════════════════════════════════════════════════════════
// EXPLORE
// ══════════════════════════════════════════════════════════════
function activateExplore(){
  currentTab = 'explore';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const fab = document.getElementById('explore-btn');
  fab.classList.add('active');
  fab.innerHTML = `${ICONS.back} Back`;
  document.getElementById('search').value = '';
  loadExploreUsers();
}
function exitExplore(){
  currentTab = 'friends';
  const fab = document.getElementById('explore-btn');
  fab.classList.remove('active');
  fab.innerHTML = `${ICONS.explore} Explore`;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const t = document.querySelector('.tab-btn[data-tab="friends"]');
  if(t) t.classList.add('active');
  document.getElementById('search').value = '';
  if(unsubExplore){ unsubExplore(); unsubExplore = null; }
  loadMyChats();
}

function loadExploreUsers(){
  const list = document.getElementById('chats-list');
  if(!list) return;
  if(unsubExplore){ unsubExplore(); unsubExplore = null; }
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading users...</div>';

  unsubExplore = onSnapshot(collection(db,'users'), (snap) => {
    if(currentTab !== 'explore') return;
    const users = [];
    snap.forEach(d => {
      if(d.id === currentUser.uid) return;
      const u = d.data();
      if(!u.displayName) return;
      users.push({ id: d.id, ...u });
    });
    users.sort((a,b) => (a.username||'').localeCompare(b.username||''));
    if(!users.length){
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No users yet</div>';
      return;
    }
    list.innerHTML = users.map(u => {
      const online = isUserOnline(u.lastSeen);
      const hasStatus = activeStatusUsers.has(u.id);
      return `<li class="chat-item" data-uid="${u.id}" data-name="${escapeHtml(u.displayName)}" data-photo="${u.photoURL||''}">
        <div class="avatar-wrap ${hasStatus?'has-status':''}">
          <div class="avatar">${u.photoURL
            ? `<img loading="lazy" src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover">`
            : escapeHtml(u.displayName[0]||'?')}</div>
          <div class="status-dot ${online?'online':'offline'}"></div>
        </div>
        <div class="chat-info">
          <div class="chat-top"><span class="chat-name">${escapeHtml(u.displayName)}</span></div>
          <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(u.username)}.mofie</span></div>
        </div>
      </li>`;
    }).join('');
    list.querySelectorAll('.chat-item').forEach(el => {
      el.onclick = () => startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
    });
  });
}

// ══════════════════════════════════════════════════════════════
// CONTACTS TAB (Mofie contacts saved on device)
// ══════════════════════════════════════════════════════════════
async function loadMyContacts(){
  const list = document.getElementById('chats-list');
  if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading contacts...</div>';

  let snap;
  try{ snap = await getDocs(collection(db,'users',currentUser.uid,'mofieContacts')); }
  catch(e){ snap = { empty: true, docs: [] }; }

  const pickerBtn = `
    <button onclick="openPhonebookPicker()">${ICONS.phonebook} Sync from Phonebook</button>`;

  if(snap.empty){
    list.innerHTML = `<div class="contacts-hint">
      No saved Mofie contacts yet.<br>Pull them from your phonebook.
      ${pickerBtn}
    </div>`;
    return;
  }

  const contacts = [];
  await Promise.all(snap.docs.map(async d => {
    const c = d.data();
    const u = await getUserCached(d.id);
    if(!u.displayName) return;
    contacts.push({
      uid: d.id, username: c.mofieUsername || u.username,
      displayName: c.customName || u.displayName,
      photoURL: c.photoURL || u.photoURL, lastSeen: u.lastSeen
    });
  }));
  contacts.sort((a,b) => (a.displayName||'').localeCompare(b.displayName||''));

  list.innerHTML = `<div class="contacts-hint" style="padding:10px">
      ${contacts.length} contact${contacts.length!==1?'s':''} on Mofie ${pickerBtn}
    </div>` + contacts.map(c => {
    const online = isUserOnline(c.lastSeen);
    const hasStatus = activeStatusUsers.has(c.uid);
    return `<li class="chat-item" data-uid="${c.uid}"
              data-name="${escapeHtml(c.displayName)}"
              data-photo="${c.photoURL||''}"
              data-username="${escapeHtml(c.username)}">
      <div class="avatar-wrap ${hasStatus?'has-status':''}">
        <div class="avatar">${c.photoURL
          ? `<img loading="lazy" src="${c.photoURL}" style="width:100%;height:100%;object-fit:cover">`
          : escapeHtml(c.displayName[0]||'?')}</div>
        <div class="status-dot ${online?'online':'offline'}"></div>
      </div>
      <div class="chat-info">
        <div class="chat-top"><span class="chat-name">${escapeHtml(c.displayName)}</span></div>
        <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(c.username)}.mofie</span></div>
      </div>
      <button class="icon" style="padding:8px" onclick="event.stopPropagation();saveMofieContactToPhone({
        username:'${escapeHtml(c.username)}',displayName:'${escapeHtml(c.displayName)}',photoURL:'${c.photoURL||''}'
      })" title="Save to phone">${ICONS.download}</button>
    </li>`;
  }).join('');

  list.querySelectorAll('.chat-item').forEach(el => {
    el.onclick = () => startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
  });
}

// ══════════════════════════════════════════════════════════════
// CHAT LIST (real-time)
// ══════════════════════════════════════════════════════════════
function loadMyChats(){
  if(unsubChats) unsubChats();
  const q = query(
    collection(db,'conversations'),
    where('participants','array-contains',currentUser.uid)
  );

  unsubChats = onSnapshot(q, (snap) => {
    snap.docChanges().forEach(change => {
      const data = change.doc.data();
      const chatId = change.doc.id;
      const newTime = toMillis(data.lastMessageTime);
      const oldTime = knownChatTimestamps.get(chatId) || 0;
      if(change.type === 'modified'
        && newTime > oldTime
        && data.lastMessageSenderId !== currentUser.uid
        && chatId !== currentChatId){
        notifyForeground('New message', data.lastMessage || 'You have a new message', chatId);
      }
      knownChatTimestamps.set(chatId, newTime);
    });
    scheduleChatListRender();
  });
}

// Store latest snapshot for re-render
let latestChatsSnap = null;
function loadMyChats_subscribe(){
  if(unsubChats) unsubChats();
  const q = query(
    collection(db,'conversations'),
    where('participants','array-contains',currentUser.uid)
  );
  unsubChats = onSnapshot(q, (snap) => {
    latestChatsSnap = snap;
    snap.docChanges().forEach(change => {
      const data = change.doc.data();
      const chatId = change.doc.id;
      const newTime = toMillis(data.lastMessageTime);
      const oldTime = knownChatTimestamps.get(chatId) || 0;
      if(change.type === 'modified'
        && newTime > oldTime
        && data.lastMessageSenderId !== currentUser.uid
        && chatId !== currentChatId){
        notifyForeground(data.senderName || 'Mofie', data.lastMessage || 'New message', chatId);
      }
      knownChatTimestamps.set(chatId, newTime);
    });
    scheduleChatListRender();
  });
}

async function renderChatList(){
  const list = document.getElementById('chats-list');
  if(!list) return;
  if(currentTab === 'contacts' || currentTab === 'explore') return;
  const snap = latestChatsSnap;
  if(!snap || snap.empty){
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No chats yet</div>';
    return;
  }

  // Sort docs: pinned first, then by lastMessageTime
  const sorted = snap.docs.slice().sort((a,b) => {
    const da = a.data(), db_ = b.data();
    const pa = (da.pinnedBy||[]).includes(currentUser.uid) ? 1 : 0;
    const pb = (db_.pinnedBy||[]).includes(currentUser.uid) ? 1 : 0;
    if(pa !== pb) return pb - pa;
    return toMillis(db_.lastMessageTime) - toMillis(da.lastMessageTime);
  });

  // Dedup conversations
  const unique = new Map();
  for(const d of sorted){
    const data = d.data();
    if(data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue;
    const key = data.isGroup ? d.id : data.participants.find(id => id !== currentUser.uid);
    if(!key) continue;
    if(!unique.has(key)) unique.set(key, { id: d.id, data, isGroup: data.isGroup });
  }

  const visible = [];
  for(const v of unique.values()){
    const data = v.data;
    if(currentTab === 'groups' && !v.isGroup) continue;
    if(currentTab === 'unread' && (!data.unreadCounts || !data.unreadCounts[currentUser.uid])) continue;
    visible.push(v);
  }
  if(!visible.length){
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No chats</div>';
    return;
  }

  let html = '';
  for(const v of visible){
    let displayName, photoURL, otherUid = '', online = false;
    if(v.isGroup){
      displayName = v.data.groupName || 'Group';
      photoURL = v.data.groupPhotoURL;
    } else {
      otherUid = v.data.participants.find(id => id !== currentUser.uid);
      const u = (await getUserCached(otherUid)) || {};
      displayName = u.displayName || 'Unknown';
      photoURL = u.photoURL;
      online = isUserOnline(u.lastSeen);
    }
    const unread = (v.data.unreadCounts && v.data.unreadCounts[currentUser.uid]) || 0;
    const badge = unread > 0 ? `<div class="unread-badge">${unread}</div>` : '';
    const isPinned = (v.data.pinnedBy || []).includes(currentUser.uid);
    const isMuted = !!(v.data.mutedBy && v.data.mutedBy[currentUser.uid]);
    const pinIcon = isPinned ? `<span class="chat-top-icons">${ICONS.pin}</span>` : '';
    const muteIcon = isMuted ? `<span class="chat-top-icons">${ICONS.mute}</span>` : '';
    const hasStatus = !v.isGroup && activeStatusUsers.has(otherUid);

    html += `<li class="chat-item ${isPinned?'pinned':''}"
              data-uid="${otherUid}"
              data-chatid="${v.id}"
              data-name="${escapeHtml(displayName)}"
              data-photo="${photoURL||''}"
              data-isgroup="${!!v.isGroup}">
      <div class="avatar-wrap ${hasStatus?'has-status':''}">
        <div class="avatar">${photoURL
          ? `<img loading="lazy" src="${photoURL}" style="width:100%;height:100%;object-fit:cover">`
          : escapeHtml(displayName[0]||'?')}</div>
        ${v.isGroup ? '' : `<div class="status-dot ${online?'online':'offline'}"></div>`}
      </div>
      <div class="chat-info">
        <div class="chat-top"><span class="chat-name">${escapeHtml(displayName)}</span>${pinIcon}${muteIcon}${badge}</div>
        <div class="chat-bottom"><span class="chat-preview">${escapeHtml(v.data.lastMessage||'')}</span></div>
      </div>
    </li>`;
  }
  list.innerHTML = html;
  list.querySelectorAll('.chat-item').forEach(el => {
    el.onclick = () => openChat(
      el.dataset.chatid, el.dataset.uid, el.dataset.name,
      el.dataset.photo, el.dataset.isgroup === 'true'
    );
  });
}

// ══════════════════════════════════════════════════════════════
// OPEN CHAT
// ══════════════════════════════════════════════════════════════
async function openChat(chatId, otherId, name, photoURL, isGroup){
  currentChatId = chatId;
  currentOtherId = otherId;
  currentChatMeta = { isGroup, name, otherId };
  currentMessages = [];
  cancelReply();
  document.getElementById('chat-window').classList.add('active');
  document.getElementById('other-name').textContent = name || '';
  document.getElementById('other-av').innerHTML = photoURL
    ? `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : escapeHtml((name||'?')[0]);
  document.getElementById('emoji-panel').classList.remove('show');
  document.getElementById('chat-search-bar').classList.remove('show');

  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';

  if(unsubMessages) unsubMessages();
  if(unsubConvMeta) unsubConvMeta();

  try{
    const snap = await getDoc(doc(db,'conversations',chatId));
    currentConvData = snap.exists() ? snap.data() : {};
  }catch(e){ currentConvData = {}; }
  updateTimerUI(currentConvData.timer || 0);

  // Group info button visibility
  document.getElementById('group-info-btn').style.display = isGroup ? 'block' : 'none';

  unsubConvMeta = onSnapshot(doc(db,'conversations',chatId), async (docSnap) => {
    if(!docSnap.exists()) return;
    const data = docSnap.data();
    currentConvData = data;
    updateTimerUI(data.timer || 0);
    const statusEl = document.getElementById('other-status');

    if(!isGroup && data.typing && data.typing[otherId] && (Date.now() - data.typing[otherId]) < 5000){
      statusEl.textContent = 'typing...';
      statusEl.classList.add('typing-active');
    } else {
      statusEl.classList.remove('typing-active');
      if(isGroup){
        statusEl.textContent = `${data.participants.length} members`;
      } else {
        const u = await getUserCached(otherId);
        const online = isUserOnline(u.lastSeen);
        statusEl.textContent = online ? 'online' : 'offline';
        document.getElementById('header-status-dot').className = `status-dot ${online?'online':'offline'}`;
      }
    }
  });

  await updateDoc(doc(db,'conversations',chatId), {
    [`readAt.${currentUser.uid}`]: serverTimestamp(),
    [`unreadCounts.${currentUser.uid}`]: 0
  }).catch(()=>{});

  const q = query(collection(db,'conversations',chatId,'messages'), orderBy('createdAt','asc'));

  // Incremental append — no full re-render
  let initialLoad = true;
  unsubMessages = onSnapshot(q, async (snap) => {
    const convData = currentConvData || {};
    if(initialLoad){
      renderFullMessages(snap.docs, convData, chatId, otherId, isGroup);
      initialLoad = false;
      attachScrollListener();
    } else {
      snap.docChanges().forEach(change => {
        if(change.type === 'added'){
          const m = change.doc.data();
          if(m.senderId !== currentUser.uid){
            notifyForeground(m.senderName || name, m.text || 'New message', chatId);
          }
          appendMessageRow(change.doc, convData, chatId, otherId, isGroup);
        } else if(change.type === 'modified'){
          updateMessageRow(change.doc, convData, chatId, otherId, isGroup);
        } else if(change.type === 'removed'){
          const el = document.querySelector(`.msg-row[data-msg-id="${change.doc.id}"]`);
          if(el) el.remove();
        }
      });
    }
    const msgs = document.getElementById('messages');
    if(msgs){
      const near = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 120;
      if(near) msgs.scrollTop = msgs.scrollHeight;
    }
    await updateDoc(doc(db,'conversations',chatId), {
      [`readAt.${currentUser.uid}`]: serverTimestamp(),
      [`unreadCounts.${currentUser.uid}`]: 0
    }).catch(()=>{});
  });
}

function renderFullMessages(docs, convData, chatId, otherId, isGroup){
  const msgsEl = document.getElementById('messages');
  if(!msgsEl) return;
  currentMessages = [];
  let html = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';
  let lastDateKey = '';
  docs.forEach(d => {
    const m = d.data();
    m._id = d.id;
    const expireMs = toMillis(m.expireAt);
    if(expireMs && expireMs < Date.now()){ deleteDoc(d.ref).catch(()=>{}); return; }
    if(m.deletedBy && m.deletedBy.includes(currentUser.uid)) return;
    currentMessages.push(m);

    const ms = toMillis(m.createdAt) || Date.now();
    const dateKey = new Date(ms).toDateString();
    if(dateKey !== lastDateKey){
      html += `<div class="date-sep"><span>${formatDateLabel(ms)}</span></div>`;
      lastDateKey = dateKey;
    }
    html += buildMessageRowHTML(m, d.id, convData, otherId, isGroup);
  });
  msgsEl.innerHTML = html;
  bindMessageEvents();
}

function appendMessageRow(docSnap, convData, chatId, otherId, isGroup){
  const msgsEl = document.getElementById('messages');
  if(!msgsEl) return;
  const m = docSnap.data();
  m._id = docSnap.id;
  if(m.deletedBy && m.deletedBy.includes(currentUser.uid)) return;
  currentMessages.push(m);
  const wrap = document.createElement('div');
  wrap.innerHTML = buildMessageRowHTML(m, docSnap.id, convData, otherId, isGroup);
  const row = wrap.firstElementChild;
  msgsEl.appendChild(row);
  bindBubbleEvents(row, m, docSnap.id, chatId, otherId, isGroup);
}

function updateMessageRow(docSnap, convData, chatId, otherId, isGroup){
  const m = docSnap.data();
  m._id = docSnap.id;
  const el = document.querySelector(`.msg-row[data-msg-id="${docSnap.id}"]`);
  if(!el) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = buildMessageRowHTML(m, docSnap.id, convData, otherId, isGroup);
  const newRow = wrap.firstElementChild;
  el.replaceWith(newRow);
  bindBubbleEvents(newRow, m, docSnap.id, chatId, otherId, isGroup);
}

function buildMessageRowHTML(m, docId, convData, otherId, isGroup){
  const isMe = m.senderId === currentUser.uid;
  const ms = toMillis(m.createdAt) || Date.now();
  const timeStr = new Date(ms).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  let tickHTML = '';
  if(isMe){
    const readTime = convData.readAt && convData.readAt[otherId]
      ? toMillis(convData.readAt[otherId]) : 0;
    tickHTML = (ms <= readTime && !isGroup)
      ? `<span class="tick read">${ICONS.tickDouble}</span>`
      : `<span class="tick">${ICONS.tickSingle}</span>`;
  }

  let contentHTML;
  switch(m.type){
    case 'image':
      contentHTML = `<img loading="lazy" src="${m.mediaUrl}"
        style="max-width:100%;border-radius:8px;cursor:zoom-in"
        onclick="event.stopPropagation();openMediaViewer('image','${docId}')">`;
      break;
    case 'video':
      contentHTML = `<video controls src="${m.mediaUrl}" playsinline preload="metadata"
        style="max-width:100%;border-radius:8px;max-height:320px"
        onclick="event.stopPropagation();openMediaViewer('video','${docId}')"></video>`;
      break;
    case 'audio':
      contentHTML = `<audio controls src="${m.mediaUrl}" style="max-width:100%"></audio>`;
      break;
    case 'document':
      contentHTML = `<a href="${m.mediaUrl}" target="_blank" rel="noopener" class="doc-msg">📄 ${escapeHtml(m.fileName||'Document')}</a>`;
      break;
    case 'contact':
      contentHTML = `<div class="contact-card">
        <div class="avatar-wrap"><div class="avatar">${m.contactPhoto
          ? `<img src="${m.contactPhoto}" style="width:100%;height:100%;object-fit:cover">`
          : escapeHtml((m.contactName||'?')[0])}</div></div>
        <div class="cc-info">
          <div class="cc-name">${escapeHtml(m.contactName||'Contact')}</div>
          <div class="cc-sub">@${escapeHtml(m.contactUsername||'user')}.mofie</div>
        </div>
        <button class="cc-btn" onclick="event.stopPropagation();startDM('${m.contactUid}',
          '${escapeHtml(m.contactName||'').replace(/'/g,'')}','${m.contactPhoto||''}')">Message</button>
      </div>`;
      break;
    case 'sticker':
      contentHTML = `<img src="${m.mediaUrl}" class="sticker-img">`;
      break;
    default:
      contentHTML = escapeHtml(m.text || '');
  }

  const bubbleClass = m.type === 'sticker' ? 'bubble sticker-bubble' : 'bubble';
  const replyHTML = m.replyToId
    ? `<div class="reply-quote"><div class="q-name">${escapeHtml(m.replyToSender||'')}</div>
         <div class="q-text">${escapeHtml(m.replyToText||'')}</div></div>` : '';
  const senderHTML = (!isMe && isGroup) ? `<div class="sender-name">${escapeHtml(m.senderName||'')}</div>` : '';
  const starHTML = (m.starredBy||[]).includes(currentUser.uid) ? `<span class="msg-star-indicator">★</span>` : '';

  let reactionsHTML = '';
  if(m.reactions && Object.keys(m.reactions).length){
    const counts = {};
    Object.values(m.reactions).forEach(e => { counts[e] = (counts[e]||0) + 1; });
    reactionsHTML = '<div class="reactions-container">';
    Object.keys(counts).forEach(e => {
      const active = m.reactions[currentUser.uid] === e;
      reactionsHTML += `<div class="reaction-pill ${active?'active':''}"
        onclick="event.stopPropagation();toggleReaction('${currentChatId}','${docId}','${e}')">${e} ${counts[e]}</div>`;
    });
    reactionsHTML += '</div>';
  }

  return `<div class="msg-row ${isMe?'me':'them'}" data-msg-id="${docId}">
    <div class="${bubbleClass}">${senderHTML}${replyHTML}${starHTML}${contentHTML}
      <div class="msg-meta">${timeStr}${tickHTML}</div></div>${reactionsHTML}
  </div>`;
}

function bindMessageEvents(){
  const msgsEl = document.getElementById('messages');
  if(!msgsEl) return;
  msgsEl.querySelectorAll('.msg-row').forEach(row => {
    const docId = row.dataset.msgId;
    const m = currentMessages.find(x => x._id === docId);
    if(!m) return;
    bindBubbleEvents(row, m, docId, currentChatId, currentOtherId, currentChatMeta?.isGroup);
  });
}

function bindBubbleEvents(row, m, docId, chatId, otherId, isGroup){
  const bubble = row.querySelector('.bubble');
  if(!bubble) return;
  const isMe = m.senderId === currentUser.uid;

  let startX = 0;
  bubble.addEventListener('touchstart', e => startX = e.touches[0].clientX, { passive: true });
  bubble.addEventListener('touchend', e => {
    if(e.changedTouches[0].clientX - startX > 60){
      setReply({ id: docId, text: m.text || 'Media' }, isMe ? currentUser.displayName : (m.senderName || ''));
    }
  }, { passive: true });

  let pressTimer;
  const openMenu = () => showMessageMenu(chatId, docId, isMe, m, isMe ? currentUser.displayName : (m.senderName || ''));
  bubble.addEventListener('mousedown', () => { pressTimer = setTimeout(openMenu, 550); });
  bubble.addEventListener('mouseup', () => clearTimeout(pressTimer));
  bubble.addEventListener('mouseleave', () => clearTimeout(pressTimer));
  bubble.addEventListener('touchstart', () => { pressTimer = setTimeout(openMenu, 550); }, { passive: true });
  bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
}
// ══════════════════════════════════════════════════════════════
// MEDIA VIEWER
// ══════════════════════════════════════════════════════════════
let mediaViewerIndex = 0;
window.openMediaViewer = (type, docId) => {
  const mediaMsgs = currentMessages.filter(x => x.type === 'image' || x.type === 'video');
  if(!mediaMsgs.length) return;
  mediaViewerIndex = Math.max(0, mediaMsgs.findIndex(m => m._id === docId));
  renderMediaViewer(mediaMsgs);
};

function renderMediaViewer(mediaMsgs){
  document.querySelectorAll('.media-viewer').forEach(n => n.remove());
  const idx = mediaViewerIndex;
  const m = mediaMsgs[idx];
  const v = document.createElement('div');
  v.className = 'media-viewer';
  v.innerHTML = `
    <div class="mv-counter">${idx+1} / ${mediaMsgs.length}</div>
    <div class="mv-controls">
      <a class="mv-btn" href="${m.mediaUrl}" download target="_blank" rel="noopener">${ICONS.download}</a>
      <button class="mv-btn" id="mv-close">${ICONS.close}</button>
    </div>
    ${m.type === 'video'
      ? `<video src="${m.mediaUrl}" controls autoplay playsinline></video>`
      : `<img src="${m.mediaUrl}" alt="media">`}
    ${mediaMsgs.length > 1 ? `
      <button class="mv-nav prev" id="mv-prev">‹</button>
      <button class="mv-nav next" id="mv-next">›</button>` : ''}`;
  document.body.appendChild(v);

  v.querySelector('#mv-close').onclick = () => v.remove();
  const prev = v.querySelector('#mv-prev'), next = v.querySelector('#mv-next');
  if(prev) prev.onclick = () => {
    mediaViewerIndex = (mediaViewerIndex - 1 + mediaMsgs.length) % mediaMsgs.length;
    renderMediaViewer(mediaMsgs);
  };
  if(next) next.onclick = () => {
    mediaViewerIndex = (mediaViewerIndex + 1) % mediaMsgs.length;
    renderMediaViewer(mediaMsgs);
  };
  let sx = 0;
  v.addEventListener('touchstart', e => sx = e.touches[0].clientX, { passive: true });
  v.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if(Math.abs(dx) < 60) return;
    if(dx > 0 && mediaMsgs.length > 1){
      mediaViewerIndex = (mediaViewerIndex - 1 + mediaMsgs.length) % mediaMsgs.length;
      renderMediaViewer(mediaMsgs);
    } else if(dx < 0 && mediaMsgs.length > 1){
      mediaViewerIndex = (mediaViewerIndex + 1) % mediaMsgs.length;
      renderMediaViewer(mediaMsgs);
    }
  }, { passive: true });
  const keyH = e => {
    if(e.key === 'Escape'){ v.remove(); document.removeEventListener('keydown', keyH); }
  };
  document.addEventListener('keydown', keyH);
}

// ══════════════════════════════════════════════════════════════
// SCROLL-TO-BOTTOM
// ══════════════════════════════════════════════════════════════
function ensureScrollBtn(){
  let btn = document.getElementById('scroll-bottom-btn');
  if(btn) return btn;
  btn = document.createElement('button');
  btn.id = 'scroll-bottom-btn';
  btn.className = 'scroll-bottom-btn';
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
  btn.onclick = () => {
    const m = document.getElementById('messages');
    if(m) m.scrollTo({ top: m.scrollHeight, behavior: 'smooth' });
    btn.classList.remove('show');
  };
  document.getElementById('chat-window')?.appendChild(btn);
  return btn;
}

function attachScrollListener(){
  const m = document.getElementById('messages');
  const btn = ensureScrollBtn();
  if(!m || !btn) return;
  m.onscroll = () => {
    const nearBottom = m.scrollHeight - m.scrollTop - m.clientHeight < 120;
    btn.classList.toggle('show', !nearBottom);
  };
}
// ══════════════════════════════════════════════════════════════
// CHAT SEARCH
// ══════════════════════════════════════════════════════════════
function openChatSearch(){
  const bar = document.getElementById('chat-search-bar');
  bar.classList.toggle('show');
  if(bar.classList.contains('show')){
    document.getElementById('chat-search-input').value = '';
    document.getElementById('chat-search-input').focus();
    document.getElementById('cs-count').textContent = '';
    document.querySelectorAll('.msg-row.search-hit').forEach(n => n.classList.remove('search-hit'));
  }
}

function searchInChat(term){
  const t = term.toLowerCase().trim();
  const rows = document.querySelectorAll('#messages .msg-row');
  let hits = 0, firstHit = null;
  rows.forEach(r => {
    r.classList.remove('search-hit');
    if(t.length < 2) return;
    if((r.textContent || '').toLowerCase().includes(t)){
      r.classList.add('search-hit');
      hits++;
      if(!firstHit) firstHit = r;
    }
  });
  document.getElementById('cs-count').textContent = hits ? `${hits}` : '0';
  if(firstHit) firstHit.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ══════════════════════════════════════════════════════════════
// CHAT MENU (pin, mute, media, delete)
// ══════════════════════════════════════════════════════════════
async function openChatMenu(){
  if(!currentChatId) return;
  const snap = await getDoc(doc(db,'conversations',currentChatId));
  if(!snap.exists()) return;
  const d = snap.data();
  const pinned = (d.pinnedBy || []).includes(currentUser.uid);
  const muted = !!(d.mutedBy && d.mutedBy[currentUser.uid]);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <button class="btn-secondary" id="cm-pin">${pinned ? '📌 Unpin' : '📌 Pin Chat'}</button>
      <button class="btn-secondary" id="cm-mute">${muted ? '🔔 Unmute' : '🔕 Mute'}</button>
      <button class="btn-secondary" id="cm-media">🖼️ Media Gallery</button>
      <button class="btn-danger" id="cm-delete">🗑️ Delete Chat</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cm-pin').onclick = async () => {
    overlay.remove();
    if(pinned) await updateDoc(doc(db,'conversations',currentChatId), { pinnedBy: arrayRemove(currentUser.uid) });
    else await updateDoc(doc(db,'conversations',currentChatId), { pinnedBy: arrayUnion(currentUser.uid) });
    showToast(pinned ? 'Unpinned' : 'Pinned');
  };
  document.getElementById('cm-mute').onclick = async () => {
    overlay.remove();
    if(muted) await updateDoc(doc(db,'conversations',currentChatId), { [`mutedBy.${currentUser.uid}`]: null });
    else await updateDoc(doc(db,'conversations',currentChatId), { [`mutedBy.${currentUser.uid}`]: Date.now() + 365*24*3600*1000 });
    showToast(muted ? 'Unmuted' : 'Muted');
  };
  document.getElementById('cm-media').onclick = () => {
    overlay.remove();
    const media = currentMessages.filter(x => x.type === 'image' || x.type === 'video');
    if(!media.length) return showToast('No media in this chat');
    openMediaViewer(media[0].type, media[0]._id);
  };
  document.getElementById('cm-delete').onclick = () => {
    overlay.remove();
    handleDeleteChat();
  };
}

async function handleDeleteChat(){
  if(!currentChatId) return;
  showAlert('Delete Chat', 'Delete this chat history for yourself?', true, async () => {
    await updateDoc(doc(db,'conversations',currentChatId), { clearedBy: arrayUnion(currentUser.uid) });
    document.getElementById('chat-window').classList.remove('active');
    scheduleChatListRender();
  });
}
// ══════════════════════════════════════════════════════════════
// MESSAGE ACTIONS
// ══════════════════════════════════════════════════════════════
function showMessageMenu(chatId, msgId, isMe, msgData, senderName){
  if(document.querySelector('.msg-menu-overlay')) return;
  const emojis = ['👍','❤️','😂','😮','😢','🙏'];
  const starred = (msgData.starredBy || []).includes(currentUser.uid);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay msg-menu-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:350px;text-align:center">
      <div class="emoji-picker">
        ${emojis.map(e => `<span onclick="toggleReaction('${chatId}','${msgId}','${e}');this.closest('.modal-overlay').remove()">${e}</span>`).join('')}
      </div>
      <button class="btn-secondary" onclick="window._replyPayload={chatId:'${chatId}',msgId:'${msgId}',senderName:'${escapeHtml(senderName)}',text:'${escapeHtml((msgData.text||'Media').replace(/'/g,''))}'};replyAction();">↩️ Reply</button>
      <button class="btn-secondary" onclick="toggleStarMessage('${chatId}','${msgId}');this.closest('.modal-overlay').remove()">${starred ? '★ Unstar' : '★ Star'}</button>
      <button class="btn-secondary" onclick="window._forwardData=window._currentMsgData;openForwardModal(window._currentMsgData);this.closest('.modal-overlay').remove()">${ICONS.forward} Forward</button>
      <button class="btn-secondary" onclick="deleteMessage('${chatId}','${msgId}',false);this.closest('.modal-overlay').remove()">🗑️ Delete for Me</button>
      ${isMe ? `<button class="btn-danger" onclick="deleteMessage('${chatId}','${msgId}',true);this.closest('.modal-overlay').remove()">🗑️ Delete for Everyone</button>` : ''}
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  window._currentMsgData = msgData;
}

window.toggleReaction = async (chatId, msgId, emoji) => {
  const ref = doc(db,'conversations',chatId,'messages',msgId);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;
  const cur = snap.data().reactions || {};
  if(cur[currentUser.uid] === emoji) await updateDoc(ref, { [`reactions.${currentUser.uid}`]: null });
  else await updateDoc(ref, { [`reactions.${currentUser.uid}`]: emoji });
};

window.replyAction = () => {
  const d = window._replyPayload;
  if(!d) return;
  setReply({ id: d.msgId, text: d.text }, d.senderName);
  document.querySelector('.msg-menu-overlay')?.remove();
};

window.toggleStarMessage = async (chatId, msgId) => {
  const ref = doc(db,'conversations',chatId,'messages',msgId);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;
  const starred = (snap.data().starredBy || []).includes(currentUser.uid);
  if(starred) await updateDoc(ref, { starredBy: arrayRemove(currentUser.uid) });
  else await updateDoc(ref, { starredBy: arrayUnion(currentUser.uid) });
  showToast(starred ? 'Removed from starred' : 'Added to starred');
};

window.deleteMessage = async (chatId, msgId, forEveryone) => {
  const ref = doc(db,'conversations',chatId,'messages',msgId);
  try{
    if(forEveryone) await deleteDoc(ref);
    else await updateDoc(ref, { deletedBy: arrayUnion(currentUser.uid) });
  }catch(e){ showAlert('Error', e.message); }
};

window.openForwardModal = (msgData) => {
  document.querySelectorAll('.modal-overlay').forEach(n => n.remove());
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Forward Message</h3>
      <div id="forward-list"><div style="padding:10px;text-align:center">Loading...</div></div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  const q = query(collection(db,'conversations'), where('participants','array-contains',currentUser.uid));
  getDocs(q).then(snap => {
    const list = document.getElementById('forward-list');
    if(!list) return;
    list.innerHTML = '';
    snap.forEach(async d => {
      const data = d.data();
      if(data.clearedBy && data.clearedBy.includes(currentUser.uid)) return;
      let name = data.isGroup ? data.groupName : (await getUserCached(data.participants.find(id => id !== currentUser.uid))).displayName;
      const item = document.createElement('div');
      item.className = 'forward-item';
      item.innerHTML = `<div style="flex:1;font-weight:600">${escapeHtml(name)}</div>`;
      item.onclick = async () => {
        await addDoc(collection(db,'conversations',d.id,'messages'), {
          text: msgData.text || 'Media',
          senderId: currentUser.uid, senderName: currentUser.displayName,
          createdAt: serverTimestamp(), type: msgData.type || 'text',
          mediaUrl: msgData.mediaUrl || null, fileName: msgData.fileName || null,
          forwarded: true,
          expireAt: Timestamp.fromMillis(Date.now() + MESSAGE_TTL_MS)
        });
        await updateDoc(doc(db,'conversations',d.id), {
          lastMessage: msgData.text || 'Media',
          lastMessageSenderId: currentUser.uid,
          lastMessageTime: serverTimestamp()
        });
        showToast('Forwarded!');
        overlay.remove();
      };
      list.appendChild(item);
    });
  });
};
// ══════════════════════════════════════════════════════════════
// SEND / RECORD
// ══════════════════════════════════════════════════════════════
function handleInputTyping(e){
  const btn = document.getElementById('send-btn');
  if(!btn || btn.dataset.mode === 'recording') return;
  const hasText = !!e.target.value.trim();
  if(hasText && btn.dataset.mode !== 'send'){ btn.innerHTML = ICONS.send; btn.dataset.mode = 'send'; }
  else if(!hasText && btn.dataset.mode !== 'mic'){ btn.innerHTML = ICONS.mic; btn.dataset.mode = 'mic'; }

  if(!currentChatId || !e.target.value.trim()) return;
  const now = Date.now();
  if(now - lastTypingUpdate > 2000){
    lastTypingUpdate = now;
    updateDoc(doc(db,'conversations',currentChatId), { [`typing.${currentUser.uid}`]: now }).catch(()=>{});
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    updateDoc(doc(db,'conversations',currentChatId), { [`typing.${currentUser.uid}`]: null }).catch(()=>{});
    lastTypingUpdate = 0;
  }, 3000);
}

function handleSendOrRecord(e){
  if(e) e.preventDefault();
  const inp = document.getElementById('msg-input');
  if(inp.value.trim()) sendAction();
  else toggleRecording();
}

async function sendAction(){
  if(isSending) return;
  const inp = document.getElementById('msg-input');
  const text = inp.value.trim();
  if(!text || !currentChatId || !currentConvData) return;
  isSending = true;

  const now = Date.now();
  const timerMs = currentConvData.timer || 0;
  const expireAt = Timestamp.fromMillis(now + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));

  const msgData = {
    text, senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: 'text', expireAt, reactions: {}, clientTs: now
  };
  if(replyToMsg){
    msgData.replyToId = replyToMsg.id;
    msgData.replyToText = replyToMsg.text;
    msgData.replyToSender = replyToMsg.senderName;
  }

  inp.value = '';
  document.getElementById('send-btn').innerHTML = ICONS.mic;
  document.getElementById('send-btn').dataset.mode = 'mic';
  cancelReply();

  try{
    const updates = {
      lastMessage: text,
      lastMessageSenderId: currentUser.uid,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...currentConvData.participants),
      [`typing.${currentUser.uid}`]: null
    };
    currentConvData.participants.forEach(p => {
      if(p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await Promise.all([
      addDoc(collection(db,'conversations',currentChatId,'messages'), msgData),
      updateDoc(doc(db,'conversations',currentChatId), updates)
    ]);
    clearTimeout(typingTimeout);
    lastTypingUpdate = 0;
  }catch(err){
    showAlert('Error', err.message);
    inp.value = text;
  }
  isSending = false;
}

async function toggleRecording(){
  const btn = document.getElementById('send-btn');
  const input = document.getElementById('msg-input');
  if(!isRecording){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        if(!currentChatId || !currentConvData) return;
        try{
          const url = await uploadToCloudinary(new File([audioBlob], 'voice.webm', { type: 'audio/webm' }));
          const timerMs = currentConvData.timer || 0;
          const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
          const msgData = {
            text: '🎙️ Voice note', senderId: currentUser.uid, senderName: currentUser.displayName,
            createdAt: serverTimestamp(), type: 'audio', mediaUrl: url,
            expireAt, reactions: {}, clientTs: Date.now()
          };
          await addDoc(collection(db,'conversations',currentChatId,'messages'), msgData);
          const updates = {
            lastMessage: '🎙️ Voice note', lastMessageSenderId: currentUser.uid,
            lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
            clearedBy: arrayRemove(...currentConvData.participants)
          };
          currentConvData.participants.forEach(p => {
            if(p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
          });
          await updateDoc(doc(db,'conversations',currentChatId), updates);
        }catch(e){ showAlert('Error', e.message); }
      };
      mediaRecorder.start();
      isRecording = true;
      input.disabled = true;
      input.placeholder = 'Recording...';
      btn.classList.add('recording');
      btn.innerHTML = `<div style="width:16px;height:16px;background:#fff;border-radius:4px"></div>`;
      btn.dataset.mode = 'recording';
    }catch(err){ showAlert('Microphone Error', 'Microphone access denied.'); }
  } else {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
    isRecording = false;
    input.disabled = false;
    input.placeholder = 'Message';
    btn.classList.remove('recording');
    btn.innerHTML = ICONS.mic;
    btn.dataset.mode = 'mic';
  }
}

// ══════════════════════════════════════════════════════════════
// REPLY
// ══════════════════════════════════════════════════════════════
window.cancelReply = () => {
  replyToMsg = null;
  document.getElementById('reply-banner')?.classList.remove('show');
};
function setReply(msg, senderName){
  replyToMsg = { id: msg.id, text: msg.text || 'Media', senderName };
  document.getElementById('rb-text').textContent = msg.text || 'Media';
  document.getElementById('reply-banner').classList.add('show');
  document.getElementById('msg-input').focus();
}
// ══════════════════════════════════════════════════════════════
// ATTACH + UPLOAD
// ══════════════════════════════════════════════════════════════
function openAttachMenu(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Send</h3>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-image').click();this.closest('.modal-overlay').remove()">📷 Photo (max 5MB)</button>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-audio').click();this.closest('.modal-overlay').remove()">🎵 Music (max 5MB)</button>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-video').click();this.closest('.modal-overlay').remove()">🎬 Video (max 3MB)</button>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-doc').click();this.closest('.modal-overlay').remove()">📄 Document (max 2MB)</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove();openShareContactModal()">👤 Share Contact</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
}

async function handleMediaUpload(e, kind){
  const file = e.target.files[0];
  e.target.value = '';
  if(!file || !currentChatId || !currentConvData) return;
  const limit = MEDIA_LIMITS[kind];
  if(file.size > limit) return showAlert('File too large', `Max ${kind} is ${(limit/1024/1024).toFixed(0)}MB.`);
  try{
    showToast('Uploading...');
    const url = await uploadToCloudinary(file);
    const convData = currentConvData;
    const timerMs = convData.timer || 0;
    const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
    const textMap = { image:'📷 Photo', audio:'🎵 Music', video:'🎬 Video', document:'📄 Document' };
    const msgData = {
      text: textMap[kind], senderId: currentUser.uid, senderName: currentUser.displayName,
      createdAt: serverTimestamp(), type: kind, mediaUrl: url,
      fileName: kind === 'document' ? file.name : null,
      expireAt, reactions: {}, clientTs: Date.now()
    };
    await addDoc(collection(db,'conversations',currentChatId,'messages'), msgData);
    const updates = {
      lastMessage: textMap[kind], lastMessageSenderId: currentUser.uid,
      lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...convData.participants)
    };
    convData.participants.forEach(p => {
      if(p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await updateDoc(doc(db,'conversations',currentChatId), updates);
  }catch(err){ showAlert('Upload Error', err.message); }
}

async function openShareContactModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Share Contact</h3>
      <input id="share-search" placeholder="Search @username...">
      <div class="user-select-list" id="share-list"></div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('share-search').oninput = async (e) => {
    const term = e.target.value.toLowerCase().trim();
    if(term.length < 2) return;
    const q = query(collection(db,'users'), where('username','>=',term), where('username','<=',term+'\uf8ff'));
    const snap = await getDocs(q);
    const list = document.getElementById('share-list');
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid).map(d => {
      const u = d.data();
      return `<div class="user-select-item"
        onclick="window._shareContactUid='${d.id}';window._shareContactName='${escapeHtml(u.displayName||'')}';window._shareContactUser='${escapeHtml(u.username||'')}';window._shareContactPhoto='${u.photoURL||''}';this.closest('.modal-overlay').remove();sendContactCard()">
        <div class="avatar">${u.photoURL
          ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : escapeHtml((u.displayName||'?')[0])}</div>
        <div style="flex:1">${escapeHtml(u.displayName||'User')}</div>
        <div style="color:var(--user-accent-1)">→</div>
      </div>`;
    }).join('');
  };
}

async function sendContactCard(){
  if(!currentChatId || !currentConvData) return;
  const now = Date.now();
  const timerMs = currentConvData.timer || 0;
  const expireAt = Timestamp.fromMillis(now + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
  const msgData = {
    text: 'Contact', senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: 'contact',
    contactUid: window._shareContactUid, contactName: window._shareContactName,
    contactUsername: window._shareContactUser, contactPhoto: window._shareContactPhoto,
    expireAt, reactions: {}, clientTs: now
  };
  await addDoc(collection(db,'conversations',currentChatId,'messages'), msgData);
  const updates = {
    lastMessage: '👤 Contact', lastMessageSenderId: currentUser.uid,
    lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
    clearedBy: arrayRemove(...currentConvData.participants)
  };
  currentConvData.participants.forEach(p => {
    if(p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
  });
  await updateDoc(doc(db,'conversations',currentChatId), updates);
  showToast('Contact shared');
}
// ══════════════════════════════════════════════════════════════
// TIMER
// ══════════════════════════════════════════════════════════════
window.openTimerModal = async () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Disappearing Messages</h3>
      <p style="font-size:12px;color:var(--text-muted);text-align:center;margin-bottom:15px">Messages auto-delete from Firestore.</p>
      <button class="timer-option btn-secondary" onclick="setTimer(0)">24 Hours (Default)</button>
      <button class="timer-option btn-secondary" onclick="setTimer(300000)">5 Minutes</button>
      <button class="timer-option btn-secondary" onclick="setTimer(3600000)">1 Hour</button>
      <button class="timer-option btn-secondary" onclick="setTimer(43200000)">12 Hours</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
};

window.setTimer = async (ms) => {
  document.querySelectorAll('.modal-overlay').forEach(n => n.remove());
  if(!currentChatId) return;
  await updateDoc(doc(db,'conversations',currentChatId), { timer: ms });
  updateTimerUI(ms);
};

function updateTimerUI(ms){
  const el = document.getElementById('timer-text');
  if(!el) return;
  el.textContent = !ms || ms === 0 ? '24 Hours'
    : ms === 300000 ? '5 Mins'
    : ms === 3600000 ? '1 Hour'
    : ms === 43200000 ? '12 Hours' : '24 Hours';
}

document.addEventListener('click', e => {
  if(e.target.closest('#timer-btn')) openTimerModal();
});

// ══════════════════════════════════════════════════════════════
// EMOJI / STICKER
// ══════════════════════════════════════════════════════════════
function toggleEmojiPanel(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  const panel = document.getElementById('emoji-panel');
  const input = document.getElementById('msg-input');
  if(panel.classList.contains('show')) panel.classList.remove('show');
  else {
    input.setAttribute('readonly','readonly');
    input.blur();
    setTimeout(() => input.removeAttribute('readonly'), 150);
    panel.classList.add('show');
  }
}

document.addEventListener('click', e => {
  const p = document.getElementById('emoji-panel');
  if(!p || !p.classList.contains('show')) return;
  if(p.contains(e.target) || e.target.closest('#emoji-btn')) return;
  p.classList.remove('show');
});

window.switchPanelTab = (tab) => {
  document.getElementById('tab-emojis').classList.toggle('active', tab === 'emoji');
  document.getElementById('tab-stickers').classList.toggle('active', tab === 'sticker');
  document.getElementById('emoji-grid').style.display = tab === 'emoji' ? 'grid' : 'none';
  document.getElementById('sticker-grid').style.display = tab === 'sticker' ? 'grid' : 'none';
};

window.insertEmoji = (emoji) => {
  const input = document.getElementById('msg-input');
  input.value += emoji;
  const btn = document.getElementById('send-btn');
  if(input.value.trim() && btn.dataset.mode !== 'send'){ btn.innerHTML = ICONS.send; btn.dataset.mode = 'send'; }
};

window.sendSticker = async (url) => {
  if(!currentChatId || isSending || !currentConvData) return;
  isSending = true;
  document.getElementById('emoji-panel').classList.remove('show');
  const timerMs = currentConvData.timer || 0;
  const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
  try{
    const msgData = {
      text: 'Sticker', senderId: currentUser.uid, senderName: currentUser.displayName,
      createdAt: serverTimestamp(), type: 'sticker', mediaUrl: url,
      expireAt, reactions: {}, clientTs: Date.now()
    };
    await addDoc(collection(db,'conversations',currentChatId,'messages'), msgData);
    const updates = {
      lastMessage: '🖼️ Sticker', lastMessageSenderId: currentUser.uid,
      lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...currentConvData.participants)
    };
    currentConvData.participants.forEach(p => {
      if(p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await updateDoc(doc(db,'conversations',currentChatId), updates);
  }catch(err){ showAlert('Error', err.message); }
  isSending = false;
};
// ══════════════════════════════════════════════════════════════
// STATUS
// ══════════════════════════════════════════════════════════════
window.openStatusTab = async () => {
  try{
    const snap = await getDocs(collection(db,'statuses'));
    const now = Date.now();
    const byUser = {};
    snap.forEach(d => {
      const s = d.data();
      const ex = toMillis(s.expireAt);
      if(ex && ex < now){ deleteDoc(d.ref).catch(()=>{}); return; }
      if(!byUser[s.userId]) byUser[s.userId] = [];
      byUser[s.userId].push({ id: d.id, ...s });
    });

    const userIds = Object.keys(byUser);
    const usersData = {};
    await Promise.all(userIds.map(async uid => {
      try{
        const u = await getUserCached(uid);
        if(u.displayName) usersData[uid] = u;
      }catch(_){}
    }));

    userIds.sort((a,b) => {
      const aT = Math.max(...byUser[a].map(s => toMillis(s.createdAt)));
      const bT = Math.max(...byUser[b].map(s => toMillis(s.createdAt)));
      return bT - aT;
    });

    const myStatuses = byUser[currentUser.uid] || [];
    const otherUsers = userIds.filter(uid => uid !== currentUser.uid && usersData[uid]);

    const overlay = document.createElement('div');
    overlay.className = 'status-page-overlay';
    overlay.innerHTML = `
      <div class="status-page-header">
        <button class="icon" id="close-status-btn" style="margin-right:10px">${ICONS.back}</button>
        <h2>Status</h2>
      </div>
      <div class="status-scroll">
        <div class="status-card" id="my-status-card">
          ${myStatuses.length > 0 ? `
            <div class="status-card-image">
              ${myStatuses[0].mediaType === 'video'
                ? `<video src="${myStatuses[0].mediaUrl}" muted></video>`
                : `<img src="${myStatuses[0].mediaUrl}">`}
              <div class="status-card-gradient"></div>
            </div>
            <div class="status-card-name">My Status</div>
          ` : `
            <div class="status-card-add">
              <div class="plus-circle">+</div>
              <div style="font-size:12px;color:var(--text-muted);text-align:center">Add Status</div>
            </div>
          `}
        </div>
        ${otherUsers.map(uid => {
          const u = usersData[uid];
          const first = byUser[uid][0];
          return `<div class="status-card" onclick="viewUserStatus('${uid}', false)">
            <div class="status-card-image">
              ${first.mediaType === 'video'
                ? `<video src="${first.mediaUrl}" muted></video>`
                : `<img src="${first.mediaUrl}">`}
              <div class="status-card-gradient"></div>
            </div>
            <div class="status-card-ring">
              ${u.photoURL
                ? `<img src="${u.photoURL}">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px">${escapeHtml(u.displayName[0]||'?')}</div>`}
            </div>
            <div class="status-card-name">${escapeHtml(u.displayName)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="status-close-text" id="close-status-text">Close</div>`;
    document.body.appendChild(overlay);

    document.getElementById('close-status-btn').onclick = () => overlay.remove();
    document.getElementById('close-status-text').onclick = () => overlay.remove();
    document.getElementById('my-status-card').onclick = () => {
      overlay.remove();
      if(myStatuses.length > 0) viewUserStatus(currentUser.uid, true);
      else document.getElementById('status-upload').click();
    };
  }catch(err){
    console.error('[status]', err);
    document.getElementById('status-upload').click();
  }
};

window.viewUserStatus = async (userId, isMe = false) => {
  const snap = await getDocs(query(collection(db,'statuses'), where('userId','==',userId)));
  const now = Date.now();
  const statuses = [];
  snap.forEach(d => {
    const s = d.data();
    const ex = toMillis(s.expireAt);
    if(!ex || ex > now) statuses.push({ id: d.id, ...s });
  });
  if(!statuses.length) return showAlert('No Status', 'This user has no active status.');
  statuses.sort((a,b) => toMillis(a.createdAt) - toMillis(b.createdAt));

  let idx = 0;
  const overlay = document.createElement('div');
  overlay.className = 'status-viewer';
  document.body.appendChild(overlay);

  const render = () => {
    if(idx >= statuses.length){ overlay.remove(); return; }
    if(idx < 0) idx = 0;
    const s = statuses[idx];

    overlay.innerHTML = `
      <div class="status-progress">${statuses.map((_,i) =>
        `<div class="status-progress-bar ${i < idx ? 'done' : i === idx ? 'active' : ''}"><div></div></div>`).join('')}</div>
      <div class="status-media">${s.mediaType === 'video'
        ? `<video src="${s.mediaUrl}" autoplay playsinline></video>`
        : `<img src="${s.mediaUrl}">`}</div>
      ${isMe ? `
        <button class="status-close" id="st-viewers" style="left:20px;right:auto;color:#53bdeb;font-size:13px;width:auto;padding:0 12px;font-weight:700">👁 ${(s.viewers||[]).length}</button>
        <button class="status-close" id="st-delete" style="left:80px;right:auto;color:#ea4335;font-size:16px">${ICONS.trash}</button>` : ''}
      <button class="status-close" id="st-close">✕</button>
      <button class="status-nav prev" id="st-prev">‹</button>
      <button class="status-nav next" id="st-next">›</button>
      ${!isMe ? `
        <div class="status-reply-bar">
          <input id="status-reply-input" placeholder="Reply privately...">
          <button id="status-reply-send">${ICONS.send}</button>
        </div>` : ''}`;

    if(!isMe) updateDoc(doc(db,'statuses',s.id), { viewers: arrayUnion(currentUser.uid) }).catch(()=>{});

    document.getElementById('st-close').onclick = () => overlay.remove();
    document.getElementById('st-prev').onclick = () => { idx--; render(); };
    document.getElementById('st-next').onclick = () => { idx++; render(); };

    if(isMe){
      document.getElementById('st-viewers').onclick = () => viewStatusViewers(s.id);
      document.getElementById('st-delete').onclick = () => {
        showAlert('Delete Status', 'Delete this status for everyone?', true, async () => {
          await deleteDoc(doc(db,'statuses',s.id));
          overlay.remove();
          openStatusTab();
        });
      };
    } else {
      const inp = document.getElementById('status-reply-input');
      const btn = document.getElementById('status-reply-send');
      const send = () => {
        const txt = inp.value.trim();
        if(!txt) return;
        replyToStatus(s, txt);
        inp.value = '';
      };
      btn.onclick = send;
      inp.onkeydown = e => { if(e.key === 'Enter') send(); };
    }

    if(s.mediaType !== 'video') setTimeout(() => {
      if(overlay.parentNode){ idx++; render(); }
    }, 5000);
  };
  render();
};

async function viewStatusViewers(statusId){
  const snap = await getDoc(doc(db,'statuses',statusId));
  if(!snap.exists()) return;
  const viewers = snap.data().viewers || [];
  const rows = [];
  for(const uid of viewers){
    const u = await getUserCached(uid);
    rows.push(`<div class="user-select-item">
      <div class="avatar">${u.photoURL
        ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : escapeHtml((u.displayName||'?')[0])}</div>
      <div style="flex:1">${escapeHtml(u.displayName||'User')}</div>
    </div>`);
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Viewed by ${viewers.length}</h3>
      <div class="user-select-list">
        ${rows.join('') || '<div style="text-align:center;padding:20px;color:var(--text-muted)">No views yet</div>'}
      </div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);
}

async function replyToStatus(status, text){
  if(!text.trim()) return;
  const participants = [currentUser.uid, status.userId].sort();
  const chatId = participants.join('_');
  const chatSnap = await getDoc(doc(db,'conversations',chatId));
  if(!chatSnap.exists()){
    await setDoc(doc(db,'conversations',chatId), {
      participants, updatedAt: serverTimestamp(), lastMessage: 'New Chat',
      clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
    });
  }
  const now = Date.now();
  await addDoc(collection(db,'conversations',chatId,'messages'), {
    text: `↩️ Replied to status: ${text}`,
    senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: 'text',
    expireAt: Timestamp.fromMillis(now + MESSAGE_TTL_MS),
    reactions: {}, clientTs: now
  });
  await updateDoc(doc(db,'conversations',chatId), {
    lastMessage: '↩️ Replied to status', lastMessageSenderId: currentUser.uid,
    lastMessageTime: serverTimestamp()
  });
  showToast('Reply sent');
}

async function handleStatusUpload(e){
  const file = e.target.files[0];
  e.target.value = '';
  if(!file || !currentUser) return;
  if(file.size > 5 * 1024 * 1024) return showAlert('Too Large','Status must be under 5MB.');
  try{
    showToast('Uploading status...');
    const url = await uploadToCloudinary(file);
    await addDoc(collection(db,'statuses'), {
      userId: currentUser.uid,
      userDisplayName: currentUser.displayName,
      mediaUrl: url,
      mediaType: file.type.startsWith('video') ? 'video' : 'image',
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + STATUS_TTL_MS),
      viewers: []
    });
    showToast('Status posted! Auto-deletes in 5 hours.');
    openStatusTab();
  }catch(err){ showAlert('Error', err.message); }
}
// START DM
// ══════════════════════════════════════════════════════════════
window.startDM = async function(otherUid, otherName, photoURL){
  if(!otherUid) return showAlert('Error','User not found');
  const participants = [currentUser.uid, otherUid].sort();
  const chatId = participants.join('_');
  try{
    const snap = await getDoc(doc(db,'conversations',chatId));
    if(!snap.exists()){
      await setDoc(doc(db,'conversations',chatId), {
        participants, updatedAt: serverTimestamp(), lastMessage: 'New Chat',
        clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
      });
    }
  }catch(e){
    await setDoc(doc(db,'conversations',chatId), {
      participants, updatedAt: serverTimestamp(), lastMessage: 'New Chat',
      clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
    }).catch(()=>{});
  }
  openChat(chatId, otherUid, otherName, photoURL, false);
  document.getElementById('search').value = '';
  scheduleChatListRender();
};

// ══════════════════════════════════════════════════════════════
// SEARCH USERS
// ══════════════════════════════════════════════════════════════
async function handleSearch(term){
  const list = document.getElementById('chats-list');
  if(!list) return;
  const q = query(collection(db,'users'),
    where('username','>=',term), where('username','<=',term+'\uf8ff'));
  const snap = await getDocs(q);
  const results = [];
  const seen = new Set();
  snap.forEach(d => {
    if(d.id === currentUser.uid) return;
    const u = d.data();
    if(seen.has(u.username)) return;
    seen.add(u.username);
    results.push({ id: d.id, ...u });
  });
  if(!results.length){
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No users found</div>';
    return;
  }
  list.innerHTML = results.map(u => `
    <li class="chat-item" data-uid="${u.id}" data-name="${escapeHtml(u.displayName)}" data-photo="${u.photoURL||''}">
      <div class="avatar-wrap">
        <div class="avatar">${u.photoURL
          ? `<img loading="lazy" src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover">`
          : escapeHtml(u.displayName[0]||'?')}</div>
      </div>
      <div class="chat-info">
        <div class="chat-top"><span class="chat-name">${escapeHtml(u.displayName)}</span></div>
        <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(u.username)}.mofie</span></div>
      </div>
    </li>`).join('');
  list.querySelectorAll('.chat-item').forEach(el => {
    el.onclick = () => startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
  });
}
// ══════════════════════════════════════════════════════════════
// STARRED MESSAGES PAGE
// ══════════════════════════════════════════════════════════════
window.openStarredMessages = async () => {
  document.querySelectorAll('.settings-page.active').forEach(p => p.classList.remove('active'));
  const page = document.createElement('div');
  page.className = 'settings-page active';
  page.innerHTML = `
    <div class="settings-header">
      <button class="icon" id="close-starred">${ICONS.back}</button>
      <h2>Starred Messages</h2>
    </div>
    <div class="settings-list" id="starred-list" style="padding:0">
      <div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>
    </div>`;
  document.querySelector('.app-container').appendChild(page);
  document.getElementById('close-starred').onclick = () => page.remove();

  const convSnap = await getDocs(query(
    collection(db,'conversations'), where('participants','array-contains',currentUser.uid)
  ));
  const items = [];
  await Promise.all(convSnap.docs.map(async c => {
    const data = c.data();
    if(data.clearedBy && data.clearedBy.includes(currentUser.uid)) return;
    const msgs = await getDocs(collection(db,'conversations',c.id,'messages'));
    msgs.forEach(d => {
      const m = d.data();
      if((m.starredBy||[]).includes(currentUser.uid)){
        items.push({ chatId: c.id, chatName: data.isGroup ? data.groupName : (m.senderName||'Chat'), msg: m });
      }
    });
  }));
  const list = document.getElementById('starred-list');
  if(!items.length){
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No starred messages yet.</div>';
    return;
  }
  items.sort((a,b) => toMillis(b.msg.createdAt) - toMillis(a.msg.createdAt));
  list.innerHTML = items.map(it => `
    <div class="starred-item" onclick="openChatById('${it.chatId}')">
      <div class="si-icon">★</div>
      <div class="si-body">
        <div class="si-text">${escapeHtml((it.msg.text || it.msg.type || 'Media').slice(0,60))}</div>
        <div class="si-meta">${escapeHtml(it.chatName)} · ${new Date(toMillis(it.msg.createdAt)||Date.now()).toLocaleDateString()}</div>
      </div>
    </div>`).join('');
};

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════
window.openThemeModal = () => {
  const t = localStorage.getItem('mofie-theme') || 'dark';
  const a1 = localStorage.getItem('mofie-accent1') || '#00a884';
  const a2 = localStorage.getItem('mofie-accent2') || '#53bdeb';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Appearance</h3>
      <div class="theme-row"><label>Theme</label>
        <select id="theme-select" style="background:var(--header);color:var(--text);border:1px solid var(--border);padding:6px;border-radius:6px">
          <option value="light" ${t==='light'?'selected':''}>Light</option>
          <option value="dark" ${t==='dark'?'selected':''}>Dark</option>
          <option value="neon" ${t==='neon'?'selected':''}>Neon</option>
        </select></div>
      <div class="theme-row"><label>Primary</label><input type="color" id="accent1" value="${a1}"></div>
      <div class="theme-row"><label>Secondary</label><input type="color" id="accent2" value="${a2}"></div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('theme-select').onchange = e => {
    localStorage.setItem('mofie-theme', e.target.value); applyTheme();
  };
  document.getElementById('accent1').oninput = e => {
    localStorage.setItem('mofie-accent1', e.target.value); applyTheme();
  };
  document.getElementById('accent2').oninput = e => {
    localStorage.setItem('mofie-accent2', e.target.value); applyTheme();
  };
};

window.openEditProfileModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Edit Profile</h3>
      <div class="avatar-wrap" style="margin:0 auto 15px;width:80px;height:80px;cursor:pointer"
        onclick="document.getElementById('profile-upload').click()">
        <div class="avatar">${currentUser.photoURL
          ? `<img src="${currentUser.photoURL}" style="width:100%;height:100%;object-fit:cover">`
          : escapeHtml(currentUser.displayName[0])}</div>
      </div>
      <input id="set-name" placeholder="Display name" value="${escapeHtml(currentUser.displayName)}">
      <input id="set-phone" type="tel" placeholder="Phone with country code" value="${escapeHtml(currentUser.phoneNumber||'')}">
      <button class="btn-primary" id="save-profile">Save</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('profile-upload').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if(!f) return;
    try{
      const url = await uploadToCloudinary(f);
      await updateDoc(doc(db,'users',currentUser.uid), { photoURL: url });
      currentUser.photoURL = url;
      overlay.remove();
      showToast('Photo updated');
      renderMain();
    }catch(err){ showAlert('Error', err.message); }
  };

  document.getElementById('save-profile').onclick = async () => {
    const name = document.getElementById('set-name').value.trim();
    const phone = normalizePhone(document.getElementById('set-phone').value);
    if(!name) return showToast('Name required');
    const updates = { displayName: name };
    if(phone) updates.phoneNumber = phone;
    await updateDoc(doc(db,'users',currentUser.uid), updates);
    currentUser.displayName = name;
    if(phone) currentUser.phoneNumber = phone;
    overlay.remove();
    showToast('Saved');
    renderMain();
  };
};
window.openAccountModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Account</h3>
      <input id="set-pass" type="password" placeholder="New password (min 6 chars)">
      <button class="btn-primary" id="change-pass">Change Password</button>
      <button class="btn-secondary" id="logout-btn" style="color:var(--user-accent-1);border-color:var(--user-accent-1)">Log Out</button>
      <button class="btn-danger" id="delete-acc">Delete Account</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('change-pass').onclick = async () => {
    const np = document.getElementById('set-pass').value;
    if(np.length < 6) return showToast('Min 6 chars');
    try{ await updatePassword(auth.currentUser, np); showToast('Password changed'); overlay.remove(); }
    catch(e){
      if(e.code === 'auth/requires-recent-login') showAlert('Security','Log out and back in first.');
      else showAlert('Error', e.message);
    }
  };
  document.getElementById('logout-btn').onclick = () => signOut(auth);
  document.getElementById('delete-acc').onclick = () => {
    showAlert('Delete Account', 'Permanently delete your account?', true, async () => {
      try{
        await deleteDoc(doc(db,'users',currentUser.uid));
        await deleteDoc(doc(db,'usernames',currentUser.username));
        await deleteUser(auth.currentUser);
        setTimeout(() => window.location.reload(), 800);
      }catch(e){
        if(e.code === 'auth/requires-recent-login') showAlert('Security','Log out and back in first.');
        else showAlert('Error', e.message);
      }
    });
  };
};

// ══════════════════════════════════════════════════════════════
// GROUPS
// ══════════════════════════════════════════════════════════════
window.openNewGroupModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>New Group</h3>
      <input id="g-name" placeholder="Group name">
      <input id="g-search" placeholder="Search users to add...">
      <div class="user-select-list" id="g-list"></div>
      <button class="btn-primary" onclick="createGroup()">Create Group</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  window.selectedGroupUsers = new Map();
  document.getElementById('g-search').oninput = async (e) => {
    const term = e.target.value.toLowerCase().trim();
    if(term.length < 2) return;
    const snap = await getDocs(query(collection(db,'users'),
      where('username','>=',term), where('username','<=',term+'\uf8ff')));
    const list = document.getElementById('g-list');
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid).map(d => {
      const u = d.data();
      const sel = window.selectedGroupUsers.has(d.id);
      return `<div class="user-select-item ${sel?'selected':''}" onclick="window.toggleGroupUser('${d.id}','${escapeHtml(u.displayName)}',this)">
        <div class="avatar">${u.photoURL
          ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : escapeHtml((u.displayName||'?')[0])}</div>
        <div style="flex:1">${escapeHtml(u.displayName)}</div>
        <div style="font-size:18px;color:var(--user-accent-1)">${sel?'✓':'+'}</div>
      </div>`;
    }).join('');
  };
};

window.toggleGroupUser = (uid, name, el) => {
  if(window.selectedGroupUsers.has(uid)){
    window.selectedGroupUsers.delete(uid);
    el.classList.remove('selected');
    el.querySelector('div:last-child').textContent = '+';
  } else {
    window.selectedGroupUsers.set(uid, name);
    el.classList.add('selected');
    el.querySelector('div:last-child').textContent = '✓';
  }
};

window.createGroup = async () => {
  const name = document.getElementById('g-name').value.trim();
  if(!name) return showToast('Group name required');
  if(window.selectedGroupUsers.size === 0) return showToast('Select at least one person');
  const participants = [currentUser.uid, ...window.selectedGroupUsers.keys()];
  try{
    const ref = doc(collection(db,'conversations'));
    await setDoc(ref, {
      isGroup: true, groupName: name, groupBio: '', groupPhotoURL: null,
      participants, createdBy: currentUser.uid, admins: [currentUser.uid],
      restricted: false, pendingMembers: [],
      updatedAt: serverTimestamp(), lastMessage: 'Group created',
      lastMessageTime: serverTimestamp(), clearedBy: [], unreadCounts: {}, timer: 0
    });
    document.querySelectorAll('.modal-overlay').forEach(n => n.remove());
    openChat(ref.id, null, name, null, true);
    scheduleChatListRender();
  }catch(e){ showAlert('Error', e.message); }
};
window.openGroupInfoModal = async () => {
  if(!currentChatId) return;
  const snap = await getDoc(doc(db,'conversations',currentChatId));
  if(!snap.exists()) return;
  const data = snap.data();
  const isAdmin = (data.admins||[]).includes(currentUser.uid);

  const members = await Promise.all((data.participants||[]).map(async uid => {
    const u = await getUserCached(uid);
    const admin = (data.admins||[]).includes(uid);
    return `<div class="member-item">
      <div class="avatar">${u.photoURL
        ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : escapeHtml((u.displayName||'?')[0])}</div>
      <div style="flex:1">${escapeHtml(u.displayName||'User')} ${admin?'<span class="admin-badge">Admin</span>':''}</div>
    </div>`;
  }));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Group Info</h3>
      <div style="width:100px;height:100px;border-radius:50%;margin:0 auto 15px;background:var(--bg-main);
        border:2px solid var(--border);display:flex;align-items:center;justify-content:center;
        font-size:40px;color:var(--text-muted);overflow:hidden">
        ${data.groupPhotoURL
          ? `<img src="${data.groupPhotoURL}" style="width:100%;height:100%;object-fit:cover">`
          : escapeHtml((data.groupName||'G')[0])}
      </div>
      <input id="gi-name" value="${escapeHtml(data.groupName||'')}" ${isAdmin?'':'disabled'}>
      ${isAdmin ? `<button class="btn-primary" id="gi-save">Save</button>` : ''}
      <h4 style="color:var(--text-muted);font-size:13px;margin:15px 0 8px">Members (${(data.participants||[]).length})</h4>
      <div class="member-list">${members.join('')}</div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  if(isAdmin){
    document.getElementById('gi-save').onclick = async () => {
      const nn = document.getElementById('gi-name').value.trim();
      if(!nn) return;
      await updateDoc(doc(db,'conversations',currentChatId), { groupName: nn });
      showToast('Updated');
      overlay.remove();
      document.getElementById('other-name').textContent = nn;
    };
  }
};

// ══════════════════════════════════════════════════════════════
// BROADCAST
// ══════════════════════════════════════════════════════════════
function listenForBroadcasts(){
  if(unsubBroadcast) unsubBroadcast();
  unsubBroadcast = onSnapshot(doc(db,'system','broadcast'), (docSnap) => {
    if(docSnap.exists()){
      const d = docSnap.data();
      const last = localStorage.getItem('mofie_last_broadcast') || 0;
      if(d.timestamp > last){
        localStorage.setItem('mofie_last_broadcast', d.timestamp);
        showAlert('Mofie', d.message);
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// AUTH STATE
// ══════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if(user){
    renderSplash();
    const userData = await loadUserWithRetry(user.uid);
    if(!userData){
      renderSplash('Could not load profile...');
      setTimeout(async () => {
        await signOut(auth);
        renderAuth();
      }, 1500);
      return;
    }
    currentUser = userData;
    startPresence();
    listenForBroadcasts();
    subscribeToStatuses();
    startExpirySweep();
    requestNotificationPermission().then(() => registerPush());
    renderMain();
    handleDeepLink();
    // Handle postMessage from service worker (chat notification click)
    navigator.serviceWorker?.addEventListener?.('message', e => {
      if(e.data?.type === 'OPEN_CHAT') openChatById(e.data.chatId);
    });
  } else {
    currentUser = null;
    clearInterval(presenceInterval);
    [unsubMessages, unsubChats, unsubBroadcast, unsubExplore, unsubStatuses, unsubUsers]
      .forEach(u => { try{ u && u(); }catch(_){} });
    unsubMessages = unsubChats = unsubBroadcast = unsubExplore = unsubStatuses = unsubUsers = null;
    knownChatTimestamps.clear();
    activeStatusUsers.clear();
    renderAuth();
  }
});
// ══════════════════════════════════════════════════════════════
// SERVICE WORKER
// ══════════════════════════════════════════════════════════════
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/Mhail-frontend/sw.js', {
    scope: '/Mhail-frontend/'
  }).catch(err => console.warn('SW:', err.message));
}