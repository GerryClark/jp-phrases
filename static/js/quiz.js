let quizQueue = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizMissed = [];
let quizRetryPool = null;   // set by "Retry missed" so startQuiz() uses those phrases

const QUIZ_TYPES = {
  listening: 'Listening Quiz',
  'en-ja': 'English → Japanese',
  reading: 'Reading Quiz',
  sayit: 'Say It'
};

// ── Quiz config view ────────────────────────────────────────────────────────
function renderQuizConfig() {
  const type = App.studyOptions.quizType;
  document.querySelectorAll('input[name="quiz-type"]').forEach(r => { r.checked = r.value === type; });
  const n = getFilteredPhrases().length;
  document.getElementById('quiz-config-count').textContent =
    n === 0 ? 'No phrases match your Study filters.' : `${n} question${n === 1 ? '' : 's'} from your Study filters`;
  document.getElementById('quiz-start-btn').disabled = n === 0;
}

// ── Quiz session ────────────────────────────────────────────────────────────
function startQuiz() {
  const type = App.studyOptions.quizType;
  const phrases = quizRetryPool || getFilteredPhrases();
  quizRetryPool = null;

  if (phrases.length === 0) {
    App.toast('No phrases match your filters.', 'error');
    App.navigate('study');
    return;
  }
  if (type !== 'sayit' && App.phrases.length < 3) {
    App.toast('Need at least 3 phrases for this quiz.', 'error');
    App.navigate('quiz-config');
    return;
  }

  quizQueue = shuffle(phrases);
  quizIndex = 0;
  quizScore = 0;
  quizMissed = [];

  document.getElementById('quiz-title').textContent = QUIZ_TYPES[type];
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-content').classList.remove('hidden');

  renderQuizQuestion(0);
}

function renderQuizQuestion(index) {
  quizAnswered = false;
  const phrase = quizQueue[index];
  const type = App.studyOptions.quizType;
  document.getElementById('quiz-counter').textContent = `${index + 1} / ${quizQueue.length}`;
  document.getElementById('quiz-score-display').textContent = `Score: ${quizScore}`;
  document.getElementById('quiz-next-btn').classList.add('hidden');
  document.getElementById('quiz-options').innerHTML = '';
  document.getElementById('quiz-sayit').classList.toggle('hidden', type !== 'sayit');

  const prompt = document.getElementById('quiz-prompt');
  prompt.innerHTML = '';

  if (type === 'listening') {
    prompt.appendChild(audioButton('🔊 Play Japanese Audio', phrase.audio_ja, 'btn-primary'));
    renderChoices(phrase, p => p.english);
  } else if (type === 'en-ja') {
    prompt.appendChild(promptText(phrase.english, 'quiz-prompt-english'));
    prompt.appendChild(audioButton('🔊 English', phrase.audio_en, 'btn-secondary'));
    renderChoices(phrase, p => p.romaji, p => p.kana);
  } else if (type === 'reading') {
    prompt.appendChild(promptText(phrase.kana || phrase.romaji, 'quiz-prompt-kana'));
    if (phrase.kana) prompt.appendChild(promptText(phrase.romaji, 'quiz-prompt-romaji'));
    renderChoices(phrase, p => p.english);
  } else {
    prompt.appendChild(promptText(phrase.english, 'quiz-prompt-english'));
    prompt.appendChild(promptText('Say it out loud in Japanese, then reveal.', 'quiz-prompt-hint'));
    document.getElementById('quiz-sayit-romaji').textContent = phrase.romaji;
    document.getElementById('quiz-sayit-kana').textContent = phrase.kana;
    document.getElementById('quiz-sayit-answer').classList.add('hidden');
    document.getElementById('quiz-sayit-grade').classList.add('hidden');
    document.getElementById('quiz-reveal-btn').classList.remove('hidden');
  }
}

function promptText(text, cls) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  return div;
}

function audioButton(label, url, cls) {
  const btn = document.createElement('button');
  btn.className = `btn ${cls}`;
  btn.textContent = label;
  btn.addEventListener('click', () => playAudio(url));
  return btn;
}

