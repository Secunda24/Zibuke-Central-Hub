export type AnnouncementStatus = "draft" | "scheduled" | "published" | "archived";
export type AnnouncementAudience = "company" | "department" | "role";
export type AnnouncementPriority = "low" | "normal" | "high";

export type AnnouncementAttachment = {
  id: string;
  kind: "image" | "video" | "document";
  slot: "cover" | "attachment";
  filename: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  url: string;
};

export type AnnouncementReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  priority: AnnouncementPriority;
  category: string;
  status: AnnouncementStatus;
  audience_type: AnnouncementAudience;
  audience_value?: string | null;
  target_department?: string | null;
  target_job_title?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  pinned: number;
  reactions_enabled: number;
  require_acknowledgement: number;
  archived_at?: string | null;
  updated_at?: string | null;
  created_at: string;
  attachments: AnnouncementAttachment[];
  reactions: AnnouncementReaction[];
  acknowledgedByMe: boolean;
  acknowledgementCount: number;
  uniqueViews?: number;
  totalViews?: number;
};

export type DraftAnnouncementAttachment = {
  id: string;
  type: "image" | "video" | "document";
  slot: "cover" | "attachment";
  name: string;
  size?: string;
  sizeBytes?: number;
  mimeType?: string;
  storageKey?: string;
  previewUrl?: string;
};
