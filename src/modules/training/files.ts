// Shared helpers for training lesson file uploads (media MP4/MP3, document PDF).
export const MAX_BYTES = 25 * 1024 * 1024;
export const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120) || 'file';

const ascii = (bytes: Uint8Array, a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));

/** Media = MP4 (ftyp box) or MP3 (ID3 tag or MPEG audio frame sync). */
export function sniffMedia(bytes: Uint8Array): 'video/mp4' | 'audio/mpeg' | null {
  if (bytes.length > 8 && ascii(bytes, 4, 8) === 'ftyp') return 'video/mp4';
  if (bytes.length > 3 && ascii(bytes, 0, 3) === 'ID3') return 'audio/mpeg';
  if (bytes.length > 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return null;
}

export function sniffDocument(bytes: Uint8Array): 'application/pdf' | null {
  return bytes.length > 5 && ascii(bytes, 0, 5) === '%PDF-' ? 'application/pdf' : null;
}

export type UploadedFile = { lessonId: string; kind: 'media' | 'document'; storageKey: string; contentType: string; filename: string; size: number };

/** Reads a file field, validates its magic bytes by kind, uploads it to R2 and returns the row data. */
export async function takeUpload(form: FormData, field: string, lessonId: string, lessonTitle: string, kind: 'media' | 'document', bucket: R2Bucket): Promise<UploadedFile | null> {
  const file = form.get(field);
  if (file == null) return null;
  if (!(file instanceof File) || !file.size) throw new Response(`The ${kind} file for "${lessonTitle}" is empty`, { status: 400 });
  if (file.size > MAX_BYTES) throw new Response(`"${lessonTitle}" is larger than 25 MB`, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = kind === 'media' ? sniffMedia(bytes) : sniffDocument(bytes);
  if (!contentType) throw new Response(kind === 'media' ? `The media for "${lessonTitle}" must be MP4 or MP3` : `The document for "${lessonTitle}" must be a PDF`, { status: 415 });
  const storageKey = `training/${lessonId}/${crypto.randomUUID()}`;
  await bucket.put(storageKey, bytes, { httpMetadata: { contentType } });
  return { lessonId, kind, storageKey, contentType, filename: safeName(file.name), size: bytes.length };
}
