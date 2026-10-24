// ══════════════════════════════════════════════════════════════════════════
//  Mofie — Advanced Build (Replies First · No Feed)
// ══════════════════════════════════════════════════════════════════════════
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updatePassword, deleteUser, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache,
  persistentMultipleTabManager, collection, doc, setDoc, getDoc, getDocs,
  query, where, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc,
  deleteDoc, arrayUnion, increment, arrayRemove, Timestamp, collectionGroup }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ══════════════════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════════════════
const CLOUD_NAME    = "rirfqxoz";
const UPLOAD_PRESET = "Ehdra_Preset";

const firebaseConfig = {
  apiKey: "AIzaSyBxfzb0kvBoTErQTkB_UH33-RTMpd0NjNs",
  authDomain: "mhail-fdb0f.firebaseapp.com",
  projectId: "mhail-fdb0f",
  storageBucket: "mhail-fdb0f.firebasestorage.app",
  messagingSenderId: "850385336150",
  appId: "1:850385336150:web:594aa53199a318209f08f7"
};

let currentAudioPlayer = null;

window.toggleAudio = (btn) => {
  const playerDiv = btn.closest(".custom-voice-player");
  const url = playerDiv.dataset.audioUrl;
  const progress = playerDiv.querySelector(".cvp-progress");
  const timeText = playerDiv.querySelector(".cvp-time");
  const playIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const pauseIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

  if (currentAudioPlayer && currentAudioPlayer.src !== url) {
    currentAudioPlayer.pause();
    document.querySelectorAll(".cvp-play-btn").forEach(b => b.innerHTML = playIcon);
  }

  if (!currentAudioPlayer || currentAudioPlayer.src !== url) {
    currentAudioPlayer = new Audio(url);
    currentAudioPlayer.ontimeupdate = () => {
      const pct = (currentAudioPlayer.currentTime / currentAudioPlayer.duration) * 100;
      progress.style.width = pct + "%";
      const mins = Math.floor(currentAudioPlayer.currentTime / 60);
      const secs = Math.floor(currentAudioPlayer.currentTime % 60);
      timeText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    currentAudioPlayer.onended = () => {
      btn.innerHTML = playIcon;
      progress.style.width = "0%";
      timeText.textContent = "0:00";
    };
  }

  if (currentAudioPlayer.paused) {
    currentAudioPlayer.play();
    btn.innerHTML = pauseIcon;
  } else {
    currentAudioPlayer.pause();
    btn.innerHTML = playIcon;
  }
};

window.seekAudio = (e, trackWrap) => {
  if (!currentAudioPlayer) return;
  const rect = trackWrap.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  currentAudioPlayer.currentTime = pct * currentAudioPlayer.duration;
};

// ══════════════════════════════════════════════════════════════════════════
//  FIREBASE INIT
// ══════════════════════════════════════════════════════════════════════════
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("[Mofie] Persistent cache failed, using default:", e.message);
  db = getFirestore(app);
}

function getOptimizedUrl(url) {
  if (!url) return url;
  if (url.includes("cloudinary.com")) {
    return url.replace("/upload/", "/upload/q_auto,f_auto,w_600/");
  }
  return url;
}
const appEl = document.getElementById("app");

// styleFix

const styleFix = document.createElement('style');
styleFix.textContent = `
  /* ═══ SCROLL BOTTOM BUTTON FIXES ═══ */
  #scroll-bottom-btn::after, #scroll-bottom-btn::before,
  #scroll-bottom-btn .unread-badge, #scroll-bottom-btn .badge {
    display: none !important;
    content: none !important;
  }
  
  #scroll-bottom-btn {
    width: 40px !important; height: 40px !important;
    background: var(--bg-main) !important; 
    border: 1px solid var(--border) !important;
    border-radius: 50% !important;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important; 
    opacity: 0.85;
    transition: all 0.2s ease; padding: 0 !important;
    display: flex; align-items: center; justify-content: center;
    right: 16px !important; bottom: 85px !important;
    z-index: 100;
  }
  #scroll-bottom-btn:hover, #scroll-bottom-btn:active { opacity: 1; transform: scale(1.05); }
  #scroll-bottom-btn svg { width: 24px !important; height: 24px !important; color: var(--text) !important; }

  /* ═══ WHATSAPP STYLE CHAT BUBBLES ═══ */
  .bubble {
    box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13) !important;
    border-radius: 8px !important;
    padding: 6px 7px 8px 9px !important;
    font-size: 15px !important;
    line-height: 20px !important;
    position: relative;
    max-width: 85% !important;
    word-wrap: break-word;
  }
  
  .msg-row.me .bubble {
    border-top-right-radius: 0px !important;
    background-color: var(--bubble-color) !important;
    background-image: none !important;
  }
  .msg-row.them .bubble {
    border-top-left-radius: 0px !important;
  }

  /* ═══ MESSAGE META (TIME & DOTS) ═══ */
  .msg-meta {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    float: right !important;
    margin: 4px 0 -3px 8px !important;
    font-size: 11px !important;
    letter-spacing: 0.3px;
    white-space: nowrap !important;
    gap: 4px;
    opacity: 0.85;
  }
  
  .msg-status-dot {
    width: 10px !important; 
    height: 10px !important;
    border-radius: 50% !important;
    display: inline-block !important;
    margin-bottom: 1px;
  }
  
  .msg-status-dot.read { background-color: #10b981 !important; }   
  .msg-status-dot.online { background-color: #f59e0b !important; } 
  .msg-status-dot.offline { background-color: #ef4444 !important; }

  /* ═══ LIGHT THEME COLORS ═══ */
  [data-theme="light"] .msg-row.them .bubble { background: #ffffff !important; color: #111b21 !important; }
  [data-theme="light"] .msg-row.me .bubble { color: #111b21 !important; }
  [data-theme="light"] .msg-row .msg-meta { color: #667781 !important; }

  /* ═══ DARK THEME COLORS ═══ */
  [data-theme="dark"] .msg-row.them .bubble { background: #202c33 !important; color: #e9edef !important; }
  [data-theme="dark"] .msg-row.me .bubble { color: #e9edef !important; }
  [data-theme="dark"] .msg-row .msg-meta { color: #8696a0 !important; }

  /* ═══ REPLY QUOTE BOX ═══ */
  .reply-quote {
    background: rgba(0, 0, 0, 0.06) !important;
    border-left: 4px solid #00a884 !important;
    border-radius: 4px !important;
    padding: 6px 8px !important;
    margin-bottom: 5px !important;
    display: flex; flex-direction: column; gap: 2px; max-width: 100%;
  }
  [data-theme="dark"] .reply-quote { background: rgba(255, 255, 255, 0.08) !important; }
  [data-theme="dark"] .msg-row.them .reply-quote { border-left-color: #53bdeb !important; }
  [data-theme="dark"] .msg-row.me .reply-quote { border-left-color: #fff !important; }
  .reply-quote .q-name { font-weight: 700 !important; font-size: 13px !important; color: #00a884 !important; }
  [data-theme="dark"] .msg-row.them .reply-quote .q-name { color: #53bdeb !important; }
  [data-theme="dark"] .msg-row.me .reply-quote .q-name { color: #fff !important; }
  .reply-quote .q-text { font-size: 13.5px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; opacity: 0.9 !important; }

  /* ═══ ULTRA COMPACT & CURVY CHAT HEADER ═══ */
  .chat-header {
    padding: 6px 12px !important;
    min-height: 50px !important; height: 50px !important;
    border-bottom-left-radius: 20px !important;
    border-bottom-right-radius: 20px !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05) !important;
    display: flex !important; align-items: center !important;
  }
  .chat-header #back-btn, .chat-header .header-actions .icon {
    width: 32px !important; height: 32px !important;
    border-radius: 50% !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    padding: 0 !important; margin: 0 4px !important;
    background: transparent !important; transition: background 0.2s !important;
  }
  .chat-header #back-btn:hover, .chat-header .header-actions .icon:hover { background: rgba(128, 128, 128, 0.1) !important; }
  .chat-header #back-btn svg, .chat-header .header-actions .icon svg { width: 20px !important; height: 20px !important; }
  .chat-header #header-profile-btn { width: 34px !important; height: 34px !important; border-radius: 50% !important; margin-right: 10px !important; border-width: 2px !important; }
  .chat-header #other-av { width: 34px !important; height: 34px !important; border-radius: 50% !important; font-size: 14px !important; }
  .chat-header #header-status-dot { width: 9px !important; height: 9px !important; bottom: 0px !important; right: 0px !important; border-width: 2px !important; }
  .chat-header .chat-name { font-size: 15px !important; font-weight: 600 !important; margin-bottom: 0px !important; line-height: 1.1 !important; }
  .chat-header .chat-status { font-size: 11px !important; margin-bottom: 2px !important; line-height: 1.1 !important; }
  .chat-header .timer-btn { font-size: 10px !important; padding: 2px 8px !important; border-radius: 20px !important; gap: 4px !important; margin-top: 1px !important; width: fit-content !important; display: inline-flex !important; align-items: center !important; }
  .chat-header .timer-btn svg { width: 12px !important; height: 12px !important; }


  /* ═══════════════════════════════════════════════════════ */
  /* ═══ FORCE COMPACT MODALS & FIX MENUS ═══ */
  /* ═══════════════════════════════════════════════════════ */

  /* 1. Make ALL Modals Small */
  .modal {
    max-width: 320px !important;
    width: 90% !important;
    padding: 20px 16px !important;
    border-radius: 24px !important;
  }
  
  .modal h3 {
    font-size: 18px !important;
    margin-bottom: 16px !important;
  }

  /* 2. Fix the Message Menu (Image 2) */
  .emoji-picker {
    display: flex !important;
    justify-content: space-between !important;
    background: var(--bg-main) !important;
    padding: 8px 12px !important;
    border-radius: 16px !important;
    margin-bottom: 16px !important;
  }
  .emoji-picker span {
    font-size: 24px !important;
    padding: 4px !important;
    cursor: pointer;
  }

  /* Force buttons to be clean and transparent, killing the blue glitch */
  .msg-menu-overlay .modal button {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 12px !important;
    padding: 12px 16px !important;
    font-size: 15px !important;
    font-weight: 500 !important;
    color: var(--text) !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
  }
  .msg-menu-overlay .modal button:active { background: rgba(128, 128, 128, 0.1) !important; }
  
  /* Fix the Cancel button specifically */
  .msg-menu-overlay .modal button[data-act="cancel"] {
    color: var(--text-muted) !important;
    border-top: 1px solid var(--border) !important;
    border-radius: 0 0 24px 24px !important;
    margin-top: 8px !important;
    padding-bottom: 16px !important;
  }
  
  /* Delete All Button */
  .msg-menu-overlay .modal button[data-act="delete-all"] {
    color: #ef4444 !important;
    font-weight: 600 !important;
  }
  
  /* Kill any weird pseudo-elements causing the blue glitch */
  .msg-menu-overlay .modal button::before,
  .msg-menu-overlay .modal button::after {
    display: none !important;
    content: none !important;
  }

  /* 3. Fix the Appearance Menu (Image 1) */
  .custom-theme-selector {
    display: flex !important;
    gap: 8px !important;
    justify-content: center !important;
    margin-bottom: 16px !important;
  }
  .custom-theme-selector button {
    flex: 1 !important;
    padding: 8px !important;
    font-size: 13px !important;
    border-radius: 10px !important;
  }

  .custom-color-palette {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 10px !important;
    justify-content: center !important;
    margin-bottom: 16px !important;
  }
  .color-swatch {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
    min-height: 32px !important;
    border-radius: 50% !important;
    cursor: pointer !important;
  }
  .color-swatch.active {
    box-shadow: 0 0 0 2px var(--bg-main), 0 0 0 4px var(--text) !important;
    transform: scale(1.05) !important;
  }

  /* Make the bottom buttons in Appearance menu smaller */
  #reset-theme-btn, .modal [data-act="close"] {
    padding: 10px !important;
    font-size: 14px !important;
    border-radius: 12px !important;
    margin-top: 8px !important;
  }
`;
document.head.appendChild(styleFix);

// ══════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════════════════
const MESSAGE_TTL_MS       = 24 * 60 * 60 * 1000;
const STATUS_TTL_MS        = 5  * 60 * 60 * 1000;
const MEDIA_LIMITS         = { image: 5e6, audio: 5e6, video: 3e6, document: 2e6 };
const USER_CACHE_TTL       = 5 * 60 * 1000;
const PRESENCE_INTERVAL_MS = 30000;
const TYPING_TIMEOUT_MS    = 3000;
const SWIPE_REPLY_PX       = 60;
const LONG_PRESS_MS        = 480;

// ══════════════════════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════════════════════
let currentUser       = null;
let currentView       = "chats";
let currentTab        = "friends";
let currentChatId     = null;
let currentOtherId    = null;
let currentConvData   = null;
let currentChatMeta   = null;
let currentMessages   = [];

let unsubMessages, unsubChats, unsubConvMeta, unsubBroadcast,
    unsubExplore, unsubStatuses, unsubUsers;

let latestChatsSnap   = null;
let presenceInterval  = null;
let mediaRecorder     = null, audioChunks = [], isRecording = false;
let replyToMsg        = null, isSending = false;
let knownChatTimestamps = new Map();
let activeStatusUsers = new Set();
let typingTimeout     = null, lastTypingUpdate = 0;
let userCache         = new Map();
let chatListRenderTimer = null;
let mediaViewerIndex  = 0;
let activeMessageContext = null;

// ══════════════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════════════
function toMillis(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  return 0;
}
function isUserOnline(ls) {
  return ls ? Date.now() - toMillis(ls) < 60000 : false;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function normalizePhone(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/[^\d+]/g, "");
  return s.length >= 8 ? s : null;
}
function formatDateLabel(ms) {
  const d = new Date(ms), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
  const same = (a, b) => a.getFullYear() === b.getFullYear() &&
                          a.getMonth() === b.getMonth() &&
                          a.getDate() === b.getDate();
  if (same(d, t)) return "Today";
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function safeError(msg) {
  console.error("[Mofie]", msg);
  if (document.getElementById("app")?.children.length === 0) {
    renderFatalError(msg);
  }
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ══════════════════════════════════════════════════════════════════════════
//  UI: TOAST
// ══════════════════════════════════════════════════════════════════════════
window.showToast = (msg, ms = 2500) => {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    stack.style.cssText =
      "position:fixed;bottom:96px;left:0;right:0;display:flex;flex-direction:column;" +
      "align-items:center;gap:8px;pointer-events:none;z-index:1200";
    document.body.appendChild(stack);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  t.style.pointerEvents = "auto";
  stack.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 350);
  }, ms);
};

// ══════════════════════════════════════════════════════════════════════════
//  UI: MODAL
// ══════════════════════════════════════════════════════════════════════════
function createModal(html, { dismissible = true, onClose = null } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(overlay);

  const modal = overlay.querySelector(".modal");
  const focusables = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (first) setTimeout(() => first.focus(), 60);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", handler);
    if (onClose) onClose();
  };

  const handler = (e) => {
    if (e.key === "Escape" && dismissible) close();
    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", handler);

  if (dismissible) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }
  return { overlay, modal, close };
}

window.showAlert = (title, message, isConfirm = false, onConfirm = null) => {
  const { overlay, modal, close } = createModal(`
    <h3>${escapeHtml(title)}</h3>
    <p style="font-size:14px;margin-bottom:20px;color:var(--text-muted);text-align:center">
      ${escapeHtml(message)}
    </p>
    <div style="display:flex;gap:10px">
      ${isConfirm ? `<button class="btn-secondary" data-act="cancel" style="flex:1;margin:0">Cancel</button>` : ""}
      <button class="btn-primary" data-act="ok" style="flex:1;margin:0">${isConfirm ? "Confirm" : "OK"}</button>
    </div>
  `);
  modal.querySelector('[data-act="ok"]').onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };
  modal.querySelector('[data-act="cancel"]')?.addEventListener("click", close);
};

// ══════════════════════════════════════════════════════════════════════════
//  ICONS
// ══════════════════════════════════════════════════════════════════════════
const ICONS = {
  back:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
  dots:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  attach:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`,
  mic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
  send:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
  group:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  forward:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>`,
  info:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  emoji:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>`,
  explore:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/></svg>`,
  status:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  search:`<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>`,
  pin:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>`,
  mute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
  download:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
  close:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  reply:`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>`,
  phonebook:`<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-7 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm6 14H7v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`,
  chatTab:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`,
  profileTab:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
};

// ══════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════
let audioContext = null, audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked && audioContext && audioContext.state === "running") return;
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    audioUnlocked = true;
  } catch (_) {}
}
["pointerdown", "keydown", "touchstart"].forEach(ev =>
  document.addEventListener(ev, unlockAudio, { passive: true }));

function playChime() {
  try {
    unlockAudio();
    if (!audioContext) return;
    if (audioContext.state === "suspended") audioContext.resume();
    const now = audioContext.currentTime;
    const tone = (freq, start, dur, vol = 0.18) => {
      const o = audioContext.createOscillator(), g = audioContext.createGain();
      o.connect(g); g.connect(audioContext.destination);
      o.type = "sine"; o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.start(start); o.stop(start + dur);
    };
    tone(880, now, 0.15);
    tone(1175, now + 0.08, 0.25);
  } catch (_) {}
}

