let currentEditId = null;
let phrasesFilterCategory = 'all';

function renderHome() {
  const summary = Progress.getSummary(App.phrases);
  const categories = [...new Set(App.phrases.map(p => p.category))];

  document.getElementById('home-total').textContent = summary.total;
  document.getElementById('home-got-it').textContent = summary.got;
  document.getElementById('home-learning').textContent = summary.learning;

  const catList = document.getElementById('home-categories');
  catList.innerHTML = '';
  categories.forEach(cat => {
    const count = App.phrases.filter(p => p.category === cat).length;
    const li = document.createElement('div');
    li.className = 'category-chip';
    li.textContent = `${cat} (${count})`;
    catList.appendChild(li);
  });

}

async function toggleConnectPhone() {
  const card = document.getElementById('connect-card');
  const btn = document.getElementById('connect-phone-btn');
  const isOpen = !card.classList.contains('hidden');

  if (isOpen) {
    card.classList.add('hidden');
    btn.textContent = '📱 Connect Phone';
    return;
  }

  card.classList.remove('hidden');
  btn.textContent = '📱 Hide';

  // Always fetch fresh — IP may have changed since last open
  const qrDiv = document.getElementById('qr-code');
  const qrUrl = document.getElementById('qr-url');
  const qrLoading = document.getElementById('qr-loading');

  qrDiv.innerHTML = '';
  qrUrl.textContent = '';
  qrLoading.textContent = 'Detecting IP address…';
  qrLoading.classList.remove('hidden');

  try {
    const info = await App.api.get('/api/server-info');
    qrLoading.classList.add('hidden');
    new QRCode(qrDiv, {
      text: info.url,
      width: 160,
      height: 160,
      colorDark: '#2c3e50',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    qrUrl.textContent = info.url;
  } catch (e) {
    qrLoading.textContent = 'Could not detect IP address.';
  }
}

function renderPhrases() {
  const phrases = App.phrases;
  const categories = ['all', ...new Set(phrases.map(p => p.category))];

  const filterEl = document.getElementById('phrases-filter');
  const currentVal = filterEl.value || phrasesFilterCategory;
  filterEl.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat === 'all' ? 'All Categories' : cat;
    if (cat === currentVal) opt.selected = true;
    filterEl.appendChild(opt);
  });
  phrasesFilterCategory = filterEl.value;

  const filtered = phrasesFilterCategory === 'all'
    ? phrases
    : phrases.filter(p => p.category === phrasesFilterCategory);

  const list = document.getElementById('phrase-list');
  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-msg">No phrases found.</p>';
    return;
  }

  filtered.forEach(phrase => {
    const status = Progress.getStatus(phrase.id);
    const card = document.createElement('div');
    card.className = 'phrase-card';
    card.innerHTML = `
      <div class="phrase-card-header">
        <span class="confidence-dot dot-${status}" title="${status}"></span>
        <span class="phrase-category-chip">${phrase.category}</span>
        <div class="phrase-actions server-only">
          <button class="btn-icon" onclick="openPhraseModal('${phrase.id}')" title="Edit">✏️</button>
          <button class="btn-icon btn-danger" onclick="deletePhrase('${phrase.id}')" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="phrase-english">${phrase.english}</div>
      <div class="phrase-romaji">${phrase.romaji}</div>
      <div class="phrase-kana">${phrase.kana}</div>
    `;
    list.appendChild(card);
  });
}

function openPhraseModal(phraseId) {
  currentEditId = phraseId || null;
  const title = document.getElementById('modal-title');

  if (phraseId) {
    const phrase = App.phrases.find(p => p.id === phraseId);
    if (!phrase) return;
    title.textContent = 'Edit Phrase';
    document.getElementById('modal-english').value = phrase.english;
    document.getElementById('modal-romaji').value = phrase.romaji;
    document.getElementById('modal-kana').value = phrase.kana;
    document.getElementById('modal-category').value = phrase.category;
  } else {
    title.textContent = 'Add Phrase';
    document.getElementById('modal-english').value = '';
    document.getElementById('modal-romaji').value = '';
    document.getElementById('modal-kana').value = '';
    document.getElementById('modal-category').value = 'Basics';
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closePhraseModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  currentEditId = null;
}

async function savePhrase() {
  const english = document.getElementById('modal-english').value.trim();
  const romaji = document.getElementById('modal-romaji').value.trim();
  const kana = document.getElementById('modal-kana').value.trim();
  const category = document.getElementById('modal-category').value.trim() || 'Basics';

  if (!english || !romaji) {
    App.toast('English and Romaji are required.', 'error');
    return;
  }

  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    let phrase;
    if (currentEditId) {
      phrase = await App.api.put(`/api/phrases/${currentEditId}`, { english, romaji, kana, category });
      App.phrases = App.phrases.map(p => p.id === currentEditId ? phrase : p);
      App.toast('Phrase updated.');
    } else {
      phrase = await App.api.post('/api/phrases', { english, romaji, kana, category });
      App.phrases.push(phrase);
      navigator.serviceWorker?.controller?.postMessage({
        type: 'CACHE_AUDIO',
        urls: [phrase.audio_ja, phrase.audio_ja_slow, phrase.audio_en]
      });
      App.toast('Phrase added.');
    }
    closePhraseModal();
    renderPhrases();
  } catch (e) {
    App.toast('Error saving phrase.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function deletePhrase(phraseId) {
  const phrase = App.phrases.find(p => p.id === phraseId);
  if (!phrase) return;
  if (!confirm(`Delete "${phrase.english}"?`)) return;

  try {
    await App.api.delete(`/api/phrases/${phraseId}`);
    App.phrases = App.phrases.filter(p => p.id !== phraseId);
    Progress.reset(phraseId);
    App.toast('Phrase deleted.');
    renderPhrases();
  } catch (e) {
    App.toast('Error deleting phrase.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('phrases-filter')?.addEventListener('change', e => {
    phrasesFilterCategory = e.target.value;
    renderPhrases();
  });

  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closePhraseModal();
  });

  document.getElementById('import-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'import-modal-overlay') closeImportModal();
  });

  document.getElementById('reset-progress-btn')?.addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      Progress.resetAll();
      App.toast('Progress reset.');
      renderHome();
    }
  });
});

