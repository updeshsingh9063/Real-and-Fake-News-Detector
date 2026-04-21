// engine/decision.js — Decision Engine (Rule-Based + Scoring + A/B)
class DecisionEngine {
  constructor() {
    this.log = [];          // Decision log for dashboard
    this.logListeners = [];
  }

  // ── Main entry point ────────────────────────────────────────────────────
  evaluate() {
    const p = window.profiler.get();
    const decisions = {};

    // Rule 1: Segment-based hero banner
    decisions.heroBanner = p.segment;
    this._log(`Segment detected: "${p.segment}" → Loading ${p.segment} hero banner`, 'segment');

    // Rule 2: Contextual — time of day
    const h = p.context.hour;
    if (h >= 5  && h < 12) { decisions.timeMode = 'morning';   this._log('Time signal: Morning (5–12h) → Boosting productivity & tech content', 'context'); }
    else if (h >= 12 && h < 17) { decisions.timeMode = 'afternoon'; this._log('Time signal: Afternoon (12–17h) → Balanced feed active', 'context'); }
    else if (h >= 17 && h < 21) { decisions.timeMode = 'evening';   this._log('Time signal: Evening (17–21h) → Boosting entertainment & sports', 'context'); }
    else { decisions.timeMode = 'night'; this._log('Time signal: Night (21–5h) → Activating dark ambient mode, boosting health & wellness', 'context'); }

    // Rule 3: Interest-based content ordering
    const top = window.profiler.topInterests(5);
    decisions.feedOrder = this._scoreFeed(p.interests, decisions.timeMode);
    if (top[0]) this._log(`Top interest: "${top[0]}" (score: ${(p.interests[top[0]]*100).toFixed(0)}%) → Pinning ${top[0]} content to top`, 'behavior');

    // Rule 4: Onboarding for new users
    decisions.showOnboarding = p.segment === 'new' && p.totalClicks < 3;
    if (decisions.showOnboarding) this._log('Cold-start detected → Showing interest picker onboarding', 'rule');

    // Rule 5: Power user extras
    decisions.showPowerWidget = p.segment === 'power' || p.segment === 'engaged';
    if (decisions.showPowerWidget) this._log('Engaged user → Unlocking analytics widget in sidebar', 'rule');

    // Rule 6: Theme decision
    decisions.theme = (h >= 20 || h < 6) ? 'dark' : (p.prefs.theme === 'auto' ? 'light' : p.prefs.theme);

    // Rule 7: A/B test assignment
    decisions.ab = this._getABVariant(p.id);
    this._log(`A/B Test → User assigned variant "${decisions.ab.ctaColor}" for CTA color, layout "${decisions.ab.layout}"`, 'ab');

    // Rule 8: Recommendations
    decisions.recommendations = this._scoreRecommendations(p.interests, decisions.feedOrder);

    return decisions;
  }

  // ── Feed scoring ─────────────────────────────────────────────────────────
  _scoreFeed(interests, timeMode) {
    const timeBoosts = {
      morning:   { tech:0.15, finance:0.10 },
      afternoon: {},
      evening:   { entertainment:0.15, sports:0.10 },
      night:     { health:0.15, entertainment:0.10 },
    };
    const boosts = timeBoosts[timeMode] || {};
    const scored = {};
    Object.keys(interests).forEach(cat => {
      scored[cat] = interests[cat] + (boosts[cat] || 0);
    });
    return Object.entries(scored).sort(([,a],[,b]) => b - a).map(([k]) => k);
  }

  // ── Recommendation scoring ───────────────────────────────────────────────
  _scoreRecommendations(interests, feedOrder) {
    // Return top 2 categories different from #1 to diversify
    return feedOrder.slice(1, 4);
  }

  // ── A/B Test (stable per user via hash) ──────────────────────────────────
  _getABVariant(userId) {
    const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      ctaColor: hash % 2 === 0 ? 'A' : 'B',       // A=purple  B=cyan
      layout:   ['grid','list','magazine'][hash % 3],
      ctaCopy:  hash % 2 === 0 ? 'Explore Now' : 'Discover More',
    };
  }

  // ── Decision log ─────────────────────────────────────────────────────────
  _log(message, type = 'rule') {
    const entry = { message, type, ts: Date.now() };
    this.log.unshift(entry);
    if (this.log.length > 100) this.log.pop();
    this.logListeners.forEach(fn => fn(entry));
  }

  onLog(fn) { this.logListeners.push(fn); }

  addManualLog(message, type) { this._log(message, type); }

  getLog() { return [...this.log]; }
}

window.decisionEngine = new DecisionEngine();
