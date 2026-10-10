const Progress = {
  get(phraseId) {
    const data = localStorage.getItem(`progress_${phraseId}`);
    return data ? JSON.parse(data) : { got_it: 0, learning: 0, last_reviewed: null };
  },

  rate(phraseId, outcome) {
    const p = this.get(phraseId);
    p[outcome]++;
    p.last_reviewed = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`progress_${phraseId}`, JSON.stringify(p));
  },

  getStatus(phraseId) {
    const p = this.get(phraseId);
    if (p.got_it === 0 && p.learning === 0) return 'unrated';
    return p.got_it >= p.learning ? 'got_it' : 'learning';
  },

  reset(phraseId) {
    localStorage.removeItem(`progress_${phraseId}`);
  },

  resetAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('progress_'))
      .forEach(k => localStorage.removeItem(k));
  },

  getSummary(phrases) {
    const got = phrases.filter(p => this.getStatus(p.id) === 'got_it').length;
    const learning = phrases.filter(p => this.getStatus(p.id) === 'learning').length;
    return { got, learning, unrated: phrases.length - got - learning, total: phrases.length };
  }
};
