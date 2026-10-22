import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, deleteUser, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc, deleteDoc, arrayUnion, increment, arrayRemove, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// ---------- CONSTANTS ----------
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_LIMITS = { image: 5*1024*1024, audio: 5*1024*1024, video: 3*1024*1024, document: 2*1024*1024 };

// ---------- STATE ----------
let currentUser = null;
let currentChatId = null;
let currentOtherId = null;
let currentConvData = null;  // cached conversation doc
let unsubMessages = null;
let unsubChats = null;
let unsubConvMeta = null;
let unsubBroadcast = null;
let unsubExplore = null;
let unsubStatuses = null;
let presenceInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let replyToMsg = null;
let currentTab = 'friends';
let isSending = false;
let isFirstMessagesLoad = true;
let pendingMessages = [];  // optimistic sends
const knownChatTimestamps = new Map();
const activeStatusUsers = new Set();
let typingTimeout = null;
let lastTypingUpdate = 0;

// ---------- USER CACHE (kills N+1) ----------
const userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000;
async function getUserCached(uid) {
  if (!uid) return { displayName: 'Unknown' };
  const hit = userCache.get(uid);
  if (hit && Date.now() - hit.ts < USER_CACHE_TTL) return hit.data;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : { displayName: "Unknown" };
    userCache.set(uid, { data, ts: Date.now() });
    return data;
  } catch { return hit?.data || { displayName: "Unknown" }; }
}

// ---------- NOTIFICATION SOUND ----------
let audioContext = null;
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked && audioContext && audioContext.state === 'running') return;
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    audioUnlocked = true;
  } catch (_) {}
}
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('keydown', unlockAudio);
document.addEventListener('touchstart', unlockAudio, { passive: true });

function playNotificationSound() {
  try {
    unlockAudio();
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const tone = (freq, start, dur, vol = 0.22) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.start(start); osc.stop(start + dur);
    };
    tone(880, now, 0.14);
    tone(1175, now + 0.08, 0.26);
  } catch (err) { console.warn('Audio error:', err); }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

async function notifyNewMessage(senderName, text, chatId) {
  const canUseNative = 'Notification' in window && Notification.permission === 'granted';
  if (canUseNative && document.hidden) {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(senderName || 'Mofie', {
          body: text || 'New message',
          icon: 'https://res.cloudinary.com/rirfqxoz/image/upload/icon.jpg',
          tag: chatId || 'mofie', silent: false
        });
        return;
      }
      const n = new Notification(senderName || 'Mofie', { body: text || 'New message', tag: chatId || 'mofie', silent: false });
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => n.close(), 6000);
      return;
    } catch (_) {}
  }
  playNotificationSound();
}

// ---------- EMOJIS ----------
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

// ---------- UI HELPERS ----------
window.showAlert = (title, message, isConfirm = false, onConfirm = null) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>${title}</h3>
      <p style="font-size:14px;margin-bottom:20px;color:var(--text-muted)">${message}</p>
      <div style="display:flex;gap:10px">
        ${isConfirm ? `<button class="btn-secondary" style="flex:1;margin:0" onclick="this.closest('.modal-overlay').remove()">Cancel</button>` : ''}
        <button class="btn-primary" id="alert-ok" style="flex:1;margin:0">${isConfirm ? 'Confirm' : 'OK'}</button>
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
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: fd });
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
  emoji: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>`,
  explore: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/></svg>`,
  status: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
};

function startPresence() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const update = () => setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
  update();
  clearInterval(presenceInterval);
  presenceInterval = setInterval(update, 30000);
}

function isUserOnline(lastSeen) {
  if (!lastSeen) return false;
  return (Date.now() - lastSeen.toMillis()) < 60000;
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

// ---------- STATUS SUBSCRIPTION ----------
function subscribeToStatuses() {
  if (unsubStatuses) unsubStatuses();
  unsubStatuses = onSnapshot(collection(db, "statuses"), (snap) => {
    const now = Date.now();
    activeStatusUsers.clear();
    snap.forEach(d => {
      const s = d.data();
      const expireMs = toMillis(s.expireAt);
      if (expireMs && expireMs < now) { deleteDoc(d.ref).catch(() => {}); return; }
      activeStatusUsers.add(s.userId);
    });
    document.querySelectorAll('#chats-list .chat-item[data-uid]').forEach(el => {
      const uid = el.dataset.uid;
      const wrap = el.querySelector('.avatar-wrap');
      if (wrap && uid) {
        if (activeStatusUsers.has(uid)) wrap.classList.add('has-status');
        else wrap.classList.remove('has-status');
      }
    });
  });
}

// ---------- SPLASH ----------
function renderSplash(msg = 'Loading...') {
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

async function loadUserWithRetry(uid, maxTries = 3) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) return snap.data();
    } catch (e) { console.warn("getDoc retry", i, e); }
    if (i < maxTries - 1) await new Promise(r => setTimeout(r, 600 * (i + 1)));
  }
  return null;
}

