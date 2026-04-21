// engine/personalizer.js — UI Renderer / Personalization Applier
class Personalizer {
  constructor() {
    this.radarChart = null;
    this.abChart = null;
    this.currentDecisions = null;
  }

  // ── Master apply — called after every engine evaluation ─────────────────
  apply(decisions) {
    this.currentDecisions = decisions;
    this.applyHeroBanner(decisions.heroBanner);
    this.applyFeedOrder(decisions.feedOrder);
    this.applyTheme(decisions.theme, decisions.timeMode);
    this.applyOnboarding(decisions.showOnboarding);
    this.applyPowerWidget(decisions.showPowerWidget);
    this.applyABVariant(decisions.ab);
    this.updateInterestBadges();
    this.updateSegmentMeter();
    this.updateContextCards();
    this.updateRadarChart();
  }

  // ── Hero Banner ──────────────────────────────────────────────────────────
  applyHeroBanner(segment) {
    const banners = window.FEATURED_BANNERS;
    const b = banners[segment] || banners.new;
    const el = document.getElementById('hero-banner');
    if (!el) return;
    el.style.background = b.gradient;
    el.querySelector('.hero-title').textContent  = b.title;
    el.querySelector('.hero-subtitle').textContent = b.subtitle;
    el.querySelector('.hero-cta').textContent    = b.cta;
  }

  // ── Feed Reorder (smooth CSS transitions) ────────────────────────────────
  applyFeedOrder(categoryOrder) {
    const feed = document.getElementById('content-feed');
    if (!feed) return;
    const cards = Array.from(feed.querySelectorAll('[data-content-id]'));

    // Sort cards by category order then by likes (within same category)
    cards.sort((a, b) => {
      const ai = categoryOrder.indexOf(a.dataset.category);
      const bi = categoryOrder.indexOf(b.dataset.category);
      const aIdx = ai === -1 ? 99 : ai;
      const bIdx = bi === -1 ? 99 : bi;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return parseInt(b.dataset.likes || 0) - parseInt(a.dataset.likes || 0);
    });

    // Re-append in new order (triggers CSS transition via opacity/transform)
    cards.forEach((card, i) => {
      card.style.order = i;
    });
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  applyTheme(theme, timeMode) {
    document.body.dataset.theme = theme;
    document.body.dataset.timeMode = timeMode || 'afternoon';
  }

  // ── Onboarding modal ─────────────────────────────────────────────────────
  applyOnboarding(show) {
    const el = document.getElementById('onboarding-overlay');
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
  }

  // ── Power user widget ────────────────────────────────────────────────────
  applyPowerWidget(show) {
    const el = document.getElementById('power-widget');
    if (el) el.style.display = show ? 'block' : 'none';
  }

  // ── A/B Variant ──────────────────────────────────────────────────────────
  applyABVariant(ab) {
    document.querySelectorAll('.ab-cta').forEach(btn => {
      btn.textContent = ab.ctaCopy;
      btn.dataset.variant = ab.ctaColor;
      btn.style.background = ab.ctaColor === 'A'
        ? 'linear-gradient(135deg,#7c3aed,#a855f7)'
        : 'linear-gradient(135deg,#06b6d4,#0284c7)';
    });
    // Show variant badge in A/B lab
    const badge = document.getElementById('ab-variant-badge');
    if (badge) badge.textContent = `Your variant: ${ab.ctaColor}`;
    const layoutBadge = document.getElementById('ab-layout-badge');
    if (layoutBadge) layoutBadge.textContent = `Layout: ${ab.layout}`;
  }

  // ── Interest Badges in Nav ────────────────────────────────────────────────
  updateInterestBadges() {
    const p = window.profiler.get();
    const top = window.profiler.topInterests(3);
    const container = document.getElementById('interest-badges');
    if (!container) return;
    const meta = window.CATEGORY_META;
    container.innerHTML = top
      .filter(k => p.interests[k] > 0.05)
      .map(k => `<span class="interest-badge" style="--clr:${meta[k]?.color||'#7c3aed'}">${meta[k]?.icon} ${meta[k]?.label}</span>`)
      .join('');
  }

  // ── Segment Meter ─────────────────────────────────────────────────────────
  updateSegmentMeter() {
    const p = window.profiler.get();
    const segments = ['new','returning','engaged','power'];
    const idx = segments.indexOf(p.segment);
    const pct = ((idx + 1) / segments.length) * 100;

    const bar  = document.getElementById('segment-bar');
    const label = document.getElementById('segment-label');
    const count = document.getElementById('session-count');
    if (bar)   bar.style.width = pct + '%';
    if (label) label.textContent = p.segment.charAt(0).toUpperCase() + p.segment.slice(1);
    if (count) count.textContent = p.sessionCount;
  }

  // ── Context Signal Cards ──────────────────────────────────────────────────
  updateContextCards() {
    const p = window.profiler.get();
    const h = p.context.hour;
    let period = h < 5 ? 'Night 🌙' : h < 12 ? 'Morning ☀️' : h < 17 ? 'Afternoon 🌤️' : h < 21 ? 'Evening 🌆' : 'Night 🌙';

    const fields = {
      'ctx-device':  p.context.device.charAt(0).toUpperCase() + p.context.device.slice(1) + ' 💻',
      'ctx-time':    `${String(h).padStart(2,'0')}:00 — ${period}`,
      'ctx-tz':      p.context.tz || 'Unknown',
      'ctx-session': `#${p.sessionCount}`,
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  // ── Radar Chart (Chart.js) ────────────────────────────────────────────────
  updateRadarChart() {
    const p = window.profiler.get();
    const labels = ['Tech','Sports','Entertainment','Health','Finance'];
    const data   = [p.interests.tech, p.interests.sports, p.interests.entertainment, p.interests.health, p.interests.finance];

    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;

    if (this.radarChart) {
      this.radarChart.data.datasets[0].data = data;
      this.radarChart.update('none');
      return;
    }

    this.radarChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Interest Profile',
          data,
          backgroundColor: 'rgba(124,58,237,0.2)',
          borderColor: '#a855f7',
          pointBackgroundColor: '#a855f7',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#a855f7',
          borderWidth: 2,
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: { r: { min:0, max:1, ticks:{ display:false }, grid:{ color:'rgba(255,255,255,0.1)' }, pointLabels:{ color:'#94a3b8', font:{ size:12 } } } },
        plugins: { legend:{ display:false } },
        animation: { duration: 600 },
      }
    });
  }

