const App = {
  phrases: [],
  studyOptions: { category: 'all', shuffle: false },

  async init() {
    await this.loadPhrases();
    this.setupRouter();
    const initialView = location.hash.slice(1) || 'home';
    this.navigate(initialView);
    this.cacheAllAudio();
  },

  async loadPhrases() {
    try {
      const res = await fetch(window.STATIC_BUILD ? 'phrases.json' : '/api/phrases');
      this.phrases = await res.json();
    } catch (e) {
      this.toast('Could not load phrases. Are you offline?', 'error');
      this.phrases = [];
    }
  },

  // Ask the service worker to download every audio file so study works offline.
  async cacheAllAudio() {
    const status = document.getElementById('offline-status');
    const show = (text, cls = '') => {
      status.textContent = text;
      status.className = `offline-status ${cls}`;
    };

    if (!('serviceWorker' in navigator)) {
      show('⚠ Offline mode needs HTTPS — use the published phone link.', 'warn');
      return;
    }
    if (this.phrases.length === 0) return;

    const urls = this.phrases.flatMap(p => [p.audio_ja, p.audio_ja_slow, p.audio_en]);
    show('Downloading audio for offline use…');

    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type !== 'CACHE_AUDIO_DONE') return;
      if (event.data.failed === 0) show('✓ Available offline', 'ready');
      else show(`⚠ ${event.data.failed} audio file(s) not downloaded — open again while online.`, 'warn');
    });

    const reg = await navigator.serviceWorker.ready;
    reg.active.postMessage({ type: 'CACHE_AUDIO', urls });
  },

  navigate(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const el = document.getElementById(`view-${view}`);
    if (el) el.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navMap = {
      home: 'home',
      phrases: 'phrases',
      study: 'study',
      flashcard: 'study',
      'autoplay-config': 'study',
      autoplay: 'study',
      quiz: 'study'
    };
    const navTarget = document.getElementById(`nav-${navMap[view]}`);
    if (navTarget) navTarget.classList.add('active');

    if (location.hash.slice(1) !== view) {
      history.pushState(null, '', `#${view}`);
    }

    if (view === 'home') renderHome();
    if (view === 'phrases') renderPhrases();
    if (view === 'study') renderStudy();
    if (view === 'flashcard') startFlashcard();
    if (view === 'autoplay-config') renderAutoplayConfig();
    if (view === 'autoplay') startAutoplay();
    if (view === 'quiz') startQuiz();
  },

  setupRouter() {
    window.addEventListener('popstate', () => {
      this.navigate(location.hash.slice(1) || 'home');
    });
  },

  toast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  api: {
    async get(url) {
      const res = await fetch(url);
      return res.json();
    },
    async post(url, data) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    async put(url, data) {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    async delete(url) {
      const res = await fetch(url, { method: 'DELETE' });
      return res.json();
    }
  }
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function playAudio(url, rate = 1.0) {
  return new Promise(resolve => {
    const audio = new Audio(url);
    audio.playbackRate = rate;
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
}

document.addEventListener('DOMContentLoaded', () => App.init());
