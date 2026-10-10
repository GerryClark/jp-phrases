let quizQueue = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

function startQuiz() {
  const phrases = App.studyOptions.category === 'all'
    ? App.phrases
    : App.phrases.filter(p => p.category === App.studyOptions.category);

  if (phrases.length < 3) {
    document.getElementById('quiz-content').innerHTML =
      '<p class="empty-msg">Need at least 3 phrases to run a quiz.</p>';
    return;
  }

  quizQueue = shuffle(phrases);
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;

  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-content').classList.remove('hidden');

  renderQuizQuestion(0);
}

function renderQuizQuestion(index) {
  quizAnswered = false;
  const phrase = quizQueue[index];
  document.getElementById('quiz-counter').textContent = `${index + 1} / ${quizQueue.length}`;
  document.getElementById('quiz-score-display').textContent = `Score: ${quizScore}`;

  document.getElementById('quiz-play-btn').onclick = () => playAudio(phrase.audio_ja);

  const others = App.phrases.filter(p => p.id !== phrase.id);
  const wrongs = shuffle(others).slice(0, 2);
  const options = shuffle([phrase, ...wrongs]);

  const container = document.getElementById('quiz-options');
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.textContent = opt.english;
    btn.addEventListener('click', () => handleQuizAnswer(btn, opt.id === phrase.id, phrase.id, container));
    container.appendChild(btn);
  });

  document.getElementById('quiz-next-btn').classList.add('hidden');
}

function handleQuizAnswer(btn, isCorrect, correctId, container) {
  if (quizAnswered) return;
  quizAnswered = true;

  if (isCorrect) {
    btn.classList.add('correct');
    quizScore++;
    document.getElementById('quiz-score-display').textContent = `Score: ${quizScore}`;
  } else {
    btn.classList.add('wrong');
    container.querySelectorAll('.quiz-option-btn').forEach(b => {
      const phrase = quizQueue[quizIndex];
      if (b.textContent === phrase.english) b.classList.add('correct');
    });
  }

  container.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);
  document.getElementById('quiz-next-btn').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('quiz-next-btn')?.addEventListener('click', () => {
    quizIndex++;
    if (quizIndex >= quizQueue.length) {
      showQuizResults();
    } else {
      renderQuizQuestion(quizIndex);
    }
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
}
