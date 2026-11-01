export type Priority = 'critical' | 'high' | 'medium' | 'low';

const BUSINESS_MINUTES: Record<Exclude<Priority, 'critical'>, number> = {
  high: 4 * 60,
  medium: 3 * 10 * 60,
  low: 5 * 10 * 60,
};

const LOCAL_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

function isBusinessTime(date: Date): boolean {
  const parts = LOCAL_PARTS.formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);

  return weekday !== 'Sat' && weekday !== 'Sun' && hour >= 8 && hour < 18;
}

export function getSlaDeadline({ from, priority }: { from: Date; priority: Priority }): Date {
  if (priority === 'critical') {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }

  let remaining = BUSINESS_MINUTES[priority] * 60 * 1000;
  let cursor = from.getTime();

  while (remaining > 0) {
    const untilNextMinute = 60_000 - (cursor % 60_000);
    const segment = Math.min(remaining, untilNextMinute);

    if (isBusinessTime(new Date(cursor))) {
      remaining -= segment;
    }

    cursor += segment;
  }

  return new Date(cursor);
}

export function classifyPriority({
  teamBlocked,
  personBlocked,
  sameDayCommitment,
  hasWorkaround,
}: {
  teamBlocked: boolean;
  personBlocked: boolean;
  sameDayCommitment: boolean;
  hasWorkaround: boolean;
}): Priority {
  if (teamBlocked) {
    return 'critical';
  }

  if (personBlocked || sameDayCommitment) {
    return 'high';
  }

  if (hasWorkaround) {
    return 'medium';
  }

  return 'low';
}
