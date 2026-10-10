// ── Shared study state ──────────────────────────────────────────────────────
let studyQueue = [];
let studyIndex = 0;
let slowMode = false;

function getFilteredPhrases() {
  const cat = App.studyOptions.category;
  let phrases = cat === 'all' ? App.phrases : App.phrases.filter(p => p.category === cat);
  if (App.studyOptions.shuffle) phrases = shuffle(phrases);
  return phrases;
}

function buildAutoplayQueue(phrases) {
  const queue = [];
  phrases.forEach(p => {
    queue.push(p);
    if (Progress.getStatus(p.id) === 'learning') queue.push(p);
  });
  return queue;
}

// ── Study selector view ─────────────────────────────────────────────────────
function renderStudy() {
  const categories = ['all', ...new Set(App.phrases.map(p => p.category))];
  const catSelect = document.getElementById('study-category');
  catSelect.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat === 'all' ? 'All Categories' : cat;
    if (cat === App.studyOptions.category) opt.selected = true;
    catSelect.appendChild(opt);
  });
  document.getElementById('study-shuffle').checked = App.studyOptions.shuffle;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('study-category')?.addEventListener('change', e => {
    App.studyOptions.category = e.target.value;
  });
  document.getElementById('study-shuffle')?.addEventListener('change', e => {
    App.studyOptions.shuffle = e.target.checked;
  });
});

// ── Flashcard mode ──────────────────────────────────────────────────────────
function startFlashcard() {
  studyQueue = getFilteredPhrases();
  studyIndex = 0;
  slowMode = false;

  if (studyQueue.length === 0) {
    document.getElementById('flashcard-content').innerHTML = '<p class="empty-msg">No phrases in this category.</p>';
    return;
  }

  document.getElementById('fc-slow-toggle').checked = false;
  renderFlashcard(0);
}

function renderFlashcard(index) {
  const phrase = studyQueue[index];
  if (!phrase) return;

  document.getElementById('fc-english').textContent = phrase.english;
  document.getElementById('fc-romaji').textContent = phrase.romaji;
  document.getElementById('fc-kana').textContent = phrase.kana;
  document.getElementById('fc-counter').textContent = `${index + 1} / ${studyQueue.length}`;

  const status = Progress.getStatus(phrase.id);
  document.getElementById('fc-got-it').classList.toggle('active', status === 'got_it');
  document.getElementById('fc-learning').classList.toggle('active', status === 'learning');

  document.getElementById('fc-prev').disabled = index === 0;
  document.getElementById('fc-next').disabled = index === studyQueue.length - 1;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fc-play')?.addEventListener('click', () => {
    const phrase = studyQueue[studyIndex];
    if (!phrase) return;
    playAudio(phrase.audio_ja, slowMode ? 0.7 : 1.0);
  });

  document.getElementById('fc-slow-toggle')?.addEventListener('change', e => {
    slowMode = e.target.checked;
  });

  document.getElementById('fc-got-it')?.addEventListener('click', () => {
    const phrase = studyQueue[studyIndex];
    if (!phrase) return;
    Progress.rate(phrase.id, 'got_it');
    renderFlashcard(studyIndex);
    App.toast('Marked as Got it!');
  });

  document.getElementById('fc-learning')?.addEventListener('click', () => {
    const phrase = studyQueue[studyIndex];
    if (!phrase) return;
    Progress.rate(phrase.id, 'learning');
    renderFlashcard(studyIndex);
    App.toast('Marked as Still learning.');
  });

  document.getElementById('fc-prev')?.addEventListener('click', () => {
    if (studyIndex > 0) {
      studyIndex--;
      renderFlashcard(studyIndex);
    }
  });

  document.getElementById('fc-next')?.addEventListener('click', () => {
    if (studyIndex < studyQueue.length - 1) {
      studyIndex++;
      renderFlashcard(studyIndex);
    }
  });
});