// ---------- AUTH ----------
function renderAuth() {
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-progress" id="auth-progress"></div>
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
            <span class="field-icon" id="email-icon"></span>
            <div class="field-msg" id="email-msg"></div>
          </div>
          <div class="input-group" id="username-group" style="display:none">
            <input id="username" placeholder="Username (a-z, 0-9)" autocomplete="username">
            <span class="field-icon" id="username-icon"></span>
            <div class="field-msg" id="username-msg"></div>
          </div>
          <div class="input-group">
            <input id="pass" type="password" placeholder="Password" autocomplete="current-password" required>
            <button type="button" class="pw-toggle" id="pw-toggle" tabindex="-1">👁️</button>
            <div class="password-meter" id="pw-meter"><div class="pw-bar" id="pw-bar"></div></div>
            <div class="field-msg" id="pass-msg"></div>
          </div>
          <button type="submit" id="submit-btn">
            <span class="btn-text">Login</span>
            <span class="btn-spinner"></span>
            <span class="btn-check">✓</span>
          </button>
          <div id="forgot-pass-btn" style="text-align:center;margin-top:15px;font-size:13px;color:var(--user-accent-2);cursor:pointer">Forgot Password?</div>
          <div class="error" id="err"></div>
          <div class="auth-status" id="auth-status"></div>
        </form>
      </div>
    </div>`;

  const $ = (id) => document.getElementById(id);
  const emailInput = $('email'), userInput = $('username'), passInput = $('pass');
  const form = $('auth-form'), submitBtn = $('submit-btn'), errEl = $('err');
  const authStatus = $('auth-status'), authProgress = $('auth-progress');
  const usernameGroup = $('username-group');
  let isLogin = true, isSubmitting = false, usernameTimer = null;
  let usernameCache = { value: '', available: null };

  const lastEmail = localStorage.getItem('mofie-last-email');
  if (lastEmail) emailInput.value = lastEmail;

  const isEmailValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isUsernameValid = (v) => /^[a-z0-9]{3,20}$/.test(v);

  const setFieldState = (input, msgEl, iconEl, state, message = '') => {
    input.classList.remove('valid', 'invalid', 'checking');
    if (iconEl) { iconEl.className = 'field-icon'; iconEl.textContent = ''; }
    if (state === 'valid') { input.classList.add('valid'); if (iconEl) { iconEl.textContent = '✓'; iconEl.classList.add('valid'); } }
    else if (state === 'invalid') { input.classList.add('invalid'); if (iconEl) { iconEl.textContent = '✕'; iconEl.classList.add('invalid'); } }
    else if (state === 'checking') { input.classList.add('checking'); if (iconEl) { iconEl.textContent = '◌'; iconEl.classList.add('checking'); } }
    if (msgEl) {
      msgEl.textContent = message;
      msgEl.className = 'field-msg ' + (state === 'valid' ? 'valid' : state === 'invalid' ? 'invalid' : '');
    }
  };

  const pwStrength = (pw) => {
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };

  const setProgress = (pct, color) => {
    authProgress.style.width = pct + '%';
    authProgress.style.opacity = pct > 0 ? '1' : '0';
    if (color) authProgress.style.background = color;
  };
  const showStatus = (msg, type = 'info') => { authStatus.textContent = msg; authStatus.className = 'auth-status show ' + type; };
  const hideStatus = () => { authStatus.className = 'auth-status'; };
  const setBtnState = (state) => {
    submitBtn.classList.remove('loading', 'success');
    submitBtn.disabled = state === 'loading' || state === 'success';
    if (state === 'loading') submitBtn.classList.add('loading');
    else if (state === 'success') submitBtn.classList.add('success');
  };

  emailInput.addEventListener('input', () => {
    const v = emailInput.value;
    if (!v) return setFieldState(emailInput, $('email-msg'), $('email-icon'), null);
    if (isEmailValid(v)) setFieldState(emailInput, $('email-msg'), $('email-icon'), 'valid', 'Looks good');
    else setFieldState(emailInput, $('email-msg'), $('email-icon'), 'invalid', 'Enter a valid email');
  });

  userInput.addEventListener('input', () => {
    const v = userInput.value.toLowerCase().trim();
    userInput.value = v;
    if (!v) return setFieldState(userInput, $('username-msg'), $('username-icon'), null);
    if (!isUsernameValid(v)) return setFieldState(userInput, $('username-msg'), $('username-icon'), 'invalid', 'Use 3–20 chars: a-z, 0-9');
    setFieldState(userInput, $('username-msg'), $('username-icon'), 'checking', 'Checking availability...');
    clearTimeout(usernameTimer);
    usernameTimer = setTimeout(async () => {
      if (usernameCache.value === v && usernameCache.available !== null) {
        return usernameCache.available
          ? setFieldState(userInput, $('username-msg'), $('username-icon'), 'valid', 'Available!')
          : setFieldState(userInput, $('username-msg'), $('username-icon'), 'invalid', 'Already taken');
      }
      try {
        const snap = await getDoc(doc(db, 'usernames', v));
        const available = !snap.exists();
        usernameCache = { value: v, available };
        if (userInput.value.toLowerCase().trim() !== v) return;
        available
          ? setFieldState(userInput, $('username-msg'), $('username-icon'), 'valid', 'Available!')
          : setFieldState(userInput, $('username-msg'), $('username-icon'), 'invalid', 'Already taken');
      } catch {
        setFieldState(userInput, $('username-msg'), $('username-icon'), 'invalid', 'Check failed — try again');
      }
    }, 350);
  });

  passInput.addEventListener('input', () => {
    const v = passInput.value;
    if (isLogin) {
      $('pw-meter').style.display = 'none';
      $('pass-msg').textContent = '';
      passInput.classList.remove('valid', 'invalid');
      if (v) passInput.classList.add(v.length >= 6 ? 'valid' : 'invalid');
      return;
    }
    if (!v) { $('pw-meter').style.display = 'none'; $('pass-msg').textContent = ''; return; }
    $('pw-meter').style.display = 'block';
    const s = pwStrength(v);
    const colors = ['#ea4335','#ea4335','#ff9900','#53bdeb','#00a884','#00a884'];
    const labels = ['Too weak','Weak','Fair','Good','Strong','Excellent'];
    $('pw-bar').style.width = (s / 5 * 100) + '%';
    $('pw-bar').style.background = colors[s];
    $('pass-msg').textContent = labels[s];
    $('pass-msg').className = 'field-msg ' + (s >= 2 ? 'valid' : 'invalid');
    passInput.classList.remove('valid', 'invalid');
    passInput.classList.add(v.length >= 6 ? 'valid' : 'invalid');
  });

  $('pw-toggle').onclick = () => {
    if (passInput.type === 'password') { passInput.type = 'text'; $('pw-toggle').textContent = '🙈'; }
    else { passInput.type = 'password'; $('pw-toggle').textContent = '👁️'; }
  };

  const switchTab = (login) => {
    isLogin = login;
    $('tab-login').classList.toggle('active', login);
    $('tab-reg').classList.toggle('active', !login);
    usernameGroup.style.display = login ? 'none' : 'block';
    submitBtn.querySelector('.btn-text').textContent = login ? 'Login' : 'Create Account';
    passInput.setAttribute('autocomplete', login ? 'current-password' : 'new-password');
    errEl.textContent = '';
    hideStatus();
    setProgress(0);
    setFieldState(passInput, $('pass-msg'), null, null);
    $('pw-meter').style.display = 'none';
    setTimeout(() => (login ? passInput : userInput).focus(), 50);
  };
  $('tab-login').onclick = () => switchTab(true);
  $('tab-reg').onclick = () => switchTab(false);

  $('forgot-pass-btn').onclick = async () => {
    const email = emailInput.value.trim();
    if (!email || !isEmailValid(email)) {
      setFieldState(emailInput, $('email-msg'), $('email-icon'), 'invalid', 'Enter your email first');
      emailInput.focus();
      return;
    }
    try {
      showStatus('Sending reset email...', 'info');
      await sendPasswordResetEmail(auth, email);
      showStatus('✓ Password reset email sent!', 'success');
    } catch (e) { showStatus('✕ ' + e.message.replace('Firebase: ', ''), 'error'); }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    errEl.textContent = '';
    const email = emailInput.value.trim();
    const username = userInput.value.toLowerCase().trim();
    const pass = passInput.value;

    if (!isEmailValid(email)) {
      setFieldState(emailInput, $('email-msg'), $('email-icon'), 'invalid', 'Enter a valid email');
      emailInput.focus(); return;
    }
    if (!isLogin && !isUsernameValid(username)) {
      setFieldState(userInput, $('username-msg'), $('username-icon'), 'invalid', 'Use 3–20 chars: a-z, 0-9');
      userInput.focus(); return;
    }
    if (pass.length < 6) {
      setFieldState(passInput, $('pass-msg'), null, 'invalid', 'At least 6 characters');
      passInput.focus(); return;
    }

    isSubmitting = true;
    setBtnState('loading');
    localStorage.setItem('mofie-last-email', email);

    try {
      if (isLogin) {
        showStatus('Signing you in...', 'info');
        setProgress(35);
        await signInWithEmailAndPassword(auth, email, pass);
        setProgress(100, 'var(--user-accent-1)');
        showStatus('✓ Welcome back!', 'success');
        setBtnState('success');
      } else {
        showStatus('Checking username availability...', 'info');
        setProgress(15);
        const usernameRef = doc(db, 'usernames', username);
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists()) {
          setFieldState(userInput, $('username-msg'), $('username-icon'), 'invalid', 'Already taken');
          showStatus('✕ Username is already taken', 'error');
          setProgress(0); setBtnState('idle'); isSubmitting = false; return;
        }
        setProgress(40);
        showStatus('Creating your account...', 'info');
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        setProgress(70);
        showStatus('Setting up your profile...', 'info');
        await Promise.all([
          setDoc(usernameRef, { uid: userCred.user.uid }),
          setDoc(doc(db, 'users', userCred.user.uid), {
            username, email, displayName: username, uid: userCred.user.uid,
            lastSeen: serverTimestamp(), photoURL: null, blockedUsers: []
          })
        ]);
        setProgress(100, 'var(--user-accent-1)');
        showStatus('✓ Account created! Welcome to Mofie 🎉', 'success');
        setBtnState('success');
      }
    } catch (error) {
      const msg = (error.message || 'Something went wrong').replace('Firebase: ', '').replace('Error: ', '');
      errEl.textContent = msg;
      showStatus('✕ ' + msg, 'error');
      setProgress(0, '#ea4335');
      setBtnState('idle');
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 400);
      if (/email/i.test(msg)) emailInput.focus();
      else if (/password/i.test(msg)) passInput.focus();
      else if (/username/i.test(msg)) userInput.focus();
    } finally { isSubmitting = false; }
  };

  setTimeout(() => (lastEmail ? passInput : emailInput).focus(), 120);
}
// ---------- MAIN UI ----------
function renderMain() {
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
          <input id="search" placeholder="Search username...">
          <button class="status-icon-btn" id="status-btn" title="Status">${ICONS.status}</button>
        </div>
        <div class="tabs-row">
          <button class="tab-btn" data-tab="groups">Groups</button>
          <button class="tab-btn" data-tab="unread">Unread</button>
          <button class="tab-btn active" data-tab="friends">Friends</button>
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
            <div class="timer-btn" id="timer-btn" onclick="openTimerModal()">${ICONS.clock} <span id="timer-text">24 Hours</span></div>
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
        <input type="file" id="chat-upload-image" accept="image/*" style="display:none">
        <input type="file" id="chat-upload-audio" accept="audio/*" style="display:none">
        <input type="file" id="chat-upload-video" accept="video/*" style="display:none">
        <input type="file" id="chat-upload-doc" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" style="display:none">
        <input type="file" id="status-upload" accept="image/*,video/*" style="display:none">
        <input type="file" id="profile-upload" accept="image/*" style="display:none">
        <input type="file" id="group-upload" accept="image/*" style="display:none">
      </main>

      <div id="settings-page" class="settings-page">
        <div class="settings-header">
          <button class="icon" id="close-settings-btn">${ICONS.back}</button>
          <h2>Settings</h2>
        </div>
        <div class="settings-list">
          <div class="settings-profile" onclick="openEditProfileModal()">
            <div class="avatar-wrap"><div class="avatar">${currentUser.photoURL ? `<img src="${currentUser.photoURL}" style="width:100%;height:100%;object-fit:cover">` : currentUser.displayName[0]}</div></div>
            <div style="flex:1"><div class="name">${currentUser.displayName}</div><div class="username">@${currentUser.username}</div></div>
            <div style="font-size:20px;color:var(--text-muted)">✎</div>
          </div>
          <div class="settings-item" onclick="openThemeModal()"><div class="icon-wrap">🎨</div><div class="info"><h4>Appearance</h4><p>Theme, Colors</p></div></div>
          <div class="settings-item" onclick="openAccountModal()"><div class="icon-wrap">🔑</div><div class="info"><h4>Account</h4><p>Security, Delete Account</p></div></div>
          ${currentUser.email === 'hermanedaru@gmail.com' ? `
          <div class="settings-item" onclick="openAdminModal()" style="background:rgba(255,153,0,.1);border-color:#ff9900">
            <div class="icon-wrap" style="color:#ff9900">⚡</div>
            <div class="info"><h4 style="color:#ff9900">Admin Panel</h4><p>Send Global Broadcast</p></div>
          </div>` : ''}
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;border-top:1px solid var(--border);margin-top:20px">
            <p style="margin-bottom:5px">Developed and maintained by <b>Herman</b></p>
            <p style="margin-bottom:5px">Contact: +256790311166</p>
            <p>Email: hermanedaru@gmail.com</p>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('emoji-grid').innerHTML = EMOJIS.map(e => `<span onclick="insertEmoji('${e}')">${e}</span>`).join('');
  document.getElementById('sticker-grid').innerHTML = STICKERS.map(s => `<img src="${s}" onclick="sendSticker('${s}')" />`).join('');

  document.getElementById('settings-btn').onclick = () => document.getElementById('settings-page').classList.add('active');
  document.getElementById('close-settings-btn').onclick = () => document.getElementById('settings-page').classList.remove('active');
  document.getElementById('new-group-btn').onclick = openNewGroupModal;
  document.getElementById('back-btn').onclick = () => { document.getElementById('chat-window').classList.remove('active'); cancelReply(); };
  document.getElementById('group-info-btn').onclick = openGroupInfoModal;
  document.getElementById('delete-chat-btn').onclick = handleDeleteChat;
  document.getElementById('send-btn').onclick = handleSendOrRecord;
  document.getElementById('msg-input').oninput = handleInputTyping;
  document.getElementById('attach-btn').onclick = openAttachMenu;
  document.getElementById('emoji-btn').onclick = toggleEmojiPanel;
  document.getElementById('status-btn').onclick = openStatusTab;
  document.getElementById('explore-btn').onclick = activateExplore;

  // Debounced search
  let searchDebounce;
  document.getElementById('search').oninput = (e) => {
    clearTimeout(searchDebounce);
    const term = e.target.value.trim();
    searchDebounce = setTimeout(() => {
      if (term.length < 2) {
        if (currentTab === 'explore') loadExploreUsers();
        else loadMyChats();
      } else {
        handleSearch({ target: { value: term } });
      }
    }, 250);
  };

  document.getElementById('chat-upload-image').onchange = (e) => handleMediaUpload(e, 'image');
  document.getElementById('chat-upload-audio').onchange = (e) => handleMediaUpload(e, 'audio');
  document.getElementById('chat-upload-video').onchange = (e) => handleMediaUpload(e, 'video');
  document.getElementById('chat-upload-doc').onchange = (e) => handleMediaUpload(e, 'document');
  document.getElementById('status-upload').onchange = handleStatusUpload;

  document.getElementById('msg-input').addEventListener('pointerdown', () => {
    const p = document.getElementById('emoji-panel');
    if (p) p.classList.remove('show');
  });

  document.getElementById('header-profile-btn').onclick = () => {
    if (!currentChatId || !currentOtherId) return;
    openFriendProfileModal(currentOtherId, document.getElementById('other-name').textContent, document.getElementById('other-av').querySelector('img')?.src);
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('explore-btn').classList.remove('active');
      currentTab = btn.dataset.tab;
      if (unsubExplore) { unsubExplore(); unsubExplore = null; }
      loadMyChats();
    };
  });

  loadMyChats();
}
// ---------- EXPLORE ----------
window.activateExplore = () => {
  currentTab = 'explore';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('explore-btn').classList.add('active');
  document.getElementById('search').value = '';
  loadExploreUsers();
};

async function loadExploreUsers() {
  const list = document.getElementById('chats-list');
  if (!list) return;
  if (unsubExplore) { unsubExplore(); unsubExplore = null; }
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading users...</div>';

  unsubExplore = onSnapshot(collection(db, "users"), (snap) => {
    if (currentTab !== 'explore') return;
    const users = [];
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      if (!u.displayName) return;
      users.push({ id: d.id, ...u });
    });
    users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    if (users.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No users yet</div>';
      return;
    }
    list.innerHTML = users.map(u => {
      const online = isUserOnline(u.lastSeen);
      const hasStatus = activeStatusUsers.has(u.id);
      return `<li class="chat-item" data-uid="${u.id}" onclick="startDM('${u.id}', '${u.displayName}', '${u.photoURL || ''}')">
        <div class="avatar-wrap ${hasStatus ? 'has-status' : ''}">
          <div class="avatar">${u.photoURL ? `<img loading="lazy" src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover">` : u.displayName[0]}</div>
          <div class="status-dot ${online ? 'online' : 'offline'}"></div>
        </div>
        <div class="chat-info"><div class="chat-top"><span class="chat-name">${u.displayName}</span></div><div class="chat-bottom"><span class="chat-preview">@${u.username}</span></div></div>
      </li>`;
    }).join('');
  });
}

// ---------- STATUS ----------
window.openStatusTab = async () => {
  const snap = await getDocs(collection(db, "statuses"));
  const now = Date.now();
  const byUser = {};
  snap.forEach(d => {
    const s = d.data();
    const expireMs = toMillis(s.expireAt);
    if (expireMs && expireMs < now) { deleteDoc(d.ref).catch(()=>{}); return; }
    if (!byUser[s.userId]) byUser[s.userId] = [];
    byUser[s.userId].push({ id: d.id, ...s });
  });
  const userIds = Object.keys(byUser);
  const usersData = {};
  await Promise.all(userIds.map(async uid => {
    const us = await getDoc(doc(db, "users", uid));
    if (us.exists()) usersData[uid] = us.data();
  }));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h3>Status</h3>
      <button class="btn-primary" id="add-status-btn" style="margin-bottom:15px">+ Add to Status</button>
      <h4 style="color:var(--text-muted);font-size:13px;margin-bottom:10px">Recent updates</h4>
      ${userIds.filter(uid => usersData[uid]).map(uid => {
        const u = usersData[uid];
        const count = byUser[uid].length;
        const isMe = uid === currentUser.uid;
        return `<div class="status-user-item" onclick="window.viewUserStatus('${uid}');this.closest('.modal-overlay').remove()">
          <div class="avatar-wrap has-status"><div class="avatar">${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover">` : u.displayName[0]}</div></div>
          <div style="flex:1"><div style="font-weight:600">${isMe ? 'My Status' : u.displayName}</div><div style="font-size:12px;color:var(--text-muted)">${count} update${count>1?'s':''}</div></div>
        </div>`;
      }).join('') || '<div style="text-align:center;color:var(--text-muted);padding:15px">No statuses yet</div>'}
      <button class="btn-secondary" style="margin-top:15px" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('add-status-btn').onclick = () => {
    overlay.remove();
    document.getElementById('status-upload').click();
  };
};

window.viewUserStatus = async (userId) => {
  const snap = await getDocs(query(collection(db, "statuses"), where("userId", "==", userId)));
  const now = Date.now();
  const statuses = [];
  snap.forEach(d => {
    const s = d.data();
    const expireMs = toMillis(s.expireAt);
    if (!expireMs || expireMs > now) statuses.push({ id: d.id, ...s });
  });
  if (statuses.length === 0) return showAlert("No Status", "This user has no active status.");
  statuses.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));

  let idx = 0;
  const overlay = document.createElement('div');
  overlay.className = 'status-viewer';
  document.body.appendChild(overlay);
  const render = () => {
    if (idx >= statuses.length) { overlay.remove(); return; }
    if (idx < 0) idx = 0;
    const s = statuses[idx];
    overlay.innerHTML = `
      <div class="status-progress">${statuses.map((_, i) => `<div class="status-progress-bar ${i < idx ? 'done' : i === idx ? 'active' : ''}"><div></div></div>`).join('')}</div>
      <div class="status-media">${s.mediaType === 'video' ? `<video src="${s.mediaUrl}" autoplay playsinline></video>` : `<img src="${s.mediaUrl}">`}</div>
      <button class="status-close" id="st-close">✕</button>
      <button class="status-nav prev" id="st-prev">‹</button>
      <button class="status-nav next" id="st-next">›</button>
    `;
    document.getElementById('st-close').onclick = () => overlay.remove();
    document.getElementById('st-prev').onclick = () => { idx--; render(); };
    document.getElementById('st-next').onclick = () => { idx++; render(); };
    if (s.mediaType !== 'video') setTimeout(() => { if (overlay.parentNode) { idx++; render(); } }, 5000);
  };
  render();
};

async function handleStatusUpload(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !currentUser) return;
  if (file.size > 5 * 1024 * 1024) return showAlert("Too Large", "Status must be under 5MB.");
  try {
    showAlert("Uploading", "Please wait...");
    const url = await uploadToCloudinary(file);
    await addDoc(collection(db, "statuses"), {
      userId: currentUser.uid,
      userDisplayName: currentUser.displayName,
      mediaUrl: url,
      mediaType: file.type.startsWith('video') ? 'video' : 'image',
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + STATUS_TTL_MS)
    });
    document.querySelector('.modal-overlay')?.remove();
    showAlert("Success", "Status posted! Auto-deletes in 24 hours.");
  } catch (err) {
    document.querySelector('.modal-overlay')?.remove();
    showAlert("Error", err.message);
  }
}
// ---------- ATTACH ----------
window.openAttachMenu = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Send Media</h3>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-image').click();this.closest('.modal-overlay').remove()">📷 Photo <small style="color:var(--text-muted)">(max 5MB)</small></button>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-audio').click();this.closest('.modal-overlay').remove()">🎵 Music <small style="color:var(--text-muted)">(max 5MB)</small></button>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-video').click();this.closest('.modal-overlay').remove()">🎥 Video <small style="color:var(--text-muted)">(max 3MB)</small></button>
      <button class="btn-secondary" onclick="document.getElementById('chat-upload-doc').click();this.closest('.modal-overlay').remove()">📄 Document <small style="color:var(--text-muted)">(max 2MB)</small></button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
};

async function handleMediaUpload(e, kind) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !currentChatId || !currentConvData) return;
  const limit = MEDIA_LIMITS[kind];
  if (file.size > limit) return showAlert("File too large", `Max ${kind} is ${(limit / 1024 / 1024).toFixed(0)}MB.`);

  try {
    showAlert("Uploading", "Please wait...");
    const url = await uploadToCloudinary(file);
    document.querySelector('.modal-overlay')?.remove();

    const convData = currentConvData;
    const timerMs = convData.timer || 0;
    const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
    const textMap = { image: '📷 Image', audio: '🎵 Music', video: '🎥 Video', document: '📄 Document' };
    const msgData = {
      text: textMap[kind],
      senderId: currentUser.uid, senderName: currentUser.displayName,
      createdAt: serverTimestamp(), type: kind, mediaUrl: url,
      fileName: kind === 'document' ? file.name : null,
      expireAt, reactions: {}, clientTs: Date.now()
    };
    await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
    const updates = {
      lastMessage: textMap[kind], lastMessageSenderId: currentUser.uid,
      lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...convData.participants)
    };
    convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
    cancelReply();
  } catch (err) {
    document.querySelector('.modal-overlay')?.remove();
    showAlert("Upload Error", err.message);
  }
}

// ---------- EMOJI ----------
window.toggleEmojiPanel = (e) => {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const panel = document.getElementById('emoji-panel');
  const input = document.getElementById('msg-input');
  if (panel.classList.contains('show')) panel.classList.remove('show');
  else {
    input.setAttribute('readonly', 'readonly');
    input.blur();
    setTimeout(() => input.removeAttribute('readonly'), 150);
    panel.classList.add('show');
  }
};

if (!window._emojiOutsideAdded) {
  document.addEventListener('click', (e) => {
    const p = document.getElementById('emoji-panel');
    if (!p || !p.classList.contains('show')) return;
    if (p.contains(e.target)) return;
    if (e.target.closest('#emoji-btn')) return;
    p.classList.remove('show');
  });
  window._emojiOutsideAdded = true;
}

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
  const btn = document.getElementById('send-btn');
  if (input.value.trim() && btn.dataset.mode !== 'send') { btn.innerHTML = ICONS.send; btn.dataset.mode = 'send'; }
};

window.sendSticker = async (stickerUrl) => {
  if (!currentChatId || isSending || !currentConvData) return;
  isSending = true;
  document.getElementById('emoji-panel').classList.remove('show');

  const convData = currentConvData;
  const timerMs = convData.timer || 0;
  const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
  const msgData = { text: 'Sticker', senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'sticker', mediaUrl: stickerUrl, expireAt, clientTs: Date.now() };

  try {
    await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
    const updates = { lastMessage: '🖼️ Sticker', lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
    convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
  } catch (err) { showAlert("Error", err.message); }
  isSending = false;
};

// ---------- ADMIN ----------
window.openAdminModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3 style="color:#ff9900">⚡ Admin Broadcast</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:15px">Sends a pop-up to every user.</p>
      <textarea id="broadcast-msg" placeholder="Type your announcement..." style="width:100%;height:100px;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-main);color:var(--text);margin-bottom:10px;resize:none"></textarea>
      <button class="btn-primary" id="send-broadcast-btn" style="background:#ff9900">Send to All</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('send-broadcast-btn').onclick = async () => {
    const msg = document.getElementById('broadcast-msg').value.trim();
    if (!msg) return showAlert("Error", "Please type a message.");
    try {
      await setDoc(doc(db, "system", "broadcast"), { message: msg, timestamp: Date.now() });
      showAlert("Sent!", "Your broadcast has been sent.");
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

// ---------- FRIEND PROFILE ----------
window.openFriendProfileModal = (uid, name, photoURL) => {
  if (!uid) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <div class="avatar-wrap" style="width:100px;height:100px;margin:0 auto 15px">
        <div class="avatar" style="font-size:40px">${photoURL ? `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover">` : name[0]}</div>
      </div>
      <h3 style="margin-bottom:5px">${name}</h3>
      <p style="color:var(--text-muted);font-size:14px;margin-bottom:20px">@${uid}</p>
      <button class="btn-primary" id="save-contact-btn" style="margin-bottom:10px"> Save to Contacts</button>
      <button class="btn-danger" id="delete-thread-btn">Delete Chat History</button>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('save-contact-btn').onclick = () => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name} (Mofie)\nTEL;TYPE=CELL:${uid}\nNOTE:Mofie ID: @${uid}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: "text/vcard" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}_Mofie.vcf`;
    a.click();
    showAlert("Contact Saved", "Contact card downloaded.");
  };
  document.getElementById('delete-thread-btn').onclick = () => {
    showAlert("Delete Chat", "Delete this chat history for yourself?", true, async () => {
      await updateDoc(doc(db, "conversations", currentChatId), { clearedBy: arrayUnion(currentUser.uid) });
      document.getElementById('chat-window').classList.remove('active');
      overlay.remove();
      if (currentTab === 'explore') loadExploreUsers();
      else loadMyChats();
    });
  };
};
// ---------- SEARCH ----------
async function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase().trim();
  const list = document.getElementById('chats-list');
  if (searchTerm.length < 2) {
    if (currentTab === 'explore') loadExploreUsers();
    else loadMyChats();
    return;
  }
  if (unsubExplore) { unsubExplore(); unsubExplore = null; }

  const q = query(collection(db, "users"), where("username", ">=", searchTerm), where("username", "<=", searchTerm + '\uf8ff'));
  const snap = await getDocs(q);
  let resultsHTML = '';
  let hasResults = false;
  let seen = new Set();
  snap.forEach(d => {
    if (d.id === currentUser.uid) return;
    const u = d.data();
    if (seen.has(u.username)) return;
    seen.add(u.username);
    hasResults = true;
    const hasStatus = activeStatusUsers.has(d.id);
    resultsHTML += `<li class="chat-item" data-uid="${d.id}" onclick="startDM('${d.id}', '${u.displayName}', '${u.photoURL || ''}')">
      <div class="avatar-wrap ${hasStatus ? 'has-status' : ''}"><div class="avatar">${u.photoURL ? `<img loading="lazy" src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover">` : u.displayName[0]}</div></div>
      <div class="chat-info"><div class="chat-top"><span class="chat-name">${u.displayName}</span></div><div class="chat-bottom"><span class="chat-preview">@${u.username}</span></div></div>
    </li>`;
  });
  list.innerHTML = hasResults ? resultsHTML : '<div style="text-align:center;padding:20px;color:var(--text-muted)">No users found</div>';
}

// ---------- CHAT LIST ----------
async function loadMyChats() {
  const list = document.getElementById('chats-list');
  if (!list) return;
  const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
  if (unsubChats) unsubChats();

  unsubChats = onSnapshot(q, async (snap) => {
    snap.docChanges().forEach(change => {
      const data = change.doc.data();
      const chatId = change.doc.id;
      const newTime = toMillis(data.lastMessageTime);
      if (change.type === 'modified') {
        const oldTime = knownChatTimestamps.get(chatId) || 0;
        if (newTime > oldTime && data.lastMessageSenderId !== currentUser.uid && chatId !== currentChatId) {
          notifyNewMessage('New message', data.lastMessage || 'You have a new message', chatId);
        }
      }
      knownChatTimestamps.set(chatId, newTime);
    });

    if (currentTab === 'explore') return;
    if (snap.empty) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No chats yet.</div>';
      return;
    }

    const sortedDocs = snap.docs.sort((a, b) => toMillis(b.data().lastMessageTime) - toMillis(a.data().lastMessageTime));
    const uniqueConvs = new Map();
    for (const d of sortedDocs) {
      const data = d.data();
      if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue;
      let key;
      if (data.isGroup) key = d.id;
      else {
        const otherId = data.participants.find(id => id !== currentUser.uid);
        if (!otherId) continue;
        key = otherId;
      }
      if (!uniqueConvs.has(key)) uniqueConvs.set(key, { id: d.id, data, isGroup: data.isGroup });
    }

    const visible = [];
    for (const conv of uniqueConvs.values()) {
      const { data, isGroup } = conv;
      if (currentTab === 'groups' && !isGroup) continue;
      if (currentTab === 'unread' && (!data.unreadCounts || !data.unreadCounts[currentUser.uid])) continue;
      visible.push(conv);
    }

    // Parallel fetch of all other users (cached)
    const otherIds = [...new Set(visible.filter(v => !v.isGroup).map(v => v.data.participants.find(id => id !== currentUser.uid)))];
    const userMap = {};
    await Promise.all(otherIds.map(async uid => { if (uid) userMap[uid] = await getUserCached(uid); }));

    let listHTML = '';
    for (const { id, data, isGroup } of visible) {
      let displayName, photoURL, online = false, otherIdForClick = '';
      if (isGroup) {
        displayName = data.groupName;
        photoURL = data.groupPhotoURL;
      } else {
        otherIdForClick = data.participants.find(id => id !== currentUser.uid);
        const u = userMap[otherIdForClick] || {};
        displayName = u.displayName || 'Unknown';
        photoURL = u.photoURL;
        online = isUserOnline(u.lastSeen);
      }
      const unread = (data.unreadCounts && data.unreadCounts[currentUser.uid]) || 0;
      const badgeHTML = unread > 0 ? `<div class="unread-badge">${unread}</div>` : '';
      const hasStatus = !isGroup && activeStatusUsers.has(otherIdForClick);
      listHTML += `<li class="chat-item" data-uid="${otherIdForClick}" onclick="openChat('${id}', '${otherIdForClick}', '${displayName.replace(/'/g, "\\'")}', '${photoURL || ''}', ${isGroup})">
        <div class="avatar-wrap ${hasStatus ? 'has-status' : ''}">
          <div class="avatar">${photoURL ? `<img loading="lazy" src="${photoURL}" style="width:100%;height:100%;object-fit:cover">` : displayName[0]}</div>
          ${isGroup ? '' : `<div class="status-dot ${online ? 'online' : 'offline'}"></div>`}
        </div>
        <div class="chat-info"><div class="chat-top"><span class="chat-name">${displayName}</span>${badgeHTML}</div><div class="chat-bottom"><span class="chat-preview">${data.lastMessage || ''}</span></div></div>
      </li>`;
    }
    list.innerHTML = listHTML || '<div style="text-align:center;padding:20px;color:var(--text-muted)">No chats found.</div>';
  });
}

// ---------- OPEN CHAT ----------
window.openChat = async function(chatId, otherId, name, photoURL, isGroup) {
  currentChatId = chatId;
  currentOtherId = otherId;
  isFirstMessagesLoad = true;
  pendingMessages = [];
  cancelReply();
  document.getElementById('chat-window').classList.add('active');
  document.getElementById('other-name').textContent = name;
  document.getElementById('other-av').innerHTML = photoURL ? `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : name[0];
  document.getElementById('emoji-panel').classList.remove('show');

  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';

  if (unsubMessages) unsubMessages();
  if (unsubConvMeta) unsubConvMeta();

  // Load conv once, then keep fresh via meta listener
  currentConvData = (await getDoc(doc(db, "conversations", chatId))).data() || {};
  updateTimerUI(currentConvData.timer || 0);

  unsubConvMeta = onSnapshot(doc(db, "conversations", chatId), async (docSnap) => {
    if (!docSnap.exists()) {
      document.getElementById('chat-window').classList.remove('active');
      return;
    }
    const data = docSnap.data();
    currentConvData = data;
    updateTimerUI(data.timer || 0);
    const statusEl = document.getElementById('other-status');

    if (!isGroup && data.typing && data.typing[otherId] && (Date.now() - data.typing[otherId]) < 5000) {
      statusEl.textContent = 'typing...';
      statusEl.classList.add('typing-active');
      return;
    }
    statusEl.classList.remove('typing-active');

    if (isGroup) {
      statusEl.textContent = `${data.participants.length} members`;
      document.getElementById('header-status-dot').style.display = 'none';
      document.getElementById('group-info-btn').style.display = 'block';
    } else {
      const otherUser = await getUserCached(otherId);
      const online = isUserOnline(otherUser.lastSeen);
      statusEl.textContent = online ? 'online' : 'offline';
      document.getElementById('header-status-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
      document.getElementById('header-status-dot').style.display = 'block';
      document.getElementById('group-info-btn').style.display = 'none';
    }
  });

  await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp(), [`unreadCounts.${currentUser.uid}`]: 0 });

  const q = query(collection(db, "conversations", chatId, "messages"), orderBy("createdAt", "asc"));
  unsubMessages = onSnapshot(q, async (snap) => {
    const convData = currentConvData || {};
    const docs = snap.docs;

    if (!isFirstMessagesLoad) {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = change.doc.data();
          if (m.senderId !== currentUser.uid) notifyNewMessage(m.senderName || name, m.text || 'New message', chatId);
        }
      });
    }
    isFirstMessagesLoad = false;

    let messagesHTML = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';

    docs.forEach(doc => {
      const m = doc.data();
      const expireMs = toMillis(m.expireAt);
      if (expireMs && expireMs < Date.now()) { deleteDoc(doc.ref).catch(() => {}); return; }
      if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return;

      const isMe = m.senderId === currentUser.uid;
      let tickHTML = '';
      if (isMe) {
        const otherReadTime = convData.readAt && convData.readAt[otherId] ? toMillis(convData.readAt[otherId]) : 0;
        const msgTime = toMillis(m.createdAt) || Date.now();
        if (!isGroup && msgTime <= otherReadTime) tickHTML = `<span class="tick read">${ICONS.tickDouble}</span>`;
        else tickHTML = `<span class="tick">${ICONS.tickSingle}</span>`;
      }
      const timeStr = m.createdAt ? new Date(toMillis(m.createdAt)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

      let contentHTML = m.text;
      let bubbleClass = 'bubble';
      if (m.type === 'image') contentHTML = `<img loading="lazy" src="${m.mediaUrl}" style="max-width:100%;border-radius:8px">`;
      else if (m.type === 'audio') contentHTML = `<audio controls src="${m.mediaUrl}" style="max-width:100%"></audio>`;
      else if (m.type === 'video') contentHTML = `<video controls src="${m.mediaUrl}" playsinline></video>`;
      else if (m.type === 'document') contentHTML = `<a href="${m.mediaUrl}" target="_blank" rel="noopener" class="doc-msg">📄 ${m.fileName || 'Document'}</a>`;
      else if (m.type === 'sticker') { contentHTML = `<img src="${m.mediaUrl}" class="sticker-img">`; bubbleClass = 'bubble sticker-bubble'; }

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

    // Reattach pending optimistic messages
    const stillPending = pendingMessages.filter(p => !docs.some(d => d.data().clientTs === p.createdAtMs));
    pendingMessages = stillPending;
    stillPending.forEach(p => {
      const el = document.createElement('div');
      el.className = 'msg-row me';
      el.innerHTML = `<div class="bubble" style="opacity:0.65">${p.text}<div class="msg-meta">${new Date(p.createdAtMs).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}<span class="tick">${ICONS.tickSingle}</span></div></div>`;
      msgsEl.appendChild(el);
    });

    msgsEl.querySelectorAll('.bubble').forEach((bubble) => {
      const docId = bubble.closest('.msg-row').dataset.msgId;
      if (!docId) return;
      const m = docs.find(d => d.id === docId)?.data();
      if (!m) return;
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
      bubble.addEventListener('mousedown', () => { pressTimer = setTimeout(() => showMessageMenu(chatId, docId, isMe, m, isMe ? currentUser.displayName : name), 600); });
      bubble.addEventListener('mouseup', () => clearTimeout(pressTimer));
      bubble.addEventListener('touchstart', () => { pressTimer = setTimeout(() => showMessageMenu(chatId, docId, isMe, m, isMe ? currentUser.displayName : name), 600); }, { passive: true });
      bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    });

    msgsEl.scrollTop = msgsEl.scrollHeight;
    await updateDoc(doc(db, "conversations", chatId), { [`readAt.${currentUser.uid}`]: serverTimestamp(), [`unreadCounts.${currentUser.uid}`]: 0 });
  });
};
// ---------- REACTIONS ----------
window.toggleReaction = async (chatId, msgId, emoji) => {
  const ref = doc(db, "conversations", chatId, "messages", msgId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cur = snap.data().reactions || {};
  if (cur[currentUser.uid] === emoji) {
    await updateDoc(ref, { [`reactions.${currentUser.uid}`]: null });
  } else {
    await updateDoc(ref, { [`reactions.${currentUser.uid}`]: emoji });
  }
};

function showMessageMenu(chatId, msgId, isMe, msgData, senderName) {
  if (document.querySelector('.msg-menu-overlay')) return;
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay msg-menu-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:350px;text-align:center">
      <div class="emoji-picker">${emojis.map(e => `<span onclick="window.toggleReaction('${chatId}', '${msgId}', '${e}');this.closest('.modal-overlay').remove()">${e}</span>`).join('')}</div>
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
  const ref = doc(db, "conversations", chatId, "messages", msgId);
  if (forEveryone) { try { await deleteDoc(ref); } catch (e) { showAlert("Error", e.message); } }
  else { await updateDoc(ref, { deletedBy: arrayUnion(currentUser.uid) }); }
};

window.openForwardModal = (msgData) => {
  document.querySelector('.msg-menu-overlay').remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:left">
      <h3 style="text-align:center">Forward Message</h3>
      <div id="forward-list"><div style="padding:10px;text-align:center">Loading chats...</div></div>
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
      let name = data.isGroup ? data.groupName : (await getUserCached(data.participants.find(id => id !== currentUser.uid))).displayName;
      const item = document.createElement('div');
      item.className = 'forward-item';
      item.innerHTML = `<div style="flex:1;font-weight:600">${name}</div>`;
      item.onclick = async () => {
        await addDoc(collection(db, "conversations", d.id, "messages"), {
          text: msgData.text, senderId: currentUser.uid, senderName: currentUser.displayName,
          createdAt: serverTimestamp(), type: msgData.type, mediaUrl: msgData.mediaUrl || null, fileName: msgData.fileName || null, forwarded: true,
          expireAt: Timestamp.fromMillis(Date.now() + MESSAGE_TTL_MS)
        });
        await updateDoc(doc(db, "conversations", d.id), { lastMessage: msgData.text || 'Media', lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp() });
        showAlert("Success", "Forwarded!"); overlay.remove();
      };
      list.appendChild(item);
    });
  });
};