function notifyForeground(senderName, text, chatId) {
  const win = document.getElementById("chat-window");
  const viewingThis = chatId === currentChatId &&
    currentView === "chats" &&
    win && win.classList.contains("active") &&
    document.visibilityState === "visible";
  if (viewingThis) return;
  playChime();
  if (document.visibilityState === "visible") {
    let banner = document.getElementById("mofie-in-app-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "mofie-in-app-banner";
      banner.className = "in-app-banner";
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <div class="banner-avatar">${(senderName || "M")[0].toUpperCase()}</div>
      <div class="banner-content">
        <div class="banner-title">${escapeHtml(senderName || "Mofie")}</div>
        <div class="banner-body">${escapeHtml(text || "New message")}</div>
      </div>`;
    banner.onclick = () => {
      banner.classList.remove("show");
      openChatById(chatId);
    };
    requestAnimationFrame(() => banner.classList.add("show"));
    clearTimeout(window._mofieBannerTO);
    window._mofieBannerTO = setTimeout(() => banner.classList.remove("show"), 4000);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  USER CACHE
// ══════════════════════════════════════════════════════════════════════════
async function getUserCached(uid) {
  if (!uid) return { displayName: "Unknown", username: "user" };
  const hit = userCache.get(uid);
  if (hit && Date.now() - hit.ts < USER_CACHE_TTL) return hit.data;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : { displayName: "Unknown" };
    userCache.set(uid, { data, ts: Date.now() });
    return data;
  } catch (e) {
    return (hit && hit.data) ? hit.data : { displayName: "Unknown" };
  }
}

function subscribeToUsers() {
  if (unsubUsers) unsubUsers();
  unsubUsers = onSnapshot(collection(db, "users"), snap => {
    snap.forEach(d => userCache.set(d.id, { data: d.data(), ts: Date.now() }));
    scheduleChatListRender();
  }, e => console.warn("users sub:", e.message));
}

// ══════════════════════════════════════════════════════════════════════════
//  PRESENCE & SWEEP
// ══════════════════════════════════════════════════════════════════════════
function startPresence() {
  if (!currentUser) return;
  const ref = doc(db, "users", currentUser.uid);
  const update = () => {
    if (document.visibilityState === "visible") {
      setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }
  };
  update();
  clearInterval(presenceInterval);
  presenceInterval = setInterval(update, PRESENCE_INTERVAL_MS);
  document.addEventListener("visibilitychange", update);
}

function startExpirySweep() {
  setInterval(async () => {
    const now = Timestamp.now();
    try {
      const st = await getDocs(query(collection(db, "statuses"), where("expireAt", "<=", now)));
      st.forEach(d => deleteDoc(d.ref).catch(() => {}));
    } catch (_) {}
    try {
      const ms = await getDocs(query(collectionGroup(db, "messages"), where("expireAt", "<=", now)));
      ms.forEach(d => deleteDoc(d.ref).catch(() => {}));
    } catch (_) {}
  }, 15 * 60 * 1000);
}

function subscribeToStatuses() {
  if (unsubStatuses) unsubStatuses();
  unsubStatuses = onSnapshot(collection(db, "statuses"), snap => {
    const now = Date.now();
    activeStatusUsers.clear();
    snap.forEach(d => {
      const s = d.data();
      const ex = toMillis(s.expireAt);
      if (ex && ex < now) { deleteDoc(d.ref).catch(() => {}); return; }
      activeStatusUsers.add(s.userId);
    });
    document.querySelectorAll("#chats-list .chat-item[data-uid]").forEach(el => {
      const wrap = el.querySelector(".avatar-wrap");
      const uid = el.dataset.uid;
      if (wrap && uid) wrap.classList.toggle("has-status", activeStatusUsers.has(uid));
    });
  }, e => console.warn("statuses sub:", e.message));
}

// ══════════════════════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════════════════════
function applyTheme() {
  const themeMode = localStorage.getItem("mofie-theme") || "dark";
  document.documentElement.setAttribute("data-theme", themeMode);

  const defaultAccent1 = "#00A884"; 
  const defaultAccent2 = "#25D366";
  
  // WhatsApp Default Bubble Colors
  const defaultBubbleColor = themeMode === "light" ? "#D9FDD3" : "#005C4B";
  
  const accent1 = localStorage.getItem("mofie-accent1") || defaultAccent1;
  const accent2 = localStorage.getItem("mofie-accent2") || defaultAccent2;
  
  document.documentElement.style.setProperty("--user-accent-1", accent1);
  document.documentElement.style.setProperty("--user-accent-2", accent2);
  
  const bubbleColor = localStorage.getItem("mofie-bubble-color") || defaultBubbleColor;
  document.documentElement.style.setProperty("--bubble-color", bubbleColor);
  
  document.body.style.backgroundColor = "var(--bg-main)";
}
applyTheme();

// ══════════════════════════════════════════════════════════════════════════
//  UPLOAD
// ══════════════════════════════════════════════════════════════════════════
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: fd });
  const data = await res.json();
  if (data.secure_url) return data.secure_url;
  throw new Error(data.error ? data.error.message : "Upload failed");
}

// ══════════════════════════════════════════════════════════════════════════
//  SPLASH & FATAL
// ══════════════════════════════════════════════════════════════════════════
function renderFatalError(msg) {
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card" style="text-align:center">
        <h2 style="color:#ef4444;margin-bottom:12px">⚠️ App Error</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">${escapeHtml(msg)}</p>
        <button class="btn-primary" onclick="location.reload()">Reload</button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════
//  AUTH SCREEN
// ══════════════════════════════════════════════════════════════════════════
function renderAuth() {
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="logo-container">
          <svg class="butterfly-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
          <h1 class="logo-text">Mofie</h1>
        </div>
        <div class="auth-tagline">Pure, Fast and convenient</div>
        <div class="tabs" role="tablist">
          <button id="tab-login" class="active" type="button" role="tab">Login</button>
          <button id="tab-reg" type="button" role="tab">Register</button>
        </div>
        <form class="form" id="auth-form" novalidate autocomplete="on">
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
          <div class="error" id="err" aria-live="polite"></div>
          <div class="auth-status" id="auth-status" aria-live="polite"></div>
        </form>
      </div>
    </div>`;

  const $ = id => document.getElementById(id);
  const emailInput = $("email"), userInput = $("username"), passInput = $("pass"),
        phoneInput = $("reg-phone"), form = $("auth-form"), errEl = $("err"),
        authStatus = $("auth-status"), usernameGroup = $("username-group"),
        phoneGroup = $("phone-group");
  let isLogin = true, isSubmitting = false, usernameTimer;

  const lastEmail = localStorage.getItem("mofie-last-email");
  if (lastEmail) emailInput.value = lastEmail;

  const isEmailValid = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isUsernameValid = v => /^[a-z0-9]{3,20}$/.test(v);

  const setField = (inp, msgEl, state, message = "") => {
    inp.classList.remove("valid", "invalid");
    if (state === "valid") inp.classList.add("valid");
    if (state === "invalid") inp.classList.add("invalid");
    if (msgEl) { msgEl.textContent = message; msgEl.className = "field-msg " + (state || ""); }
  };
  const showStatus = (msg, type = "info") => {
    authStatus.textContent = msg;
    authStatus.className = "auth-status show " + type;
  };

  emailInput.addEventListener("input", () => {
    const v = emailInput.value;
    if (!v) return setField(emailInput, $("email-msg"), null);
    setField(emailInput, $("email-msg"),
      isEmailValid(v) ? "valid" : "invalid",
      isEmailValid(v) ? "Looks good" : "Enter a valid email");
  });

  userInput.addEventListener("input", () => {
    const v = userInput.value.toLowerCase().trim();
    userInput.value = v;
    if (!v) return setField(userInput, $("username-msg"), null);
    if (!isUsernameValid(v)) return setField(userInput, $("username-msg"), "invalid", "3–20 chars: a-z, 0-9");
    clearTimeout(usernameTimer);
    setField(userInput, $("username-msg"), null, "Checking...");
    usernameTimer = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, "usernames", v));
        setField(userInput, $("username-msg"),
          snap.exists() ? "invalid" : "valid",
          snap.exists() ? "Already taken" : "Available");
      } catch (_) { setField(userInput, $("username-msg"), null, ""); }
    }, 350);
  });

  passInput.addEventListener("input", () => {
    const v = passInput.value;
    if (!v) return setField(passInput, $("pass-msg"), null);
    if (v.length < 6) setField(passInput, $("pass-msg"), "invalid", "At least 6 characters");
    else setField(passInput, $("pass-msg"), "valid", "");
  });

  const switchTab = (login) => {
    isLogin = login;
    $("tab-login").classList.toggle("active", login);
    $("tab-reg").classList.toggle("active", !login);
    usernameGroup.style.display = login ? "none" : "block";
    phoneGroup.style.display = login ? "none" : "block";
    $("submit-btn").querySelector(".btn-text").textContent = login ? "Login" : "Create Account";
    passInput.setAttribute("autocomplete", login ? "current-password" : "new-password");
    errEl.textContent = "";
    authStatus.className = "auth-status";
  };
  $("tab-login").onclick = () => switchTab(true);
  $("tab-reg").onclick = () => switchTab(false);

  $("forgot-pass-btn").onclick = async () => {
    const email = emailInput.value.trim();
    if (!isEmailValid(email)) { setField(emailInput, $("email-msg"), "invalid", "Enter your email first"); return; }
    try {
      showStatus("Sending reset email...", "info");
      await sendPasswordResetEmail(auth, email);
      showStatus("Reset email sent", "success");
    } catch (e) { showStatus(e.message.replace("Firebase: ", ""), "error"); }
  };

form.onsubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    errEl.textContent = "";
    const email = emailInput.value.trim();
    const username = userInput.value.toLowerCase().trim();
    const phone = phoneGroup.style.display !== "none" ? normalizePhone(phoneInput.value) : null;
    const pass = passInput.value;

    if (!isEmailValid(email)) { setField(emailInput, $("email-msg"), "invalid", "Enter a valid email"); return; }
    if (!isLogin && !isUsernameValid(username)) { setField(userInput, $("username-msg"), "invalid", "3–20 chars: a-z, 0-9"); return; }
    if (pass.length < 6) { setField(passInput, $("pass-msg"), "invalid", "At least 6 characters"); return; }

    isSubmitting = true;
    const btn = $("submit-btn");
    btn.disabled = true;
    btn.querySelector(".btn-text").textContent = "Please wait...";
    localStorage.setItem("mofie-last-email", email);

    try {
      if (isLogin) {
        showStatus("Signing in...", "info");
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        showStatus("Checking username...", "info");
        const us = await getDoc(doc(db, "usernames", username));
        if (us.exists()) {
          setField(userInput, $("username-msg"), "invalid", "Taken");
          throw new Error("Username already taken");
        }
        showStatus("Creating account...", "info");
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const profileData = {
          username, email, displayName: username, uid: cred.user.uid,
          lastSeen: serverTimestamp(), photoURL: null, blockedUsers: []
        };
        if (phone) profileData.phoneNumber = phone;
        await Promise.all([
          setDoc(doc(db, "usernames", username), { uid: cred.user.uid }),
          setDoc(doc(db, "users", cred.user.uid), profileData)
        ]);
        showStatus("Welcome!", "success");
      }
    } catch (error) {
      const msg = (error.message || "Something went wrong").replace("Firebase: ", "");
      errEl.textContent = msg;
      showStatus(msg, "error");
    } finally {
      isSubmitting = false;
      btn.disabled = false;
      btn.querySelector(".btn-text").textContent = isLogin ? "Login" : "Create Account";
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN APP SHELL (NO FEED)
// ══════════════════════════════════════════════════════════════════════════
function renderMain() {
  try {
    const name = escapeHtml(currentUser.displayName || "User");
    const uname = escapeHtml(currentUser.username || "user");
    const photo = currentUser.photoURL ? escapeHtml(currentUser.photoURL) : "";
    const initial = (currentUser.displayName || "U")[0].toUpperCase();

    appEl.innerHTML = `
      <div class="app-container">

        <!-- CHATS VIEW -->
        <div class="app-view active" id="view-chats">
          <aside class="sidebar" id="sidebar">
            <div class="header">
              <div style="display:flex;align-items:center;gap:8px">
                <svg class="butterfly-svg" style="width:26px;height:26px" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                <h1>Mofie</h1>
              </div>
              <div class="header-icons">
                <button class="icon" id="new-group-btn" title="New Group" aria-label="New Group">${ICONS.group}</button>
              </div>
            </div>
            <div class="search-row">
              <input id="search" placeholder="Search @username..." aria-label="Search users">
              <button class="icon" id="status-btn" aria-label="Status"
                style="width:40px;height:40px;border-radius:50%;background:var(--bg-main);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--user-accent-2)">${ICONS.status}</button>
            </div>
            <div class="tabs-row" role="tablist">
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
              <button id="back-btn" aria-label="Back">${ICONS.back}</button>
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
                <button class="icon" id="chat-search-btn" title="Search" aria-label="Search messages">${ICONS.search}</button>
                <button class="icon" id="group-info-btn" title="Group Info" style="display:none" aria-label="Group Info">${ICONS.info}</button>
                <button class="icon" id="chat-menu-btn" title="Menu" aria-label="Chat menu">${ICONS.dots}</button>
              </div>
            </div>
            
            <div class="chat-search-bar" id="chat-search-bar">
              <input id="chat-search-input" placeholder="Search messages..." aria-label="Search messages">
              <span class="cs-count" id="cs-count"></span>
              <button class="icon" id="close-chat-search" aria-label="Close search">${ICONS.close}</button>
            </div>
            
            <div class="messages" id="messages"></div>

            <div class="reply-banner" id="reply-banner" role="status" aria-live="polite">
              <div class="rb-icon">${ICONS.reply}</div>
              <div class="rb-content">
                <div class="rb-name" id="rb-name">Replying to</div>
                <div class="rb-text" id="rb-text"></div>
              </div>
              <button class="rb-close" onclick="cancelReply()" aria-label="Cancel reply">✕</button>
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

            <div class="composer">
              <button class="icon" id="attach-btn" aria-label="Attach">${ICONS.attach}</button>
              <button class="icon" id="emoji-btn" style="margin-right:4px" aria-label="Emoji">${ICONS.emoji}</button>
              <div class="input-wrap">
                <input id="msg-input" placeholder="Message" autocomplete="off" aria-label="Message">
              </div>
              <button class="send-btn" id="send-btn" data-mode="mic" aria-label="Send">${ICONS.mic}</button>
            </div>
          </main>
        </div>

        <!-- PROFILE VIEW -->
        <div class="app-view" id="view-profile">
          <div class="settings-header">
            <h2>Profile</h2>
            <button class="icon" onclick="openEditProfileModal()" aria-label="Edit profile">✎</button>
          </div>
          <div style="text-align:center;padding:30px 20px;border-bottom:1px solid var(--border)">
            <div class="avatar-wrap" style="width:100px;height:100px;margin:0 auto 15px;border-width:3px">
              <div class="avatar" style="font-size:40px">${photo ? `<img src="${photo}" alt="">` : initial}</div>
            </div>
            <h2 style="margin:0 0 4px 0">${name}</h2>
            <p style="color:var(--text-muted);margin:0 0 16px 0">@${uname}.mofie</p>
          </div>
          <div class="settings-list">
            <div class="settings-item" onclick="openThemeModal()">
              <div class="icon-wrap">🎨</div>
              <div class="info"><h4>Appearance</h4><p>Theme, Colors</p></div>
            </div>
            <div class="settings-item" onclick="openAccountModal()">
              <div class="icon-wrap">🔒</div>
              <div class="info"><h4>Account</h4><p>Security, Delete Account</p></div>
            </div>
            <div class="settings-item" onclick="openStarredMessages()">
              <div class="icon-wrap" style="color:#f59e0b">★</div>
              <div class="info"><h4>Starred Messages</h4><p>Messages you starred</p></div>
            </div>
            <div class="settings-item" onclick="promptPhoneNumber()">
              <div class="icon-wrap">📱</div>
              <div class="info"><h4>Phone Number</h4><p>${currentUser.phoneNumber ? escapeHtml(currentUser.phoneNumber) : "Not set"}</p></div>
            </div>
            <div class="settings-item" onclick="openPhonebookPicker()">
              <div class="icon-wrap">${ICONS.phonebook}</div>
              <div class="info"><h4>Sync Phonebook</h4><p>Find friends on Mofie</p></div>
            </div>
            ${currentUser.email === "hermanedaru@gmail.com"
              ? `<div class="settings-item" onclick="openAdminModal()" style="background:rgba(245,158,11,.08);border-color:#f59e0b">
                   <div class="icon-wrap" style="color:#f59e0b">📢</div>
                   <div class="info"><h4 style="color:#f59e0b">Admin Panel</h4><p>Send Global Broadcast</p></div>
                 </div>` : ""}
          </div>
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">
            <p>Developed by <b>Herman</b></p>
            <p>+256790311166 · hermanedaru@gmail.com</p>
          </div>
        </div>

        <!-- BOTTOM NAV -->
        <div class="bottom-nav">
          <button class="bottom-nav-btn active" id="nav-chats" onclick="switchView('chats')" aria-label="Chats">
            ${ICONS.chatTab}<span>Chats</span>
          </button>
          <button class="bottom-nav-btn" id="nav-profile" onclick="switchView('profile')" aria-label="Profile">
            ${ICONS.profileTab}<span>Profile</span>
          </button>
        </div>

        <!-- HIDDEN FILE INPUTS -->
        <input type="file" id="chat-upload-image" accept="image/*" style="display:none">
        <input type="file" id="chat-upload-audio" accept="audio/*" style="display:none">
        <input type="file" id="chat-upload-video" accept="video/*" style="display:none">
        <input type="file" id="chat-upload-doc" style="display:none">
        <input type="file" id="status-upload" accept="image/*,video/*" style="display:none">
        <input type="file" id="profile-upload" accept="image/*" style="display:none">
      </div>`;

    populatePanels();
    wireUpMain();
    loadMyChats();
    subscribeToUsers();
  } catch (e) {
    safeError("Failed to render app: " + e.message);
  }
}

function populatePanels() {
  const EMOJIS = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😋","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","😳","😱","😨","😰","🤗","🤔","🤭","😶","😐","😑","🙄","😯","😮","😲","😴","😪","😵","🤐","🤢","🤮","😷","🤒","💩","👻","💀","👽","🤖","🎃","👍","❤️","🔥","🎉"];
  const STICKERS = [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif"
  ];
  const eg = document.getElementById("emoji-grid");
  const sg = document.getElementById("sticker-grid");
  if (eg) eg.innerHTML = EMOJIS.map(e => `<span onclick="insertEmoji('${e}')">${e}</span>`).join("");
  if (sg) sg.innerHTML = STICKERS.map(s => `<img src="${s}" onclick="sendSticker('${s}')" alt="sticker" />`).join("");
}

function wireUpMain() {
  const $ = id => document.getElementById(id);

  $("new-group-btn").onclick = openNewGroupModal;
  $("back-btn").onclick = () => {
    $("chat-window").classList.remove("active");
    document.querySelector(".app-container").classList.remove("chat-open");
    cancelReply();
  };
  $("group-info-btn").onclick = openGroupInfoModal;
  $("chat-menu-btn").onclick = openChatMenu;
  $("chat-search-btn").onclick = openChatSearch;
  $("close-chat-search").onclick = () => {
    $("chat-search-bar").classList.remove("show");
    document.querySelectorAll(".msg-row.search-hit").forEach(n => n.classList.remove("search-hit"));
  };
  $("chat-search-input").addEventListener("input", e => searchInChat(e.target.value));
  $("send-btn").onclick = handleSendOrRecord;
  $("msg-input").oninput = handleInputTyping;
  $("attach-btn").onclick = openAttachMenu;
  $("emoji-btn").onclick = toggleEmojiPanel;
  $("status-btn").onclick = openStatusTab;
  $("header-profile-btn").onclick = () => {
    if (!currentChatId || !currentOtherId) return;
    const nm = $("other-name").textContent;
    const imgEl = $("other-av").querySelector("img");
    openFriendProfileModal(currentOtherId, nm, imgEl ? imgEl.src : "");
  };
  $("explore-btn").onclick = () => {
    if (currentTab === "explore") exitExplore();
    else activateExplore();
  };

  // Auto-scrolls chat to bottom when the input is focused (mobile keyboard opening)
  $("msg-input").addEventListener("focus", () => {
    setTimeout(() => {
      const m = document.getElementById("messages");
      if (m) m.scrollTop = m.scrollHeight;
    }, 300);
  });

  const searchDebounce = debounce((term) => {
    if (currentTab === "explore") loadExploreUsers();
    else if (term.length < 2) scheduleChatListRender();
    else handleSearch(term);
  }, 250);
  $("search").oninput = (e) => searchDebounce(e.target.value.trim());

  $("chat-upload-image").onchange = e => handleMediaUpload(e, "image");
  $("chat-upload-audio").onchange = e => handleMediaUpload(e, "audio");
  $("chat-upload-video").onchange = e => handleMediaUpload(e, "video");
  $("chat-upload-doc").onchange = e => handleMediaUpload(e, "document");
  $("status-upload").onchange = handleStatusUpload;

  $("msg-input").addEventListener("pointerdown", () => {
    $("emoji-panel")?.classList.remove("show");
  });

  $("msg-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ($("msg-input").value.trim()) sendAction();
    }
  });

  document.getElementById("nav-chats").onclick = () => window.switchView("chats");
  document.getElementById("nav-profile").onclick = () => window.switchView("profile");

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const fab = $("explore-btn");
      fab.classList.remove("active");
      fab.innerHTML = `${ICONS.explore} Explore`;
      currentTab = btn.dataset.tab;
      if (unsubExplore) { unsubExplore(); unsubExplore = null; }
      if (currentTab === "contacts") loadMyContacts();
      else scheduleChatListRender();
    };
  });

  document.addEventListener("click", e => {
    if (e.target.closest("#timer-btn")) window.openTimerModal();
    const p = document.getElementById("emoji-panel");
    if (!p || !p.classList.contains("show")) return;
    if (p.contains(e.target) || e.target.closest("#emoji-btn")) return;
    p.classList.remove("show");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.querySelector(".modal-overlay")) return; 
    if (replyToMsg) { cancelReply(); return; }
    const win = document.getElementById("chat-window");
    if (win && win.classList.contains("active")) win.classList.remove("active");
    document.querySelector(".app-container").classList.remove("chat-open");
  });
}

