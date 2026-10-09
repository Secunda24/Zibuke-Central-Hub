// Recurrence expansion for calendar events.
//
// All arithmetic is done on wall-clock string components (YYYY-MM-DDTHH:mm) rather than absolute
// instants. The client posts local-naive `datetime-local` values and the Worker runs on UTC, so
// instant-based maths would silently shift the weekday and time-of-day of every occurrence.

export type RecurrenceEvent = {
  start_time: string;
  end_time: string;
  recurrence_type?: string | null;
  recurrence_day?: number | null;
  recurrence_end_date?: string | null;
};

export type Occurrence = { start: string; end: string };

type Wall = { y: number; mo: number; d: number; h: number; mi: number };
type Day = { y: number; mo: number; d: number };

const pad = (value: number) => String(value).padStart(2, "0");

function parseWall(value: string | null | undefined): Wall | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value || ""));
  if (!match) return null;
  return { y: +match[1], mo: +match[2], d: +match[3], h: +match[4], mi: +match[5] };
}

function parseDay(value: string | null | undefined): Day | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) return null;
  return { y: +match[1], mo: +match[2], d: +match[3] };
}

const formatWall = (parts: Wall) => `${parts.y}-${pad(parts.mo)}-${pad(parts.d)}T${pad(parts.h)}:${pad(parts.mi)}`;
const dayNumber = (parts: Day) => parts.y * 10000 + parts.mo * 100 + parts.d;

// Built in UTC space on purpose: no DST or server-timezone shift can affect the result.
const toMs = (parts: Wall) => Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi);
function fromMs(ms: number): Wall {
  const date = new Date(ms);
  return { y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate(), h: date.getUTCHours(), mi: date.getUTCMinutes() };
}
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const weekdayOf = (parts: Day) => new Date(Date.UTC(parts.y, parts.mo - 1, parts.d)).getUTCDay();
const WEEK_MS = 7 * 86_400_000;

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Occurrences that start within [from, to] (inclusive wall-clock strings), never before the event's
 * own start and never after `recurrence_end_date`. Returns [] for 'none' or an unparseable rule, so
 * callers can simply render the stored row unchanged.
 */
export function expandOccurrences(event: RecurrenceEvent, from: string, to: string, cap = 400): Occurrence[] {
  const type = String(event.recurrence_type || "none");
  if (type !== "daily" && type !== "weekly" && type !== "monthly") return [];

  const anchor = parseWall(event.start_time);
  const anchorEnd = parseWall(event.end_time);
  const windowFrom = parseWall(from);
  const windowTo = parseWall(to);
  if (!anchor || !anchorEnd || !windowFrom || !windowTo) return [];

  const durationMs = Math.max(60_000, toMs(anchorEnd) - toMs(anchor));
  const endBoundary = parseDay(event.recurrence_end_date);
  const upper = dayNumber(windowTo);
  const lower = dayNumber(windowFrom);
  const anchorDay = dayNumber(anchor);

  const occurrences: Occurrence[] = [];
  /** Adds the occurrence and reports whether expansion should continue. */
  const consider = (startMs: number): boolean => {
    const parts = fromMs(startMs);
    const day = dayNumber(parts);
    if (day > upper) return false;                                  // beyond the requested window
    if (endBoundary && day > dayNumber(endBoundary)) return false;  // beyond the rule's own end
    if (day >= anchorDay && day >= lower) {
      occurrences.push({ start: formatWall(parts), end: formatWall(fromMs(startMs + durationMs)) });
    }
    return occurrences.length < cap;
  };

  if (type === "daily") {
    // One occurrence per calendar day at the anchor's time-of-day. recurrence_day is ignored.
    let cursor = toMs(anchor);
    for (let index = 0; index < cap; index += 1) {
      if (!consider(cursor)) break;
      cursor += 86_400_000;
    }
    return occurrences;
  }

  if (type === "weekly") {
    const target = Number.isInteger(event.recurrence_day) ? Number(event.recurrence_day) : weekdayOf(anchor);
    const shift = ((target - weekdayOf(anchor)) % 7 + 7) % 7; // first matching weekday on/after the anchor date
    let cursor = toMs(anchor) + shift * 86_400_000;
    for (let index = 0; index < cap; index += 1) {
      if (!consider(cursor)) break;
      cursor += WEEK_MS;
    }
    return occurrences;
  }

  // Monthly: same day-of-month, skipping months that don't have it (the 31st skips February).
  const dayOfMonth = Number.isInteger(event.recurrence_day) ? Number(event.recurrence_day) : anchor.d;
  let year = anchor.y;
  let month = anchor.mo;
  for (let index = 0; index < cap; index += 1) {
    const lastDay = daysInMonth(year, month);
    if (dayOfMonth <= lastDay) {
      if (!consider(toMs({ y: year, mo: month, d: dayOfMonth, h: anchor.h, mi: anchor.mi }))) break;
    } else if (dayNumber({ y: year, mo: month, d: lastDay }) > upper) {
      break; // this month ends after the window, so every later month does too
    }
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return occurrences;
}
