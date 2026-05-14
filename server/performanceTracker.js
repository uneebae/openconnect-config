/**
 * Performance Tracker
 * Tracks timing for each stage of API validation.
 */

export function createTracker() {
  const stages = {};
  let _start = Date.now();

  return {
    /** Mark the start of a named stage. */
    start(name) {
      stages[name] = { startedAt: Date.now(), ms: null, status: 'running', note: '' };
    },

    /** Mark a stage as completed successfully. */
    pass(name, note = '') {
      if (stages[name]) {
        stages[name].ms = Date.now() - stages[name].startedAt;
        stages[name].status = 'success';
        stages[name].note = note;
      }
    },

    /** Mark a stage as failed. */
    fail(name, note = '') {
      if (stages[name]) {
        stages[name].ms = Date.now() - stages[name].startedAt;
        stages[name].status = 'error';
        stages[name].note = note;
      }
    },

    /** Get individual stage timing by name. */
    get(name) {
      return stages[name]?.ms ?? 0;
    },

    /** Get all stages as an ordered array. */
    getStages() {
      return Object.entries(stages).map(([name, data]) => ({
        name,
        status: data.status,
        ms: data.ms,
        note: data.note,
      }));
    },

    /** Total wall-clock time since tracker creation. */
    total() {
      return Date.now() - _start;
    },
  };
}
