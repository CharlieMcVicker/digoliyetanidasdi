/**
 * Formats a start and end second range into a compact time string, e.g. "1:05–1:20".
 */
export function formatTimeRange(startSec: number, endSec: number): string {
  const fmt = (s: number) => {
    const total = Math.max(0, Math.round(s));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  return `${fmt(startSec)}–${fmt(endSec)}`;
}
