import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const runDueScheduledCampaignsMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../campaignRunner.js', () => ({ runDueScheduledCampaigns: (...args) => runDueScheduledCampaignsMock(...args) }));

const { startCampaignScheduler, stopCampaignScheduler } = await import('../campaignScheduler.js');

beforeEach(() => {
  vi.useFakeTimers();
  runDueScheduledCampaignsMock.mockClear();
});

afterEach(() => {
  stopCampaignScheduler();
  vi.useRealTimers();
});

describe('campaignScheduler', () => {
  it('checks for due campaigns immediately on start, then on each interval', () => {
    startCampaignScheduler(1000);
    expect(runDueScheduledCampaignsMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(runDueScheduledCampaignsMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(2000);
    expect(runDueScheduledCampaignsMock).toHaveBeenCalledTimes(4);
  });

  it('does not start a second interval if already running', () => {
    startCampaignScheduler(1000);
    startCampaignScheduler(1000);
    runDueScheduledCampaignsMock.mockClear();

    vi.advanceTimersByTime(1000);
    expect(runDueScheduledCampaignsMock).toHaveBeenCalledTimes(1);
  });

  it('stops polling after stopCampaignScheduler()', () => {
    startCampaignScheduler(1000);
    runDueScheduledCampaignsMock.mockClear();
    stopCampaignScheduler();

    vi.advanceTimersByTime(5000);
    expect(runDueScheduledCampaignsMock).not.toHaveBeenCalled();
  });
});
