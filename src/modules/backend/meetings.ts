import crypto from "crypto";

export const DEFAULT_MEETING_PROVIDER = "jitsi";

export function createMeetingRoomId() {
  return `zc-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
