const calendar = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function playDate(timestamp) {
  return calendar.format(timestamp);
}

export function playPeriod(now, days) {
  const through = playDate(now);
  if (days === null) return { days, from: null, through };
  // Do calendar arithmetic on the date label so that DST does not change the day count.
  const start = new Date(through + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { days, from: start.toISOString().slice(0, 10), through };
}
