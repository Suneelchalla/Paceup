/* ============================================================
   PaceUp — UI Module v2
   Screen management, form builders, lock/modal, DOM helpers
   ============================================================ */

var UI = (function() {

  var RUN_TYPE_NAMES = { easy:'Easy Run', tempo:'Tempo Run', intervals:'Intervals', long:'Long Run', race:'Race Mode' };
  var RUN_TYPE_BADGES = { easy:'EASY', tempo:'TEMPO', intervals:'INTERVALS', long:'LONG', race:'RACE' };

  // ─── Setup form ───
  function buildSetupForm(type) {
    document.getElementById('setup-title').textContent = RUN_TYPE_NAMES[type] + ' Setup';
    var f = document.getElementById('setup-fields');
    var html = '';
    switch(type) {
      case 'easy':
        html = fieldPace('Maximum pace (don\'t go faster than)', 6, 0, 'min:sec per km — pacer warns if faster');
        break;
      case 'tempo':
        html = fieldPace('Target tempo pace', 5, 15, 'min:sec per km — ±15s tolerance');
        html += fieldNumber('Tempo distance (km)', 'cfg-dist', 5, 1, 30);
        break;
      case 'intervals':
        html = fieldPills('Interval distance', 'interval-dist-pills', [
          {val:200,label:'200m'}, {val:400,label:'400m',selected:true}, {val:800,label:'800m'}, {val:1000,label:'1000m'}
        ]);
        html += fieldNumber('Number of reps', 'cfg-reps', 8, 1, 30);
        html += fieldPace('Target rep pace', 4, 30, 'min:sec per km');
        html += fieldNumber('Rest between reps (sec)', 'cfg-rest', 90, 15, 600);
        break;
      case 'long':
        html = fieldPace('Target pace', 6, 30, 'min:sec per km');
        html += fieldNumber('Distance goal (km)', 'cfg-dist', 15, 5, 50);
        break;
      case 'race':
        html = fieldPills('Race distance', 'race-dist-pills', [
          {val:5,label:'5K',selected:true}, {val:10,label:'10K'}, {val:21.1,label:'Half'}, {val:42.2,label:'Full'}
        ]);
        html += fieldGoalTime();
        break;
    }
    html += voiceBlock();
    html += '<button class="start-btn" id="btn-start-run">Start Run</button>';
    f.innerHTML = html;
  }

  function fieldPace(label, dm, ds, hint) {
    return '<div class="field-group"><label class="field-label">'+label+'</label><div class="field-row">' +
      '<input class="field-input" type="number" id="cfg-min" min="2" max="15" value="'+dm+'" inputmode="numeric" style="flex:1">' +
      '<span class="field-sep">:</span>' +
      '<input class="field-input" type="number" id="cfg-sec" min="0" max="59" value="'+ds+'" inputmode="numeric" style="flex:1">' +
      '</div><span class="unit-label">'+hint+'</span></div>';
  }
  function fieldNumber(label, id, val, min, max) {
    return '<div class="field-group"><label class="field-label">'+label+'</label>' +
      '<input class="field-input" type="number" id="'+id+'" value="'+val+'" min="'+min+'" max="'+max+'" inputmode="numeric"></div>';
  }
  function fieldPills(label, gid, opts) {
    var p = opts.map(function(o) {
      return '<div class="pill'+(o.selected?' selected':'')+'" data-val="'+o.val+'">'+o.label+'</div>';
    }).join('');
    return '<div class="field-group"><label class="field-label">'+label+'</label><div class="pill-group" id="'+gid+'">'+p+'</div></div>';
  }
  function fieldGoalTime() {
    return '<div class="field-group"><label class="field-label">Goal time</label><div class="field-row">' +
      '<input class="field-input" type="number" id="cfg-hrs" value="0" min="0" max="8" inputmode="numeric" style="flex:1"><span class="field-sep">h</span>' +
      '<input class="field-input" type="number" id="cfg-min" value="25" min="0" max="59" inputmode="numeric" style="flex:1"><span class="field-sep">m</span>' +
      '<input class="field-input" type="number" id="cfg-sec" value="0" min="0" max="59" inputmode="numeric" style="flex:1"><span class="field-sep">s</span>' +
      '</div></div>';
  }
  function voiceBlock() {
    return '<div class="voice-settings"><h4>🔊 Voice Pacer</h4>' +
      '<div class="toggle-row"><span>Voice guidance</span><button class="toggle on" id="toggle-voice" type="button"></button></div>' +
      '<div class="range-row"><span>Frequency</span><input type="range" id="voice-freq" min="10" max="60" value="30"><span class="range-val" id="voice-freq-val">30s</span></div></div>';
  }

  function parseConfig(type) {
    var cfg = {};
    var m = document.getElementById('cfg-min'), s = document.getElementById('cfg-sec');
    switch(type) {
      case 'easy': cfg.maxPace = (parseInt(m.value)||6)*60 + (parseInt(s.value)||0); break;
      case 'tempo':
        cfg.targetPace = (parseInt(m.value)||5)*60 + (parseInt(s.value)||15);
        cfg.tolerance = 15;
        cfg.distance = parseFloat(document.getElementById('cfg-dist').value)||5;
        break;
      case 'intervals':
        var sel = document.querySelector('#interval-dist-pills .pill.selected');
        cfg.repDist = sel ? parseFloat(sel.dataset.val) : 400;
        cfg.reps = parseInt(document.getElementById('cfg-reps').value)||8;
        cfg.targetPace = (parseInt(m.value)||4)*60 + (parseInt(s.value)||30);
        cfg.restSeconds = parseInt(document.getElementById('cfg-rest').value)||90;
        break;
      case 'long':
        cfg.targetPace = (parseInt(m.value)||6)*60 + (parseInt(s.value)||30);
        cfg.distance = parseFloat(document.getElementById('cfg-dist').value)||15;
        break;
      case 'race':
        var h = parseInt(document.getElementById('cfg-hrs').value)||0;
        var rsel = document.querySelector('#race-dist-pills .pill.selected');
        cfg.distance = rsel ? parseFloat(rsel.dataset.val) : 5;
        cfg.goalTime = h*3600 + (parseInt(m.value)||25)*60 + (parseInt(s.value)||0);
        cfg.targetPace = cfg.goalTime / cfg.distance;
        break;
    }
    cfg.voiceEnabled = document.getElementById('toggle-voice').classList.contains('on');
    cfg.voiceFreq = parseInt(document.getElementById('voice-freq').value)||30;
    return cfg;
  }

  // ─── Active run UI ───
  function updateRunStats(pace, dist, time, avg) {
    document.getElementById('current-pace').textContent = pace;
    document.getElementById('stat-distance').textContent = dist;
    document.getElementById('stat-time').textContent = time;
    document.getElementById('stat-avg-pace').textContent = avg;
    document.getElementById('lock-pace').textContent = pace;
    document.getElementById('lock-dist').textContent = dist;
    document.getElementById('lock-time').textContent = time;
  }
  function updatePaceDisplay(s) {
    document.getElementById('pace-dot').className = 'pace-dot ' + s.dotClass;
    document.getElementById('pace-status-text').textContent = s.statusText;
    var ind = document.getElementById('target-indicator');
    ind.textContent = s.indicatorText; ind.style.color = s.indicatorColor;
  }
  function setRunTypeBadge(t) { document.getElementById('run-type-badge').textContent = RUN_TYPE_BADGES[t]; }
  function showIntervalBar(s) { document.getElementById('interval-bar').classList.toggle('show', s); }
  function updateIntervalBar(txt, phase) {
    document.getElementById('rep-info').textContent = txt;
    var b = document.getElementById('phase-badge'); b.textContent = phase.toUpperCase(); b.className = 'phase-badge phase-' + phase;
  }
  function setPauseButton(p) {
    var b = document.getElementById('pause-btn');
    b.className = p ? 'ctrl-btn btn-resume' : 'ctrl-btn btn-pause';
    b.innerHTML = p ? '▶ Resume' : '⏸ Pause';
  }
  function showGPSOverlay(s) { document.getElementById('gps-overlay').classList.toggle('hidden', !s); }
  function setGPSMessage(m) { document.getElementById('gps-overlay-msg').textContent = m; }
  function showCountdown(s) { document.getElementById('countdown-overlay').classList.toggle('hidden', !s); }
  function setCountdownNumber(n) {
    var el = document.getElementById('countdown-num'); el.textContent = n;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'count-pulse 0.6s ease-out';
  }
  function setVoiceToggle(on) {
    var b = document.getElementById('voice-toggle-btn'); b.textContent = on ? '🔊' : '🔇'; b.classList.toggle('muted', !on);
  }
  function showLockOverlay(s) { document.getElementById('lock-overlay').classList.toggle('visible', s); }
  function showStopModal(d, t) {
    document.getElementById('stop-modal-info').textContent = d + ' km · ' + t;
    document.getElementById('stop-modal').classList.add('visible');
  }
  function hideStopModal() { document.getElementById('stop-modal').classList.remove('visible'); }

  // ─── Summary ───
  function buildSummary(runType, distKm, elapsed, avgPace, splits, config, intervalRep) {
    document.getElementById('summary-subtitle').textContent = RUN_TYPE_NAMES[runType] + ' · ' + new Date().toLocaleDateString();
    var h = '<div class="summary-card"><div class="val">' + distKm.toFixed(2) + '</div><div class="lbl">Distance (km)</div></div>' +
      '<div class="summary-card"><div class="val">' + GPS.formatTime(elapsed) + '</div><div class="lbl">Duration</div></div>' +
      '<div class="summary-card"><div class="val">' + avgPace + '</div><div class="lbl">Avg Pace</div></div>';
    if (runType === 'race') {
      var gd = Math.round(elapsed - config.goalTime);
      h += '<div class="summary-card"><div class="val" style="color:' + (gd<=0?'var(--green)':'var(--red)') + '">' + (gd<=0 ? Math.abs(gd)+'s ahead' : gd+'s behind') + '</div><div class="lbl">vs Goal</div></div>';
    } else if (runType === 'intervals') {
      h += '<div class="summary-card"><div class="val">' + intervalRep + ' / ' + config.reps + '</div><div class="lbl">Reps</div></div>';
    } else {
      h += '<div class="summary-card"><div class="val">' + Math.round(distKm*62) + '</div><div class="lbl">Est. Cal</div></div>';
    }
    document.getElementById('summary-stats').innerHTML = h;

    var sh = '';
    splits.forEach(function(s) {
      var tgt = config.targetPace || config.maxPace;
      var c = 'var(--text)';
      if (tgt) { if (s.time < tgt-15) c='var(--red)'; else if (s.time > tgt+15) c='var(--amber)'; else c='var(--green)'; }
      sh += '<div class="split-row"><span class="km">Km '+s.km+'</span><span class="pace" style="color:'+c+'">'+GPS.formatPace(s.time)+'</span></div>';
    });
    document.getElementById('splits-list').innerHTML = sh || '<p style="color:var(--text-dim);font-size:13px">Shorter than 1 km</p>';
  }

  return {
    RUN_TYPE_NAMES:RUN_TYPE_NAMES, buildSetupForm:buildSetupForm, parseConfig:parseConfig,
    updateRunStats:updateRunStats, updatePaceDisplay:updatePaceDisplay,
    setRunTypeBadge:setRunTypeBadge, showIntervalBar:showIntervalBar, updateIntervalBar:updateIntervalBar,
    setPauseButton:setPauseButton, showGPSOverlay:showGPSOverlay, setGPSMessage:setGPSMessage,
    showCountdown:showCountdown, setCountdownNumber:setCountdownNumber, setVoiceToggle:setVoiceToggle,
    showLockOverlay:showLockOverlay, showStopModal:showStopModal, hideStopModal:hideStopModal,
    buildSummary:buildSummary
  };
})();