function scheduleChatListRender() {
  clearTimeout(chatListRenderTimer);
  chatListRenderTimer = setTimeout(() => {
    if (currentTab === "explore") loadExploreUsers();
    else if (currentTab === "contacts") loadMyContacts();
    else renderChatList();
  }, 80);
}

window.switchView = function (view) {
  const target = document.getElementById(`view-${view}`);
  const btn = document.getElementById(`nav-${view}`);
  if (!target || !btn) return;
  
  currentView = view;
  document.querySelectorAll(".app-view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".bottom-nav-btn").forEach(el => el.classList.remove("active"));
  target.classList.add("active");
  btn.classList.add("active");
  
  if (view !== "chats") {
    document.getElementById("chat-window")?.classList.remove("active");
    document.querySelector(".app-container")?.classList.remove("chat-open");
  } else {
    if (document.getElementById("chat-window")?.classList.contains("active")) {
      document.querySelector(".app-container")?.classList.add("chat-open");
    }
  }
};


let isInitialChatLoad = true;
function loadMyChats() {
  if (unsubChats) unsubChats();

  // Show Skeleton Loaders on first load
  const list = document.getElementById("chats-list");
  if (list && isInitialChatLoad) {
    list.innerHTML = Array(6).fill(0).map(() => `
      <div class="skeleton-item">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-text-wrap">
          <div class="skeleton-line-1"></div>
          <div class="skeleton-line-2"></div>
        </div>
      </div>
    `).join("");
  }

  const q = query(collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid));
    
  unsubChats = onSnapshot(q, snap => {
    latestChatsSnap = snap;
    
    if (isInitialChatLoad) {
      snap.forEach(d => knownChatTimestamps.set(d.id, toMillis(d.data().lastMessageTime)));
      isInitialChatLoad = false;
    } else {
      snap.docChanges().forEach(change => {
        const data = change.doc.data();
        const chatId = change.doc.id;
        const newTime = toMillis(data.lastMessageTime);
        const oldTime = knownChatTimestamps.get(chatId) || 0;
        
        if (newTime > oldTime && data.lastMessageSenderId !== currentUser.uid) {
          notifyForeground(data.senderName || "Mofie", data.lastMessage || "New message", chatId);
        }
        knownChatTimestamps.set(chatId, newTime);
      });
    }
    scheduleChatListRender();
  }, e => console.warn("chats sub:", e.message));
}

async function renderChatList() {
  const list = document.getElementById("chats-list");
  if (!list) return;
  if (currentTab === "contacts" || currentTab === "explore") return;
  const snap = latestChatsSnap;
  if (!snap || snap.empty) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <h3>No chats yet</h3>
        <p>Search for a username above, or tap <b>Explore</b> to find people.</p>
      </div>`;
    return;
  }

  const sorted = snap.docs.slice().sort((a, b) => {
    const da = a.data(), db_ = b.data();
    const pa = (da.pinnedBy || []).includes(currentUser.uid) ? 1 : 0;
    const pb = (db_.pinnedBy || []).includes(currentUser.uid) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return toMillis(db_.lastMessageTime) - toMillis(da.lastMessageTime);
  });

 const unique = new Map();
  for (const d of sorted) {
    const data = d.data();
    if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue;
    const key = data.isGroup ? d.id : (data.participants || []).find(id => id !== currentUser.uid);
    if (!key) continue;
    if (!unique.has(key)) unique.set(key, { id: d.id, data, isGroup: data.isGroup });
  }

  const visible = [];
  for (const v of unique.values()) {
    if (currentTab === "groups" && !v.isGroup) continue;
    if (currentTab === "unread" && (!v.data.unreadCounts || !v.data.unreadCounts[currentUser.uid])) continue;
    visible.push(v);
  }
  if (!visible.length) {
    const icon = currentTab === "groups" ? "👥" : currentTab === "unread" ? "✓" : "💬";
    const title = currentTab === "groups" ? "No groups yet" :
                  currentTab === "unread" ? "You're all caught up" : "No chats";
    const body = currentTab === "groups" ? "Create a group from the icon above." :
                 currentTab === "unread" ? "No unread messages." :
                 "Start a conversation to see it here.";
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${body}</p>
      </div>`;
    return;
  }

  let html = "";
  for (const v of visible) {
    let displayName, photoURL, otherUid = "", online = false;
    if (v.isGroup) {
      displayName = v.data.groupName || "Group";
      photoURL = v.data.groupPhotoURL;
    } else {
      otherUid = v.data.participants.find(id => id !== currentUser.uid);
      const u = (await getUserCached(otherUid)) || {};
      displayName = u.displayName || "Unknown";
      photoURL = u.photoURL;
      online = isUserOnline(u.lastSeen);
    }
    const unread = (v.data.unreadCounts && v.data.unreadCounts[currentUser.uid]) || 0;
    const badge = unread > 0 ? `<div class="unread-badge">${unread}</div>` : "";
    const isPinned = (v.data.pinnedBy || []).includes(currentUser.uid);
    const isMuted = !!(v.data.mutedBy && v.data.mutedBy[currentUser.uid]);
    const pinIcon = isPinned ? `<span class="chat-top-icons">${ICONS.pin}</span>` : "";
    const muteIcon = isMuted ? `<span class="chat-top-icons">${ICONS.mute}</span>` : "";
    const hasStatus = !v.isGroup && activeStatusUsers.has(otherUid);
    const pEsc = photoURL ? escapeHtml(photoURL) : "";

    html += `<li class="chat-item ${isPinned ? "pinned" : ""}"
              data-uid="${escapeHtml(otherUid)}"
              data-chatid="${v.id}"
              data-name="${escapeHtml(displayName)}"
              data-photo="${pEsc}"
              data-isgroup="${!!v.isGroup}">
      <div class="avatar-wrap ${hasStatus ? "has-status" : ""}">
        <div class="avatar">${photoURL
          ? `<img loading="lazy" src="${pEsc}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml(displayName[0] || "?")}</div>
        ${v.isGroup ? "" : `<div class="status-dot ${online ? "online" : "offline"}"></div>`}
      </div>
      <div class="chat-info">
        <div class="chat-top">
          <span class="chat-name">${escapeHtml(displayName)}</span>${pinIcon}${muteIcon}${badge}
        </div>
        <div class="chat-bottom">
          <span class="chat-preview">${escapeHtml(v.data.lastMessage || "")}</span>
        </div>
      </div>
    </li>`;
  }
  list.innerHTML = html;
  list.querySelectorAll(".chat-item").forEach(el => {
    el.onclick = () => openChat(
      el.dataset.chatid, el.dataset.uid, el.dataset.name,
      el.dataset.photo, el.dataset.isgroup === "true");
  });
}

async function openChat(chatId, otherId, name, photoURL, isGroup) {
  if (currentView !== "chats") switchView("chats");
  currentChatId = chatId;
  currentOtherId = otherId;
  currentChatMeta = { isGroup, name, otherId };
  currentMessages = [];
  cancelReply();

  const win = document.getElementById("chat-window");
  win.classList.add("active");
  document.querySelector(".app-container").classList.add("chat-open"); 
  document.getElementById("other-name").textContent = name || "";
  document.getElementById("other-av").innerHTML = photoURL
    ? `<img src="${escapeHtml(photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="">`
    : escapeHtml((name || "?")[0]);
  document.getElementById("emoji-panel").classList.remove("show");
  document.getElementById("chat-search-bar").classList.remove("show");

  const inp = document.getElementById("msg-input");
  if (inp) { inp.value = ""; inp.placeholder = "Message"; inp.disabled = false; }
  const sb = document.getElementById("send-btn");
  if (sb) { sb.innerHTML = ICONS.mic; sb.dataset.mode = "mic"; sb.classList.remove("recording"); }

  const msgsEl = document.getElementById("messages");
  msgsEl.innerHTML = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';

  if (unsubMessages) unsubMessages();
  if (unsubConvMeta) unsubConvMeta();

  try {
    const snap = await getDoc(doc(db, "conversations", chatId));
    currentConvData = snap.exists() ? snap.data() : {};
  } catch (e) { currentConvData = {}; }
  updateTimerUI(currentConvData.timer || 0);
  document.getElementById("group-info-btn").style.display = isGroup ? "block" : "none";

  unsubConvMeta = onSnapshot(doc(db, "conversations", chatId), async (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    currentConvData = data;
    updateTimerUI(data.timer || 0);
    const statusEl = document.getElementById("other-status");
    if (!isGroup && data.typing && data.typing[otherId] && (Date.now() - data.typing[otherId]) < 5000) {
      statusEl.textContent = "typing…";
      statusEl.classList.add("typing-active");
    } else {
      statusEl.classList.remove("typing-active");
      if (isGroup) {
        statusEl.textContent = `${data.participants.length} members`;
      } else {
        const u = await getUserCached(otherId);
        const online = isUserOnline(u.lastSeen);
        statusEl.textContent = online ? "online" : "offline";
        const dot = document.getElementById("header-status-dot");
        if (dot) dot.className = `status-dot ${online ? "online" : "offline"}`;
      }
    }
  }, e => console.warn("convMeta sub:", e.message));

  updateDoc(doc(db, "conversations", chatId), {
    [`readAt.${currentUser.uid}`]: serverTimestamp(),
    [`unreadCounts.${currentUser.uid}`]: 0
  }).catch(() => {});

  const q = query(collection(db, "conversations", chatId, "messages"));
  let initialLoad = true;
  unsubMessages = onSnapshot(q, async (snap) => {
    const convData = currentConvData || {};
    
    // If chat is empty but preview exists, clear it
    if (snap.empty && convData.lastMessage && convData.lastMessage !== "New Chat") {
      updateDoc(doc(db, "conversations", chatId), {
        lastMessage: "New Chat",
        [`unreadCounts.${currentUser.uid}`]: 0
      }).catch(() => {});
      msgsEl.innerHTML = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';
      return;
    }

    // Sort messages locally by time
    const sortedDocs = snap.docs.slice().sort((a, b) => {
      const timeA = toMillis(a.data().createdAt) || a.data().clientTs || 0;
      const timeB = toMillis(b.data().createdAt) || b.data().clientTs || 0;
      return timeA - timeB;
    });

    if (initialLoad) {
      renderFullMessages(sortedDocs, convData, chatId, otherId, isGroup);
      initialLoad = false;
      attachScrollListener();
      
      // Scroll to bottom on initial load
      const scrollToBottom = () => {
        if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
      };
      requestAnimationFrame(() => {
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 200);
      });
    } else {
      // Handle incoming messages without ruining scroll position
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const m = change.doc.data();
          const isMe = m.senderId === currentUser.uid;
          
          // Check if user is near the bottom (within 150px)
          const nearBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 150;
          
          if (!isMe) notifyForeground(m.senderName || name, m.text || "New message", chatId);
          
          appendMessageRow(change.doc, convData, chatId, otherId, isGroup);
          
          // Auto-scroll ONLY if it's my message OR if I'm already at the bottom
          if (isMe || nearBottom) {
            msgsEl.scrollTop = msgsEl.scrollHeight;
            // Explicitly hide the arrow when we force scroll
            const btn = document.getElementById("scroll-bottom-btn");
            if (btn) btn.classList.remove("show");
          } else {
            // Show the floating button
            const btn = document.getElementById("scroll-bottom-btn");
            if (btn) btn.classList.add("show");
          }
        } else if (change.type === "modified") {
          updateMessageRow(change.doc, convData, chatId, otherId, isGroup);
        } else if (change.type === "removed") {
          const el = document.querySelector(`.msg-row[data-msg-id="${change.doc.id}"]`);
          if (el) el.remove();
        }
      });
    }
    
    updateDoc(doc(db, "conversations", chatId), {
      [`readAt.${currentUser.uid}`]: serverTimestamp(),
      [`unreadCounts.${currentUser.uid}`]: 0
    }).catch(() => {});
  }, e => {
    console.warn("messages sub:", e.message);
    showToast("Error loading messages: " + e.message);
  });

  setTimeout(() => document.getElementById("msg-input")?.focus(), 450);
}

window.openChatById = async function (chatId) {
  try {
    const snap = await getDoc(doc(db, "conversations", chatId));
    if (!snap.exists()) return;
    const d = snap.data();
    if (!d.participants.includes(currentUser.uid)) return;
    switchView("chats");
    if (d.isGroup) {
      openChat(chatId, null, d.groupName, d.groupPhotoURL, true);
    } else {
      const otherId = d.participants.find(id => id !== currentUser.uid);
      const u = await getUserCached(otherId);
      openChat(chatId, otherId, u.displayName, u.photoURL, false);
    }
  } catch (e) { console.warn(e); }
};

