import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { expandOccurrences } from "./recurrence";
export type AvailabilityStatus = "available" | "busy" | "tentative";

export type AvailabilityPerson = {
  userId: string;
  name: string;
  status: AvailabilityStatus;
  conflictCount: number;
};

export type SuggestedSlot = { start_time: string; end_time: string };

export type AvailabilityResult = {
  available: boolean;
  people: AvailabilityPerson[];
  suggestions: SuggestedSlot[];
};

type Interval = { start: number; end: number; status: Exclude<AvailabilityStatus, "available"> };

export async function calculateAvailability(db: D1Database, userIds: string[], startTime: string, endTime: string, excludeEventId?: string | null, withSuggestions = true): Promise<AvailabilityResult> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { available: true, people: [], suggestions: [] };

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) {
    return { available: false, people: [], suggestions: [] };
  }

  const suggestionEnd = new Date(Math.max(Date.now(), start.getTime()) + 30 * 86400000);
  const windowStart = new Date(Math.min(start.getTime(), Date.now()));
  const windowEnd = withSuggestions ? suggestionEnd : end;
  const intervals = await loadIntervals(db, ids, windowStart.toISOString(), windowEnd.toISOString(), excludeEventId || null);
  const names = await loadNames(db, ids);

  const people = ids.map((userId) => {
    const conflicts = overlapping(intervals.get(userId) || [], start.getTime(), end.getTime());
    const status: AvailabilityStatus = conflicts.some((item) => item.status === "busy") ? "busy" : conflicts.some((item) => item.status === "tentative") ? "tentative" : "available";
    return { userId, name: names.get(userId) || "Zibuke user", status, conflictCount: conflicts.length };
  });

  const suggestions = withSuggestions
    ? findSuggestedSlots(ids, intervals, start, end, 5)
    : [];

  return {
    available: people.every((person) => person.status === "available"),
    people,
    suggestions,
  };
}

async function loadNames(db: D1Database, ids: string[]) {
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await db.prepare(`
    SELECT id, COALESCE(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), email) AS display_name
    FROM users
    WHERE archived_at IS NULL AND id IN (${placeholders})
  `).bind(...ids).all<Pick<DatabaseRows["users"], "id"> & {"display_name":string}>();
  return new Map((results).map((row) => [String(row.id), String(row.display_name || "Zibuke user")]));
}

async function loadIntervals(db: D1Database, ids: string[], windowStart: string, windowEnd: string, excludeEventId: string | null) {
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await db.prepare(`
    SELECT e.id, e.start_time, e.end_time, e.organizer_id,
           e.recurrence_type, e.recurrence_day, e.recurrence_end_date,
           ea.user_id AS attendee_user_id, ea.response AS attendee_response
    FROM events e
    LEFT JOIN event_attendees ea ON ea.event_id = e.id
    WHERE e.cancelled_at IS NULL
      AND (
        (datetime(e.start_time) < datetime(?) AND datetime(e.end_time) > datetime(?))
        -- recurring series are fetched whenever they start before the window, so occurrences that
        -- fall inside it can be expanded below (otherwise a weekly meeting never blocks a clash)
        OR (e.recurrence_type != 'none' AND datetime(e.start_time) < datetime(?))
      )
      AND (? IS NULL OR e.id != ?)
      AND (e.organizer_id IN (${placeholders}) OR ea.user_id IN (${placeholders}))
  `).bind(windowEnd, windowStart, windowEnd, excludeEventId, excludeEventId, ...ids, ...ids).all<Pick<DatabaseRows["events"], "id" | "start_time" | "end_time" | "organizer_id" | "recurrence_type" | "recurrence_day" | "recurrence_end_date"> & {"attendee_user_id":string;"attendee_response":string}>();

  const map = new Map<string, Interval[]>();
  const target = new Set(ids);
  for (const row of results) {
    // A recurring series only contributes the occurrences that actually fall in the window.
    const occurrences = expandOccurrences(row, windowStart, windowEnd);
    const spans = occurrences.length
      ? occurrences.map((occurrence) => [new Date(occurrence.start).getTime(), new Date(occurrence.end).getTime()] as const)
      : ([[new Date(row.start_time).getTime(), new Date(row.end_time).getTime()] as const]);

    for (const [start, end] of spans) {
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      if (target.has(row.organizer_id)) addInterval(map, row.organizer_id, { start, end, status: "busy" });
      if (row.attendee_user_id && target.has(row.attendee_user_id) && row.attendee_response !== "declined") {
        addInterval(map, row.attendee_user_id, { start, end, status: row.attendee_response === "tentative" ? "tentative" : "busy" });
      }
    }
  }
  return map;
}

function addInterval(map: Map<string, Interval[]>, userId: string, interval: Interval) {
  const list = map.get(userId) || [];
  if (!list.some((item) => item.start === interval.start && item.end === interval.end && item.status === interval.status)) list.push(interval);
  map.set(userId, list);
}

function overlapping(intervals: Interval[], start: number, end: number) {
  return intervals.filter((item) => item.start < end && item.end > start);
}

function findSuggestedSlots(ids: string[], intervals: Map<string, Interval[]>, proposedStart: Date, proposedEnd: Date, limit: number) {
  const duration = proposedEnd.getTime() - proposedStart.getTime();
  if (duration <= 0 || duration > 8 * 60 * 60 * 1000) return [];

  const suggestions: SuggestedSlot[] = [];
  const cursor = new Date(Math.max(Date.now(), proposedStart.getTime()));
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() < 30 ? 30 : 0);
  if (cursor.getMinutes() === 0) cursor.setHours(cursor.getHours() + 1);

  const endLimit = new Date(cursor.getTime() + 30 * 86400000).getTime();
  while (cursor.getTime() < endLimit && suggestions.length < limit) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      advanceToNextWorkday(cursor);
      continue;
    }
    if (cursor.getHours() < 8) cursor.setHours(8, 0, 0, 0);
    if (cursor.getHours() >= 17) {
      advanceToNextWorkday(cursor);
      continue;
    }

    const slotStart = cursor.getTime();
    const slotEnd = slotStart + duration;
    const workdayEnd = new Date(cursor); workdayEnd.setHours(17, 0, 0, 0);
    if (slotEnd > workdayEnd.getTime()) {
      advanceToNextWorkday(cursor);
      continue;
    }

    const allFree = ids.every((id) => overlapping(intervals.get(id) || [], slotStart, slotEnd).length === 0);
    if (allFree) suggestions.push({ start_time: new Date(slotStart).toISOString(), end_time: new Date(slotEnd).toISOString() });
    cursor.setTime(cursor.getTime() + 30 * 60000);
  }
  return suggestions;
}

function advanceToNextWorkday(date: Date) {
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
}