// ---------- TIMERS ----------
window.openTimerModal = async () => {
  const convSnap = await getDoc(doc(db, "conversations", currentChatId));
  if (!convSnap.exists()) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:left">
      <h3 style="text-align:center">Disappearing Messages</h3>
      <p style="font-size:12px;color:var(--text-muted);text-align:center;margin-bottom:15px">All messages auto-delete from Firestore.</p>
      <div class="timer-options">
        <button class="timer-option" onclick="setTimer(0)">24 Hours (Default)</button>
        <button class="timer-option" onclick="setTimer(300000)">5 Minutes</button>
        <button class="timer-option" onclick="setTimer(3600000)">1 Hour</button>
        <button class="timer-option" onclick="setTimer(43200000)">12 Hours</button>
      </div>
      <button class="btn-secondary" style="margin-top:15px" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
};

window.setTimer = async (ms) => {
  document.querySelector('.modal-overlay').remove();
  const snap = await getDoc(doc(db, "conversations", currentChatId));
  if (snap.exists()) {
    await updateDoc(doc(db, "conversations", currentChatId), { timer: ms });
    updateTimerUI(ms);
  }
};

function updateTimerUI(ms) {
  const el = document.getElementById('timer-text');
  if (!el) return;
  if (!ms || ms === 0) el.textContent = "24 Hours";
  else if (ms === 300000) el.textContent = "5 Mins";
  else if (ms === 3600000) el.textContent = "1 Hour";
  else if (ms === 43200000) el.textContent = "12 Hours";
  else el.textContent = "24 Hours";
}

