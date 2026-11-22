import { appPath } from "./paths";
import { z } from "zod";

export const MAX_ENTRY_IMAGES = 4;
export const MAX_ENTRY_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export const removedEntryImageIdsSchema = z.array(z.cuid("This image could not be found. Refresh the page and try again."))
  .max(MAX_ENTRY_IMAGES, "Remove up to four images at a time.")
  .refine((ids) => new Set(ids).size === ids.length, "Each image can only be removed once.");

export function validateEntryImages(images: readonly Pick<File, "size" | "type">[]): string | undefined {
  if (images.length > MAX_ENTRY_IMAGES) return "Keep each entry to four images or fewer.";
  if (images.some((image) => !IMAGE_TYPES.includes(image.type))) {
    return "Paste PNG, JPEG, GIF or WebP images.";
  }
  if (images.some((image) => image.size === 0)) return "An image is empty. Paste another image.";
  if (images.reduce((size, image) => size + image.size, 0) > MAX_ENTRY_IMAGE_BYTES) {
    return "Keep the images in each entry to 4 MB in total or less.";
  }
}

export function imageContentType(bytes: Uint8Array): string | null {
  const startsWith = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (bytes.length >= 24 && startsWith([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (bytes.length >= 4 && startsWith([255, 216, 255]) && bytes.at(-2) === 255 && bytes.at(-1) === 217) {
    return "image/jpeg";
  }
  const header = String.fromCharCode(...bytes.slice(0, 12));
  if (bytes.length >= 14 && /^(GIF87a|GIF89a)/.test(header) && bytes.at(-1) === 59) return "image/gif";
  if (bytes.length >= 20 && header.startsWith("RIFF") && header.slice(8) === "WEBP"
    && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length) {
    return "image/webp";
  }
  return null;
}

export function entryImagePath(id: string): string {
  return appPath(`/images/${encodeURIComponent(id)}/`);
}