// ── Bulk import ─────────────────────────────────────────────────────────────

let importParsed = [];

function openImportModal() {
  document.getElementById('import-modal-overlay').classList.remove('hidden');
  showImportPaste();
}

function closeImportModal() {
  document.getElementById('import-modal-overlay').classList.add('hidden');
  document.getElementById('import-textarea').value = '';
  importParsed = [];
}

function showImportPaste() {
  document.getElementById('import-step-paste').classList.remove('hidden');
  document.getElementById('import-step-preview').classList.add('hidden');
  document.getElementById('import-step-progress').classList.add('hidden');
}

function parseImportData(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const sep = lines[0].includes('\t') ? '\t' : ',';

  function splitLine(line) {
    if (sep === '\t') return line.split('\t').map(c => c.trim());
    // Simple CSV split (handles quoted fields)
    const cols = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuote = !inQuote; }
      else if (line[i] === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else cur += line[i];
    }
    cols.push(cur.trim());
    return cols;
  }

  const ALIASES = {
    english: ['english'],
    romaji: ['romaji'],
    kana: ['kana', 'japanese', 'hiragana', 'katakana'],
    category: ['category', 'situation', 'topic']
  };

  function detectCol(header) {
    const h = header.toLowerCase().replace(/[^a-z]/g, '');
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.some(a => h.includes(a))) return field;
    }
    return null;
  }

  const firstCols = splitLine(lines[0]);
  const hasHeader = firstCols.some(c => detectCol(c) !== null);

  let colMap = {};
  let dataLines = lines;

  if (hasHeader) {
    firstCols.forEach((h, i) => {
      const field = detectCol(h);
      if (field && !(field in colMap)) colMap[field] = i;
    });
    dataLines = lines.slice(1);
  } else {
    // Assume order: English, Romaji, Kana, Category
    colMap = { english: 0, romaji: 1, kana: 2, category: 3 };
  }

  const existingEnglish = new Set(App.phrases.map(p => p.english.trim().toLowerCase()));

  return dataLines.map(line => {
    const cols = splitLine(line);
    const english = (cols[colMap.english] || '').trim();
    const romaji = (cols[colMap.romaji] || '').trim();
    const kana = (cols[colMap.kana] || '').trim();
    const category = (cols[colMap.category] || 'Basics').trim() || 'Basics';
    const isDuplicate = existingEnglish.has(english.toLowerCase());
    return { english, romaji, kana, category, isDuplicate };
  }).filter(r => r.english);
}

function previewImport() {
  const text = document.getElementById('import-textarea').value;
  importParsed = parseImportData(text);

  if (!importParsed.length) {
    App.toast('No valid rows found. Check your data format.', 'error');
    return;
  }

  const newRows = importParsed.filter(r => !r.isDuplicate);
  const dupRows = importParsed.filter(r => r.isDuplicate);

  document.getElementById('import-summary').innerHTML =
    `<strong>${newRows.length}</strong> new phrase${newRows.length !== 1 ? 's' : ''} to import &nbsp;·&nbsp; ` +
    `<span class="dup-count">${dupRows.length} duplicate${dupRows.length !== 1 ? 's' : ''} skipped</span>`;

  const btn = document.getElementById('import-confirm-btn');
  btn.textContent = `Import ${newRows.length} phrase${newRows.length !== 1 ? 's' : ''}`;
  btn.disabled = newRows.length === 0;

  const rows = importParsed.map(r => `
    <tr class="${r.isDuplicate ? 'dup-row' : ''}">
      <td>${r.isDuplicate ? '<span class="badge-dup">skip</span>' : '<span class="badge-new">new</span>'}</td>
      <td>${r.english}</td>
      <td>${r.romaji}</td>
      <td>${r.kana}</td>
      <td>${r.category}</td>
    </tr>`).join('');

  document.getElementById('import-preview-table-wrap').innerHTML = `
    <div class="import-table-scroll">
      <table class="import-preview-table">
        <thead><tr><th></th><th>English</th><th>Romaji</th><th>Kana</th><th>Category</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.getElementById('import-step-paste').classList.add('hidden');
  document.getElementById('import-step-preview').classList.remove('hidden');
}

async function runImport() {
  const newPhrases = importParsed.filter(r => !r.isDuplicate);
  if (!newPhrases.length) return;

  document.getElementById('import-step-preview').classList.add('hidden');
  document.getElementById('import-step-progress').classList.remove('hidden');
  document.getElementById('import-progress-text').textContent =
    `Generating audio for ${newPhrases.length} phrase${newPhrases.length !== 1 ? 's' : ''}… this may take a moment.`;

  try {
    const result = await App.api.post('/api/import', { phrases: newPhrases });
    const count = result.imported?.length || 0;

    result.imported?.forEach(p => {
      App.phrases.push(p);
      navigator.serviceWorker?.controller?.postMessage({
        type: 'CACHE_AUDIO',
        urls: [p.audio_ja, p.audio_ja_slow, p.audio_en]
      });
    });

    closeImportModal();
    renderPhrases();
    App.toast(`Imported ${count} phrase${count !== 1 ? 's' : ''}.`);
  } catch (e) {
    App.toast('Import failed. Check that the server is running.', 'error');
    showImportPaste();
  }
}