// ---------- ACTIONS ----------
async function handleDeleteChat() {
  if (!currentChatId) return;
  showAlert("Delete Chat", "Delete this chat history for yourself?", true, async () => {
    await updateDoc(doc(db, "conversations", currentChatId), { clearedBy: arrayUnion(currentUser.uid) });
    document.getElementById('chat-window').classList.remove('active');
    if (currentTab === 'explore') loadExploreUsers();
    else loadMyChats();
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
  if (currentTab === 'explore') loadExploreUsers();
  else loadMyChats();
};

function handleInputTyping(e) {
  if (!isRecording) {
    const btn = document.getElementById('send-btn');
    const hasText = !!e.target.value.trim();
    const currentMode = btn.dataset.mode;
    if (hasText && currentMode !== 'send') { btn.innerHTML = ICONS.send; btn.dataset.mode = 'send'; }
    else if (!hasText && currentMode !== 'mic') { btn.innerHTML = ICONS.mic; btn.dataset.mode = 'mic'; }
  }
  if (!currentChatId || !currentUser || !e.target.value.trim()) return;
  const now = Date.now();
  const convRef = doc(db, "conversations", currentChatId);
  if (now - lastTypingUpdate > 2000) {
    lastTypingUpdate = now;
    updateDoc(convRef, { [`typing.${currentUser.uid}`]: now }).catch(() => {});
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    updateDoc(convRef, { [`typing.${currentUser.uid}`]: null }).catch(() => {});
    lastTypingUpdate = 0;
  }, 3000);
}

function handleSendOrRecord(e) {
  if (document.getElementById('msg-input').value.trim()) sendAction(e);
  else toggleRecording();
}
// ---------- OPTIMISTIC SEND ----------
async function sendAction(e) {
  if (e) e.preventDefault();
  if (isSending) return;
  const inp = document.getElementById('msg-input');
  const text = inp.value.trim();
  if (!text || !currentChatId || !currentConvData) return;

  isSending = true;
  const msgsEl = document.getElementById('messages');
  const now = Date.now();
  const tempId = 'temp_' + now;

  // INSTANT optimistic bubble
  pendingMessages.push({ tempId, text, createdAtMs: now });
  const tempEl = document.createElement('div');
  tempEl.className = 'msg-row me';
  tempEl.innerHTML = `<div class="bubble" style="opacity:0.65">${text}<div class="msg-meta">${new Date(now).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}<span class="tick">${ICONS.tickSingle}</span></div></div>`;
  msgsEl.appendChild(tempEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  inp.value = '';
  document.getElementById('send-btn').innerHTML = ICONS.mic;
  document.getElementById('send-btn').dataset.mode = 'mic';
  cancelReply();

  const convData = currentConvData;
  const timerMs = convData.timer || 0;
  const expireAt = Timestamp.fromMillis(now + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));

  const msgData = { text, senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'text', expireAt, reactions: {}, clientTs: now };
  if (replyToMsg) { msgData.replyToId = replyToMsg.id; msgData.replyToText = replyToMsg.text; msgData.replyToSender = replyToMsg.senderName; }

  try {
    const updates = { lastMessage: text, lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants), [`typing.${currentUser.uid}`]: null };
    convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });

    await Promise.all([
      addDoc(collection(db, "conversations", currentChatId, "messages"), msgData),
      updateDoc(doc(db, "conversations", currentChatId), updates)
    ]);

    clearTimeout(typingTimeout);
    lastTypingUpdate = 0;
  } catch (err) {
    tempEl.remove();
    pendingMessages = pendingMessages.filter(p => p.tempId !== tempId);
    showAlert("Error", err.message);
    inp.value = text;
    document.getElementById('send-btn').innerHTML = ICONS.send;
    document.getElementById('send-btn').dataset.mode = 'send';
  }
  isSending = false;
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
        if (!currentChatId || !currentConvData) return;
        const url = await uploadToCloudinary(new File([audioBlob], "voice_note.webm", { type: 'audio/webm' }));
        const convData = currentConvData;
        const timerMs = convData.timer || 0;
        const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
        const msgData = { text: '🎤 Voice Note', senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: serverTimestamp(), type: 'audio', mediaUrl: url, expireAt, reactions: {}, clientTs: Date.now() };
        await addDoc(collection(db, "conversations", currentChatId, "messages"), msgData);
        const updates = { lastMessage: '🎤 Voice Note', lastMessageSenderId: currentUser.uid, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(), clearedBy: arrayRemove(...convData.participants) };
        convData.participants.forEach(p => { if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1); });
        await updateDoc(doc(db, "conversations", currentChatId), updates);
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
    btn.dataset.mode = 'mic';
  }
}

