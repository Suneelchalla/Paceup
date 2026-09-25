/* ============================================================
   PaceUp — Voice Module
   Speech synthesis with queue system and natural phrasing
   ============================================================ */

const Voice = (() => {

  let queue = [];
  let isSpeaking = false;
  let enabled = true;
  let preferredVoice = null;

  // Initialize voices — must be called after page load
  function init() {
    if (!('speechSynthesis' in window)) return;
    loadVoice();
    speechSynthesis.onvoiceschanged = loadVoice;
  }

  function loadVoice() {
    const voices = speechSynthesis.getVoices();
    // Prefer natural, English female voices
    preferredVoice =
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Samantha')) ||
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Karen')) ||
      voices.find(v => v.lang.startsWith('en') && !v.localService && v.name.includes('Female')) ||
      voices.find(v => v.lang.startsWith('en') && !v.localService) ||
      voices.find(v => v.lang.startsWith('en')) ||
      null;
  }

  function setEnabled(val) {
    enabled = val;
    if (!val) cancel();
  }

  function isEnabled() {
    return enabled;
  }

  // Add a message to the queue
  function speak(text) {
    if (!enabled || !('speechSynthesis' in window)) return;
    queue.push(text);
    processQueue();
  }

  function processQueue() {
    if (isSpeaking || queue.length === 0) return;
    isSpeaking = true;

    const text = queue.shift();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (preferredVoice) utter.voice = preferredVoice;

    utter.onend = () => {
      isSpeaking = false;
      processQueue();
    };
    utter.onerror = () => {
      isSpeaking = false;
      processQueue();
    };

    speechSynthesis.speak(utter);
  }

  function cancel() {
    queue = [];
    isSpeaking = false;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ─── Run-type-specific message generators ───

  function startMessage(runType, config) {
    const pace = GPS.formatPace(config.targetPace || config.maxPace);
    switch (runType) {
      case 'easy':
        return `Easy run started. Keep it relaxed. No faster than ${pace} per K.`;
      case 'tempo':
        return `Tempo run started. Target pace: ${pace}. Lock in after warming up.`;
      case 'intervals':
        return `Interval session. ${config.reps} reps of ${config.repDist} meters. Rep 1. Go!`;
      case 'long':
        return `Long run started. ${pace} pace. Stay patient and enjoy it.`;
      case 'race':
        return `Race mode. Goal: ${GPS.formatTime(config.goalTime)}. Target pace: ${pace} per K. Let's go.`;
      default:
        return 'Run started.';
    }
  }

  function paceCue(runType, config, paceStr, pace, elapsed, totalDistance) {
    switch (runType) {
      case 'easy':
        if (pace < config.maxPace - 10) {
          return `You're at ${paceStr}. That's too fast. Slow down. This should feel conversational.`;
        }
        return `${paceStr}. Nice and easy. Stay relaxed.`;

      case 'tempo': {
        const diff = pace - config.targetPace;
        if (Math.abs(diff) <= config.tolerance) {
          return `${paceStr}. Right in the tempo zone. Hold this.`;
        } else if (diff > config.tolerance) {
          return `${paceStr}. Below tempo pace. Pick it up slightly.`;
        }
        return `${paceStr}. Ease back a touch. Save energy for the full tempo.`;
      }

      case 'long': {
        const diff = pace - config.targetPace;
        if (diff < -20) {
          return `${paceStr}. A bit fast for a long run. Save your legs.`;
        }
        const distLeft = config.distance - totalDistance / 1000;
        if (distLeft > 1) {
          return `${paceStr}. ${distLeft.toFixed(1)} K to go. Stay patient.`;
        }
        return `${paceStr}. Almost there. Strong finish.`;
      }

      case 'race': {
        const distKm = totalDistance / 1000;
        const expectedTime = distKm * config.targetPace;
        const timeDiff = Math.round(expectedTime - elapsed);
        if (timeDiff > 0) {
          const extra = timeDiff > 30 ? " Stay disciplined. Don't burn out." : '';
          return `${paceStr}. ${timeDiff} seconds ahead of goal pace.${extra}`;
        } else if (timeDiff < 0) {
          const extra = Math.abs(timeDiff) > 30 ? ' Pick it up gradually.' : ' Close the gap.';
          return `${paceStr}. ${Math.abs(timeDiff)} seconds behind.${extra}`;
        }
        return `${paceStr}. Right on target. Keep it steady.`;
      }

      default:
        return `Pace: ${paceStr}.`;
    }
  }

  function splitMessage(km, splitPace) {
    return `Kilometer ${km}. Split: ${splitPace}.`;
  }

  function intervalRepDone(repNum, totalReps, restSeconds) {
    if (repNum >= totalReps) {
      return `All ${totalReps} reps complete! Great workout. Cool down.`;
    }
    return `Rep ${repNum} done! Rest for ${restSeconds} seconds.`;
  }

  function endMessage(distKm, elapsed, avgPace) {
    return `Run complete. ${distKm.toFixed(2)} kilometers in ${GPS.formatTime(elapsed)}. Average pace: ${avgPace} per K. Great effort.`;
  }

  return {
    init,
    setEnabled,
    isEnabled,
    speak,
    cancel,
    startMessage,
    paceCue,
    splitMessage,
    intervalRepDone,
    endMessage
  };

})();
