/* ============================================================
   PaceUp — UI Module
   Screen management, form builders, DOM helpers
   ============================================================ */

const UI = (() => {

  const RUN_TYPE_NAMES = {
    easy: 'Easy Run',
    tempo: 'Tempo Run',
    intervals: 'Intervals',
    long: 'Long Run',
    race: 'Race Mode'
  };

  const RUN_TYPE_BADGES = {
    easy: 'EASY',
    tempo: 'TEMPO',
    intervals: 'INTERVALS',
    long: 'LONG',
    race: 'RACE'
  };

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ─── Setup form builders per run type ───

  function buildSetupForm(type) {
    document.getElementById('setup-title').textContent = RUN_TYPE_NAMES[type] + ' Setup';
    const container = document.getElementById('setup-fields');
    let html = '';

    switch (type) {
      case 'easy':
        html = fieldPace('Maximum pace (don\'t go faster than)', 6, 0,
          'min : sec per km — the pacer warns if you go faster');
        break;

      case 'tempo':
        html = fieldPace('Target tempo pace', 5, 15, 'min : sec per km — ±15 sec tolerance band');
        html += fieldNumber('Tempo distance (km)', 'cfg-dist', 5, 1, 30);
        break;

      case 'intervals':
        html = fieldPills('Interval distance', 'interval-dist-pills', [
          { val: 200, label: '200m' },
          { val: 400, label: '400m', selected: true },
          { val: 800, label: '800m' },
          { val: 1000, label: '1000m' },
        ]);
        html += fieldNumber('Number of reps', 'cfg-reps', 8, 1, 30);
        html += fieldPace('Target rep pace', 4, 30, 'min : sec per km pace');
        html += fieldNumber('Rest between reps (seconds)', 'cfg-rest', 90, 15, 600);
        break;

      case 'long':
        html = fieldPace('Target pace', 6, 30, 'min : sec per km');
        html += fieldNumber('Distance goal (km)', 'cfg-dist', 15, 5, 50);
        break;

      case 'race':
        html = fieldPills('Race distance', 'race-dist-pills', [
          { val: 5, label: '5K', selected: true },
          { val: 10, label: '10K' },
          { val: 21.1, label: 'Half' },
          { val: 42.2, label: 'Full' },
        ]);
        html += fieldGoalTime();
        break;
    }

    // Voice settings (common to all)
    html += voiceSettings();

    // Start button
    html += '<button class="start-btn" id="btn-start-run">Start Run</button>';

    container.innerHTML = html;

    // Bind range slider
    const rng = document.getElementById('voice-freq');
    if (rng) {
      rng.addEventListener('input', () => {
        document.getElementById('voice-freq-val').textContent = rng.value + 's';
      });
    }
  }

  // ─── Field helpers ───

  function fieldPace(label, defaultMin, defaultSec, hint) {
    return `
      <div class="field-group">
        <label class="field-label">${label}</label>
        <div class="field-row">
          <input class="field-input" type="number" id="cfg-min" placeholder="${defaultMin}" min="2" max="15" value="${defaultMin}" style="flex:1" inputmode="numeric">
          <span class="field-sep">:</span>
          <input class="field-input" type="number" id="cfg-sec" placeholder="${String(defaultSec).padStart(2,'0')}" min="0" max="59" value="${defaultSec}" style="flex:1" inputmode="numeric">
        </div>
        <span class="unit-label">${hint}</span>
      </div>`;
  }

  function fieldNumber(label, id, defaultVal, min, max) {
    return `
      <div class="field-group">
        <label class="field-label">${label}</label>
        <input class="field-input" type="number" id="${id}" placeholder="${defaultVal}" min="${min}" max="${max}" value="${defaultVal}" inputmode="numeric">
      </div>`;
  }

  function fieldPills(label, groupId, options) {
    const pills = options.map(o =>
      `<div class="pill${o.selected ? ' selected' : ''}" data-val="${o.val}">${o.label}</div>`
    ).join('');
    return `
      <div class="field-group">
        <label class="field-label">${label}</label>
        <div class="pill-group" id="${groupId}">${pills}</div>
      </div>`;
  }

  function fieldGoalTime() {
    return `
      <div class="field-group">
        <label class="field-label">Goal time</label>
        <div class="field-row">
          <input class="field-input" type="number" id="cfg-hrs" placeholder="0" min="0" max="8" value="0" style="flex:1" inputmode="numeric">
          <span class="field-sep">h</span>
          <input class="field-input" type="number" id="cfg-min" placeholder="25" min="0" max="59" value="25" style="flex:1" inputmode="numeric">
          <span class="field-sep">m</span>
          <input class="field-input" type="number" id="cfg-sec" placeholder="00" min="0" max="59" value="0" style="flex:1" inputmode="numeric">
          <span class="field-sep">s</span>
        </div>
      </div>`;
  }

  function voiceSettings() {
    return `
      <div class="voice-settings">
        <h4>🔊 Voice Pacer</h4>
        <div class="toggle-row">
          <span>Voice guidance</span>
          <button class="toggle on" id="toggle-voice" type="button"></button>
        </div>
        <div class="range-row">
          <span>Frequency</span>
          <input type="range" id="voice-freq" min="10" max="60" value="30">
          <span class="range-val" id="voice-freq-val">30s</span>
        </div>
      </div>`;
  }

  // ─── Parse config from form ───

  function parseConfig(type) {
    const cfg = {};
    const m = document.getElementById('cfg-min');
    const s = document.getElementById('cfg-sec');

    switch (type) {
      case 'easy':
        cfg.maxPace = (parseInt(m.value) || 6) * 60 + (parseInt(s.value) || 0);
        break;

      case 'tempo':
        cfg.targetPace = (parseInt(m.value) || 5) * 60 + (parseInt(s.value) || 15);
        cfg.tolerance = 15;
        cfg.distance = parseFloat(document.getElementById('cfg-dist').value) || 5;
        break;

      case 'intervals':
        cfg.repDist = getSelectedPillValue('interval-dist-pills') || 400;
        cfg.reps = parseInt(document.getElementById('cfg-reps').value) || 8;
        cfg.targetPace = (parseInt(m.value) || 4) * 60 + (parseInt(s.value) || 30);
        cfg.restSeconds = parseInt(document.getElementById('cfg-rest').value) || 90;
        break;

      case 'long':
        cfg.targetPace = (parseInt(m.value) || 6) * 60 + (parseInt(s.value) || 30);
        cfg.distance = parseFloat(document.getElementById('cfg-dist').value) || 15;
        break;

      case 'race': {
        const h = parseInt(document.getElementById('cfg-hrs').value) || 0;
        cfg.distance = getSelectedPillValue('race-dist-pills') || 5;
        cfg.goalTime = h * 3600 + (parseInt(m.value) || 25) * 60 + (parseInt(s.value) || 0);
        cfg.targetPace = cfg.goalTime / cfg.distance;
        break;
      }
    }

    cfg.voiceEnabled = document.getElementById('toggle-voice').classList.contains('on');
    cfg.voiceFreq = parseInt(document.getElementById('voice-freq').value) || 30;

    return cfg;
  }

  function getSelectedPillValue(groupId) {
    const sel = document.querySelector('#' + groupId + ' .pill.selected');
    return sel ? parseFloat(sel.dataset.val) : null;
  }

  // ─── Active run UI updates ───

  function updateRunStats(paceStr, distKm, timeStr, avgPaceStr) {
    document.getElementById('current-pace').textContent = paceStr;
    document.getElementById('stat-distance').textContent = distKm;
    document.getElementById('stat-time').textContent = timeStr;
    document.getElementById('stat-avg-pace').textContent = avgPaceStr;
  }

  function updatePaceDisplay(status) {
    const dot = document.getElementById('pace-dot');
    const txt = document.getElementById('pace-status-text');
    const ind = document.getElementById('target-indicator');

    dot.className = 'pace-dot ' + status.dotClass;
    txt.textContent = status.statusText;
    ind.textContent = status.indicatorText;
    ind.style.color = status.indicatorColor;
  }

  function setRunTypeBadge(type) {
    document.getElementById('run-type-badge').textContent = RUN_TYPE_BADGES[type];
  }

  function showIntervalBar(show) {
    document.getElementById('interval-bar').classList.toggle('show', show);
  }

  function updateIntervalBar(repText, phase) {
    document.getElementById('rep-info').textContent = repText;
    const badge = document.getElementById('phase-badge');
    badge.textContent = phase.toUpperCase();
    badge.className = 'phase-badge phase-' + phase;
  }

  function setPauseButton(isPaused) {
    const btn = document.getElementById('pause-btn');
    if (isPaused) {
      btn.className = 'ctrl-btn btn-resume';
      btn.innerHTML = '▶ Resume';
    } else {
      btn.className = 'ctrl-btn btn-pause';
      btn.innerHTML = '⏸ Pause';
    }
  }

  function setLockButton(isLocked) {
    document.getElementById('lock-btn').textContent = isLocked ? '🔓' : '🔒';
  }

  function showGPSOverlay(show) {
    document.getElementById('gps-overlay').classList.toggle('hidden', !show);
  }

  function setGPSMessage(msg) {
    document.getElementById('gps-overlay-msg').textContent = msg;
  }

  function showCountdown(show) {
    document.getElementById('countdown-overlay').classList.toggle('hidden', !show);
  }

  function setCountdownNumber(n) {
    const el = document.getElementById('countdown-num');
    el.textContent = n;
    el.style.animation = 'none';
    void el.offsetWidth; // force reflow
    el.style.animation = 'count-pulse 0.6s ease-out';
  }

  function setVoiceToggle(enabled) {
    const btn = document.getElementById('voice-toggle-btn');
    btn.textContent = enabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !enabled);
  }

  // ─── Summary screen ───

  function buildSummary(runType, distKm, elapsed, avgPace, splits, config, intervalRep) {
    document.getElementById('summary-subtitle').textContent =
      RUN_TYPE_NAMES[runType] + ' · ' + new Date().toLocaleDateString();

    let statsHtml = `
      <div class="summary-card"><div class="val">${distKm.toFixed(2)}</div><div class="lbl">Distance (km)</div></div>
      <div class="summary-card"><div class="val">${GPS.formatTime(elapsed)}</div><div class="lbl">Duration</div></div>
      <div class="summary-card"><div class="val">${avgPace}</div><div class="lbl">Avg Pace</div></div>`;

    if (runType === 'race') {
      const goalDiff = Math.round(elapsed - config.goalTime);
      const str = goalDiff <= 0 ? `${Math.abs(goalDiff)}s ahead` : `${goalDiff}s behind`;
      const clr = goalDiff <= 0 ? 'var(--green)' : 'var(--red)';
      statsHtml += `<div class="summary-card"><div class="val" style="color:${clr}">${str}</div><div class="lbl">vs Goal</div></div>`;
    } else if (runType === 'intervals') {
      statsHtml += `<div class="summary-card"><div class="val">${intervalRep} / ${config.reps}</div><div class="lbl">Reps Done</div></div>`;
    } else {
      const cals = Math.round(distKm * 62);
      statsHtml += `<div class="summary-card"><div class="val">${cals}</div><div class="lbl">Est. Calories</div></div>`;
    }

    document.getElementById('summary-stats').innerHTML = statsHtml;

    // Splits
    let splitsHtml = '';
    splits.forEach(s => {
      const target = config.targetPace || config.maxPace;
      let color = 'var(--text)';
      if (target) {
        if (s.time < target - 15) color = 'var(--red)';
        else if (s.time > target + 15) color = 'var(--amber)';
        else color = 'var(--green)';
      }
      splitsHtml += `
        <div class="split-row">
          <span class="km">Km ${s.km}</span>
          <span class="pace" style="color:${color}">${GPS.formatPace(s.time)}</span>
        </div>`;
    });

    document.getElementById('splits-list').innerHTML = splitsHtml ||
      '<p style="color:var(--text-dim);font-size:14px;">Run was shorter than 1 km</p>';
  }

  return {
    RUN_TYPE_NAMES,
    showScreen,
    buildSetupForm,
    parseConfig,
    getSelectedPillValue,
    updateRunStats,
    updatePaceDisplay,
    setRunTypeBadge,
    showIntervalBar,
    updateIntervalBar,
    setPauseButton,
    setLockButton,
    showGPSOverlay,
    setGPSMessage,
    showCountdown,
    setCountdownNumber,
    setVoiceToggle,
    buildSummary
  };

})();