// ── Auto-play config view ───────────────────────────────────────────────────
function updateApConfigLabels() {
  const mode = document.querySelector('input[name="ap-mode"]:checked')?.value || 'ja-first';
  const isEnFirst = mode === 'en-first';
  document.getElementById('ap-pause-title').textContent = isEnFirst ? 'Think time' : 'Repeat pause';
  document.getElementById('ap-pause-hint').textContent = isEnFirst
    ? 'Time to say the Japanese phrase before hearing the answer'
    : 'Time to repeat the phrase before moving on';
  document.getElementById('ap-english-row').style.display = isEnFirst ? 'none' : '';
}

function renderAutoplayConfig() {
  const slider = document.getElementById('ap-pause-slider');
  const label = document.getElementById('ap-pause-label');
  if (slider) {
    label.textContent = `${slider.value}s`;
    slider.addEventListener('input', () => {
      label.textContent = `${slider.value}s`;
    });
  }
  updateApConfigLabels();
  document.querySelectorAll('input[name="ap-mode"]').forEach(r => {
    r.addEventListener('change', updateApConfigLabels);
  });
}

// ── Auto-play mode ──────────────────────────────────────────────────────────
let apPaused = false;
let apStopped = false;
let apJump = false;          // true when Back/Replay sets a new target index
let apCurrentPhrase = null;
let apCurrentIndex = 0;
let apQueue = [];
let apAudioResolve = null;   // resolves the current audio promise early (set while a clip is in progress)
let apGapTimer = null;       // setTimeout id for the between-phrase gap
let apGapResolve = null;     // resolves the current gap promise early
let apResumeResolve = null;  // resolves the pause-wait promise

function getApAudio() { return document.getElementById('ap-audio'); }

// Unlock the shared audio element within a user gesture so iOS allows
// subsequent plays outside gesture context on the same element.
function unlockApAudio() {
  const a = getApAudio();
  a.play().catch(() => {});
  a.pause();
}

function playApAudio(url, rate = 1.0) {
  return new Promise(resolve => {
    const audio = getApAudio();
    audio.src = url;
    audio.playbackRate = rate;
    audio.load();
    const done = () => {
      if (apAudioResolve !== done) return;
      apAudioResolve = null;
      resolve();
    };
    apAudioResolve = done;
    audio.onended = done;
    audio.onerror = done;
    // A rejected play() caused by Pause is not the end of the clip — Resume restarts it
    audio.play().catch(() => { if (!apPaused) done(); });
  });
}

function waitGap(ms) {
  return new Promise(resolve => {
    apGapResolve = resolve;
    apGapTimer = setTimeout(() => {
      apGapTimer = null;
      apGapResolve = null;
      resolve();
    }, ms);
  });
}

// Cancel whatever is currently happening (audio or gap) so the loop can act.
function interruptCurrent() {
  getApAudio().pause();
  if (apAudioResolve) apAudioResolve();
  if (apGapTimer) { clearTimeout(apGapTimer); apGapTimer = null; }
  if (apGapResolve) { apGapResolve(); apGapResolve = null; }
}

function waitForResume() {
  return new Promise(resolve => { apResumeResolve = resolve; });
}

function startAutoplay() {
  const pauseSeconds = parseInt(document.getElementById('ap-pause-slider')?.value || 5);
  const mode = document.querySelector('input[name="ap-mode"]:checked')?.value || 'ja-first';
  const playEnglish = mode === 'ja-first' && (document.getElementById('ap-english-toggle')?.checked || false);

  const phrases = getFilteredPhrases();
  if (phrases.length === 0) {
    App.toast('No phrases in this category.', 'error');
    App.navigate('autoplay-config');
    return;
  }

  apQueue = buildAutoplayQueue(phrases);
  apPaused = false;
  apStopped = false;
  apJump = false;
  apCurrentIndex = 0;

  document.getElementById('ap-progress-bar').style.width = '0%';
  document.getElementById('ap-counter').textContent = `1 / ${apQueue.length}`;
  document.getElementById('ap-pause-btn').textContent = 'Pause';

  runAutoplay(apQueue, pauseSeconds, mode, playEnglish);
}

