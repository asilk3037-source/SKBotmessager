import { runDueScheduledCampaigns } from './campaignRunner.js';

let intervalHandle = null;

// Polling instead of one setTimeout per scheduled campaign: simpler to
// reason about (no timers to cancel/reschedule when a campaign is
// cancelled) and self-healing if the process was down when a scheduled
// time passed - the next poll just picks it up late instead of losing it.
export function startCampaignScheduler(intervalMs = 30_000) {
  if (intervalHandle) return intervalHandle;

  const tick = () => {
    runDueScheduledCampaigns().catch((err) => {
      console.error('Falha ao verificar campanhas agendadas:', err);
    });
  };

  tick();
  intervalHandle = setInterval(tick, intervalMs);
  intervalHandle.unref?.();
  return intervalHandle;
}

export function stopCampaignScheduler() {
  clearInterval(intervalHandle);
  intervalHandle = null;
}
