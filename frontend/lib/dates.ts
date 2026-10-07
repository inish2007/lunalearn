export function examCountdown(value: string, now = new Date()): string {
 const date = new Date(value);
 if (!Number.isFinite(date.getTime())) return 'Date unavailable';
 if (date.getTime() < now.getTime()) return 'Exam has passed';
 const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
 const days = Math.round((target.getTime()-today.getTime())/86400000);
 return days===0 ? 'Today' : days===1 ? 'Tomorrow' : `${days} days remaining`;
}
export function toLocalInput(value: string) { const d=new Date(value); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }

/** Reject invalid calendar dates and DST gaps instead of silently rescheduling. */
export function fromLocalInput(value: string): string {
 const date=new Date(value);
 if (!Number.isFinite(date.getTime()) || toLocalInput(date.toISOString())!==value) throw new Error('This local time does not exist. Choose a valid date and time.');
 return date.toISOString();
}