function renderFullMessages(docs, convData, chatId, otherId, isGroup) {
  const msgsEl = document.getElementById("messages");
  if (!msgsEl) return;
  currentMessages = [];
  let html = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';
  let lastDateKey = "";
  docs.forEach(d => {
    const m = d.data();
    m._id = d.id;
    
    if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return;
    
    currentMessages.push(m);

    const ms = toMillis(m.createdAt) || Date.now();
    const dateKey = new Date(ms).toDateString();
    if (dateKey !== lastDateKey) {
      html += `<div class="date-sep"><span>${formatDateLabel(ms)}</span></div>`;
      lastDateKey = dateKey;
    }
    html += buildMessageRowHTML(m, d.id, convData, otherId, isGroup);
  });
  msgsEl.innerHTML = html;
  bindMessageEvents();
}

function appendMessageRow(docSnap, convData, chatId, otherId, isGroup) {
  const msgsEl = document.getElementById("messages");
  if (!msgsEl) return;
  const m = docSnap.data();
  m._id = docSnap.id;
  if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return;
  currentMessages.push(m);

  const ms = toMillis(m.createdAt) || Date.now();
  const seps = msgsEl.querySelectorAll(".date-sep");
  const lastSep = seps[seps.length - 1];
  const lastLabel = lastSep ? lastSep.textContent.trim() : "";
  if (formatDateLabel(ms) !== lastLabel) {
    const sep = document.createElement("div");
    sep.className = "date-sep";
    sep.innerHTML = `<span>${formatDateLabel(ms)}</span>`;
    msgsEl.appendChild(sep);
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = buildMessageRowHTML(m, docSnap.id, convData, otherId, isGroup);
  const row = wrap.firstElementChild;
  msgsEl.appendChild(row);
  bindBubbleEvents(row, m, docSnap.id, chatId, otherId, isGroup);
}

function updateMessageRow(docSnap, convData, chatId, otherId, isGroup) {
  const m = docSnap.data();
  m._id = docSnap.id;
  const el = document.querySelector(`.msg-row[data-msg-id="${docSnap.id}"]`);
  if (!el) return;
  if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) { el.remove(); return; }
  const wrap = document.createElement("div");
  wrap.innerHTML = buildMessageRowHTML(m, docSnap.id, convData, otherId, isGroup);
  const newRow = wrap.firstElementChild;
  el.replaceWith(newRow);
  bindBubbleEvents(newRow, m, docSnap.id, chatId, otherId, isGroup);
}

function buildReplyQuoteHTML(m) {
  if (!m.replyToId) return "";
  const quoteText = m.replyToText || "Media";
  const quoteSender = m.replyToSender || "User";
  return `<div class="reply-quote" role="button" tabindex="0"
    onclick="event.stopPropagation();scrollToMessage('${m.replyToId}')"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();scrollToMessage('${m.replyToId}')}">
    <div class="q-name">↩ ${escapeHtml(quoteSender)}</div>
    <div class="q-text">${escapeHtml(quoteText)}</div>
  </div>`;
}

function buildMessageRowHTML(m, docId, convData, otherId, isGroup) {
  const isMe = m.senderId === currentUser.uid;
  const ms = toMillis(m.createdAt) || Date.now();
  const timeStr = new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let statusDotHTML = "";
  if (isMe) {
    const readTime = convData.readAt && convData.readAt[otherId] ? toMillis(convData.readAt[otherId]) : 0;
    const isRead = (ms <= readTime && !isGroup);
    
    if (isRead) {
      statusDotHTML = `<span class="msg-status-dot read" title="Read"></span>`;
    } else {
      const otherUser = otherId ? userCache.get(otherId)?.data : null;
      const isOnline = isUserOnline(otherUser?.lastSeen);
      
      if (isOnline) {
        statusDotHTML = `<span class="msg-status-dot online" title="Delivered, User Online"></span>`;
      } else {
        statusDotHTML = `<span class="msg-status-dot offline" title="Delivered, User Offline"></span>`;
      }
    }
  }

  let statusReplyHTML = "";
  if (m.statusReply) {
    statusReplyHTML = `
      <div class="status-reply-preview" onclick="event.stopPropagation();window.viewUserStatus('${m.statusReply.userId || m.senderId}', false)">
        ${m.statusReply.mediaType === 'video'
          ? `<video src="${escapeHtml(m.statusReply.mediaUrl)}" muted preload="metadata"></video>`
          : `<img src="${escapeHtml(m.statusReply.mediaUrl)}" alt="status">`}
        <span class="sr-text">Replied to status</span>
      </div>`;
  }
  
  let contentHTML;
  switch (m.type) {
    case "image":
      contentHTML = `<img loading="lazy" src="${escapeHtml(m.mediaUrl)}" alt="photo"
        style="max-width:100%;border-radius:10px;cursor:zoom-in"
        onclick="event.stopPropagation();openMediaViewer('image','${docId}')">`;
      break;
    case "video":
      contentHTML = `<video controls src="${escapeHtml(m.mediaUrl)}" playsinline preload="metadata"
        style="max-width:100%;border-radius:10px;max-height:320px"
        onclick="event.stopPropagation();openMediaViewer('video','${docId}')"></video>`;
      break;
    case "audio":
      contentHTML = `<div class="custom-voice-player" data-audio-url="${escapeHtml(m.mediaUrl)}">
        <button class="cvp-play-btn" onclick="window.toggleAudio(this)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div class="cvp-track-wrap" onclick="window.seekAudio(event, this)">
          <div class="cvp-progress"></div>
        </div>
        <span class="cvp-time">0:00</span>
      </div>`;
      break;
    case "document":
      contentHTML = `<a href="${escapeHtml(m.mediaUrl)}" target="_blank" rel="noopener" class="doc-msg">📄 ${escapeHtml(m.fileName || "Document")}</a>`;
      break;
    case "contact":
      contentHTML = `<div class="contact-card">
        <div class="avatar-wrap"><div class="avatar">${m.contactPhoto
          ? `<img src="${escapeHtml(m.contactPhoto)}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml((m.contactName || "?")[0])}</div></div>
        <div class="cc-info">
          <div class="cc-name">${escapeHtml(m.contactName || "Contact")}</div>
          <div class="cc-sub">@${escapeHtml(m.contactUsername || "user")}.mofie</div>
        </div>
        <button class="cc-btn" data-contact-uid="${escapeHtml(m.contactUid || "")}"
          data-contact-name="${escapeHtml(m.contactName || "")}"
          data-contact-photo="${escapeHtml(m.contactPhoto || "")}">Message</button>
      </div>`;
      break;
    case "sticker":
      contentHTML = `<img src="${escapeHtml(m.mediaUrl)}" class="sticker-img" alt="sticker">`;
      break;
    default:
      contentHTML = statusReplyHTML + escapeHtml(m.text || "");
  }

  const bubbleClass = m.type === "sticker" ? "bubble sticker-bubble" : "bubble";
  const replyHTML = buildReplyQuoteHTML(m);
  const senderHTML = (!isMe && isGroup) ? `<div class="sender-name">${escapeHtml(m.senderName || "")}</div>` : "";
  const starHTML = (m.starredBy || []).includes(currentUser.uid) ? `<span class="msg-star-indicator">★</span>` : "";

  let reactionsHTML = "";
  if (m.reactions && Object.keys(m.reactions).length) {
    const counts = {};
    Object.values(m.reactions).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    reactionsHTML = '<div class="reactions-container">';
    Object.keys(counts).forEach(e => {
      const active = m.reactions[currentUser.uid] === e;
      reactionsHTML += `<div class="reaction-pill ${active ? "active" : ""}"
        onclick="event.stopPropagation();toggleReaction('${currentChatId}','${docId}','${e}')">${e} ${counts[e]}</div>`;
    });
    reactionsHTML += "</div>";
  }

  // THIS IS THE PART THAT WAS DUPLICATING - IT IS NOW CLEAN
  return `<div class="msg-row ${isMe ? "me" : "them"}" data-msg-id="${docId}">
    <div class="${bubbleClass}">
      <span class="swipe-reply-icon" aria-hidden="true">${ICONS.reply}</span>
      ${senderHTML}${replyHTML}${starHTML}${contentHTML}
      <div class="msg-meta">${m.edited ? '<span style="font-size:10px; opacity:0.7; margin-right:4px">(edited)</span>' : ''}${timeStr}${statusDotHTML}</div>
    </div>${reactionsHTML}
  </div>`;
}

function bindMessageEvents() {
  document.querySelectorAll("#messages .msg-row").forEach(row => {
    const docId = row.dataset.msgId;
    const m = currentMessages.find(x => x._id === docId);
    if (!m) return;
    bindBubbleEvents(row, m, docId, currentChatId, currentOtherId, currentChatMeta?.isGroup);
  });
}

function bindBubbleEvents(row, m, docId, chatId, otherId, isGroup) {
  const bubble = row.querySelector(".bubble");
  if (!bubble) return;
  const isMe = m.senderId === currentUser.uid;
  const senderName = isMe ? currentUser.displayName : (m.senderName || "User");

  const contactBtn = bubble.querySelector("[data-contact-uid]");
  if (contactBtn) {
    contactBtn.onclick = (ev) => {
      ev.stopPropagation();
      window.startDM(contactBtn.dataset.contactUid,
        contactBtn.dataset.contactName, contactBtn.dataset.contactPhoto);
    };
  }

  let startX = 0, startY = 0, tracking = false;
  bubble.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  bubble.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) { tracking = false; bubble.style.transform = ""; return; }
    if (dx > 10) {
      const capped = Math.min(dx, 80);
      bubble.style.transform = `translateX(${capped}px)`;
      const icon = bubble.querySelector(".swipe-reply-icon");
      if (icon) icon.style.opacity = String(capped / 80);
    }
  }, { passive: true });

  bubble.addEventListener("touchend", () => {
    if (!tracking) return;
    tracking = false;
    const match = (bubble.style.transform || "").match(/translateX\((\d+)px\)/);
    const dx = match ? parseInt(match[1], 10) : 0;
    bubble.style.transform = "";
    const icon = bubble.querySelector(".swipe-reply-icon");
    if (icon) icon.style.opacity = "0";
    if (dx >= SWIPE_REPLY_PX) {
      setReply({ id: docId, text: m.text, type: m.type, mediaUrl: m.mediaUrl }, senderName, isMe);
      try { navigator.vibrate?.(25); } catch (_) {}
    }
  }, { passive: true });

  let pressTimer;
  const openMenu = () => showMessageMenu(chatId, docId, isMe, m, senderName);
  bubble.addEventListener("mousedown", () => { pressTimer = setTimeout(openMenu, LONG_PRESS_MS); });
  bubble.addEventListener("mouseup", () => clearTimeout(pressTimer));
  bubble.addEventListener("mouseleave", () => clearTimeout(pressTimer));
  bubble.addEventListener("touchstart", () => { pressTimer = setTimeout(openMenu, LONG_PRESS_MS); }, { passive: true });
  bubble.addEventListener("touchend", () => clearTimeout(pressTimer));
  bubble.addEventListener("touchmove", () => clearTimeout(pressTimer), { passive: true });

  bubble.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showMessageMenu(chatId, docId, isMe, m, senderName);
  });
}

window.cancelReply = () => {
  replyToMsg = null;
  document.getElementById("reply-banner")?.classList.remove("show");
  document.querySelector(".composer")?.classList.remove("replying");
  const inp = document.getElementById("msg-input");
  if (inp && !inp.value.trim()) {
    const btn = document.getElementById("send-btn");
    if (btn) { btn.innerHTML = ICONS.mic; btn.dataset.mode = "mic"; }
  }
};

function setReply(msg, senderName, senderIsMe = false) {
  const preview = msg.text ||
    (msg.type === "image" ? "📷 Photo"
     : msg.type === "video" ? "🎬 Video"
     : msg.type === "audio" ? "🎙️ Voice note"
     : msg.type === "sticker" ? "🖼️ Sticker"
     : msg.type === "document" ? "📄 Document"
     : msg.type === "contact" ? "👤 Contact" : "Message");

  replyToMsg = {
    id: msg.id,
    text: preview,
    senderName: senderIsMe ? "You" : (senderName || "User")
  };

  const banner = document.getElementById("reply-banner");
  if (banner) {
    const nameEl = document.getElementById("rb-name");
    const textEl = document.getElementById("rb-text");
    if (nameEl) nameEl.textContent = `Replying to ${replyToMsg.senderName}`;
    if (textEl) textEl.textContent = replyToMsg.text;
    banner.classList.add("show");
  }
  document.querySelector(".composer")?.classList.add("replying");
  const inp = document.getElementById("msg-input");
  inp?.focus();

  if (inp && inp.value.trim()) {
    const btn = document.getElementById("send-btn");
    if (btn) { btn.innerHTML = ICONS.send; btn.dataset.mode = "send"; }
  }
}

window.scrollToMessage = (msgId) => {
  const el = document.querySelector(`.msg-row[data-msg-id="${msgId}"]`);
  if (!el) {
    showToast("Original message not available (may have expired)");
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("message-flash");
  setTimeout(() => el.classList.remove("message-flash"), 1500);
};

function showMessageMenu(chatId, msgId, isMe, msgData, senderName) {
  if (document.querySelector(".msg-menu-overlay")) return;
  
  const emojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
  const starred = (msgData.starredBy || []).includes(currentUser.uid);
  
  // Check if message is under 1 hour old for deleting/editing
  const msgTime = toMillis(msgData.createdAt) || Date.now();
  const canEdit = isMe && msgData.type === "text" && (Date.now() - msgTime < 3600000);
  const canDeleteAll = isMe && (Date.now() - msgTime < 3600000);

  const { overlay, modal, close } = createModal(`
    <div class="emoji-picker">
      ${emojis.map(e => `<span data-emoji="${e}">${e}</span>`).join("")}
    </div>
    <div class="menu-actions-list">
      <button class="menu-action-btn" data-act="star">${starred ? "★ Unstar" : "★ Star"}</button>
      ${msgData.type === "text" ? `<button class="menu-action-btn" data-act="copy">Copy text</button>` : ""}
      <button class="menu-action-btn" data-act="forward">Forward</button>
      ${canEdit ? `<button class="menu-action-btn" data-act="edit">Edit Message</button>` : ""}
      <button class="menu-action-btn" data-act="delete-me">Delete for me</button>
      ${canDeleteAll ? `<button class="menu-action-btn text-danger" data-act="delete-all">Delete for everyone</button>` : ""}
      <button class="menu-action-btn text-muted" data-act="cancel">Cancel</button>
    </div>
  `);
  overlay.classList.add("msg-menu-overlay");

  modal.querySelectorAll("[data-emoji]").forEach(el => {
    el.onclick = () => { close(); window.toggleReaction(chatId, msgId, el.dataset.emoji); };
  });
  
  modal.querySelector('[data-act="star"]').onclick = async () => {
    close(); await window.toggleStarMessage(chatId, msgId);
  };

  if (modal.querySelector('[data-act="copy"]')) {
    modal.querySelector('[data-act="copy"]').onclick = () => {
      close();
      navigator.clipboard.writeText(msgData.text).then(() => showToast("Copied"), () => showToast("Could not copy"));
    };
  }

  modal.querySelector('[data-act="forward"]').onclick = () => {
    close(); window.openForwardModal({ ...msgData, _id: msgId });
  };
  
  if (canEdit) {
    modal.querySelector('[data-act="edit"]').onclick = () => {
      close();
      
      window.openEditMessageModal(chatId, msgId, msgData.text);
    };
  }

  modal.querySelector('[data-act="delete-me"]').onclick = async () => {
    close(); await window.deleteMessage(chatId, msgId, false);
  };
  
  if (canDeleteAll) {
    modal.querySelector('[data-act="delete-all"]').onclick = async () => {
      close(); await window.deleteMessage(chatId, msgId, true);
    };
  }
  
  modal.querySelector('[data-act="cancel"]').onclick = close;
}

// Add this new function right below showMessageMenu

window.openEditMessageModal = (chatId, msgId, oldText) => {
  const { modal, close } = createModal(`
    <h3>Edit Message</h3>
    <input id="edit-msg-input" value="${escapeHtml(oldText)}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); background:var(--bg-main); color:var(--text); margin-bottom:15px;">
    <button class="btn-primary" data-act="save">Save Changes</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  const input = modal.querySelector("#edit-msg-input");
  input.focus();

  modal.querySelector('[data-act="cancel"]').onclick = close;
  
  modal.querySelector('[data-act="save"]').onclick = () => {
    const newText = input.value.trim();
    if (!newText || newText === oldText) return close();
    
    // 1. Close modal and show toast immediately
    close();
    showToast("Message edited");
    
    // 2. Update the database in the background
    updateDoc(doc(db, "conversations", chatId, "messages", msgId), {
      text: newText,
      edited: true
    }).catch((e) => {
      showAlert("Error", "Could not save edit. Check your connection.");
    });
  };
};

function handleInputTyping(e) {
  const btn = document.getElementById("send-btn");
  if (!btn || btn.dataset.mode === "recording") return;
  const hasText = !!e.target.value.trim();
  if (hasText && btn.dataset.mode !== "send") { btn.innerHTML = ICONS.send; btn.dataset.mode = "send"; }
  else if (!hasText && btn.dataset.mode !== "mic") { btn.innerHTML = ICONS.mic; btn.dataset.mode = "mic"; }

  if (!currentChatId || !e.target.value.trim()) return;
  const now = Date.now();
  if (now - lastTypingUpdate > 2000) {
    lastTypingUpdate = now;
    updateDoc(doc(db, "conversations", currentChatId), { [`typing.${currentUser.uid}`]: now }).catch(() => {});
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    updateDoc(doc(db, "conversations", currentChatId), { [`typing.${currentUser.uid}`]: null }).catch(() => {});
    lastTypingUpdate = 0;
  }, TYPING_TIMEOUT_MS);
}

