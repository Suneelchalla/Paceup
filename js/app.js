/* ============================================================
   PaceUp — App Controller (FIXED)
   State management, run lifecycle, event wiring
   - Lock overlay: full-screen touch blocker with hold-to-unlock
   - Stop: custom modal instead of broken confirm()
   - Wake lock: persistent, re-acquires on visibility change
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
    positions: [],
    speeds: [],
    splits: [],
    lastSplitTime: 0,
    lastVoiceTime: 0,
    watchId: null,
    timerInterval: null,
    wakeLock: null,
    // Interval-specific
    intervalPhase: 'work',
    intervalRep: 0,
    intervalPhaseDist: 0,
    intervalRestTimer: null,
    // Unlock hold tracking
    unlockTimer: null,
    unlockStart: 0,
    unlockRAF: null,
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
    UI.showLockOverlay(false);
    UI.hideStopModal();
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
    document.querySelectorAll('.run-type-card').forEach(function(card) {
      card.addEventListener('click', function() {
        selectRunType(card.dataset.type);
      });
    });

    // Back button
    document.getElementById('btn-back-home').addEventListener('click', goHome);

    // Active run controls
    document.getElementById('voice-toggle-btn').addEventListener('click', toggleVoice);
    document.getElementById('center-btn').addEventListener('click', centerMap);
    document.getElementById('pause-btn').addEventListener('click', pauseRun);
    document.getElementById('stop-btn').addEventListener('click', requestStop);
    document.getElementById('lock-btn').addEventListener('click', lockScreen);

    // Stop modal buttons
    document.getElementById('stop-cancel').addEventListener('click', function() {
      UI.hideStopModal();
    });
    document.getElementById('stop-confirm').addEventListener('click', function() {
      UI.hideStopModal();
      stopRun(false);
    });

    // Unlock button — hold for 2 seconds to unlock
    initUnlockButton();

    // Summary
    document.getElementById('btn-done').addEventListener('click', goHome);
    document.getElementById('btn-export').addEventListener('click', exportGPX);

    // Re-acquire wake lock when page becomes visible again
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && state.isRunning) {
        requestWakeLock();
      }
    });
  }

  function bindSetupEvents() {
    document.querySelectorAll('.pill-group .pill').forEach(function(pill) {
      pill.addEventListener('click', function() {
        pill.parentElement.querySelectorAll('.pill').forEach(function(p) {
          p.classList.remove('selected');
        });
        pill.classList.add('selected');
      });
    });

    var toggle = document.getElementById('toggle-voice');
    if (toggle) {
      toggle.addEventListener('click', function() {
        toggle.classList.toggle('on');
      });
    }

    var startBtn = document.getElementById('btn-start-run');
    if (startBtn) {
      startBtn.addEventListener('click', startRun);
    }
  }

  // ─── LOCK SCREEN ───

  function lockScreen() {
    state.isLocked = true;
    UI.showLockOverlay(true);
  }

  function unlockScreen() {
    state.isLocked = false;
    UI.showLockOverlay(false);
  }

  function initUnlockButton() {
    var btn = document.getElementById('unlock-btn');
    var fill = document.getElementById('unlock-fill');
    var HOLD_DURATION = 2000; // 2 seconds

    function startHold(e) {
      e.preventDefault();
      e.stopPropagation();
      state.unlockStart = Date.now();

      // Animate the fill bar
      function animateFill() {
        var elapsed = Date.now() - state.unlockStart;
        var pct = Math.min((elapsed / HOLD_DURATION) * 100, 100);
        fill.style.width = pct + '%';

        if (pct >= 100) {
          // Unlock!
          fill.style.width = '0%';
          unlockScreen();
          return;
        }
        state.unlockRAF = requestAnimationFrame(animateFill);
      }
      state.unlockRAF = requestAnimationFrame(animateFill);
    }

    function endHold(e) {
      e.preventDefault();
      e.stopPropagation();
      if (state.unlockRAF) {
        cancelAnimationFrame(state.unlockRAF);
        state.unlockRAF = null;
      }
      fill.style.width = '0%';
      state.unlockStart = 0;
    }

    // Touch events
    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend', endHold, { passive: false });
    btn.addEventListener('touchcancel', endHold, { passive: false });

    // Mouse events (for desktop testing)
    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', endHold);
    btn.addEventListener('mouseleave', endHold);

    // Block ALL touches on the lock overlay except the unlock button
    document.getElementById('lock-overlay').addEventListener('touchstart', function(e) {
      // Only allow touches on the unlock button
      if (!btn.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    document.getElementById('lock-overlay').addEventListener('touchmove', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false });
  }

  // ─── STOP (with custom modal) ───

  function requestStop() {
    // If very short run, just stop directly
    if (state.totalDistance < 100) {
      stopRun(false);
      return;
    }
    // Show custom modal instead of browser confirm()
    var distKm = (state.totalDistance / 1000).toFixed(2);
    var timeStr = GPS.formatTime(getElapsed());
    UI.showStopModal(distKm, timeStr);
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
      UI.updateIntervalBar('Rep 1 / ' + state.config.reps, 'work');
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
    UI.showLockOverlay(false);
    UI.hideStopModal();

    // Show GPS overlay
    UI.showGPSOverlay(true);
    UI.showCountdown(false);

    if (!navigator.geolocation) {
      alert('GPS is not available on this device.');
      goHome();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(pos) {
        MapManager.initRun('map', pos.coords.latitude, pos.coords.longitude);
        UI.showGPSOverlay(false);
        runCountdown();
      },
      function(err) {
        UI.setGPSMessage('GPS error: ' + err.message + '. Enable location access and retry.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function runCountdown() {
    UI.showCountdown(true);
    var count = 3;
    UI.setCountdownNumber(count);
    Voice.speak(String(count));

    var iv = setInterval(function() {
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
      function(err) { console.warn('GPS error:', err.message); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    // Timer tick — updates both main screen and lock screen
    state.timerInterval = setInterval(function() {
      if (!state.isPaused) {
        var t = GPS.formatTime(getElapsed());
        document.getElementById('stat-time').textContent = t;
        // Also update lock screen time
        document.getElementById('lock-time').textContent = t;
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

    var result = GPS.processPosition(pos, state.positions);
    if (!result) return;

    if (result.dist > 0) {
      state.totalDistance += result.dist;
      state.speeds.push(result.speed);

      var kmNow = Math.floor(state.totalDistance / 1000);
      var kmPrev = Math.floor((state.totalDistance - result.dist) / 1000);
      if (kmNow > kmPrev && kmNow > 0) {
        recordSplit(kmNow);
      }
    }

    state.positions.push(result);

    // Update map (follow only if not locked)
    MapManager.addPoint(result.lat, result.lon, !state.isLocked);

    // Update UI (both main stats and lock screen stats)
    updateStats();

    // Voice cues
    checkVoice();

    // Interval logic
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
    var avgPace = state.totalDistance > 10
      ? (elapsed / state.totalDistance) * 1000
      : 0;

    UI.updateRunStats(
      GPS.formatPace(pace),
      distKm,
      GPS.formatTime(elapsed),
      GPS.formatPace(avgPace)
    );

    var status = Pacer.getPaceStatus(state.runType, state.config, pace);
    UI.updatePaceDisplay(status);
  }

  function checkVoice() {
    var elapsed = getElapsed();
    if (!Pacer.shouldSpeak(elapsed, state.lastVoiceTime, state.config.voiceFreq)) return;
    state.lastVoiceTime = elapsed;

    var speed = GPS.smoothSpeed(state.speeds, 8);
    var pace = GPS.speedToPace(speed);
    if (pace <= 0 || !isFinite(pace)) return;

    var paceStr = GPS.formatPace(pace);
    var msg = Voice.paceCue(
      state.runType, state.config, paceStr, pace, elapsed, state.totalDistance
    );
    Voice.speak(msg);
  }

  // ─── Interval logic ───
  function checkInterval() {
    var cfg = state.config;
    if (state.intervalPhase !== 'work') return;

    var distInRep = state.totalDistance - state.intervalPhaseDist;
    if (distInRep >= cfg.repDist) {
      state.intervalRep++;
      UI.updateIntervalBar('Rep ' + state.intervalRep + ' / ' + cfg.reps, 'work');

      if (Pacer.isIntervalComplete(state.intervalRep, cfg.reps)) {
        Voice.speak(Voice.intervalRepDone(state.intervalRep, cfg.reps, 0));
        return;
      }

      Voice.speak(Voice.intervalRepDone(state.intervalRep, cfg.reps, cfg.restSeconds));

      state.intervalPhase = 'rest';
      state.config._intervalPhase = 'rest';
      UI.updateIntervalBar('Rep ' + state.intervalRep + ' / ' + cfg.reps, 'rest');

      var restLeft = cfg.restSeconds;
      state.intervalRestTimer = setInterval(function() {
        restLeft--;
        if (restLeft === 30) Voice.speak('30 seconds to next rep.');
        if (restLeft === 10) Voice.speak('10 seconds. Get ready.');
        if (restLeft <= 3 && restLeft > 0) Voice.speak(String(restLeft));
        if (restLeft <= 0) {
          clearInterval(state.intervalRestTimer);
          state.intervalPhase = 'work';
          state.config._intervalPhase = 'work';
          state.intervalPhaseDist = state.totalDistance;
          UI.updateIntervalBar('Rep ' + (state.intervalRep + 1) + ' / ' + cfg.reps, 'work');
          Voice.speak('Rep ' + (state.intervalRep + 1) + '. Go!');
        }
      }, 1000);
    }
  }

  // ─── Controls ───
  function pauseRun() {
    if (state.isLocked) return; // Can't pause while locked

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

  function stopRun(silent) {
    state.isRunning = false;
    state.isPaused = false;
    state.isLocked = false;

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
    releaseWakeLock();
    UI.showLockOverlay(false);
    UI.hideStopModal();

    if (!silent && state.totalDistance > 50) {
      showSummary();
    }
  }

  function toggleVoice() {
    var nowEnabled = !Voice.isEnabled();
    Voice.setEnabled(nowEnabled);
    UI.setVoiceToggle(nowEnabled);
  }

  function centerMap() {
    if (state.positions.length > 0) {
      var last = state.positions[state.positions.length - 1];
      MapManager.centerOn(last.lat, last.lon);
    }
  }

  // ─── Summary ───
  function showSummary() {
    UI.showScreen('summary');

    var elapsed = getElapsed();
    var distKm = state.totalDistance / 1000;
    var avgPace = state.totalDistance > 10
      ? GPS.formatPace((elapsed / state.totalDistance) * 1000)
      : '--:--';

    UI.buildSummary(
      state.runType, distKm, elapsed, avgPace,
      state.splits, state.config, state.intervalRep
    );

    Voice.speak(Voice.endMessage(distKm, elapsed, avgPace));

    if (state.positions.length > 2) {
      MapManager.initSummary('summary-map', state.positions);
    } else {
      document.getElementById('summary-map').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:14px;">Route too short to display</div>';
    }

    // Save to history
    if (typeof History !== 'undefined' && History.createRecord) {
      var avgPaceVal = state.totalDistance > 10
        ? (elapsed / state.totalDistance) * 1000 : 0;
      var record = History.createRecord(
        state.runType, state.config, state.totalDistance,
        elapsed, avgPaceVal, state.splits, state.positions
      );
      History.save(record);
    }
  }

  // ─── GPX Export ───
  function exportGPX() {
    if (state.positions.length < 2) {
      alert('Not enough GPS data to export.');
      return;
    }

    var name = UI.RUN_TYPE_NAMES[state.runType] + ' - ' + new Date().toLocaleDateString();
    var gpx = GPS.generateGPX(state.positions, name, state.startTime);

    var blob = new Blob([gpx], { type: 'application/gpx+xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'paceup-' + new Date().toISOString().slice(0, 10) + '.gpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Wake lock (persistent) ───
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;

    navigator.wakeLock.request('screen')
      .then(function(lock) {
        state.wakeLock = lock;
        // Re-acquire if released (e.g., tab switch)
        lock.addEventListener('release', function() {
          state.wakeLock = null;
          // Re-acquire if still running
          if (state.isRunning) {
            requestWakeLock();
          }
        });
      })
      .catch(function(err) {
        console.log('Wake lock failed:', err.message);
      });
  }

  function releaseWakeLock() {
    if (state.wakeLock) {
      state.wakeLock.release().catch(function() {});
      state.wakeLock = null;
    }
  }

  // ─── Boot ───
  init();

})();
