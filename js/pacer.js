/* ============================================================
   PaceUp — Pacer Module
   Run-type-specific pacing logic
   ============================================================ */

const Pacer = (() => {

  // Returns { status, dotClass, statusText, indicatorText, indicatorColor }
  function getPaceStatus(runType, config, pace) {
    if (pace <= 0 || !isFinite(pace)) {
      return {
        dotClass: 'green',
        statusText: 'Waiting for pace...',
        indicatorText: '',
        indicatorColor: ''
      };
    }

    switch (runType) {
      case 'easy':
        return easyStatus(config, pace);
      case 'tempo':
        return tempoStatus(config, pace);
      case 'intervals':
        return intervalStatus(config, pace);
      case 'long':
        return longStatus(config, pace);
      case 'race':
        return raceStatus(config, pace);
      default:
        return { dotClass: 'green', statusText: 'Running', indicatorText: '', indicatorColor: '' };
    }
  }

  function easyStatus(config, pace) {
    if (pace < config.maxPace - 10) {
      return {
        dotClass: 'red',
        statusText: 'Too fast!',
        indicatorText: '⚠ Slow down',
        indicatorColor: 'var(--red)'
      };
    }
    return {
      dotClass: 'green',
      statusText: 'Good pace',
      indicatorText: '✓ Easy and relaxed',
      indicatorColor: 'var(--green)'
    };
  }

  function tempoStatus(config, pace) {
    const diff = pace - config.targetPace;
    const tol = config.tolerance || 15;
    if (Math.abs(diff) <= tol) {
      return {
        dotClass: 'green',
        statusText: 'On pace',
        indicatorText: '✓ In the tempo zone',
        indicatorColor: 'var(--green)'
      };
    } else if (diff > tol) {
      return {
        dotClass: 'amber',
        statusText: 'Too slow',
        indicatorText: `↑ Pick up ${Math.round(diff)}s slow`,
        indicatorColor: 'var(--amber)'
      };
    }
    return {
      dotClass: 'red',
      statusText: 'Too fast',
      indicatorText: `↓ Ease back ${Math.round(-diff)}s fast`,
      indicatorColor: 'var(--red)'
    };
  }

  function intervalStatus(config, pace) {
    if (!config._intervalPhase || config._intervalPhase !== 'work') {
      return { dotClass: 'green', statusText: 'Recovery', indicatorText: 'Rest phase', indicatorColor: 'var(--green)' };
    }
    const diff = pace - config.targetPace;
    const tol = 10;
    if (Math.abs(diff) <= tol) {
      return { dotClass: 'green', statusText: 'On pace', indicatorText: '✓ Right on target', indicatorColor: 'var(--green)' };
    } else if (diff > tol) {
      return { dotClass: 'amber', statusText: 'Push harder', indicatorText: `↑ ${Math.round(diff)}s slow`, indicatorColor: 'var(--amber)' };
    }
    return { dotClass: 'red', statusText: 'Too fast', indicatorText: `↓ Control ${Math.round(-diff)}s`, indicatorColor: 'var(--red)' };
  }

  function longStatus(config, pace) {
    const diff = pace - config.targetPace;
    if (diff < -20) {
      return {
        dotClass: 'amber',
        statusText: 'Too fast',
        indicatorText: '↓ Save your legs',
        indicatorColor: 'var(--amber)'
      };
    }
    if (diff > 20) {
      return {
        dotClass: 'amber',
        statusText: 'Drifting slow',
        indicatorText: `↑ ${Math.round(diff)}s slow`,
        indicatorColor: 'var(--amber)'
      };
    }
    return {
      dotClass: 'green',
      statusText: 'Good pace',
      indicatorText: '✓ Stay patient',
      indicatorColor: 'var(--green)'
    };
  }

  function raceStatus(config, pace) {
    const diff = pace - config.targetPace;
    const tol = 10;
    if (Math.abs(diff) <= tol) {
      return { dotClass: 'green', statusText: 'On pace', indicatorText: '✓ Right on target', indicatorColor: 'var(--green)' };
    } else if (diff > tol) {
      return { dotClass: 'amber', statusText: 'Behind pace', indicatorText: `↑ ${Math.round(diff)}s behind`, indicatorColor: 'var(--amber)' };
    }
    return {
      dotClass: 'red',
      statusText: 'Ahead of pace',
      indicatorText: `↓ ${Math.round(-diff)}s fast — stay disciplined`,
      indicatorColor: 'var(--red)'
    };
  }

  // Should we trigger a voice cue now?
  function shouldSpeak(elapsed, lastVoiceTime, voiceFreq) {
    return (elapsed - lastVoiceTime) >= voiceFreq;
  }

  // Check if all interval reps are done
  function isIntervalComplete(rep, totalReps) {
    return rep >= totalReps;
  }

  return {
    getPaceStatus,
    shouldSpeak,
    isIntervalComplete
  };

})();