function handleSendOrRecord(e) {
  if (e) e.preventDefault();
  const inp = document.getElementById("msg-input");
  if (inp.value.trim()) sendAction();
  else toggleRecording();
}

async function sendAction() {
  if (isSending) return;
  const inp = document.getElementById("msg-input");
  const text = inp.value.trim();
  if (!text || !currentChatId || !currentConvData) return;
  if (!currentConvData.isGroup && currentUser.blockedUsers && currentUser.blockedUsers.includes(currentOtherId)) {
    return showToast("You have blocked this user. Unblock them to send messages.");
  }
  if (!currentConvData.participants || !currentConvData.participants.length) {
    return showToast("Chat not ready");
  }
  isSending = true;

  const savedReply = replyToMsg;
  const timerMs = currentConvData.timer || 0;
  const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
  const msgData = {
    text, senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: "text", expireAt, reactions: {}, clientTs: Date.now()
  };
  if (savedReply) {
    msgData.replyToId = savedReply.id;
    msgData.replyToText = savedReply.text;
    msgData.replyToSender = savedReply.senderName;
  }

  inp.value = "";
  cancelReply();

const sb = document.getElementById("send-btn");
  if (sb) {
    sb.classList.add("sending");
    setTimeout(() => sb.classList.remove("sending"), 320);
    sb.innerHTML = ICONS.mic;
    sb.dataset.mode = "mic";
  }

  try {
    const updates = {
      lastMessage: text,
      lastMessageSenderId: currentUser.uid,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...currentConvData.participants),
      [`typing.${currentUser.uid}`]: null
    };
    currentConvData.participants.forEach(p => {
      if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await Promise.all([
      addDoc(collection(db, "conversations", currentChatId, "messages"), msgData),
      updateDoc(doc(db, "conversations", currentChatId), updates)
    ]);
    clearTimeout(typingTimeout);
    lastTypingUpdate = 0;
  } catch (err) {
    showAlert("Error", err.message);
    inp.value = text;
    if (savedReply) setReply(savedReply, savedReply.senderName, savedReply.senderName === "You");
  } finally {
    isSending = false;
    if (sb) {
      sb.innerHTML = inp.value.trim() ? ICONS.send : ICONS.mic;
      sb.dataset.mode = inp.value.trim() ? "send" : "mic";
    }
  }
}

async function toggleRecording() {
  const btn = document.getElementById("send-btn");
  const input = document.getElementById("msg-input");
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        if (!currentChatId || !currentConvData) return;
        try {
          showToast("Uploading voice note…");
          const url = await uploadToCloudinary(new File([audioBlob], "voice.webm", { type: "audio/webm" }));
          const timerMs = currentConvData.timer || 0;
          const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
          await addDoc(collection(db, "conversations", currentChatId, "messages"), {
            text: "🎙️ Voice note", senderId: currentUser.uid, senderName: currentUser.displayName,
            createdAt: serverTimestamp(), type: "audio", mediaUrl: url,
            expireAt, reactions: {}, clientTs: Date.now()
          });
          const updates = {
            lastMessage: "🎙️ Voice note", lastMessageSenderId: currentUser.uid,
            lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
            clearedBy: arrayRemove(...currentConvData.participants)
          };
          currentConvData.participants.forEach(p => {
            if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
          });
          await updateDoc(doc(db, "conversations", currentChatId), updates);
        } catch (e) { showAlert("Error", e.message); }
      };
      mediaRecorder.start();
      isRecording = true;
      input.disabled = true;
      input.placeholder = "Recording…";
      btn.classList.add("recording");
      btn.innerHTML = `<div style="width:16px;height:16px;background:#fff;border-radius:4px"></div>`;
      btn.dataset.mode = "recording";
    } catch (err) { showAlert("Microphone Error", "Microphone access denied."); }
  } else {
    try { mediaRecorder.stop(); } catch (_) {}
    try { mediaRecorder.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
    isRecording = false;
    input.disabled = false;
    input.placeholder = "Message";
    btn.classList.remove("recording");
    btn.innerHTML = ICONS.mic;
    btn.dataset.mode = "mic";
  }
}

window.openMediaViewer = (type, docId) => {
  const mediaMsgs = currentMessages.filter(x => x.type === "image" || x.type === "video");
  if (!mediaMsgs.length) return;
  mediaViewerIndex = Math.max(0, mediaMsgs.findIndex(m => m._id === docId));
  renderMediaViewer(mediaMsgs);
};

function renderMediaViewer(mediaMsgs) {
  document.querySelectorAll(".media-viewer").forEach(n => n.remove());
  const idx = mediaViewerIndex;
  const m = mediaMsgs[idx];
  const v = document.createElement("div");
  v.className = "media-viewer";
  v.innerHTML = `
    <div class="mv-counter">${idx + 1} / ${mediaMsgs.length}</div>
    <div class="mv-controls">
      <a class="mv-btn" href="${escapeHtml(m.mediaUrl)}" download target="_blank" rel="noopener" aria-label="Download">${ICONS.download}</a>
      <button class="mv-btn" id="mv-close" aria-label="Close">${ICONS.close}</button>
    </div>
    ${m.type === "video"
      ? `<video src="${escapeHtml(m.mediaUrl)}" controls autoplay playsinline></video>`
      : `<img src="${escapeHtml(m.mediaUrl)}" alt="media">`}
    ${mediaMsgs.length > 1 ? `
      <button class="mv-nav prev" id="mv-prev" aria-label="Previous">‹</button>
      <button class="mv-nav next" id="mv-next" aria-label="Next">›</button>` : ""}`;
  document.body.appendChild(v);

  v.querySelector("#mv-close").onclick = () => v.remove();
  const prev = v.querySelector("#mv-prev"), next = v.querySelector("#mv-next");
  if (prev) prev.onclick = () => {
    mediaViewerIndex = (mediaViewerIndex - 1 + mediaMsgs.length) % mediaMsgs.length;
    renderMediaViewer(mediaMsgs);
  };
  if (next) next.onclick = () => {
    mediaViewerIndex = (mediaViewerIndex + 1) % mediaMsgs.length;
    renderMediaViewer(mediaMsgs);
  };
}

function ensureScrollBtn() {
  let btn = document.getElementById("scroll-bottom-btn");
  if (btn) return btn;
  btn = document.createElement("button");
  btn.id = "scroll-bottom-btn";
  btn.className = "scroll-bottom-btn";
  btn.setAttribute("aria-label", "Scroll to bottom");
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
  
  btn.onclick = () => {
    const m = document.getElementById("messages");
    if (m) m.scrollTo({ top: m.scrollHeight, behavior: "smooth" });
    // Hide immediately on click, don't wait for scroll event
    btn.classList.remove("show");
  };
  
  document.getElementById("chat-window")?.appendChild(btn);
  return btn;
}

function attachScrollListener() {
  const m = document.getElementById("messages");
  const btn = ensureScrollBtn();
  if (!m || !btn) return;
  m.onscroll = () => {
    // Changed 120 to 50 for a tighter, more accurate threshold
    const near = m.scrollHeight - m.scrollTop - m.clientHeight < 50;
    btn.classList.toggle("show", !near);
  };
}

function openChatSearch() {
  const bar = document.getElementById("chat-search-bar");
  bar.classList.toggle("show");
  if (bar.classList.contains("show")) {
    const input = document.getElementById("chat-search-input");
    input.value = "";
    input.focus();
    document.getElementById("cs-count").textContent = "";
    document.querySelectorAll(".msg-row.search-hit").forEach(n => n.classList.remove("search-hit"));
  }
}

function searchInChat(term) {
  const t = term.toLowerCase().trim();
  const rows = document.querySelectorAll("#messages .msg-row");
  let hits = 0, firstHit = null;
  rows.forEach(r => {
    r.classList.remove("search-hit");
    if (t.length < 2) return;
    if ((r.textContent || "").toLowerCase().includes(t)) {
      r.classList.add("search-hit");
      hits++;
      if (!firstHit) firstHit = r;
    }
  });
  document.getElementById("cs-count").textContent = hits ? `${hits}` : "0";
  if (firstHit) firstHit.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function openChatMenu() {
  if (!currentChatId) return;
  
  const d = currentConvData || {};
  const pinned = (d.pinnedBy || []).includes(currentUser.uid);
  const muted = !!(d.mutedBy && d.mutedBy[currentUser.uid]);

const { modal, close } = createModal(`
    <button class="btn-secondary" data-act="pin">${pinned ? "📌 Unpin" : "📌 Pin Chat"}</button>
    <button class="btn-secondary" data-act="mute">${muted ? "🔔 Unmute" : "🔕 Mute"}</button>
    <button class="btn-secondary" data-act="media"> Media Gallery</button>
    <button class="btn-danger" data-act="delete"> Delete Chat</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);

  modal.querySelector('[data-act="pin"]').onclick = async () => {
    close();
    if (pinned) await updateDoc(doc(db, "conversations", currentChatId), { pinnedBy: arrayRemove(currentUser.uid) });
    else await updateDoc(doc(db, "conversations", currentChatId), { pinnedBy: arrayUnion(currentUser.uid) });
    showToast(pinned ? "Unpinned" : "Pinned");
  };
  modal.querySelector('[data-act="mute"]').onclick = async () => {
    close();
    if (muted) await updateDoc(doc(db, "conversations", currentChatId), { [`mutedBy.${currentUser.uid}`]: null });
    else await updateDoc(doc(db, "conversations", currentChatId), { [`mutedBy.${currentUser.uid}`]: Date.now() + 365 * 24 * 3600 * 1000 });
    showToast(muted ? "Unmuted" : "Muted");
  };
  modal.querySelector('[data-act="media"]').onclick = () => {
    close();
    const media = currentMessages.filter(x => x.type === "image" || x.type === "video");
    if (!media.length) return showToast("No media in this chat");
    window.openMediaViewer(media[0].type, media[0]._id);
  };
  modal.querySelector('[data-act="delete"]').onclick = () => {
    close();
    handleDeleteChat();
  };
  modal.querySelector('[data-act="cancel"]').onclick = close;
}

async function handleDeleteChat() {
  if (!currentChatId) return;
  const d = currentConvData || {};
  const newCleared = [...new Set([...(d.clearedBy || []), currentUser.uid])];
  try {
    await updateDoc(doc(db, "conversations", currentChatId), {
      clearedBy: newCleared,
      lastMessage: "New Chat",
      [`unreadCounts.${currentUser.uid}`]: 0
    });
    document.getElementById("chat-window").classList.remove("active");
    document.querySelector(".app-container").classList.remove("chat-open");
    currentChatId = null;
    currentOtherId = null;
    currentConvData = null;
    currentMessages = [];
    scheduleChatListRender();
    showToast("Chat cleared");
  } catch (e) { showAlert("Error", e.message); }
}

function openAttachMenu() {
  const { modal, close } = createModal(`
    <h3>Send</h3>
    <button class="btn-secondary" data-act="image"> Photo (max 5MB)</button>
    <button class="btn-secondary" data-act="audio"> Music (max 5MB)</button>
    <button class="btn-secondary" data-act="video"> Video (max 3MB)</button>
    <button class="btn-secondary" data-act="document"> Document (max 2MB)</button>
    <button class="btn-secondary" data-act="contact"> Share Contact</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="image"]').onclick = () => { close(); document.getElementById("chat-upload-image").click(); };
  modal.querySelector('[data-act="audio"]').onclick = () => { close(); document.getElementById("chat-upload-audio").click(); };
  modal.querySelector('[data-act="video"]').onclick = () => { close(); document.getElementById("chat-upload-video").click(); };
  modal.querySelector('[data-act="document"]').onclick = () => { close(); document.getElementById("chat-upload-doc").click(); };
  modal.querySelector('[data-act="contact"]').onclick = () => { close(); window.openShareContactModal(); };
  modal.querySelector('[data-act="cancel"]').onclick = close;
}

async function handleMediaUpload(e, kind) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !currentChatId || !currentConvData) return;
  const limit = MEDIA_LIMITS[kind];
  if (file.size > limit) {
    return showAlert("File too large", `${kind} limit is ${formatFileSize(limit)}. Your file: ${formatFileSize(file.size)}.`);
  }
  try {
    showToast(`Uploading ${kind}…`);
    const url = await uploadToCloudinary(file);
    const convData = currentConvData;
    const timerMs = convData.timer || 0;
    const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
    const textMap = { image: " Photo", audio: " Music", video: " Video", document: " Document" };
    await addDoc(collection(db, "conversations", currentChatId, "messages"), {
      text: textMap[kind], senderId: currentUser.uid, senderName: currentUser.displayName,
      createdAt: serverTimestamp(), type: kind, mediaUrl: url,
      fileName: kind === "document" ? file.name : null,
      expireAt, reactions: {}, clientTs: Date.now()
    });
    const updates = {
      lastMessage: textMap[kind], lastMessageSenderId: currentUser.uid,
      lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...(convData.participants || []))
    };
    (convData.participants || []).forEach(p => {
      if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
  } catch (err) { showAlert("Upload Error", err.message); }
}

window.openShareContactModal = () => {
  const { modal, close } = createModal(`
    <h3>Share Contact</h3>
    <input id="share-search" placeholder="Search @username...">
    <div class="user-select-list" id="share-list"></div>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;

  modal.querySelector("#share-search").oninput = debounce(async (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length < 2) return;
    const q = query(collection(db, "users"),
      where("username", ">=", term), where("username", "<=", term + "\uf8ff"));
    const snap = await getDocs(q);
    const list = document.getElementById("share-list");
    if (!list) return;
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid).map(d => {
      const u = d.data();
      return `<div class="user-select-item" data-uid="${d.id}"
        data-uname="${escapeHtml(u.username || "")}"
        data-dname="${escapeHtml(u.displayName || "")}"
        data-photo="${escapeHtml(u.photoURL || "")}">
        <div class="avatar">${u.photoURL
          ? `<img src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : escapeHtml((u.displayName || "?")[0])}</div>
        <div style="flex:1">${escapeHtml(u.displayName || "User")}</div>
        <div style="color:var(--user-accent-1)">→</div>
      </div>`;
    }).join("");
    list.querySelectorAll(".user-select-item").forEach(el => {
      el.onclick = () => {
        sendContactCard(el.dataset.uid, el.dataset.dname, el.dataset.uname, el.dataset.photo);
        close();
      };
    });
  }, 250);
};

async function sendContactCard(uid, name, username, photo) {
  if (!currentChatId || !currentConvData) return;
  const timerMs = currentConvData.timer || 0;
  const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
  await addDoc(collection(db, "conversations", currentChatId, "messages"), {
    text: "Contact", senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: "contact",
    contactUid: uid, contactName: name,
    contactUsername: username, contactPhoto: photo,
    expireAt, reactions: {}, clientTs: Date.now()
  });
  const updates = {
    lastMessage: " Contact", lastMessageSenderId: currentUser.uid,
    lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
    clearedBy: arrayRemove(...(currentConvData.participants || []))
  };
  (currentConvData.participants || []).forEach(p => {
    if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
  });
  await updateDoc(doc(db, "conversations", currentChatId), updates);
  showToast("Contact shared");
}

window.openTimerModal = () => {
  createModal(`
    <h3>Disappearing Messages</h3>
    <p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:20px">
      Messages auto-delete from Firestore.
    </p>
    <button class="timer-option" onclick="window.setTimer(0); this.closest('.modal-overlay').remove();">24 Hours (Default)</button>
    <button class="timer-option" onclick="window.setTimer(300000); this.closest('.modal-overlay').remove();">5 Minutes</button>
    <button class="timer-option" onclick="window.setTimer(3600000); this.closest('.modal-overlay').remove();">1 Hour</button>
    <button class="timer-option" onclick="window.setTimer(43200000); this.closest('.modal-overlay').remove();">12 Hours</button>
    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
  `);
};

window.setTimer = async (ms) => {
  if (!currentChatId) return;
  await updateDoc(doc(db, "conversations", currentChatId), { timer: ms });
  updateTimerUI(ms);
};

function updateTimerUI(ms) {
  const el = document.getElementById("timer-text");
  if (!el) return;
  el.textContent = !ms || ms === 0 ? "24 Hours"
    : ms === 300000 ? "5 Mins"
    : ms === 3600000 ? "1 Hour"
    : ms === 43200000 ? "12 Hours" : "24 Hours";
}

function toggleEmojiPanel(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const panel = document.getElementById("emoji-panel");
  const input = document.getElementById("msg-input");
  if (panel.classList.contains("show")) panel.classList.remove("show");
  else {
    input.setAttribute("readonly", "readonly");
    input.blur();
    setTimeout(() => input.removeAttribute("readonly"), 150);
    panel.classList.add("show");
  }
}

window.switchPanelTab = (tab) => {
  document.getElementById("tab-emojis").classList.toggle("active", tab === "emoji");
  document.getElementById("tab-stickers").classList.toggle("active", tab === "sticker");
  document.getElementById("emoji-grid").style.display = tab === "emoji" ? "grid" : "none";
  document.getElementById("sticker-grid").style.display = tab === "sticker" ? "grid" : "none";
};

