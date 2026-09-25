/* ============================================================
   PaceUp — History Module
   Saves completed runs to localStorage
   ============================================================ */

const History = (() => {

  const STORAGE_KEY = 'paceup_runs';

  function getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('History: read failed', e);
      return [];
    }
  }

  function save(run) {
    try {
      const runs = getAll();
      runs.unshift(run); // newest first

      // Keep last 100 runs to limit storage
      if (runs.length > 100) runs.length = 100;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
      return true;
    } catch (e) {
      console.warn('History: save failed', e);
      return false;
    }
  }

  function deleteRun(index) {
    try {
      const runs = getAll();
      if (index >= 0 && index < runs.length) {
        runs.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
      }
    } catch (e) {
      console.warn('History: delete failed', e);
    }
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  // Build a run record from app state
  function createRecord(runType, config, totalDistance, elapsed, avgPace, splits, positions) {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString(),
      runType,
      distance: totalDistance,          // meters
      duration: elapsed,                // seconds
      avgPace,                          // seconds per km
      splits,                           // array of {km, time}
      config: {                         // trimmed config
        targetPace: config.targetPace || config.maxPace || null,
        goalTime: config.goalTime || null,
        reps: config.reps || null,
        repDist: config.repDist || null,
      },
      routePointCount: positions.length,
      // Don't store full GPS track in history — too large.
      // GPX export handles the full route at run-end.
    };
  }

  return { getAll, save, deleteRun, clear, createRecord };

})();
