export type CurrentUser = {
  id: string;
  name: string;
  email?: string;
  role: "admin" | "employee";
  department: string;
};

export type DraftAttachment = {
  id: string;
  type: "document" | "image" | "video" | "audio" | "link";
  name: string;
  size?: string;
  sizeBytes?: number;
  url?: string;
  previewUrl?: string;
  mimeType?: string;
  storageKey?: string;
};

export type MessageAttachment = {
  id: string;
  kind: DraftAttachment["type"];
  filename: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  url: string;
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};