window.insertEmoji = (emoji) => {
  const input = document.getElementById("msg-input");
  input.value += emoji;
  const btn = document.getElementById("send-btn");
  if (input.value.trim() && btn.dataset.mode !== "send") { btn.innerHTML = ICONS.send; btn.dataset.mode = "send"; }
};

window.sendSticker = async (url) => {
  if (!currentChatId || isSending || !currentConvData) return;
  isSending = true;
  document.getElementById("emoji-panel").classList.remove("show");
  try {
    const timerMs = currentConvData.timer || 0;
    const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
    await addDoc(collection(db, "conversations", currentChatId, "messages"), {
      text: "Sticker", senderId: currentUser.uid, senderName: currentUser.displayName,
      createdAt: serverTimestamp(), type: "sticker", mediaUrl: url,
      expireAt, reactions: {}, clientTs: Date.now()
    });
    const updates = {
      lastMessage: "🖼️ Sticker", lastMessageSenderId: currentUser.uid,
      lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...(currentConvData.participants || []))
    };
    (currentConvData.participants || []).forEach(p => {
      if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
  } catch (err) { showAlert("Error", err.message); }
  finally { isSending = false; }
};

window.openStatusTab = async () => {
  if (document.getElementById("floating-status-widget")) return;
  showToast("Loading statuses...");

  try {
    const q = query(collection(db, "statuses"), where("expireAt", ">", Timestamp.now()));
    const snap = await getDocs(q);
    
    const byUser = {};
    snap.forEach(d => {
      const s = d.data();
      if (!byUser[s.userId]) byUser[s.userId] = [];
      byUser[s.userId].push({ id: d.id, ...s });
    });
    
    const userIds = Object.keys(byUser);
    const usersData = {};
    
    await Promise.all(userIds.map(async uid => {
      try {
        const u = await getUserCached(uid);
        if (u.displayName) usersData[uid] = u;
      } catch (_) {}
    }));
    
    const myStatuses = byUser[currentUser.uid] || [];
    myStatuses.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    
    const otherUsers = userIds.filter(uid => uid !== currentUser.uid && usersData[uid]);

    const widget = document.createElement("div");
    widget.id = "floating-status-widget";
    widget.className = "status-floating-widget";
    
    widget.innerHTML = `
      <div class="sw-header">
        <span class="sw-title">Status Updates</span>
        <button class="sw-close" onclick="document.getElementById('floating-status-widget').remove()">✕</button>
      </div>
      <div class="sw-list">
        <div class="sw-item-group" id="sw-add-new">
          <div class="sw-add"><span>+</span></div>
          <span class="sw-label">Add</span>
        </div>

        ${myStatuses.length > 0 ? `
        <div class="sw-item-group" id="sw-view-mine">
          <div class="sw-item" style="border-color: var(--text-muted)">
            ${myStatuses[0].mediaType === "video"
              ? `<video src="${escapeHtml(myStatuses[0].mediaUrl)}" muted preload="metadata"></video>`
              : `<img src="${escapeHtml(getOptimizedUrl(myStatuses[0].mediaUrl))}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`}
            ${myStatuses.length > 1 ? `<div class="sw-badge">${myStatuses.length}</div>` : ''}
          </div>
          <span class="sw-label">Mine</span>
        </div>` : ''}

        ${otherUsers.map(uid => {
          const u = usersData[uid];
          const userStatuses = byUser[uid].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
          const first = userStatuses[0];
          return `<div class="sw-item-group" data-status-uid="${uid}">
            <div class="sw-item">
              ${first.mediaType === "video"
                ? `<video src="${escapeHtml(first.mediaUrl)}" muted preload="metadata"></video>`
                : `<img src="${escapeHtml(getOptimizedUrl(first.mediaUrl))}" alt="">`}
              ${userStatuses.length > 1 ? `<div class="sw-badge">${userStatuses.length}</div>` : ''}
            </div>
            <span class="sw-label">${escapeHtml((u.displayName || "?").split(" ")[0])}</span>
          </div>`;
        }).join("")}
      </div>
    `;
      
    document.body.appendChild(widget);
    
    userIds.forEach(uid => {
      if (byUser[uid][0] && byUser[uid][0].mediaType === "image") {
        const img = new Image();
        img.src = getOptimizedUrl(byUser[uid][0].mediaUrl);
      }
    });
    
    document.getElementById("sw-add-new").onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,video/*";
      input.onchange = (e) => { handleStatusUpload(e); widget.remove(); };
      input.click();
    };

    if (myStatuses.length > 0) {
      document.getElementById("sw-view-mine").onclick = () => {
        widget.remove();
        window.viewUserStatus(currentUser.uid, true, myStatuses);
      };
    }
    
    widget.querySelectorAll("[data-status-uid]").forEach(el => {
      el.onclick = () => {
        widget.remove(); 
        window.viewUserStatus(el.dataset.statusUid, false, byUser[el.dataset.statusUid]);
      };
    });
    
  } catch (err) {
    console.error("[status]", err);
    showToast("Failed to load statuses");
  }
};

window.viewUserStatus = async (userId, isMe = false, preloadedStatuses = null) => {
  let statuses = preloadedStatuses;

  if (!statuses) {
    const snap = await getDocs(query(collection(db, "statuses"), where("userId", "==", userId)));
    const now = Date.now();
    statuses = [];
    snap.forEach(d => {
      const s = d.data();
      const ex = toMillis(s.expireAt);
      if (!ex || ex > now) statuses.push({ id: d.id, ...s });
    });
    statuses.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  }

  if (!statuses || !statuses.length) return showAlert("No Status", "This user has no active status.");

  let idx = 0;
  let autoTimer = null;
  const clearAuto = () => { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } };

  const overlay = document.createElement("div");
  overlay.className = "status-viewer-overlay";
  document.body.appendChild(overlay);

  const render = () => {
    clearAuto();
    if (idx >= statuses.length) { overlay.remove(); return; }
    if (idx < 0) idx = 0;
    const s = statuses[idx];
    
    const mediaUrl = getOptimizedUrl(s.mediaUrl);

    overlay.innerHTML = `
      <div class="status-viewer-card">
        <div class="status-progress">${statuses.map((_, i) =>
          `<div class="status-progress-bar ${i < idx ? "done" : i === idx ? "active" : ""}"><div></div></div>`).join("")}</div>
          
        <div class="status-media">
          ${s.mediaType === "video"
            ? `<video src="${escapeHtml(mediaUrl)}" autoplay playsinline preload="auto"></video>`
            : `<img src="${escapeHtml(mediaUrl)}" alt="" loading="eager" style="opacity:0; transition:opacity 0.2s;" onload="this.style.opacity=1">`}
        </div>
          
        ${isMe ? `
          <button class="st-viewers-btn" id="st-viewers">
            Views ${(s.viewers || []).length}
          </button>
          <button class="status-close" id="st-delete" style="right: 60px; color:#ef4444; font-size:16px">️Delete</button>` : ''}
          
        <button class="status-close" id="st-close" aria-label="Close">✕</button>
        <button class="status-nav prev" id="st-prev" aria-label="Previous">‹</button>
        <button class="status-nav next" id="st-next" aria-label="Next">›</button>
        
        ${!isMe ? `
          <div class="status-reply-bar">
            <input id="status-reply-input" placeholder="Reply privately...">
            <button id="status-reply-send" aria-label="Send reply">${ICONS.send}</button>
          </div>` : ''}
      </div>`;

    if (!isMe) updateDoc(doc(db, "statuses", s.id), { viewers: arrayUnion(currentUser.uid) }).catch(() => {});

    document.getElementById("st-close").onclick = () => { clearAuto(); overlay.remove(); };
    document.getElementById("st-prev").onclick = () => { clearAuto(); idx--; render(); };
    document.getElementById("st-next").onclick = () => { clearAuto(); idx++; render(); };

    if (isMe) {
      document.getElementById("st-viewers").onclick = () => viewStatusViewers(s.id);
      document.getElementById("st-delete").onclick = () => {
        showAlert("Delete Status", "Delete this status for everyone?", true, async () => {
          await deleteDoc(doc(db, "statuses", s.id));
          overlay.remove();
          window.openStatusTab(); 
        });
      };
    } else {
      const inp = document.getElementById("status-reply-input");
      const btn = document.getElementById("status-reply-send");
      const send = async () => {
        const txt = inp.value.trim();
        if (!txt) return;
        inp.value = "";
        try {
          await replyToStatus(s, txt);
          showToast("Reply sent!");
        } catch (e) {
          showToast("Failed to send reply");
        }
      };
      btn.onclick = send;
      inp.onkeydown = e => { if (e.key === "Enter") send(); };
    }

    const mediaEl = overlay.querySelector(".status-media img, .status-media video");
    if (mediaEl) {
      const startTimer = () => {
        if (s.mediaType !== "video") {
          autoTimer = setTimeout(() => {
            if (overlay.parentNode) { idx++; render(); }
          }, 5000);
        }
      };
      if (mediaEl.tagName === "IMG") {
        if (mediaEl.complete) startTimer();
        else mediaEl.onload = startTimer;
      } else if (mediaEl.tagName === "VIDEO") {
        if (mediaEl.readyState >= 2) startTimer();
        else mediaEl.oncanplay = startTimer;
      }
    }
  };
  render();
};

async function viewStatusViewers(statusId) {
  const snap = await getDoc(doc(db, "statuses", statusId));
  if (!snap.exists()) return;
  const viewers = snap.data().viewers || [];
  
  if (!viewers.length) return showAlert("No Views Yet", "Nobody has viewed this status yet.");

  const rows = [];
  for (const uid of viewers) {
    const u = await getUserCached(uid);
    rows.push(`
      <div class="viewer-item">
        <div class="viewer-avatar">
          ${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : `<span>${escapeHtml((u.displayName || "?")[0])}</span>`}
        </div>
        <div class="viewer-name">${escapeHtml(u.displayName || "User")}</div>
      </div>
    `);
  }

  const { modal, close } = createModal(`
    <h3 style="margin-bottom:20px">Viewed by ${viewers.length}</h3>
    <div class="viewers-list">${rows.join("")}</div>
    <button class="btn-secondary" data-act="close">Close</button>
  `);
  modal.querySelector('[data-act="close"]').onclick = close;
}

async function replyToStatus(status, text) {
  if (!text.trim()) return;
  const participants = [currentUser.uid, status.userId].sort();
  const chatId = participants.join("_");
  const chatSnap = await getDoc(doc(db, "conversations", chatId));
  if (!chatSnap.exists()) {
    await setDoc(doc(db, "conversations", chatId), {
      participants, updatedAt: serverTimestamp(), lastMessage: "New Chat",
      clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
    });
  }
  
  await addDoc(collection(db, "conversations", chatId, "messages"), {
    text: text,
    senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: "text",
    expireAt: Timestamp.fromMillis(Date.now() + MESSAGE_TTL_MS),
    reactions: {}, clientTs: Date.now(),
    statusReply: { 
      mediaUrl: status.mediaUrl,
      mediaType: status.mediaType,
      statusId: status.id,
      userId: status.userId 
    }
  });
  
  await updateDoc(doc(db, "conversations", chatId), {
    lastMessage: text,
    lastMessageSenderId: currentUser.uid,
    lastMessageTime: serverTimestamp()
  });
}

async function handleStatusUpload(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !currentUser) return;
  if (file.size > 5 * 1024 * 1024) return showAlert("Too Large", "Status must be under 5MB.");
  try {
    showToast("Uploading status…");
    const url = await uploadToCloudinary(file);
    await addDoc(collection(db, "statuses"), {
      userId: currentUser.uid,
      userDisplayName: currentUser.displayName,
      mediaUrl: url,
      mediaType: file.type.startsWith("video") ? "video" : "image",
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + STATUS_TTL_MS),
      viewers: []
    });
    showToast("Status posted! Auto-deletes in 5 hours.");
    window.openStatusTab();
  } catch (err) { showAlert("Error", err.message); }
}

window.startDM = async function (otherUid, otherName, photoURL) {
  if (!otherUid) return showAlert("Error", "User not found");
  const participants = [currentUser.uid, otherUid].sort();
  const chatId = participants.join("_");
  try {
    const snap = await getDoc(doc(db, "conversations", chatId));
    if (!snap.exists()) {
      await setDoc(doc(db, "conversations", chatId), {
        participants, updatedAt: serverTimestamp(), lastMessage: "New Chat",
        clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
      });
    }
  } catch (e) {
    await setDoc(doc(db, "conversations", chatId), {
      participants, updatedAt: serverTimestamp(), lastMessage: "New Chat",
      clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
    }).catch(() => {});
  }
  openChat(chatId, otherUid, otherName, photoURL, false);
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = "";
  scheduleChatListRender();
};

async function handleSearch(term) {
  const list = document.getElementById("chats-list");
  if (!list) return;
  const q = query(collection(db, "users"),
    where("username", ">=", term), where("username", "<=", term + "\uf8ff"));
  const snap = await getDocs(q);
  const results = [];
  const seen = new Set();
  snap.forEach(d => {
    if (d.id === currentUser.uid) return;
    const u = d.data();
    if (seen.has(u.username)) return;
    seen.add(u.username);
    results.push({ id: d.id, ...u });
  });
  if (!results.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>No users found</h3>
        <p>Try a different username.</p>
      </div>`;
    return;
  }
  list.innerHTML = results.map(u => `
    <li class="chat-item" data-uid="${u.id}" data-name="${escapeHtml(u.displayName)}" data-photo="${escapeHtml(u.photoURL || "")}">
      <div class="avatar-wrap">
        <div class="avatar">${u.photoURL
          ? `<img loading="lazy" src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml((u.displayName || "?")[0])}</div>
      </div>
      <div class="chat-info">
        <div class="chat-top"><span class="chat-name">${escapeHtml(u.displayName)}</span></div>
        <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(u.username)}.mofie</span></div>
      </div>
    </li>`).join("");
  list.querySelectorAll(".chat-item").forEach(el => {
    el.onclick = () => window.startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
  });
}

function activateExplore() {
  currentTab = "explore";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const fab = document.getElementById("explore-btn");
  fab.classList.add("active");
  fab.innerHTML = `${ICONS.back} Back`;
  document.getElementById("search").value = "";
  loadExploreUsers();
}

function exitExplore() {
  currentTab = "friends";
  const fab = document.getElementById("explore-btn");
  fab.classList.remove("active");
  fab.innerHTML = `${ICONS.explore} Explore`;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const t = document.querySelector('.tab-btn[data-tab="friends"]');
  if (t) t.classList.add("active");
  document.getElementById("search").value = "";
  if (unsubExplore) { unsubExplore(); unsubExplore = null; }
  scheduleChatListRender();
}

function loadExploreUsers() {
  const list = document.getElementById("chats-list");
  if (!list) return;
  if (unsubExplore) { unsubExplore(); unsubExplore = null; }

  // Show Skeleton Loaders
  list.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-item">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-text-wrap">
        <div class="skeleton-line-1"></div>
        <div class="skeleton-line-2"></div>
      </div>
    </div>
  `).join("");

  unsubExplore = onSnapshot(collection(db, "users"), (snap) => {
    if (currentTab !== "explore") return;
    const users = [];
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      if (!u.displayName) return;
      users.push({ id: d.id, ...u });
    });
    
    users.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    
    if (!users.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌍</div>
          <h3>No users yet</h3>
          <p>Be the first — invite a friend!</p>
        </div>`;
      return;
    }
    
    list.innerHTML = users.map(u => {
      const online = isUserOnline(u.lastSeen);
      const hasStatus = activeStatusUsers.has(u.id);
      return `<li class="chat-item" data-uid="${u.id}" data-name="${escapeHtml(u.displayName)}" data-photo="${escapeHtml(u.photoURL || "")}">
        <div class="avatar-wrap ${hasStatus ? "has-status" : ""}">
          <div class="avatar">${u.photoURL
            ? `<img loading="lazy" src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
            : escapeHtml((u.displayName || "?")[0])}</div>
          <div class="status-dot ${online ? "online" : "offline"}"></div>
        </div>
        <div class="chat-info">
          <div class="chat-top"><span class="chat-name">${escapeHtml(u.displayName)}</span></div>
          <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(u.username)}.mofie</span></div>
        </div>
      </li>`;
    }).join("");
    
    list.querySelectorAll(".chat-item").forEach(el => {
      el.onclick = () => window.startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
    });
  });
}

async function loadMyContacts() {
  const list = document.getElementById("chats-list");
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading contacts…</div>';
  let snap;
  try { snap = await getDocs(collection(db, "users", currentUser.uid, "mofieContacts")); }
  catch (e) { snap = { empty: true, docs: [] }; }

  const pickerBtn = `<button onclick="openPhonebookPicker()" style="margin-top:8px;padding:8px 16px;border-radius:20px;border:1px solid var(--border);background:var(--bg-main);color:var(--text);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px">${ICONS.phonebook} Sync from Phonebook</button>`;

  if (snap.empty) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📒</div>
        <h3>No contacts yet</h3>
        <p>Pull your phonebook to find friends on Mofie.</p>
        <div style="margin-top:16px">${pickerBtn}</div>
      </div>`;
    return;
  }

  const contacts = [];
  await Promise.all(snap.docs.map(async d => {
    const c = d.data();
    const u = await getUserCached(d.id);
    if (!u.displayName) return;
    contacts.push({
      uid: d.id,
      username: c.mofieUsername || u.username,
      displayName: c.customName || u.displayName,
      photoURL: c.photoURL || u.photoURL,
      lastSeen: u.lastSeen
    });
  }));
  contacts.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

  list.innerHTML = `<div class="contacts-hint" style="padding:12px;text-align:center">
    ${contacts.length} contact${contacts.length !== 1 ? "s" : ""} on Mofie
    <div style="margin-top:6px">${pickerBtn}</div>
  </div>` + contacts.map(c => {
    const online = isUserOnline(c.lastSeen);
    const hasStatus = activeStatusUsers.has(c.uid);
    return `<li class="chat-item" data-uid="${c.uid}"
              data-name="${escapeHtml(c.displayName)}"
              data-photo="${escapeHtml(c.photoURL || "")}">
      <div class="avatar-wrap ${hasStatus ? "has-status" : ""}">
        <div class="avatar">${c.photoURL
          ? `<img loading="lazy" src="${escapeHtml(c.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml((c.displayName || "?")[0])}</div>
        <div class="status-dot ${online ? "online" : "offline"}"></div>
      </div>
      <div class="chat-info">
        <div class="chat-top"><span class="chat-name">${escapeHtml(c.displayName)}</span></div>
        <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(c.username)}.mofie</span></div>
      </div>
      <button class="icon" style="padding:8px" data-save-vcf title="Save to phone" aria-label="Save to phone">${ICONS.download}</button>
    </li>`;
  }).join("");

  list.querySelectorAll(".chat-item").forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest("[data-save-vcf]")) return;
      window.startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
    };
    const btn = el.querySelector("[data-save-vcf]");
    if (btn) btn.onclick = (ev) => {
      ev.stopPropagation();
      const uid = el.dataset.uid;
      const c = contacts.find(x => x.uid === uid);
      if (c) window.saveMofieContactToPhone({
        username: c.username, displayName: c.displayName, photoURL: c.photoURL
      });
    };
  });
}

const canPickContacts = "contacts" in navigator && "ContactsManager" in window;

window.openPhonebookPicker = async () => {
  if (!currentUser.phoneNumber) { window.promptPhoneNumber(); return; }
  if (!canPickContacts) {
    showAlert("Phonebook not available",
      "Your browser does not support reading the phonebook. Open in Chrome on Android.");
    return;
  }
  try {
    const contacts = await navigator.contacts.select(["name", "tel"], { multiple: true });
    if (!contacts || !contacts.length) return;
    const phones = [];
    contacts.forEach(c => (c.tel || []).forEach(t => {
      const n = normalizePhone(t);
      if (n) phones.push(n);
    }));
    if (!phones.length) { showToast("No phone numbers found"); return; }

    const chunks = [];
    for (let i = 0; i < phones.length; i += 30) chunks.push(phones.slice(i, i + 30));

    const found = new Map();
    await Promise.all(chunks.map(async batch => {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("phoneNumber", "in", batch)));
        snap.forEach(d => {
          const u = d.data();
          const n = normalizePhone(u.phoneNumber);
          if (n) found.set(n, { uid: d.id, ...u });
        });
      } catch (e) { console.warn("phone lookup", e.message); }
    }));

    renderPickedContacts(contacts, found);
  } catch (err) {
    if (err.name !== "AbortError") showToast("Could not open phonebook");
  }
};

function renderPickedContacts(rawContacts, foundMap) {
  const rows = [];
  const seen = new Set();
  rawContacts.forEach(c => {
    const name = (c.name && c.name[0]) || "Unknown";
    (c.tel || []).forEach(t => {
      const n = normalizePhone(t);
      if (!n || seen.has(n)) return;
      seen.add(n);
      rows.push({ name, phone: n, user: foundMap.get(n) });
    });
  });
  const { modal, close } = createModal(`
    <h3>Phonebook matches</h3>
    <div style="max-height:340px;overflow-y:auto;margin-bottom:12px">
      ${rows.map((r, i) => `
        <div class="user-select-item" data-i="${i}">
          <div class="avatar">${r.user?.photoURL
            ? `<img src="${escapeHtml(r.user.photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : escapeHtml((r.name || "?")[0])}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">${escapeHtml(r.name)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${
              r.user ? `@${escapeHtml(r.user.username)}.mofie` : escapeHtml(r.phone)
            }</div>
          </div>
          ${r.user
            ? `<span style="color:#10b981;font-size:12px;font-weight:700">ON MOFIE</span>`
            : `<span style="color:var(--text-muted);font-size:12px">Not on Mofie</span>`}
        </div>`).join("")}
    </div>
    <button class="btn-primary" data-act="save">Save on-Mofie contacts</button>
    <button class="btn-secondary" data-act="close">Close</button>
  `);
  modal.querySelector('[data-act="close"]').onclick = close;
  modal.querySelector('[data-act="save"]').onclick = async () => {
    const matches = rows.filter(r => r.user);
    if (!matches.length) { showToast("No Mofie users in your selection"); return; }
    for (const m of matches) {
      await setDoc(doc(db, "users", currentUser.uid, "mofieContacts", m.user.uid), {
        mofieUsername: m.user.username,
        customName: m.user.displayName,
        photoURL: m.user.photoURL || null,
        savedAt: serverTimestamp()
      }, { merge: true });
    }
    close();
    showToast(`Saved ${matches.length} contact${matches.length > 1 ? "s" : ""}`);
    loadMyContacts();
  };
}

window.saveMofieContactToPhone = (user) => {
  const handle = `@${user.username}.mofie`;
  const url = `${window.location.origin}?u=${encodeURIComponent(user.username)}`;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${handle}`, "ORG:Mofie",
    `URL:${url}`, `NOTE:Open in Mofie → ${handle}`];
  if (user.phoneNumber) lines.push(`TEL;TYPE:CELL:${user.phoneNumber}`);
  lines.push("END:VCARD");
  const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${user.username}.vcf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast(`Contact saved as ${handle}`);
};

window.promptPhoneNumber = () => {
  const { modal, close } = createModal(`
    <h3>Add your phone number</h3>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;text-align:center">
      Used so friends can find you in their phonebook.<br>Include country code.
    </p>
    <input id="phone-input" type="tel" placeholder="+256 700 000 000" value="${escapeHtml(currentUser.phoneNumber || "")}">
    <button class="btn-primary" data-act="save">Save</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="save"]').onclick = async () => {
    const norm = normalizePhone(document.getElementById("phone-input").value.trim());
    if (!norm) { showToast("Invalid phone number"); return; }
    try {
      await setDoc(doc(db, "users", currentUser.uid), { phoneNumber: norm }, { merge: true });
      currentUser.phoneNumber = norm;
      close();
      showToast("Phone number saved");
      window.openPhonebookPicker();
    } catch (e) { showAlert("Error", e.message); }
  };
};

window.openStarredMessages = async () => {
  const page = document.createElement("div");
  page.className = "settings-page active";
  page.innerHTML = `
    <div class="settings-header">
      <button class="icon" id="close-starred" aria-label="Back">${ICONS.back}</button>
      <h2>Starred Messages</h2>
    </div>
    <div class="settings-list" id="starred-list" style="padding:0">
      <div style="text-align:center;padding:20px;color:var(--text-muted)">Loading…</div>
    </div>`;
  document.querySelector(".app-container").appendChild(page);
  document.getElementById("close-starred").onclick = () => page.remove();

  try {
    const convSnap = await getDocs(query(
      collection(db, "conversations"), where("participants", "array-contains", currentUser.uid)));
    const items = [];
    await Promise.all(convSnap.docs.map(async c => {
      const data = c.data();
      if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) return;
      const msgs = await getDocs(collection(db, "conversations", c.id, "messages"));
      msgs.forEach(d => {
        const m = d.data();
        if ((m.starredBy || []).includes(currentUser.uid)) {
          items.push({ chatId: c.id, chatName: data.isGroup ? data.groupName : (m.senderName || "Chat"), msg: m });
        }
      });
    }));
    const list = document.getElementById("starred-list");
    if (!items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">★</div>
          <h3>No starred messages</h3>
          <p>Long-press any message to star it for quick access.</p>
        </div>`;
      return;
    }
    items.sort((a, b) => toMillis(b.msg.createdAt) - toMillis(a.msg.createdAt));
    list.innerHTML = items.map(it => `
      <div class="starred-item" data-chat="${it.chatId}">
        <div class="si-icon">★</div>
        <div class="si-body">
          <div class="si-text">${escapeHtml((it.msg.text || it.msg.type || "Media").slice(0, 60))}</div>
          <div class="si-meta">${escapeHtml(it.chatName)} · ${new Date(toMillis(it.msg.createdAt) || Date.now()).toLocaleDateString()}</div>
        </div>
      </div>`).join("");
    list.querySelectorAll(".starred-item").forEach(el => {
      el.onclick = () => { page.remove(); openChatById(el.dataset.chat); };
    });
  } catch (e) {
    const list = document.getElementById("starred-list");
    if (list) list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">${escapeHtml(e.message)}</div>`;
  }
};

window.openThemeModal = () => {
  const themeColors = [
    { hex: "#00A884" }, { hex: "#0088CC" }, { hex: "#8B5CF6" },
    { hex: "#F97316" }, { hex: "#EF4444" }, { hex: "#EC4899" }
  ];

  // Beautifully organized WhatsApp colors + extras
  const bubbleColors = [
    { hex: "#005C4B" }, { hex: "#D9FDD3" }, { hex: "#00A884" }, 
    { hex: "#0078D4" }, { hex: "#6B46C1" }, { hex: "#D97706" }, 
    { hex: "#DC2626" }, { hex: "#BE185D" }, { hex: "#4B5563" }
  ];

  const t = localStorage.getItem("mofie-theme") || "dark";
  const a1 = localStorage.getItem("mofie-accent1") || "#00A884";
  const defaultBubble = t === "light" ? "#D9FDD3" : "#005C4B";
  const bColor = localStorage.getItem("mofie-bubble-color") || defaultBubble;
  
  const themeSwatchesHTML = themeColors.map(c => `
    <div class="color-swatch ${a1.toLowerCase() === c.hex.toLowerCase() ? "active" : ""}" 
         style="background: ${c.hex};" 
         data-color="${c.hex}">
    </div>
  `).join("");

  const bubbleSwatchesHTML = bubbleColors.map(c => `
    <div class="color-swatch ${bColor.toLowerCase() === c.hex.toLowerCase() ? "active" : ""}" 
         style="background: ${c.hex};" 
         data-bubble-color="${c.hex}">
    </div>
  `).join("");

  const { modal, close } = createModal(`
    <h3 style="margin-bottom: 15px;">Appearance</h3>
    
    <div class="custom-theme-selector" style="margin-bottom: 20px;">
      <button class="theme-btn ${t === 'light' ? 'active' : ''}" data-theme="light">Light</button>
      <button class="theme-btn ${t === 'dark' ? 'active' : ''}" data-theme="dark">Dark</button>
      <button class="theme-btn ${t === 'neon' ? 'active' : ''}" data-theme="neon">Neon</button>
    </div>
    
    <h4 style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">App Accent Color</h4>
    <div class="custom-color-palette" style="margin-bottom: 20px;">
      ${themeSwatchesHTML}
    </div>

    <h4 style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">Chat Bubble Color</h4>
    <div class="custom-color-palette" style="margin-bottom: 20px;">
      ${bubbleSwatchesHTML}
    </div>

    <button class="btn-secondary" id="reset-theme-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); font-weight: 700; margin-top: 5px;">Reset to Default</button>
    <button class="btn-secondary" data-act="close" style="margin-top: 10px;">Close</button>
  `);
  
  modal.querySelector('[data-act="close"]').onclick = close;

  // Theme Mode Toggles
  modal.querySelectorAll(".theme-btn").forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll(".theme-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      localStorage.setItem("mofie-theme", btn.dataset.theme);
      applyTheme();
    };
  });

  // App Accent Colors
  modal.querySelectorAll("[data-color]").forEach(swatch => {
    swatch.onclick = () => {
      modal.querySelectorAll("[data-color]").forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      const color = swatch.dataset.color;
      localStorage.setItem("mofie-accent1", color);
      localStorage.setItem("mofie-accent2", color); 
      applyTheme();
    };
  });

  // Chat Bubble Colors
  modal.querySelectorAll("[data-bubble-color]").forEach(swatch => {
    swatch.onclick = () => {
      modal.querySelectorAll("[data-bubble-color]").forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      const color = swatch.dataset.bubbleColor;
      localStorage.setItem("mofie-bubble-color", color);
      applyTheme();
    };
  });

  // Reset Everything
  modal.querySelector("#reset-theme-btn").onclick = () => {
    localStorage.removeItem("mofie-theme");
    localStorage.removeItem("mofie-accent1");
    localStorage.removeItem("mofie-accent2");
    localStorage.removeItem("mofie-bubble-color");
    applyTheme();
    close();
    showToast("Theme reset to defaults!");
  };
};

window.openEditProfileModal = () => {
  const { modal, close } = createModal(`
    <h3>Edit Profile</h3>
    <div class="avatar-wrap" style="margin:0 auto 15px;width:80px;height:80px;cursor:pointer"
      id="profile-pic-wrap">
      <div class="avatar">${currentUser.photoURL
        ? `<img src="${escapeHtml(currentUser.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
        : escapeHtml((currentUser.displayName || "U")[0])}</div>
    </div>
    <input id="set-name" placeholder="Display name" value="${escapeHtml(currentUser.displayName || "")}">
    <input id="set-phone" type="tel" placeholder="Phone with country code" value="${escapeHtml(currentUser.phoneNumber || "")}">
    <button class="btn-primary" data-act="save">Save</button>
    <button class="btn-secondary" data-act="cancel">Close</button>
  `);
  modal.querySelector("#profile-pic-wrap").onclick = () =>
    document.getElementById("profile-upload").click();
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="save"]').onclick = async () => {
    const name = document.getElementById("set-name").value.trim();
    const phone = normalizePhone(document.getElementById("set-phone").value);
    if (!name) return showToast("Name required");
    const updates = { displayName: name };
    if (phone) updates.phoneNumber = phone;
    await updateDoc(doc(db, "users", currentUser.uid), updates);
    currentUser.displayName = name;
    if (phone) currentUser.phoneNumber = phone;
    close();
    showToast("Saved");
    renderMain();
    switchView("profile");
  };

document.getElementById("profile-upload").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const url = await uploadToCloudinary(f);
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
      currentUser.photoURL = url;
      close();
      showToast("Photo updated");
      renderMain();
      switchView("profile");
    } catch (err) { showAlert("Error", err.message); }
  };
};

window.openAccountModal = () => {
  const { modal, close } = createModal(`
    <h3>Account</h3>
    <input id="set-pass" type="password" placeholder="New password (min 6 chars)">
    <button class="btn-primary" data-act="pass">Change Password</button>
    <button class="btn-secondary" data-act="logout"
      style="color:var(--user-accent-1);border:1px solid var(--user-accent-1)">Log Out</button>
    <button class="btn-danger" data-act="delete">Delete Account</button>
    <button class="btn-secondary" data-act="cancel">Close</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="pass"]').onclick = async () => {
    const np = document.getElementById("set-pass").value;
    if (np.length < 6) return showToast("Min 6 chars");
    try {
      await updatePassword(auth.currentUser, np);
      showToast("Password changed");
      close();
    } catch (e) {
      if (e.code === "auth/requires-recent-login") showAlert("Security", "Log out and back in first.");
      else showAlert("Error", e.message);
    }
  };
  modal.querySelector('[data-act="logout"]').onclick = () => signOut(auth);
  modal.querySelector('[data-act="delete"]').onclick = () => {
    close();
    showAlert("Delete Account", "Permanently delete your account?", true, async () => {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid));
        await deleteDoc(doc(db, "usernames", currentUser.username));
        await deleteUser(auth.currentUser);
        setTimeout(() => window.location.reload(), 800);
      } catch (e) {
        if (e.code === "auth/requires-recent-login") showAlert("Security", "Log out and back in first.");
        else showAlert("Error", e.message);
      }
    });
  };
};

window.openAdminModal = () => {
  const { modal, close } = createModal(`
    <h3>Send Broadcast</h3>
    <textarea id="bc-message" placeholder="Broadcast message..." rows="4"></textarea>
    <button class="btn-primary" data-act="send">Send to All</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="send"]').onclick = async () => {
    const msg = document.getElementById("bc-message").value.trim();
    if (!msg) return showToast("Message required");
    try {
      await setDoc(doc(db, "system", "broadcast"), { message: msg, timestamp: Date.now() });
      showToast("Broadcast sent");
      close();
    } catch (e) { showAlert("Error", e.message); }
  };
};

function openFriendProfileModal(uid, name, photoURL) {
  // NO 'await' here! It loads instantly using local data.
  const isBlocked = (currentUser.blockedUsers || []).includes(uid);

  const { modal, close } = createModal(`
    <div style="text-align:center">
      <div class="avatar-wrap" style="width:80px;height:80px;margin:0 auto 12px">
        <div class="avatar" style="font-size:32px">${photoURL
          ? `<img src="${escapeHtml(photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml((name || "?")[0])}</div>
      </div>
      <h3>${escapeHtml(name || "User")}</h3>
      <button class="btn-secondary" data-act="block" style="color: ${isBlocked ? 'var(--user-accent-1)' : '#ef4444'}; border-color: ${isBlocked ? 'var(--user-accent-1)' : 'rgba(239,68,68,0.3)'}">
        ${isBlocked ? "Unblock User" : "Block User"}
      </button>
      <button class="btn-secondary" data-act="close">Close</button>
    </div>
  `);
  
  modal.querySelector('[data-act="close"]').onclick = close;
  
  modal.querySelector('[data-act="block"]').onclick = () => {
    // 1. Close the modal INSTANTLY
    close(); 
    
    // 2. Change the local data instantly so the app knows immediately
    if (isBlocked) {
      showToast("User unblocked");
      currentUser.blockedUsers = (currentUser.blockedUsers || []).filter(id => id !== uid);
      // 3. Update the database in the background (no await)
      updateDoc(doc(db, "users", currentUser.uid), { blockedUsers: arrayRemove(uid) }).catch(() => {});
    } else {
      showToast("User blocked");
      currentUser.blockedUsers = [...(currentUser.blockedUsers || []), uid];
      // 3. Update the database in the background (no await)
      updateDoc(doc(db, "users", currentUser.uid), { blockedUsers: arrayUnion(uid) }).catch(() => {});
    }
  };
}

window.openNewGroupModal = () => {
  window.selectedGroupUsers = new Map();
  const { modal, close } = createModal(`
    <h3 style="text-align:center; margin-top:0; margin-bottom:16px; font-size:18px;">New Group</h3>
    <input id="g-name" placeholder="Group Name">
    <input id="g-search" placeholder="Search users to add...">
    <div id="g-list"></div>
    <button class="btn-primary" data-act="create">Create Group</button>
    <button class="btn-secondary" data-act="cancel" style="color:var(--text-muted) !important; background:transparent !important; border:none !important; box-shadow:none !important;">Cancel</button>
  `);
  
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="create"]').onclick = () => window.createGroup(close);

  const search = debounce(async (e) => {
    const term = e.target.value.toLowerCase().trim();
    const list = document.getElementById("g-list");
    if (!list) return;
    
    if (term.length < 2) {
      list.innerHTML = `<div style="text-align:center; padding:10px; font-size:12px; color:var(--text-muted)">Type to search users...</div>`;
      return;
    }

    const snap = await getDocs(query(collection(db, "users"),
      where("username", ">=", term), where("username", "<=", term + "\uf8ff")));
    
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid).map(d => {
      const u = d.data();
      const sel = window.selectedGroupUsers.has(d.id);
      return `<div class="user-select-item ${sel ? "selected" : ""}" data-guid="${d.id}" data-gname="${escapeHtml(u.displayName || "")}">
        <div class="avatar">
          ${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : escapeHtml((u.displayName || "?")[0])}
        </div>
        <div style="flex:1; font-size:14px; font-weight:500;">${escapeHtml(u.displayName)}</div>
        <div class="g-check" style="font-size:16px; font-weight:bold; color:var(--user-accent-1)">${sel ? "✓" : ""}</div>
      </div>`;
    }).join("") || `<div style="text-align:center; padding:10px; font-size:12px; color:var(--text-muted)">No users found</div>`;

    list.querySelectorAll("[data-guid]").forEach(el => {
      el.onclick = () => window.toggleGroupUser(el.dataset.guid, el.dataset.gname, el);
    });
  }, 250);
  
  modal.querySelector("#g-search").oninput = search;
};

window.toggleGroupUser = (uid, name, el) => {
  if (window.selectedGroupUsers.has(uid)) {
    window.selectedGroupUsers.delete(uid);
    el.classList.remove("selected");
    const check = el.querySelector(".g-check");
    if (check) check.textContent = "";
  } else {
    window.selectedGroupUsers.set(uid, name);
    el.classList.add("selected");
    const check = el.querySelector(".g-check");
    if (check) check.textContent = "✓";
  }
};

window.createGroup = async (closeModal) => {
  const name = document.getElementById("g-name").value.trim();
  if (!name) return showToast("Group name required");
  if (window.selectedGroupUsers.size === 0) return showToast("Select at least one person");
  
  const participants = [currentUser.uid, ...window.selectedGroupUsers.keys()];
  try {
    const ref = doc(collection(db, "conversations"));
    await setDoc(ref, {
      isGroup: true, groupName: name, groupBio: "", groupPhotoURL: null,
      participants, createdBy: currentUser.uid, admins: [currentUser.uid],
      restricted: false, pendingMembers: [],
      updatedAt: serverTimestamp(), lastMessage: "Group created",
      lastMessageTime: serverTimestamp(), clearedBy: [], unreadCounts: {}, timer: 0
    });
    closeModal();
    openChat(ref.id, null, name, null, true);
    scheduleChatListRender();
  } catch (e) { 
    if (e.code === 'permission-denied') {
      showAlert("Permission Denied", "You need to update your Firebase Firestore rules to allow writing to the 'conversations' collection.");
    } else {
      showAlert("Error", e.message); 
    }
  }
};

function openGroupInfoModal() {
  if (!currentChatId) return;
  
  getDoc(doc(db, "conversations", currentChatId)).then(async (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.isGroup) return showToast("Not a group chat");

    const isAdmin = (data.admins || []).includes(currentUser.uid);
    const creatorId = data.createdBy;
    
    // Generate the member list rows
    const members = await Promise.all((data.participants || []).map(async uid => {
      const u = await getUserCached(uid);
      const isTargetAdmin = (data.admins || []).includes(uid);
      const isTargetCreator = uid === creatorId;
      const displayName = u.displayName || "User";
      
      let actionButtons = "";
      if (isAdmin && uid !== currentUser.uid) {
        const promoteBtn = !isTargetCreator 
          ? `<div class="member-action-icon" style="color:${isTargetAdmin ? '#f59e0b' : 'var(--text-muted)'};" onclick="window.toggleGroupAdmin('${uid}', ${isTargetAdmin})" title="${isTargetAdmin ? 'Dismiss Admin' : 'Make Admin'}">
               ${isTargetAdmin ? '👑' : '☆'}
             </div>` 
          : '';
          
        actionButtons = `
          <div style="display:flex; gap:4px;">
            ${promoteBtn}
            <div class="member-action-icon" style="color:#ef4444;" onclick="window.removeGroupMember('${uid}')" title="Remove">✕</div>
          </div>
        `;
      }

      return `<div class="clean-member-row">
        <div class="avatar" style="width:32px; height:32px; font-size:14px; overflow:hidden; display:flex; align-items:center; justify-content:center; border-radius:50%;">
          ${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover;">` : escapeHtml(displayName[0])}
        </div>
        <div style="flex:1; font-size:14px; font-weight:500;">
          ${escapeHtml(displayName)} 
          ${isTargetAdmin ? '<span style="font-size:10px; color:var(--user-accent-1); margin-left:4px;">(Admin)</span>' : ""}
        </div>
        ${actionButtons}
      </div>`;
    }));

    const { modal, close } = createModal(`
      <h3 style="text-align:center; margin-top:0; margin-bottom:16px; font-size:18px;">Group Info</h3>
      
      <!-- Clickable Group Avatar -->
      <div style="text-align:center; margin-bottom:12px;">
        <div id="group-avatar-click" style="width:72px; height:72px; border-radius:50%; margin:0 auto; overflow:hidden; background:var(--bg-main); position:relative; cursor:${isAdmin ? 'pointer' : 'default'}; display:flex; align-items:center; justify-content:center;">
          ${data.groupPhotoURL 
            ? `<img src="${escapeHtml(data.groupPhotoURL)}" style="width:100%;height:100%;object-fit:cover;">` 
            : `<span style="font-size:28px; font-weight:bold; color:var(--text-muted);">${escapeHtml((data.groupName || "G")[0])}</span>`}
          ${isAdmin ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:20px; opacity:0; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">📷</div>` : ''}
        </div>
      </div>
      
      <!-- Group Name Input -->
      <input id="gi-name" class="clean-group-input" value="${escapeHtml(data.groupName || "")}" placeholder="Group Name" ${isAdmin ? "" : "disabled"}>
      
      <!-- Member List -->
      <h4 style="font-size:12px; color:var(--text-muted); margin:0 0 8px 4px; text-transform:uppercase; letter-spacing:0.5px;">Members (${(data.participants || []).length})</h4>
      <div style="max-height:160px; overflow-y:auto; margin-bottom:16px; padding-right:4px;">
        ${members.join("")}
      </div>
      
      <!-- Action Buttons -->
      <div style="display:flex; flex-direction:column; gap:4px;">
        ${isAdmin ? `<button class="modern-action-btn" data-act="add-member">+ Add Member</button>` : ""}
        ${isAdmin ? `<button class="modern-action-btn" data-act="save">Save Name</button>` : ""}
        <button class="modern-action-btn danger" data-act="leave-group">
          ${creatorId === currentUser.uid ? "Delete Group" : "Leave Group"}
        </button>
        <button class="modern-action-btn" data-act="close" style="margin-top:8px;">Close</button>
      </div>
    `);
    
    modal.classList.add("group-info-modal"); // Apply the new CSS class

    // Handle Group Name Update
    if (isAdmin) {
      modal.querySelector('[data-act="save"]').onclick = async () => {
        const nn = document.getElementById("gi-name").value.trim();
        if (!nn) return showToast("Group name cannot be empty");
        await updateDoc(doc(db, "conversations", currentChatId), { groupName: nn });
        showToast("Group name updated");
        document.getElementById("other-name").textContent = nn;
        close();
      };

      // Handle Group Photo Upload
      modal.querySelector('#group-avatar-click').onclick = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            showToast("Uploading...");
            const url = await uploadToCloudinary(file);
            await updateDoc(doc(db, "conversations", currentChatId), { groupPhotoURL: url });
            showToast("Group photo updated!");
            close();
            openGroupInfoModal(); 
          } catch (err) { showAlert("Error", err.message); }
        };
        fileInput.click();
      };

      // Handle Add Member
      modal.querySelector('[data-act="add-member"]').onclick = () => {
        close();
        window.openAddMemberToGroupModal(currentChatId, data.participants);
      };
    }

    // Handle Leave / Delete Group
    modal.querySelector('[data-act="leave-group"]').onclick = () => {
      close();
      const isCreator = creatorId === currentUser.uid;
      showAlert(
        isCreator ? "Delete Group" : "Leave Group",
        isCreator ? "Delete this group for everyone?" : "Leave this group?",
        true,
        async () => {
          try {
            if (isCreator) {
              await deleteDoc(doc(db, "conversations", currentChatId));
              showToast("Group deleted");
            } else {
              const newParticipants = data.participants.filter(id => id !== currentUser.uid);
              const newAdmins = (data.admins || []).filter(id => id !== currentUser.uid);
              if (newAdmins.length === 0 && newParticipants.length > 0) newAdmins.push(newParticipants[0]);
              
              await updateDoc(doc(db, "conversations", currentChatId), {
                participants: newParticipants,
                admins: newAdmins
              });
              showToast("You left the group");
            }
            document.getElementById("chat-window").classList.remove("active");
            document.querySelector(".app-container").classList.remove("chat-open");
          } catch (err) { showAlert("Error", err.message); }
        }
      );
    };
    
    modal.querySelector('[data-act="close"]').onclick = close;
  });
}

window.removeGroupMember = async (uidToRemove) => {
  showAlert("Remove Member", "Are you sure you want to remove this member?", true, async () => {
    await updateDoc(doc(db, "conversations", currentChatId), {
      participants: arrayRemove(uidToRemove),
      admins: arrayRemove(uidToRemove) // Remove admin status if they had it
    });
    document.querySelector(".modal-overlay")?.remove();
    showToast("Member removed");
    setTimeout(openGroupInfoModal, 500); // Reopen to show updated list
  });
};

window.openAddMemberToGroupModal = (chatId, existingParticipants) => {
  const { modal, close } = createModal(`
    <h3>Add Member</h3>
    <input id="add-member-search" placeholder="Search username...">
    <div id="add-member-list" style="max-height:200px; overflow-y:auto; margin-bottom:12px;"></div>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;

  modal.querySelector("#add-member-search").oninput = debounce(async (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length < 2) return;
    const snap = await getDocs(query(collection(db, "users"), where("username", ">=", term), where("username", "<=", term + "\uf8ff")));
    const list = document.getElementById("add-member-list");
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid && !existingParticipants.includes(d.id)).map(d => {
      const u = d.data();
      return `<div class="user-select-item" onclick="window.addMemberToGroup('${chatId}', '${d.id}')">
        <div class="avatar">${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : escapeHtml((u.displayName||"?")[0])}</div>
        <div style="flex:1; font-weight:600;">${escapeHtml(u.displayName)}</div>
        <div style="color:var(--user-accent-1); font-weight:bold;">+ Add</div>
      </div>`;
    }).join("") || `<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:13px;">No users found</div>`;
  }, 300);
};

window.addMemberToGroup = async (chatId, newUid) => {
  await updateDoc(doc(db, "conversations", chatId), {
    participants: arrayUnion(newUid)
  });
  document.querySelector(".modal-overlay")?.remove();
  showToast("Member added");
  setTimeout(openGroupInfoModal, 500);
};

 function listenForBroadcasts() {
  if (unsubBroadcast) unsubBroadcast();
  unsubBroadcast = onSnapshot(doc(db, "system", "broadcast"), (docSnap) => {
    if (docSnap.exists()) {
      const d = docSnap.data();
      const last = Number(localStorage.getItem("mofie_last_broadcast") || 0);
      if (d.timestamp > last) {
        localStorage.setItem("mofie_last_broadcast", d.timestamp);
        showAlert("Mofie", d.message);
      }
    }
  });
}

async function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const username = (params.get("u") || "").toLowerCase();
  const chatParam = params.get("chat");
  if (!username && !chatParam) return;

  const ready = () => new Promise(resolve => {
    if (currentUser) return resolve(true);
    const t = setInterval(() => { if (currentUser) { clearInterval(t); resolve(true); } }, 300);
    setTimeout(() => { clearInterval(t); resolve(false); }, 15000);
  });
  const ok = await ready();
  if (!ok) return;

  switchView("chats");
  if (chatParam) {
    openChatById(chatParam);
  } else if (username) {
    try {
      const snap = await getDocs(query(collection(db, "users"), where("username", "==", username)));
      if (!snap.empty) {
        const u = snap.docs[0].data();
        window.startDM(snap.docs[0].id, u.displayName, u.photoURL);
      } else {
        showToast(`No user found: @${username}.mofie`);
      }
    } catch (e) { console.warn(e); }
  }
  history.replaceState({}, "", "/");
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    let userData = null;
    for (let i = 0; i < 3; i++) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) { userData = snap.data(); break; }
      } catch (e) { console.warn("retry", i, e.message); }
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
    if (!userData) {
      setTimeout(async () => { await signOut(auth); renderAuth(); }, 1500);
      return;
    }
    currentUser = userData;

    currentView = "chats";
    currentTab = "friends";
    currentChatId = null;
    currentOtherId = null;
    currentConvData = null;
    currentMessages = [];
    userCache.clear();
    knownChatTimestamps.clear();
    activeStatusUsers.clear();
    latestChatsSnap = null;

    startPresence();
    listenForBroadcasts();
    subscribeToStatuses();
    startExpirySweep();
    renderMain();

    // ═══════════════════════════════════════════════════════════
    //  NEW: PUSH NOTIFICATIONS SETUP
    // ═══════════════════════════════════════════════════════════
    const setupPushNotifications = async () => {
      try {
        if (!('Notification' in window)) return;
        
        // This pops up the "Allow Notifications" prompt on the phone
        const permission = await Notification.requestPermission();
        
        if (permission === "granted") {
          const messaging = getMessaging(app);
          
          const currentToken = await getToken(messaging, {
            vapidKey: "BNqwA2JH6f1ipYAbYpxDQiUJ_zI_Yr2EeAVASGMbxX0oOB9YUTd44sIM6cceBW9Ux-dipi3boLqFC_MmABLS2Tk",
            serviceWorkerRegistration: await navigator.serviceWorker.ready
          });

          if (currentToken) {
            // Save the token to Firestore so the backend can find this phone later
            await updateDoc(doc(db, "users", currentUser.uid), {
              fcmTokens: arrayUnion(currentToken)
            });
            console.log("✅ FCM Token saved to database!");
          }
        }
      } catch (error) {
        console.warn("❌ Push setup failed:", error);
      }
    };
    
    setupPushNotifications();

    // Handle notifications if the app is currently open
    try {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        notifyForeground(
          payload.notification?.title || "Mofie", 
          payload.notification?.body || "New message", 
          payload.data?.chatId
        );
      });
    } catch(e) {}
    // ═══════════════════════════════════════════════════════════

    handleDeepLink();
    navigator.serviceWorker?.addEventListener?.("message", e => {
      if (e.data?.type === "OPEN_CHAT") openChatById(e.data.chatId);
    });
  } else {
    currentUser = null;
    clearInterval(presenceInterval);
    clearTimeout(chatListRenderTimer);
    [unsubMessages, unsubChats, unsubConvMeta, unsubBroadcast,
     unsubExplore, unsubStatuses, unsubUsers]
      .forEach(u => { try { u && u(); } catch (_) {} });
    unsubMessages = unsubChats = unsubConvMeta = unsubBroadcast =
      unsubExplore = unsubStatuses = unsubUsers = null;
    latestChatsSnap = null;
    knownChatTimestamps.clear();
    activeStatusUsers.clear();
    userCache.clear();
    renderAuth();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(err =>
    console.warn("SW:", err.message));
}