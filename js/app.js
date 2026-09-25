/* ============================================================
   PaceUp — App Controller v2
   Tab navigation, dashboard, history, settings, run lifecycle
   ============================================================ */

var App = (function() {

  var state = {
    runType: null, config: {}, isRunning: false, isPaused: false,
    isLocked: false, startTime: null, pausedDuration: 0, pauseStart: null,
    totalDistance: 0, positions: [], speeds: [], splits: [],
    lastSplitTime: 0, lastVoiceTime: 0, watchId: null, timerInterval: null,
    wakeLock: null,
    intervalPhase: 'work', intervalRep: 0, intervalPhaseDist: 0, intervalRestTimer: null,
    unlockRAF: null, unlockStart: 0,
  };

  function getElapsed() {
    if (!state.startTime) return 0;
    var now = state.isPaused ? state.pauseStart : Date.now();
    return (now - state.startTime - state.pausedDuration) / 1000;
  }

  // ─── INIT ───
  function init() {
    Voice.init();
    bindTabs();
    bindHome();
    bindRunControls();
    bindStopModal();
    bindUnlockButton();
    bindSettings();
    document.getElementById('btn-back-home').addEventListener('click', closeOverlay);
    document.getElementById('btn-done').addEventListener('click', function() { closeOverlay(); refreshDashboard(); });
    document.getElementById('btn-export').addEventListener('click', exportGPX);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && state.isRunning) requestWakeLock();
    });
    setGreeting();
    refreshDashboard();
    renderHistory();
  }

  // ─── TABS ───
  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-screen').forEach(function(s) { s.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'tab-history') renderHistory();
      });
    });
  }

  function showOverlay(id) {
    document.getElementById(id).classList.add('active');
  }
  function closeOverlay() {
    stopRun(true);
    document.querySelectorAll('.overlay-screen').forEach(function(s) { s.classList.remove('active'); });
  }

  // ─── GREETING ───
  function setGreeting() {
    var h = new Date().getHours();
    var g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('greeting').textContent = g;
  }

  // ─── DASHBOARD ───
  function refreshDashboard() {
    var runs = History.getAll();

    // Last run card
    var card = document.getElementById('last-run-card');
    if (runs.length > 0) {
      var r = runs[0];
      card.classList.remove('hidden');
      document.getElementById('lrc-date').textContent = new Date(r.date).toLocaleDateString();
      document.getElementById('lrc-dist').textContent = (r.distance / 1000).toFixed(2);
      document.getElementById('lrc-time').textContent = GPS.formatTime(r.duration);
      document.getElementById('lrc-pace').textContent = GPS.formatPace(r.avgPace);
    } else {
      card.classList.add('hidden');
    }

    // Weekly stats
    var now = new Date();
    var weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0,0,0,0);
    var weekRuns = runs.filter(function(r) { return new Date(r.date) >= weekStart; });
    var wDist = 0, wTime = 0;
    weekRuns.forEach(function(r) { wDist += r.distance; wTime += r.duration; });
    document.getElementById('week-runs').textContent = weekRuns.length;
    document.getElementById('week-dist').textContent = (wDist / 1000).toFixed(1);
    document.getElementById('week-time').textContent = Math.round(wTime / 60);
  }

  // ─── HISTORY ───
  function renderHistory() {
    var runs = History.getAll();
    var list = document.getElementById('history-list');
    var empty = document.getElementById('history-empty');
    if (runs.length === 0) { list.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';

    var typeIcons = { easy:'🚶', tempo:'⚡', intervals:'🔥', long:'🏔️', race:'🏁' };
    var typeClasses = { easy:'icon-easy', tempo:'icon-tempo', intervals:'icon-intervals', long:'icon-long', race:'icon-race' };
    var typeNames = { easy:'Easy Run', tempo:'Tempo', intervals:'Intervals', long:'Long Run', race:'Race' };

    var html = '';
    runs.forEach(function(r) {
      var d = new Date(r.date);
      var dateStr = d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
      var dist = (r.distance / 1000).toFixed(2);
      var time = GPS.formatTime(r.duration);
      var pace = GPS.formatPace(r.avgPace);
      html += '<div class="history-card">' +
        '<div class="hc-type-dot ' + (typeClasses[r.runType]||'icon-easy') + '">' + (typeIcons[r.runType]||'🏃') + '</div>' +
        '<div class="hc-body">' +
          '<div class="hc-top"><span class="hc-title">' + (typeNames[r.runType]||'Run') + '</span><span class="hc-date">' + dateStr + '</span></div>' +
          '<div class="hc-stats"><span class="hc-stat"><strong>' + dist + '</strong> km</span>' +
          '<span class="hc-stat"><strong>' + time + '</strong></span>' +
          '<span class="hc-stat"><strong>' + pace + '</strong> /km</span></div>' +
        '</div></div>';
    });
    list.innerHTML = html;
  }

  // ─── SETTINGS ───
  function bindSettings() {
    // Voice toggle
    document.getElementById('setting-voice-toggle').addEventListener('click', function() {
      this.classList.toggle('on');
    });
    // Frequency slider
    var freq = document.getElementById('setting-freq');
    freq.addEventListener('input', function() {
      document.getElementById('setting-freq-val').textContent = freq.value + 's';
    });
    // Unit pills
    document.querySelectorAll('#setting-units .pill-sm').forEach(function(p) {
      p.addEventListener('click', function() {
        document.querySelectorAll('#setting-units .pill-sm').forEach(function(x) { x.classList.remove('selected'); });
        p.classList.add('selected');
        document.getElementById('units-val').textContent = p.dataset.val === 'km' ? 'Kilometers' : 'Miles';
      });
    });
    // Clear history
    document.getElementById('setting-clear').addEventListener('click', function() {
      if (confirm('Delete all run history?')) {
        History.clear();
        renderHistory();
        refreshDashboard();
      }
    });
  }

  // ─── HOME ───
  function bindHome() {
    document.querySelectorAll('.run-type-card').forEach(function(card) {
      card.addEventListener('click', function() {
        haptic();
        selectRunType(card.dataset.type);
      });
    });
  }

  function selectRunType(type) {
    state.runType = type;
    showOverlay('setup');
    UI.buildSetupForm(type);
    bindSetupEvents();
  }

  function bindSetupEvents() {
    document.querySelectorAll('.pill-group .pill').forEach(function(pill) {
      pill.addEventListener('click', function() {
        pill.parentElement.querySelectorAll('.pill').forEach(function(p) { p.classList.remove('selected'); });
        pill.classList.add('selected');
      });
    });
    var toggle = document.getElementById('toggle-voice');
    if (toggle) toggle.addEventListener('click', function() { toggle.classList.toggle('on'); });
    var rng = document.getElementById('voice-freq');
    if (rng) rng.addEventListener('input', function() { document.getElementById('voice-freq-val').textContent = rng.value + 's'; });
    var startBtn = document.getElementById('btn-start-run');
    if (startBtn) startBtn.addEventListener('click', startRun);
  }

  // ─── RUN LIFECYCLE ───
  function startRun() {
    state.config = UI.parseConfig(state.runType);
    Voice.setEnabled(state.config.voiceEnabled);
    showOverlay('active-run');
    UI.setRunTypeBadge(state.runType);
    UI.showIntervalBar(state.runType === 'intervals');
    if (state.runType === 'intervals') {
      state.intervalRep = 0; state.intervalPhase = 'work'; state.intervalPhaseDist = 0;
      state.config._intervalPhase = 'work';
      UI.updateIntervalBar('Rep 1 / ' + state.config.reps, 'work');
    }
    state.totalDistance = 0; state.positions = []; state.speeds = [];
    state.splits = []; state.lastSplitTime = 0; state.lastVoiceTime = 0;
    state.pausedDuration = 0; state.isPaused = false; state.isLocked = false;
    UI.setPauseButton(false); UI.showLockOverlay(false); UI.hideStopModal();
    UI.showGPSOverlay(true); UI.showCountdown(false);

    if (!navigator.geolocation) { alert('GPS not available.'); closeOverlay(); return; }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        MapManager.initRun('map', pos.coords.latitude, pos.coords.longitude);
        UI.showGPSOverlay(false);
        runCountdown();
      },
      function(err) { UI.setGPSMessage('GPS error: ' + err.message); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function runCountdown() {
    UI.showCountdown(true);
    var count = 3;
    UI.setCountdownNumber(count); Voice.speak(String(count));
    var iv = setInterval(function() {
      count--;
      if (count > 0) { UI.setCountdownNumber(count); Voice.speak(String(count)); }
      else { clearInterval(iv); UI.showCountdown(false); beginRun(); }
    }, 1000);
  }

  function beginRun() {
    state.isRunning = true; state.startTime = Date.now();
    state.watchId = navigator.geolocation.watchPosition(onGPS,
      function(e) { console.warn('GPS:', e.message); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    state.timerInterval = setInterval(function() {
      if (!state.isPaused) {
        var t = GPS.formatTime(getElapsed());
        document.getElementById('stat-time').textContent = t;
        document.getElementById('lock-time').textContent = t;
      }
    }, 500);
    Voice.speak(Voice.startMessage(state.runType, state.config));
    requestWakeLock();
  }

  function onGPS(pos) {
    if (!state.isRunning || state.isPaused) return;
    var result = GPS.processPosition(pos, state.positions);
    if (!result) return;
    if (result.dist > 0) {
      state.totalDistance += result.dist;
      state.speeds.push(result.speed);
      var kmNow = Math.floor(state.totalDistance / 1000);
      var kmPrev = Math.floor((state.totalDistance - result.dist) / 1000);
      if (kmNow > kmPrev && kmNow > 0) recordSplit(kmNow);
    }
    state.positions.push(result);
    MapManager.addPoint(result.lat, result.lon, !state.isLocked);
    updateStats();
    checkVoice();
    if (state.runType === 'intervals') checkInterval();
  }

  function recordSplit(km) {
    var elapsed = getElapsed();
    var splitTime = elapsed - state.lastSplitTime;
    state.splits.push({ km: km, time: splitTime, totalTime: elapsed });
    state.lastSplitTime = elapsed;
    Voice.speak(Voice.splitMessage(km, GPS.formatPace(splitTime)));
  }

  function updateStats() {
    var speed = GPS.smoothSpeed(state.speeds, 8);
    var pace = GPS.speedToPace(speed);
    var distKm = (state.totalDistance / 1000).toFixed(2);
    var elapsed = getElapsed();
    var avgPace = state.totalDistance > 10 ? (elapsed / state.totalDistance) * 1000 : 0;
    UI.updateRunStats(GPS.formatPace(pace), distKm, GPS.formatTime(elapsed), GPS.formatPace(avgPace));
    UI.updatePaceDisplay(Pacer.getPaceStatus(state.runType, state.config, pace));
  }

  function checkVoice() {
    var elapsed = getElapsed();
    if (!Pacer.shouldSpeak(elapsed, state.lastVoiceTime, state.config.voiceFreq)) return;
    state.lastVoiceTime = elapsed;
    var speed = GPS.smoothSpeed(state.speeds, 8);
    var pace = GPS.speedToPace(speed);
    if (pace <= 0 || !isFinite(pace)) return;
    Voice.speak(Voice.paceCue(state.runType, state.config, GPS.formatPace(pace), pace, elapsed, state.totalDistance));
  }

  function checkInterval() {
    var cfg = state.config;
    if (state.intervalPhase !== 'work') return;
    var distInRep = state.totalDistance - state.intervalPhaseDist;
    if (distInRep >= cfg.repDist) {
      state.intervalRep++;
      UI.updateIntervalBar('Rep ' + state.intervalRep + ' / ' + cfg.reps, 'work');
      if (Pacer.isIntervalComplete(state.intervalRep, cfg.reps)) {
        Voice.speak(Voice.intervalRepDone(state.intervalRep, cfg.reps, 0)); return;
      }
      Voice.speak(Voice.intervalRepDone(state.intervalRep, cfg.reps, cfg.restSeconds));
      state.intervalPhase = 'rest'; state.config._intervalPhase = 'rest';
      UI.updateIntervalBar('Rep ' + state.intervalRep + ' / ' + cfg.reps, 'rest');
      var restLeft = cfg.restSeconds;
      state.intervalRestTimer = setInterval(function() {
        restLeft--;
        if (restLeft === 30) Voice.speak('30 seconds to next rep.');
        if (restLeft === 10) Voice.speak('10 seconds. Get ready.');
        if (restLeft <= 3 && restLeft > 0) Voice.speak(String(restLeft));
        if (restLeft <= 0) {
          clearInterval(state.intervalRestTimer);
          state.intervalPhase = 'work'; state.config._intervalPhase = 'work';
          state.intervalPhaseDist = state.totalDistance;
          UI.updateIntervalBar('Rep ' + (state.intervalRep + 1) + ' / ' + cfg.reps, 'work');
          Voice.speak('Rep ' + (state.intervalRep + 1) + '. Go!');
        }
      }, 1000);
    }
  }

  // ─── CONTROLS ───
  function bindRunControls() {
    document.getElementById('voice-toggle-btn').addEventListener('click', function() {
      var on = !Voice.isEnabled(); Voice.setEnabled(on); UI.setVoiceToggle(on);
    });
    document.getElementById('center-btn').addEventListener('click', function() {
      if (state.positions.length) { var l = state.positions[state.positions.length-1]; MapManager.centerOn(l.lat, l.lon); }
    });
    document.getElementById('pause-btn').addEventListener('click', function() {
      if (state.isLocked) return;
      if (!state.isPaused) {
        state.isPaused = true; state.pauseStart = Date.now();
        UI.setPauseButton(true); Voice.speak('Paused.');
      } else {
        state.pausedDuration += Date.now() - state.pauseStart;
        state.isPaused = false; UI.setPauseButton(false); Voice.speak('Resuming.');
      }
    });
    document.getElementById('stop-btn').addEventListener('click', function() {
      if (state.isLocked) return;
      if (state.totalDistance < 100) { stopRun(false); return; }
      UI.showStopModal((state.totalDistance/1000).toFixed(2), GPS.formatTime(getElapsed()));
    });
    document.getElementById('lock-btn').addEventListener('click', function() {
      haptic(); state.isLocked = true; UI.showLockOverlay(true);
    });
  }

  function bindStopModal() {
    document.getElementById('stop-cancel').addEventListener('click', function() { UI.hideStopModal(); });
    document.getElementById('stop-confirm').addEventListener('click', function() { UI.hideStopModal(); stopRun(false); });
  }

  function stopRun(silent) {
    state.isRunning = false; state.isPaused = false; state.isLocked = false;
    if (state.watchId != null) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    if (state.intervalRestTimer) { clearInterval(state.intervalRestTimer); state.intervalRestTimer = null; }
    Voice.cancel(); releaseWakeLock(); UI.showLockOverlay(false); UI.hideStopModal();
    if (!silent && state.totalDistance > 50) showSummary();
  }

  function showSummary() {
    showOverlay('summary');
    // Close setup and active-run
    document.getElementById('setup').classList.remove('active');
    document.getElementById('active-run').classList.remove('active');

    var elapsed = getElapsed();
    var distKm = state.totalDistance / 1000;
    var avgPaceVal = state.totalDistance > 10 ? (elapsed / state.totalDistance) * 1000 : 0;
    var avgPaceStr = GPS.formatPace(avgPaceVal);
    UI.buildSummary(state.runType, distKm, elapsed, avgPaceStr, state.splits, state.config, state.intervalRep);
    Voice.speak(Voice.endMessage(distKm, elapsed, avgPaceStr));
    if (state.positions.length > 2) MapManager.initSummary('summary-map', state.positions);
    else document.getElementById('summary-map').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:13px;">Route too short</div>';
    // Save
    if (typeof History !== 'undefined') {
      History.save(History.createRecord(state.runType, state.config, state.totalDistance, elapsed, avgPaceVal, state.splits, state.positions));
    }
  }

  // ─── LOCK ───
  function bindUnlockButton() {
    var btn = document.getElementById('unlock-btn');
    var fill = document.getElementById('unlock-fill');
    var HOLD = 2000;
    function startH(e) {
      e.preventDefault(); e.stopPropagation();
      state.unlockStart = Date.now();
      (function anim() {
        var pct = Math.min(((Date.now()-state.unlockStart)/HOLD)*100, 100);
        fill.style.width = pct + '%';
        if (pct >= 100) { fill.style.width='0%'; state.isLocked=false; UI.showLockOverlay(false); haptic(); return; }
        state.unlockRAF = requestAnimationFrame(anim);
      })();
    }
    function endH(e) { e.preventDefault(); e.stopPropagation(); if(state.unlockRAF) cancelAnimationFrame(state.unlockRAF); fill.style.width='0%'; }
    btn.addEventListener('touchstart', startH, {passive:false});
    btn.addEventListener('touchend', endH, {passive:false});
    btn.addEventListener('touchcancel', endH, {passive:false});
    btn.addEventListener('mousedown', startH);
    btn.addEventListener('mouseup', endH);
    btn.addEventListener('mouseleave', endH);
    var overlay = document.getElementById('lock-overlay');
    overlay.addEventListener('touchstart', function(e) { if (!btn.contains(e.target)) { e.preventDefault(); e.stopPropagation(); } }, {passive:false});
    overlay.addEventListener('touchmove', function(e) { e.preventDefault(); }, {passive:false});
  }

  // ─── GPX ───
  function exportGPX() {
    if (state.positions.length < 2) { alert('Not enough data.'); return; }
    var gpx = GPS.generateGPX(state.positions, 'PaceUp Run', state.startTime);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([gpx], {type:'application/gpx+xml'}));
    a.download = 'paceup-' + new Date().toISOString().slice(0,10) + '.gpx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // ─── WAKE LOCK ───
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function(l) {
      state.wakeLock = l;
      l.addEventListener('release', function() { state.wakeLock=null; if(state.isRunning) requestWakeLock(); });
    }).catch(function(){});
  }
  function releaseWakeLock() { if(state.wakeLock) { state.wakeLock.release().catch(function(){}); state.wakeLock=null; } }

  // ─── HAPTIC ───
  function haptic() { try { if(navigator.vibrate) navigator.vibrate(15); } catch(e){} }

  init();
})();