window.cancelReply = () => { replyToMsg = null; document.getElementById('reply-banner').classList.remove('show'); };
function setReply(msg, senderName) {
  replyToMsg = { id: msg.id, text: msg.text || 'Media', senderName };
  document.getElementById('rb-text').textContent = msg.text || 'Media';
  document.getElementById('reply-banner').classList.add('show');
  document.getElementById('msg-input').focus();
}

// ---------- SETTINGS ----------
window.openThemeModal = () => {
  const t = localStorage.getItem('mofie-theme') || 'dark';
  const a1 = localStorage.getItem('mofie-accent1') || '#00a884';
  const a2 = localStorage.getItem('mofie-accent2') || '#53bdeb';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Appearance</h3>
      <div class="theme-row"><label>Theme</label>
        <select id="theme-select">
          <option value="light" ${t === 'light' ? 'selected' : ''}>Light Mode</option>
          <option value="dark" ${t === 'dark' ? 'selected' : ''}>Dark Mode</option>
          <option value="neon" ${t === 'neon' ? 'selected' : ''}>Neon Mode</option>
        </select>
      </div>
      <div class="theme-row"><label>Primary</label><input type="color" id="accent1-picker" value="${a1}"></div>
      <div class="theme-row"><label>Secondary</label><input type="color" id="accent2-picker" value="${a2}"></div>
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
      <div class="avatar-wrap" style="margin:0 auto 15px;width:80px;height:80px" onclick="document.getElementById('profile-upload').click()">
        <div class="avatar" id="settings-av">${currentUser.photoURL ? `<img src="${currentUser.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : currentUser.displayName[0]}</div>
        <div style="position:absolute;bottom:0;right:0;background:var(--user-accent-1);color:var(--bg-main);border-radius:50%;padding:4px">${ICONS.camera}</div>
      </div>
      <input id="set-name" placeholder="Display Name" value="${currentUser.displayName}">
      <button class="btn-primary" id="btn-save-name" style="margin-bottom:10px">Save Name</button>
      ${currentUser.photoURL ? `<button class="btn-danger" id="btn-remove-photo" style="margin-bottom:10px">Remove Photo</button>` : ''}
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('profile-upload').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      document.getElementById('settings-av').innerHTML = '...';
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
      currentUser.photoURL = url;
      overlay.remove();
      // Update DOM without full re-render
      const settingsAvatar = document.querySelector('.settings-profile .avatar');
      if (settingsAvatar) settingsAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
      showAlert("Success", "Profile updated!");
    } catch(err) { showAlert("Error", err.message); }
  };

  document.getElementById('btn-save-name').onclick = async () => {
    const newName = document.getElementById('set-name').value.trim();
    if (!newName) return;
    await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName });
    currentUser.displayName = newName;
    overlay.remove();
    const nameEl = document.querySelector('.settings-profile .name');
    if (nameEl) nameEl.textContent = newName;
    showAlert("Success", "Name updated!");
  };

  const btnRemove = document.getElementById('btn-remove-photo');
  if (btnRemove) btnRemove.onclick = async () => {
    await updateDoc(doc(db, "users", currentUser.uid), { photoURL: null });
    currentUser.photoURL = null;
    overlay.remove();
    const settingsAvatar = document.querySelector('.settings-profile .avatar');
    if (settingsAvatar) settingsAvatar.textContent = currentUser.displayName[0];
    showAlert("Removed", "Profile photo removed.");
  };
};

window.openAccountModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Account Security</h3>
      <input id="set-password" type="password" placeholder="New Password (min 6 chars)">
      <button class="btn-primary" id="btn-change-password" style="margin-bottom:10px">Change Password</button>
      <hr style="border-color:var(--border);margin:20px 0">
      <button class="btn-secondary" id="btn-logout" style="color:var(--user-accent-1);border-color:var(--user-accent-1);margin-bottom:10px">Log Out</button>
      <button class="btn-danger" id="btn-delete-acc">Delete Account Permanently</button>
      <button class="btn-secondary" style="margin-top:10px" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('btn-change-password').onclick = async () => {
    const np = document.getElementById('set-password').value;
    if (np.length < 6) return showAlert("Error", "Password must be at least 6 characters.");
    try {
      await updatePassword(auth.currentUser, np);
      showAlert("Success", "Password changed!");
      overlay.remove();
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') showAlert("Security Check", "Log out and back in before changing your password.");
      else showAlert("Error", error.message);
    }
  };
  document.getElementById('btn-logout').onclick = () => { signOut(auth); overlay.remove(); };
  document.getElementById('btn-delete-acc').onclick = () => {
    showAlert("Delete Account", "This will permanently delete your account. Cannot be undone.", true, async () => {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid));
        await deleteDoc(doc(db, "usernames", currentUser.username));
        await deleteUser(auth.currentUser);
        showAlert("Deleted", "Account deleted.");
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        if (error.code === 'auth/requires-recent-login') showAlert("Security Check", "Log out and back in before deleting.");
        else showAlert("Error", error.message);
      }
    });
  };
};
// ---------- GROUPS ----------
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
    const term = e.target.value.toLowerCase().trim();
    if (term.length < 2) return;
    const q = query(collection(db, "users"), where("username", ">=", term), where("username", "<=", term + '\uf8ff'));
    const snap = await getDocs(q);
    const list = document.getElementById('group-user-list');
    list.innerHTML = '';
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      const isSel = window.selectedGroupUsers.has(u.uid);
      const item = document.createElement('div');
      item.className = `user-select-item ${isSel ? 'selected' : ''}`;
      item.innerHTML = `<div class="avatar">${u.photoURL ? `<img src="${u.photoURL}">` : u.displayName[0]}</div><div style="flex:1">${u.displayName}</div><div style="font-size:18px;color:var(--user-accent-1)">${isSel ? '✓' : '+'}</div>`;
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
  if (!name) return showAlert("Error", "Enter a group name");
  if (window.selectedGroupUsers.size === 0) return showAlert("Error", "Select at least one person");
  const participants = [currentUser.uid, ...Array.from(window.selectedGroupUsers.keys())];
  try {
    const ref = doc(collection(db, "conversations"));
    await setDoc(ref, {
      isGroup: true, groupName: name, groupBio: "", groupPhotoURL: null,
      participants, createdBy: currentUser.uid, admins: [currentUser.uid],
      restricted: false, pendingMembers: [],
      updatedAt: serverTimestamp(), lastMessage: "Group created", lastMessageTime: serverTimestamp(),
      clearedBy: [], unreadCounts: {}, timer: 0
    });
    document.querySelector('.modal-overlay').remove();
    openChat(ref.id, null, name, null, true);
    loadMyChats();
  } catch(e) { showAlert("Error", e.message); }
};

window.openGroupInfoModal = async () => {
  const snap = await getDoc(doc(db, "conversations", currentChatId));
  if (!snap.exists()) return;
  const data = snap.data();
  const isAdmin = data.admins && data.admins.includes(currentUser.uid);
  const restricted = data.restricted || false;

  const membersHTML = await Promise.all(data.participants.map(async (uid) => {
    const u = await getUserCached(uid);
    const isAdminM = data.admins && data.admins.includes(uid);
    let controls = '';
    if (isAdmin && !isAdminM && uid !== data.createdBy) {
      controls = `<button class="btn-remove" onclick="removeMember('${uid}')" style="margin-right:4px">Remove</button><button class="btn-approve" onclick="makeAdmin('${uid}')">Make Admin</button>`;
    } else if (isAdmin && isAdminM && uid !== data.createdBy) {
      controls = `<button class="btn-reject" onclick="removeAdmin('${uid}')">Remove Admin</button>`;
    }
    return `<div class="member-item">
      <div class="avatar">${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : u.displayName[0]}</div>
      <div class="name">${u.displayName} ${isAdminM ? '<span class="admin-badge">Admin</span>' : ''}</div>
      ${controls}
    </div>`;
  }));

  let pendingHTML = '';
  if (isAdmin && data.pendingMembers && data.pendingMembers.length > 0) {
    const items = await Promise.all(data.pendingMembers.map(async (uid) => {
      const u = await getUserCached(uid);
      return `<div style="display:flex;justify-content:space-between;margin-bottom:5px"><span>${u.displayName}</span><div><button class="btn-approve" onclick="approveMember('${uid}')">Approve</button><button class="btn-reject" onclick="rejectMember('${uid}')">Reject</button></div></div>`;
    }));
    pendingHTML = `<div style="background:rgba(255,153,0,.1);border:1px solid var(--user-accent-2);border-radius:8px;padding:10px;margin-bottom:15px"><h4 style="margin:0 0 10px 0;color:var(--user-accent-2)">Pending</h4>${items.join('')}</div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="text-align:center">
      <h3>Group Info</h3>
      <div onclick="${isAdmin ? "document.getElementById('group-upload').click()" : ''}" style="width:100px;height:100px;border-radius:50%;margin:0 auto 15px;background:var(--bg-main);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:40px;color:var(--text-muted);overflow:hidden;position:relative;cursor:pointer">
        ${data.groupPhotoURL ? `<img src="${data.groupPhotoURL}" style="width:100%;height:100%;object-fit:cover">` : data.groupName[0]}
        ${isAdmin ? `<div style="position:absolute;bottom:0;right:0;background:var(--user-accent-1);color:var(--bg-main);border-radius:50%;padding:6px;font-size:12px">✎</div>` : ''}
      </div>
      <input id="group-name-input" placeholder="Group Name" value="${data.groupName}" ${isAdmin ? '' : 'disabled'}>
      <input id="group-bio-input" placeholder="Group Bio" value="${data.groupBio || ''}" ${isAdmin ? '' : 'disabled'}>
      ${isAdmin ? `<button class="btn-primary" id="save-group-info" style="margin-bottom:15px">Save Info</button>` : ''}
      <div class="group-settings-row">
        <label style="font-size:14px">Restrict Joining</label>
        <input type="checkbox" id="restrict-toggle" ${restricted ? 'checked' : ''} ${isAdmin ? '' : 'disabled'} style="width:auto;margin:0">
      </div>
      ${pendingHTML}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0;color:var(--text-muted)">Members (${data.participants.length})</h4>
        <button class="btn-primary" style="width:auto;padding:6px 12px;margin:0" onclick="openAddMemberModal()">${ICONS.addUser} Add</button>
      </div>
      <div class="member-list">${membersHTML.join('')}</div>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="margin-top:15px">Close</button>
    </div>`;
  document.body.appendChild(overlay);

  if (isAdmin) {
    document.getElementById('group-upload').onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      try {
        const url = await uploadToCloudinary(file);
        await updateDoc(doc(db, "conversations", currentChatId), { groupPhotoURL: url });
        overlay.remove(); openGroupInfoModal();
      } catch(err) { showAlert("Error", err.message); }
    };
    document.getElementById('save-group-info').onclick = async () => {
      const nn = document.getElementById('group-name-input').value.trim();
      const nb = document.getElementById('group-bio-input').value.trim();
      if (!nn) return showAlert("Error", "Group name cannot be empty");
      await updateDoc(doc(db, "conversations", currentChatId), { groupName: nn, groupBio: nb });
      showAlert("Success", "Group info updated!");
      overlay.remove();
      document.getElementById('other-name').textContent = nn;
      loadMyChats();
    };
    document.getElementById('restrict-toggle').onchange = async (e) => {
      await updateDoc(doc(db, "conversations", currentChatId), { restricted: e.target.checked });
      showAlert("Updated", e.target.checked ? "Joining restricted." : "Joining open.");
    };
  }
};

window.makeAdmin = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { admins: arrayUnion(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };
window.removeAdmin = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { admins: arrayRemove(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };
window.removeMember = async (uid) => { if (confirm("Remove this member?")) { await updateDoc(doc(db, "conversations", currentChatId), { participants: arrayRemove(uid), admins: arrayRemove(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); } };
window.approveMember = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { pendingMembers: arrayRemove(uid), participants: arrayUnion(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };
window.rejectMember = async (uid) => { await updateDoc(doc(db, "conversations", currentChatId), { pendingMembers: arrayRemove(uid) }); document.querySelector('.modal-overlay').remove(); openGroupInfoModal(); };

window.openAddMemberModal = async () => {
  const snap = await getDoc(doc(db, "conversations", currentChatId));
  const data = snap.data();
  const isRestricted = data.restricted || false;
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
    const term = e.target.value.toLowerCase().trim();
    if (term.length < 2) return;
    const q = query(collection(db, "users"), where("username", ">=", term), where("username", "<=", term + '\uf8ff'));
    const s = await getDocs(q);
    const list = document.getElementById('add-member-list');
    list.innerHTML = '';
    s.forEach(d => {
      if (d.id === currentUser.uid || data.participants.includes(d.id) || (data.pendingMembers && data.pendingMembers.includes(d.id))) return;
      const u = d.data();
      const item = document.createElement('div');
      item.className = 'user-select-item';
      item.innerHTML = `<div class="avatar">${u.photoURL ? `<img src="${u.photoURL}">` : u.displayName[0]}</div><div style="flex:1">${u.displayName}</div><button class="btn-primary" style="width:auto;padding:4px 8px;margin:0" onclick="addMemberToGroup('${u.uid}', ${isRestricted})">Add</button>`;
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
      showAlert("Success", "Member added!");
    }
    document.querySelector('.modal-overlay').remove();
    openGroupInfoModal();
  } catch(e) { showAlert("Error", e.message); }
};

// ---------- AUTH STATE ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    renderSplash();
    const userData = await loadUserWithRetry(user.uid);
    if (!userData) {
      renderSplash('Could not load your profile…');
      setTimeout(async () => {
        await signOut(auth);
        renderAuth();
        showAlert('Login failed', 'Your profile could not be loaded. Please try again.');
      }, 1200);
      return;
    }
    currentUser = userData;
    startPresence();
    listenForBroadcasts();
    requestNotificationPermission();
    subscribeToStatuses();
    renderMain();
  } else {
    currentUser = null;
    currentConvData = null;
    pendingMessages = [];
    clearInterval(presenceInterval);
    if (unsubMessages) unsubMessages();
    if (unsubChats) unsubChats();
    if (unsubBroadcast) unsubBroadcast();
    if (unsubExplore) { unsubExplore(); unsubExplore = null; }
    if (unsubStatuses) { unsubStatuses(); unsubStatuses = null; }
    knownChatTimestamps.clear();
    activeStatusUsers.clear();
    renderAuth();
  }
});

// ---------- SW ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed:', err));
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; window.location.reload(); }
  });
}