export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(remain).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatWatts(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return String(Math.round(value));
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatSpeed(mps: number): string {
  return `${(mps * 3.6).toFixed(1)}`;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function recordedRides(count: number): string {
  return count === 1 ? '1 recorded ride' : `${count} recorded rides`;
}

export function weekdayName(day: number): string {
  return DAYS[day - 1] ?? `Day ${day}`;
}
