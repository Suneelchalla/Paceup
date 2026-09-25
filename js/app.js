/* ============================================================
   PaceUp — App Controller
   State management, run lifecycle, event wiring
   ============================================================ */

const App = (() => {

  // ─── State ───
  const state = {
    runType: null,
    config: {},
    isRunning: false,
    isPaused: false,
    isLocked: false,
    startTime: null,
    pausedDuration: 0,
    pauseStart: null,
    totalDistance: 0,
    positions: [],       // { lat, lon, ts, accuracy }
    speeds: [],
    splits: [],
    lastSplitTime: 0,
    lastVoiceTime: 0,
    watchId: null,
    timerInterval: null,
    // Interval-specific
    intervalPhase: 'work',
    intervalRep: 0,
    intervalPhaseDist: 0,
    intervalRestTimer: null,
  };

  // ─── Elapsed time ───
  function getElapsed() {
    if (!state.startTime) return 0;
    const now = state.isPaused ? state.pauseStart : Date.now();
    return (now - state.startTime - state.pausedDuration) / 1000;
  }

  // ─── Navigation ───
  function goHome() {
    stopRun(true);
    UI.showScreen('home');
  }

  function selectRunType(type) {
    state.runType = type;
    UI.showScreen('setup');
    UI.buildSetupForm(type);
    bindSetupEvents();
  }

  // ─── Event bindings ───
  function init() {
    Voice.init();

    // Home screen — run type cards
    document.querySelectorAll('.run-type-card').forEach(card => {
      card.addEventListener('click', () => selectRunType(card.dataset.type));
    });

    // Back button
    document.getElementById('btn-back-home').addEventListener('click', goHome);

    // Active run controls
    document.getElementById('voice-toggle-btn').addEventListener('click', toggleVoice);
    document.getElementById('center-btn').addEventListener('click', centerMap);
    document.getElementById('pause-btn').addEventListener('click', pauseRun);
    document.getElementById('stop-btn').addEventListener('click', confirmStop);
    document.getElementById('lock-btn').addEventListener('click', toggleLock);

    // Summary
    document.getElementById('btn-done').addEventListener('click', goHome);
    document.getElementById('btn-export').addEventListener('click', exportGPX);
  }

  function bindSetupEvents() {
    // Pill selectors
    document.querySelectorAll('.pill-group .pill').forEach(pill => {
      pill.addEventListener('click', () => {
        pill.parentElement.querySelectorAll('.pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
      });
    });

    // Voice toggle
    const toggle = document.getElementById('toggle-voice');
    if (toggle) {
      toggle.addEventListener('click', () => toggle.classList.toggle('on'));
    }

    // Start button
    const startBtn = document.getElementById('btn-start-run');
    if (startBtn) {
      startBtn.addEventListener('click', startRun);
    }
  }

  // ─── Start run ───
  function startRun() {
    state.config = UI.parseConfig(state.runType);

    Voice.setEnabled(state.config.voiceEnabled);
    UI.showScreen('active-run');
    UI.setRunTypeBadge(state.runType);
    UI.showIntervalBar(state.runType === 'intervals');

    if (state.runType === 'intervals') {
      state.intervalRep = 0;
      state.intervalPhase = 'work';
      state.intervalPhaseDist = 0;
      state.config._intervalPhase = 'work';
      UI.updateIntervalBar(`Rep 1 / ${state.config.reps}`, 'work');
    }

    // Reset state
    state.totalDistance = 0;
    state.positions = [];
    state.speeds = [];
    state.splits = [];
    state.lastSplitTime = 0;
    state.lastVoiceTime = 0;
    state.pausedDuration = 0;
    state.isPaused = false;
    state.isLocked = false;
    UI.setPauseButton(false);
    UI.setLockButton(false);

    // Show GPS overlay
    UI.showGPSOverlay(true);
    UI.showCountdown(false);

    if (!navigator.geolocation) {
      alert('GPS is not available on this device.');
      goHome();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        MapManager.initRun('map', pos.coords.latitude, pos.coords.longitude);
        UI.showGPSOverlay(false);
        runCountdown();
      },
      (err) => {
        UI.setGPSMessage('GPS error: ' + err.message + '. Enable location access and retry.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function runCountdown() {
    UI.showCountdown(true);
    let count = 3;
    UI.setCountdownNumber(count);
    Voice.speak(String(count));

    const iv = setInterval(() => {
      count--;
      if (count > 0) {
        UI.setCountdownNumber(count);
        Voice.speak(String(count));
      } else {
        clearInterval(iv);
        UI.showCountdown(false);
        beginRun();
      }
    }, 1000);
  }

  function beginRun() {
    state.isRunning = true;
    state.startTime = Date.now();

    // GPS watch
    state.watchId = navigator.geolocation.watchPosition(
      onGPS,
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    // Timer tick
    state.timerInterval = setInterval(() => {
      if (!state.isPaused) {
        document.getElementById('stat-time').textContent = GPS.formatTime(getElapsed());
      }
    }, 500);

    // Start voice
    Voice.speak(Voice.startMessage(state.runType, state.config));

    // Screen wake lock
    requestWakeLock();
  }

  // ─── GPS callback ───
  function onGPS(pos) {
    if (!state.isRunning || state.isPaused) return;

    const result = GPS.processPosition(pos, state.positions);
    if (!result) return;

    if (result.dist > 0) {
      state.totalDistance += result.dist;
      state.speeds.push(result.speed);

      // Check km split
      const kmNow = Math.floor(state.totalDistance / 1000);
      const kmPrev = Math.floor((state.totalDistance - result.dist) / 1000);
      if (kmNow > kmPrev && kmNow > 0) {
        recordSplit(kmNow);
      }
    }

    state.positions.push(result);

    // Update map
    MapManager.addPoint(result.lat, result.lon, !state.isLocked);

    // Update UI
    updateStats();

    // Voice cues
    checkVoice();

    // Interval logic
    if (state.runType === 'intervals') checkInterval();
  }

  function recordSplit(km) {
    const elapsed = getElapsed();
    const splitTime = elapsed - state.lastSplitTime;
    state.splits.push({ km, time: splitTime, totalTime: elapsed });
    state.lastSplitTime = elapsed;

    Voice.speak(Voice.splitMessage(km, GPS.formatPace(splitTime)));
  }

  function updateStats() {
    const speed = GPS.smoothSpeed(state.speeds, 8);
    const pace = GPS.speedToPace(speed);
    const distKm = (state.totalDistance / 1000).toFixed(2);
    const elapsed = getElapsed();
    const avgPace = state.totalDistance > 10
      ? (elapsed / state.totalDistance) * 1000
      : 0;

    UI.updateRunStats(
      GPS.formatPace(pace),
      distKm,
      GPS.formatTime(elapsed),
      GPS.formatPace(avgPace)
    );

    const status = Pacer.getPaceStatus(state.runType, state.config, pace);
    UI.updatePaceDisplay(status);
  }

  function checkVoice() {
    const elapsed = getElapsed();
    if (!Pacer.shouldSpeak(elapsed, state.lastVoiceTime, state.config.voiceFreq)) return;
    state.lastVoiceTime = elapsed;

    const speed = GPS.smoothSpeed(state.speeds, 8);
    const pace = GPS.speedToPace(speed);
    if (pace <= 0 || !isFinite(pace)) return;

    const paceStr = GPS.formatPace(pace);
    const msg = Voice.paceCue(
      state.runType, state.config, paceStr, pace, elapsed, state.totalDistance
    );
    Voice.speak(msg);
  }

  // ─── Interval logic ───
  function checkInterval() {
    const cfg = state.config;
    if (state.intervalPhase !== 'work') return;

    const distInRep = state.totalDistance - state.intervalPhaseDist;
    if (distInRep >= cfg.repDist) {
      state.intervalRep++;
      UI.updateIntervalBar(`Rep ${state.intervalRep} / ${cfg.reps}`, 'work');

      if (Pacer.isIntervalComplete(state.intervalRep, cfg.reps)) {
        Voice.speak(Voice.intervalRepDone(state.intervalRep, cfg.reps, 0));
        return;
      }

      Voice.speak(Voice.intervalRepDone(state.intervalRep, cfg.reps, cfg.restSeconds));

      // Switch to rest
      state.intervalPhase = 'rest';
      state.config._intervalPhase = 'rest';
      UI.updateIntervalBar(`Rep ${state.intervalRep} / ${cfg.reps}`, 'rest');

      let restLeft = cfg.restSeconds;
      state.intervalRestTimer = setInterval(() => {
        restLeft--;
        if (restLeft === 30) Voice.speak('30 seconds to next rep.');
        if (restLeft === 10) Voice.speak('10 seconds. Get ready.');
        if (restLeft <= 3 && restLeft > 0) Voice.speak(String(restLeft));
        if (restLeft <= 0) {
          clearInterval(state.intervalRestTimer);
          state.intervalPhase = 'work';
          state.config._intervalPhase = 'work';
          state.intervalPhaseDist = state.totalDistance;
          UI.updateIntervalBar(`Rep ${state.intervalRep + 1} / ${cfg.reps}`, 'work');
          Voice.speak(`Rep ${state.intervalRep + 1}. Go!`);
        }
      }, 1000);
    }
  }

  // ─── Controls ───
  function pauseRun() {
    if (!state.isPaused) {
      state.isPaused = true;
      state.pauseStart = Date.now();
      UI.setPauseButton(true);
      Voice.speak('Run paused.');
    } else {
      state.pausedDuration += Date.now() - state.pauseStart;
      state.isPaused = false;
      UI.setPauseButton(false);
      Voice.speak('Resuming.');
    }
  }

  function confirmStop() {
    if (state.isLocked) return;
    if (state.totalDistance < 100) {
      stopRun(false);
      return;
    }
    if (confirm('End this run?')) {
      stopRun(false);
    }
  }

  function stopRun(silent) {
    state.isRunning = false;
    state.isPaused = false;

    if (state.watchId != null) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (state.intervalRestTimer) {
      clearInterval(state.intervalRestTimer);
      state.intervalRestTimer = null;
    }
    Voice.cancel();

    if (!silent && state.totalDistance > 50) {
      showSummary();
    }
  }

  function toggleVoice() {
    const nowEnabled = !Voice.isEnabled();
    Voice.setEnabled(nowEnabled);
    UI.setVoiceToggle(nowEnabled);
  }

  function toggleLock() {
    state.isLocked = !state.isLocked;
    UI.setLockButton(state.isLocked);
  }

  function centerMap() {
    if (state.positions.length > 0) {
      const last = state.positions[state.positions.length - 1];
      MapManager.centerOn(last.lat, last.lon);
    }
  }

  // ─── Summary ───
  function showSummary() {
    UI.showScreen('summary');

    const elapsed = getElapsed();
    const distKm = state.totalDistance / 1000;
    const avgPace = state.totalDistance > 10
      ? GPS.formatPace((elapsed / state.totalDistance) * 1000)
      : '--:--';

    UI.buildSummary(
      state.runType, distKm, elapsed, avgPace,
      state.splits, state.config, state.intervalRep
    );

    Voice.speak(Voice.endMessage(distKm, elapsed, avgPace));

    // Summary map
    if (state.positions.length > 2) {
      MapManager.initSummary('summary-map', state.positions);
    } else {
      document.getElementById('summary-map').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:14px;">Route too short to display</div>';
    }
  }

  // ─── GPX Export ───
  function exportGPX() {
    if (state.positions.length < 2) {
      alert('Not enough GPS data to export.');
      return;
    }

    const name = UI.RUN_TYPE_NAMES[state.runType] + ' - ' + new Date().toLocaleDateString();
    const gpx = GPS.generateGPX(state.positions, name, state.startTime);

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paceup-' + new Date().toISOString().slice(0, 10) + '.gpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Wake lock ───
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      // Wake lock not supported or failed — non-critical
    }
  }

  // ─── Boot ───
  init();

})();
