import { describe, expect, it } from 'vitest';
import { getSlaDeadline } from './sla';

describe('service desk SLA', () => {
  it('counts critical time continuously', () => {
    const from = new Date('2026-11-01T22:30:00.000Z');
    expect(getSlaDeadline({ from, priority: 'critical' }).toISOString()).toBe(
      '2026-11-01T23:30:00.000Z',
    );
  });

  it('continues high priority on the next business day', () => {
    const from = new Date('2026-10-30T20:00:00.000Z');
    expect(getSlaDeadline({ from, priority: 'high' }).toISOString()).toBe(
      '2026-11-02T14:00:00.000Z',
    );
  });

  it('counts five full business days for low priority', () => {
    const from = new Date('2026-11-02T11:00:00.000Z');
    expect(getSlaDeadline({ from, priority: 'low' }).toISOString()).toBe(
      '2026-11-06T21:00:00.000Z',
    );
  });
});
