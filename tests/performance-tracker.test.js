/**
 * Performance Tracker — Comprehensive Tests
 */
import { describe, it, expect } from 'vitest';
import { createTracker } from '../server/performanceTracker.js';

describe('createTracker', () => {
  it('should create a tracker with all methods', () => {
    const t = createTracker();
    expect(typeof t.start).toBe('function');
    expect(typeof t.pass).toBe('function');
    expect(typeof t.fail).toBe('function');
    expect(typeof t.get).toBe('function');
    expect(typeof t.getStages).toBe('function');
    expect(typeof t.total).toBe('function');
  });

  it('should track a successful stage', () => {
    const t = createTracker();
    t.start('stage1');
    t.pass('stage1', 'done');
    const stages = t.getStages();
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe('stage1');
    expect(stages[0].status).toBe('success');
    expect(stages[0].note).toBe('done');
    expect(stages[0].ms).toBeGreaterThanOrEqual(0);
  });

  it('should track a failed stage', () => {
    const t = createTracker();
    t.start('failing');
    t.fail('failing', 'timeout');
    const stages = t.getStages();
    expect(stages[0].status).toBe('error');
    expect(stages[0].note).toBe('timeout');
  });

  it('should return 0 for unknown stage', () => {
    const t = createTracker();
    expect(t.get('nonexistent')).toBe(0);
  });

  it('should track multiple stages in order', () => {
    const t = createTracker();
    t.start('load');
    t.pass('load');
    t.start('build');
    t.pass('build');
    t.start('call');
    t.fail('call', 'error');

    const stages = t.getStages();
    expect(stages).toHaveLength(3);
    expect(stages[0].name).toBe('load');
    expect(stages[1].name).toBe('build');
    expect(stages[2].name).toBe('call');
    expect(stages[2].status).toBe('error');
  });

  it('should track total wall-clock time', () => {
    const t = createTracker();
    const total = t.total();
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('should handle pass/fail on non-started stage gracefully', () => {
    const t = createTracker();
    // Should not throw
    t.pass('ghost', 'note');
    t.fail('ghost2', 'note');
    expect(t.getStages()).toHaveLength(0);
  });

  it('should get individual stage timing by name', () => {
    const t = createTracker();
    t.start('myStage');
    t.pass('myStage');
    expect(t.get('myStage')).toBeGreaterThanOrEqual(0);
  });
});
