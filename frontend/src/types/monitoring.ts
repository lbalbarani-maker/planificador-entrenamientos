export type KeepAliveStatus = 'ok' | 'error';
export type KeepAliveSource = 'cron' | 'manual';

export interface KeepAliveResult {
  ok: boolean;
  detail: string | null;
}

export interface CronRun {
  id: string;
  ran_at: string;
  status: KeepAliveStatus;
  source: KeepAliveSource;
  detail: string | null;
}