async function runAutoplay(queue, pauseSeconds, mode, playEnglish) {
  // ok() — returns false if we should exit the current phrase early
  const ok = () => !apStopped && !apJump;

  while (apCurrentIndex < queue.length) {
    if (apStopped) break;

    // Wait here if paused between phrases
    if (apPaused) { await waitForResume(); if (apStopped) break; }

    apJump = false;
    const phrase = queue[apCurrentIndex];
    apCurrentPhrase = phrase;
    document.getElementById('ap-counter').textContent = `${apCurrentIndex + 1} / ${queue.length}`;
    document.getElementById('ap-progress-bar').style.width = `${((apCurrentIndex + 1) / queue.length) * 100}%`;

    if (mode === 'en-first') {
      document.getElementById('ap-english').textContent = phrase.english;
      document.getElementById('ap-romaji').textContent = '';
      document.getElementById('ap-kana').textContent = '';

      await playApAudio(phrase.audio_en);
      if (!ok()) continue;
      if (apPaused) { await waitForResume(); if (!ok()) continue; }

      await waitGap(pauseSeconds * 1000);
      if (!ok()) continue;
      if (apPaused) { await waitForResume(); if (!ok()) continue; }

      document.getElementById('ap-romaji').textContent = phrase.romaji;
      document.getElementById('ap-kana').textContent = phrase.kana;
      await playApAudio(phrase.audio_ja);
      if (!ok()) continue;

      await waitGap(1000);
      if (!ok()) continue;

    } else {
      document.getElementById('ap-english').textContent = phrase.english;
      document.getElementById('ap-romaji').textContent = phrase.romaji;
      document.getElementById('ap-kana').textContent = phrase.kana;

      await playApAudio(phrase.audio_ja);
      if (!ok()) continue;
      if (apPaused) { await waitForResume(); if (!ok()) continue; }

      await waitGap(pauseSeconds * 1000);
      if (!ok()) continue;
      if (apPaused) { await waitForResume(); if (!ok()) continue; }

      if (playEnglish) {
        await playApAudio(phrase.audio_en);
        if (!ok()) continue;
        await waitGap(1000);
        if (!ok()) continue;
      }
    }

    // Phrase completed normally — advance
    apCurrentIndex++;
  }

  if (!apStopped) App.toast('Session complete!');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ap-pause-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('ap-pause-btn');
    if (!apPaused) {
      // PAUSE — hold audio where it is (Resume continues it); cut a gap short
      apPaused = true;
      btn.textContent = 'Resume';
      if (apAudioResolve) {
        getApAudio().pause();
      } else {
        interruptCurrent();
      }
    } else {
      // RESUME — this IS a user gesture, so iOS allows audio.play() here
      apPaused = false;
      btn.textContent = 'Pause';
      if (apAudioResolve) {
        const done = apAudioResolve;
        getApAudio().play().catch(done);   // if iOS refuses, move on rather than hang
      }
      if (apResumeResolve) { apResumeResolve(); apResumeResolve = null; }
    }
  });

  document.getElementById('ap-back-btn')?.addEventListener('click', () => {
    // Move to previous phrase (minimum index 0)
    apCurrentIndex = Math.max(0, apCurrentIndex - 1);
    apJump = true;
    interruptCurrent();
    // If paused, unpause so the loop can continue to the target phrase
    if (apPaused) {
      apPaused = false;
      document.getElementById('ap-pause-btn').textContent = 'Pause';
      if (apResumeResolve) { apResumeResolve(); apResumeResolve = null; }
    }
  });

  document.getElementById('ap-stop-btn')?.addEventListener('click', () => {
    apStopped = true;
    interruptCurrent();
    if (apResumeResolve) { apResumeResolve(); apResumeResolve = null; }
    App.navigate('study');
  });

  document.getElementById('ap-start-btn')?.addEventListener('click', () => {
    unlockApAudio();
    App.navigate('autoplay');
  });
});
