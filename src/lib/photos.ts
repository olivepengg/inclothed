import { File } from "expo-file-system";
import { Platform } from "react-native";
import { ensureSignedIn } from "./auth";
import { supabase } from "./supabase";

const BUCKET = "clothing-photos";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// expo-file-system's File class isn't documented for web, where the browser's fetch
// can read the blob or data URLs that the image picker returns.
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

/**
 * Uploads a local photo to the private bucket and returns its Storage path.
 * The path must start with the user's id, because the Storage policies check that folder.
 */
export async function uploadPhoto(localUri: string): Promise<string> {
  const userId = await ensureSignedIn();

  const extension = localUri.match(/\.(\w+)$/)?.[1]?.toLowerCase() ?? "jpg";
  const contentType = CONTENT_TYPES[extension] ?? CONTENT_TYPES.jpg;
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const path = `${userId}/${name}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, await readBytes(localUri), { contentType });
  if (error) throw error;

  return path;
}

/**
 * Creates a temporary link to a photo, for displaying it in an <Image>.
 * The bucket is private, so photos have no permanent public URL.
 */
export async function getPhotoUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deletePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