// Multiple choice: the correct phrase plus 2 others whose label differs from it.
function renderChoices(phrase, labelFn, subFn) {
  const label = labelFn(phrase);
  const seen = new Set([label]);
  const wrongs = [];
  for (const p of shuffle(App.phrases)) {
    if (wrongs.length === 2) break;
    if (p.id === phrase.id || seen.has(labelFn(p))) continue;
    seen.add(labelFn(p));
    wrongs.push(p);
  }

  const container = document.getElementById('quiz-options');
  shuffle([phrase, ...wrongs]).forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.dataset.id = opt.id;
    btn.textContent = labelFn(opt);
    if (subFn && subFn(opt)) {
      const sub = document.createElement('span');
      sub.className = 'quiz-option-sub';
      sub.textContent = subFn(opt);
      btn.appendChild(sub);
    }
    btn.addEventListener('click', () => handleQuizAnswer(btn, phrase, container));
    container.appendChild(btn);
  });
}

function handleQuizAnswer(btn, phrase, container) {
  if (quizAnswered) return;
  quizAnswered = true;

  if (btn.dataset.id === phrase.id) {
    btn.classList.add('correct');
    quizScore++;
    document.getElementById('quiz-score-display').textContent = `Score: ${quizScore}`;
  } else {
    btn.classList.add('wrong');
    container.querySelector(`[data-id="${phrase.id}"]`).classList.add('correct');
    quizMissed.push(phrase);
  }
  container.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);

  // Reinforce: hear the Japanese once the answer is shown (listening already played it)
  if (App.studyOptions.quizType !== 'listening') playAudio(phrase.audio_ja);
  document.getElementById('quiz-next-btn').classList.remove('hidden');
}

function nextQuizQuestion() {
  quizIndex++;
  if (quizIndex >= quizQueue.length) {
    showQuizResults();
  } else {
    renderQuizQuestion(quizIndex);
  }
}

function gradeSayIt(gotIt) {
  if (quizAnswered) return;
  quizAnswered = true;
  if (gotIt) quizScore++;
  else quizMissed.push(quizQueue[quizIndex]);
  nextQuizQuestion();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name="quiz-type"]').forEach(r => {
    r.addEventListener('change', () => {
      App.studyOptions.quizType = r.value;
      App.saveStudyOptions();
    });
  });

  document.getElementById('quiz-start-btn')?.addEventListener('click', () => App.navigate('quiz'));
  document.getElementById('quiz-next-btn')?.addEventListener('click', nextQuizQuestion);

  document.getElementById('quiz-reveal-btn')?.addEventListener('click', () => {
    document.getElementById('quiz-sayit-answer').classList.remove('hidden');
    document.getElementById('quiz-sayit-grade').classList.remove('hidden');
    document.getElementById('quiz-reveal-btn').classList.add('hidden');
    playAudio(quizQueue[quizIndex].audio_ja);
  });
  document.getElementById('quiz-sayit-replay')?.addEventListener('click', () => {
    playAudio(quizQueue[quizIndex].audio_ja);
  });
  document.getElementById('quiz-gotit-btn')?.addEventListener('click', () => gradeSayIt(true));
  document.getElementById('quiz-missed-btn')?.addEventListener('click', () => gradeSayIt(false));

  document.getElementById('quiz-retry-btn')?.addEventListener('click', () => {
    quizRetryPool = quizMissed;
    startQuiz();
  });

  document.getElementById('quiz-play-again-btn')?.addEventListener('click', () => {
    startQuiz();
  });

  document.getElementById('quiz-back-btn')?.addEventListener('click', () => {
    App.navigate('study');
  });
});

function showQuizResults() {
  document.getElementById('quiz-content').classList.add('hidden');
  const result = document.getElementById('quiz-result');
  result.classList.remove('hidden');
  const pct = Math.round((quizScore / quizQueue.length) * 100);
  document.getElementById('quiz-final-score').textContent =
    `You got ${quizScore} out of ${quizQueue.length} (${pct}%)`;
  document.getElementById('quiz-result-msg').textContent =
    pct === 100 ? 'Perfect! 🎉' :
    pct >= 70 ? 'Great work! Keep practicing.' :
    'Keep going — you\'ll get there!';

  const list = document.getElementById('quiz-missed-list');
  list.innerHTML = '';
  quizMissed.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="missed-en"></span><span class="missed-ja"></span>`;
    li.querySelector('.missed-en').textContent = p.english;
    li.querySelector('.missed-ja').textContent = p.romaji;
    li.addEventListener('click', () => playAudio(p.audio_ja));
    list.appendChild(li);
  });
  document.getElementById('quiz-missed-wrap').classList.toggle('hidden', quizMissed.length === 0);
  const retry = document.getElementById('quiz-retry-btn');
  retry.classList.toggle('hidden', quizMissed.length === 0);
  retry.textContent = `Retry missed (${quizMissed.length})`;
}
