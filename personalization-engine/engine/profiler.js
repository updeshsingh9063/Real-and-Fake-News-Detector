// engine/profiler.js — User Profiling & Segmentation
class UserProfiler {
  constructor() {
    this.profile = this._load();
    this._newSession();
    this._syncBackend();
  }

  async _syncBackend() {
    try {
      await fetch(`http://localhost:5000/user?id=${this.profile.id}`);
    } catch(e) {
      console.warn("Backend sync failed:", e);
    }
  }

  _default() {
    return {
      id: `u_${Math.random().toString(36).substr(2,12)}`,
      sessionCount: 0,
      segment: 'new',
      interests: { tech:0, sports:0, entertainment:0, health:0, finance:0 },
      context: {
        hour: new Date().getHours(),
        device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      prefs: { layout:'grid', density:'comfortable', theme:'dark' },
      abVariant: null,
      totalClicks: 0,
      createdAt: Date.now(),
      lastSeen: 0,
    };
  }

  _load() {
    try {
      const p = JSON.parse(localStorage.getItem('pe_profile') || 'null');
      if (p) { p.context.hour = new Date().getHours(); return p; }
    } catch {}
    return this._default();
  }

  _save() { localStorage.setItem('pe_profile', JSON.stringify(this.profile)); }

  _newSession() {
    const gap = Date.now() - this.profile.lastSeen;
    if (gap > 30 * 60 * 1000 || this.profile.sessionCount === 0) {
      this.profile.sessionCount++;
      this.profile.lastSeen = Date.now();
      this.profile.segment = this._segment();
      this._save();
    }
  }

  _segment() {
    const n = this.profile.sessionCount;
    if (n <= 1)  return 'new';
    if (n <= 4)  return 'returning';
    if (n <= 9)  return 'engaged';
    return 'power';
  }

  record(type, data = {}) {
    const { category } = data;
    const boosts = { content_click:0.15, hover:0.05, rec_click:0.12 };
    const boost = boosts[type] || 0;
    if (boost && category && category in this.profile.interests) {
      this.profile.interests[category] = Math.min(1, this.profile.interests[category] + boost);
      if (type === 'content_click') this.profile.totalClicks++;
      this._decay();
    }
    this.profile.segment = this._segment();
    this._save();
  }

  _decay() {
    // Soft decay on non-interacted categories so interests stay meaningful
    const ints = this.profile.interests;
    const max = Math.max(...Object.values(ints));
    if (max > 0.85) {
      Object.keys(ints).forEach(k => {
        if (ints[k] < max) ints[k] = Math.max(0, ints[k] - 0.008);
      });
    }
  }

  setPref(key, val) {
    if (key in this.profile.prefs) { this.profile.prefs[key] = val; this._save(); this._syncProfileToBackend(); }
  }

  setInterest(cat, val) {
    if (cat in this.profile.interests) {
      this.profile.interests[cat] = Math.max(0, Math.min(1, val));
      this._save();
      this._syncProfileToBackend();
    }
  }
  
  async _syncProfileToBackend() {
      try {
          await fetch('http://localhost:5000/profile', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ userId: this.profile.id, profile: this.profile })
          });
      } catch(e) {}
  }

  topInterests(n = 3) {
    return Object.entries(this.profile.interests)
      .sort(([,a],[,b]) => b - a).slice(0, n).map(([k]) => k);
  }

  get() { return { ...this.profile, interests: { ...this.profile.interests } }; }

  reset() {
    this.profile = this._default();
    this._save();
    window.tracker && window.tracker.clear();
  }

  // Simulate being a specific segment (for demo)
  simulateSegment(seg) {
    const counts = { new:1, returning:3, engaged:7, power:12 };
    this.profile.sessionCount = counts[seg] || 1;
    this.profile.segment = seg;
    this._save();
  }
}

window.profiler = new UserProfiler();
