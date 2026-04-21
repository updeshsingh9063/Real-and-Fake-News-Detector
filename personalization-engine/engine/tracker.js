// engine/tracker.js — Event Collection Layer
class EventTracker {
  constructor() {
    this.events = this._load();
    this.listeners = {};
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    this._trackScroll();
    this._trackHover();
  }

  _load() {
    try { return JSON.parse(localStorage.getItem('pe_events') || '[]'); }
    catch { return []; }
  }

  _save() {
    if (this.events.length > 500) this.events = this.events.slice(-500);
    localStorage.setItem('pe_events', JSON.stringify(this.events));
  }

  log(type, data = {}) {
    const evt = { id:`evt_${Date.now()}`, type, ts: Date.now(), sessionId: this.sessionId, ...data };
    this.events.push(evt);
    this._save();
    this._emit(type, evt);
    this._emit('*', evt);
    
    // Sync to Backend
    const p = window.profiler ? window.profiler.get() : null;
    if (p) {
        fetch('http://localhost:5000/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: p.id, event: evt })
        }).catch(err => console.error("Failed to sync event to backend:", err));
    }
    
    return evt;
  }

  on(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    if (this.listeners[type]) this.listeners[type] = this.listeners[type].filter(h => h !== fn);
  }

  _emit(type, evt) { (this.listeners[type] || []).forEach(h => h(evt)); }

  _trackScroll() {
    let maxDepth = 0;
    window.addEventListener('scroll', () => {
      const pct = document.body.scrollHeight - window.innerHeight;
      if (!pct) return;
      const depth = Math.round((window.scrollY / pct) * 100);
      if (depth > maxDepth + 15) { maxDepth = depth; this.log('scroll', { depth }); }
    });
  }

  _trackHover() {
    let t0 = null, el = null;
    document.addEventListener('mouseover', e => {
      const c = e.target.closest('[data-content-id]');
      if (c) { t0 = Date.now(); el = c; }
    });
    document.addEventListener('mouseout', e => {
      const c = e.target.closest('[data-content-id]');
      if (c && t0) {
        const dur = Date.now() - t0;
        if (dur > 1200) this.log('hover', { contentId: c.dataset.contentId, category: c.dataset.category, dur });
        t0 = null; el = null;
      }
    });
  }

  byType(type) { return this.events.filter(e => e.type === type); }
  recent(n = 50) { return this.events.slice(-n); }
  clear() { this.events = []; localStorage.removeItem('pe_events'); }
}

window.tracker = new EventTracker();
