// app.js — Application Bootstrap & Router
class App {
  constructor() {
    this.currentSection = 'home';
    this.abSimData = this._generateABSimData();
    this.init();
  }

  init() {
    this._setupNav();
    this._setupOnboarding();
    this._setupPreferences();
    this._setupABLab();
    this._setupDecisionLog();
    this._setupProfileReset();
    this._setupDetector();
    this.navigate('home');
    this.refresh();

    // Auto-refresh engine every 30s (simulates real-time)
    setInterval(() => this.refresh(), 30000);

    // React to any tracked event
    window.tracker.on('*', () => this.refresh());
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  _setupNav() {
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.nav));
    });
  }

  navigate(section) {
    this.currentSection = section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === section);
    });
    if (section === 'engine')   this._refreshEngineDashboard();
    if (section === 'recs')     window.personalizer.renderRecommendations('rec-container');
    if (section === 'ab')       this._renderABLab();
    if (section === 'settings') this._refreshSettings();
  }

  // ── Master Refresh ────────────────────────────────────────────────────────
  refresh() {
    const decisions = window.decisionEngine.evaluate();
    window.personalizer.apply(decisions);
    window.personalizer.renderFeed('content-feed', window.CONTENT_CATALOG);

    if (this.currentSection === 'engine') this._refreshEngineDashboard();
    if (this.currentSection === 'recs')   window.personalizer.renderRecommendations('rec-container');
  }

  // ── Engine Dashboard ──────────────────────────────────────────────────────
  _refreshEngineDashboard() {
    this._updateDecisionLog();
    this._updateInterestSliders();
    window.personalizer.updateRadarChart();
    window.personalizer.updateSegmentMeter();
    window.personalizer.updateContextCards();
  }

  _updateDecisionLog() {
    const container = document.getElementById('decision-log');
    if (!container) return;
    const log = window.decisionEngine.getLog().slice(0, 20);
    const typeColors = { rule:'#7c3aed', behavior:'#10b981', context:'#06b6d4', segment:'#f59e0b', ab:'#ec4899' };
    const typeIcons  = { rule:'📋', behavior:'👆', context:'🌍', segment:'👤', ab:'🧪' };
    container.innerHTML = log.map(entry => {
      const clr  = typeColors[entry.type] || '#7c3aed';
      const icon = typeIcons[entry.type]  || '📋';
      const time = new Date(entry.ts).toLocaleTimeString();
      return `<div class="log-entry" style="--entry-clr:${clr}">
        <span class="log-icon">${icon}</span>
        <div class="log-content">
          <span class="log-type" style="color:${clr}">${entry.type.toUpperCase()}</span>
          <p class="log-msg">${entry.message}</p>
          <span class="log-time">${time}</span>
        </div>
      </div>`;
    }).join('');
  }

  _updateInterestSliders() {
    const p = window.profiler.get();
    Object.entries(p.interests).forEach(([cat, val]) => {
      const slider = document.getElementById(`slider-${cat}`);
      const label  = document.getElementById(`slider-val-${cat}`);
      if (slider) slider.value = val;
      if (label)  label.textContent = (val * 100).toFixed(0) + '%';
    });
  }

  _setupDecisionLog() {
    // Animate new log entries
    window.decisionEngine.onLog(() => {
      if (this.currentSection === 'engine') {
        this._updateDecisionLog();
      }
      // Flash the engine nav icon
      const navBtn = document.querySelector('[data-nav="engine"]');
      if (navBtn) {
        navBtn.classList.add('pulse');
        setTimeout(() => navBtn.classList.remove('pulse'), 1000);
      }
    });
  }

  // ── Onboarding ────────────────────────────────────────────────────────────
  _setupOnboarding() {
    document.querySelectorAll('.interest-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        btn.classList.toggle('selected');
        const isSelected = btn.classList.contains('selected');
        if (isSelected) {
          window.profiler.setInterest(cat, 0.6);
          window.decisionEngine.addManualLog(`Onboarding: User selected "${cat}" → Interest set to 60%`, 'rule');
        } else {
          window.profiler.setInterest(cat, 0.1);
        }
      });
    });

    document.getElementById('onboarding-done')?.addEventListener('click', () => {
      const overlay = document.getElementById('onboarding-overlay');
      if (overlay) overlay.style.display = 'none';
      window.decisionEngine.addManualLog('Onboarding complete → Engine fully active, personalizing feed', 'rule');
      this.refresh();
    });
  }

  // ── Settings / Preferences ────────────────────────────────────────────────
  _setupPreferences() {
    // Interest sliders (engine page)
    ['tech','sports','entertainment','health','finance'].forEach(cat => {
      const slider = document.getElementById(`slider-${cat}`);
      if (!slider) return;
      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        window.profiler.setInterest(cat, val);
        const label = document.getElementById(`slider-val-${cat}`);
        if (label) label.textContent = (val * 100).toFixed(0) + '%';
        window.decisionEngine.addManualLog(`Manual preference: "${cat}" set to ${(val*100).toFixed(0)}%`, 'rule');
        this.refresh();
      });
    });

    // Settings page layout / density / theme
    document.getElementById('pref-layout')?.addEventListener('change', e => {
      window.profiler.setPref('layout', e.target.value);
      document.getElementById('content-feed').dataset.layout = e.target.value;
    });
    document.getElementById('pref-density')?.addEventListener('change', e => {
      window.profiler.setPref('density', e.target.value);
      document.body.dataset.density = e.target.value;
    });
    document.getElementById('pref-theme')?.addEventListener('change', e => {
      window.profiler.setPref('theme', e.target.value);
      this.refresh();
    });

    // Segment simulator
    document.getElementById('sim-segment')?.addEventListener('change', e => {
      window.profiler.simulateSegment(e.target.value);
      window.decisionEngine.addManualLog(`Simulator: Switched to segment "${e.target.value}"`, 'rule');
      this.refresh();
    });
  }

  _refreshSettings() {
    const p = window.profiler.get();
    const layoutEl = document.getElementById('pref-layout');
    const densityEl = document.getElementById('pref-density');
    const simEl = document.getElementById('sim-segment');
    if (layoutEl) layoutEl.value = p.prefs.layout;
    if (densityEl) densityEl.value = p.prefs.density;
    if (simEl) simEl.value = p.segment;

    // Render interest bars in settings
    const barsContainer = document.getElementById('settings-interest-bars');
    if (barsContainer) {
      const meta = window.CATEGORY_META;
      barsContainer.innerHTML = Object.entries(p.interests).map(([cat, val]) => `
        <div class="pref-interest-row">
          <span>${meta[cat]?.icon} ${meta[cat]?.label}</span>
          <div class="pref-bar-track">
            <div class="pref-bar-fill" style="width:${val*100}%;background:${meta[cat]?.color}"></div>
          </div>
          <span>${(val*100).toFixed(0)}%</span>
        </div>`).join('');
    }

    // Total events
    const totalEl = document.getElementById('total-events');
    if (totalEl) totalEl.textContent = window.tracker.events.length;
    const totalClicks = document.getElementById('total-clicks');
    if (totalClicks) totalClicks.textContent = p.totalClicks;
  }

  // ── Profile Reset ─────────────────────────────────────────────────────────
  _setupProfileReset() {
    document.getElementById('reset-profile')?.addEventListener('click', () => {
      if (confirm('Reset your profile? This clears all tracked data and starts fresh.')) {
        window.profiler.reset();
        window.decisionEngine.addManualLog('Profile reset → Cold start. Welcome, new user!', 'rule');
        this.refresh();
        this.navigate('home');
      }
    });
  }

  // ── AI Detector ───────────────────────────────────────────────────────────
  _setupDetector() {
    const btn = document.getElementById('btn-detect');
    const input = document.getElementById('detector-input');
    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) {
        alert("Please enter some text to analyze.");
        return;
      }

      // UI Loading state
      btn.disabled = true;
      btn.querySelector('span').textContent = "Analyzing patterns...";
      const resultCard = document.getElementById('detector-result');
      resultCard.classList.remove('hidden', 'Real', 'Fake');
      
      const p = window.profiler.get();

      try {
        const response = await fetch("http://localhost:5000/api/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, userId: p.id })
        });

        if (!response.ok) throw new Error("Detection API failed");
        
        const data = await response.json();
        
        // Update UI
        document.getElementById('result-label').textContent = data.label;
        document.getElementById('result-conf').textContent = (data.confidence * 100).toFixed(1) + "%";
        document.getElementById('result-bar-fill').style.width = (data.confidence * 100) + "%";
        document.getElementById('result-explanation').textContent = data.explanation;
        
        resultCard.classList.add(data.label);
        
        window.decisionEngine.addManualLog(`Detector ran: ${data.label} (${(data.confidence*100).toFixed(0)}%)`, 'rule');
        this.refresh();

      } catch (err) {
        console.error(err);
        alert("Error connecting to detection service. Is the backend running?");
      } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = "Run Detection Analysis";
      }
    });
  }

  // ── A/B Testing Lab ────────────────────────────────────────────────────────
  _setupABLab() { /* rendered dynamically */ }

  _renderABLab() {
    const p = window.profiler.get();
    const ab = window.decisionEngine._getABVariant(p.id);

    // Update variant highlight cards
    document.querySelectorAll('.ab-variant-card').forEach(card => {
      card.classList.toggle('ab-winner', card.dataset.variant === ab.ctaColor);
    });

    // Render simulated CTR chart
    const canvas = document.getElementById('ab-chart');
    if (!canvas) return;
    if (this.abChart) { this.abChart.destroy(); this.abChart = null; }
    this.abChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Variant A (Purple)', 'Variant B (Cyan)'],
        datasets: [{
          label: 'Simulated CTR %',
          data: this.abSimData,
          backgroundColor: ['rgba(124,58,237,0.7)', 'rgba(6,182,212,0.7)'],
          borderColor: ['#7c3aed', '#06b6d4'],
          borderWidth: 2,
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` CTR: ${ctx.parsed.y}%` } }
        },
        scales: {
          y: { min: 0, max: 30, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        }
      }
    });

    // Populate CTR stats on cards
    const ctrA = document.getElementById('ab-ctr-a');
    const ctrB = document.getElementById('ab-ctr-b');
    if (ctrA) ctrA.textContent = this.abSimData[0] + '%';
    if (ctrB) ctrB.textContent = this.abSimData[1] + '%';

    // Update winner text
    const winnerEl = document.getElementById('ab-winner-text');
    if (winnerEl) {
      const winner = this.abSimData[0] > this.abSimData[1] ? 'A (Purple)' : 'B (Cyan)';
      winnerEl.textContent = `🏆 Current winner: Variant ${winner} with ${Math.max(...this.abSimData)}% CTR`;
    }
  }

  _generateABSimData() {
    return [
      parseFloat((12 + Math.random() * 10).toFixed(1)),
      parseFloat((12 + Math.random() * 10).toFixed(1)),
    ];
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