  // ── Render content cards into a container ──────────────────────────────────
  renderFeed(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map(item => this.cardHTML(item)).join('');
    // Bind click handlers
    container.querySelectorAll('[data-content-id]').forEach(card => {
      card.addEventListener('click', () => {
        const cat = card.dataset.category;
        const id  = card.dataset.contentId;
        window.tracker.log('content_click', { contentId: id, category: cat });
        window.profiler.record('content_click', { category: cat });
        window.decisionEngine.addManualLog(`Content clicked: "${card.querySelector('.card-title')?.textContent}" → boosting "${cat}" interest by 15%`, 'behavior');
        window.app && window.app.refresh();
      });
    });
  }

  // ── Individual card HTML ──────────────────────────────────────────────────
  cardHTML(item) {
    const meta = window.CATEGORY_META[item.category] || {};
    return `
      <article class="content-card" data-content-id="${item.id}" data-category="${item.category}" data-likes="${item.likes}" title="${item.title}">
        <div class="card-cover" style="background:${item.gradient}">
          <span class="card-icon">${item.icon}</span>
          <span class="card-cat-badge" style="--clr:${meta.color||'#7c3aed'}">${meta.icon} ${meta.label}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${item.title}</h3>
          <p class="card-summary">${item.summary}</p>
          <div class="card-meta">
            <span class="card-author">✍️ ${item.author}</span>
            <span class="card-date">${item.date}</span>
            <span class="card-read">${item.readTime}</span>
            <span class="card-likes">❤️ ${item.likes.toLocaleString()}</span>
          </div>
          <div class="card-tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
        </div>
      </article>`;
  }

  // ── Render recommendation cards ───────────────────────────────────────────
  renderRecommendations(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const p = window.profiler.get();
    const recCats = window.profiler.topInterests(3);
    const recs = [];
    recCats.forEach(cat => {
      const items = window.CONTENT_CATALOG.filter(i => i.category === cat);
      if (items.length) {
        const picked = items[Math.floor(Math.random() * items.length)];
        const score  = Math.round(60 + p.interests[cat] * 39);
        recs.push({ ...picked, score });
      }
    });
    container.innerHTML = recs.map(item => `
      <div class="rec-card" data-content-id="${item.id}" data-category="${item.category}">
        <div class="rec-cover" style="background:${item.gradient}">${item.icon}</div>
        <div class="rec-body">
          <p class="rec-title">${item.title}</p>
          <div class="rec-score">
            <div class="score-bar"><div class="score-fill" style="width:${item.score}%;background:${item.gradient}"></div></div>
            <span>${item.score}% match</span>
          </div>
        </div>
      </div>`).join('');

    container.querySelectorAll('[data-content-id]').forEach(card => {
      card.addEventListener('click', () => {
        window.tracker.log('rec_click', { contentId: card.dataset.contentId, category: card.dataset.category });
        window.profiler.record('rec_click', { category: card.dataset.category });
        window.decisionEngine.addManualLog(`Recommendation clicked → boosting "${card.dataset.category}" weight by 12%`, 'behavior');
        window.app && window.app.refresh();
      });
    });
  }
}

window.personalizer = new Personalizer();
