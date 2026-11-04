import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, Paths } from "expo-file-system";
import { convertIndexedToRgb, decode, type DecodedPng } from "fast-png";
import { Platform } from "react-native";
import { getPhotoUrl, readBytes } from "./photos";

// Color clustering doesn't need detail, and fewer pixels make it much faster.
const RESIZED_WIDTH = 64;

export type PhotoPixels = {
  width: number;
  height: number;
  /** Four values per pixel (red, green, blue, alpha), each from 0 to 255. */
  rgba: Uint8Array;
};

// PNGs can store pixels in several layouts, such as without an alpha value or with
// 16 bits per value. This converts them all to one layout for the rest of the code.
function toRgba(png: DecodedPng): Uint8Array {
  const pixelCount = png.width * png.height;
  const data = png.palette ? convertIndexedToRgb(png) : png.data;
  const channels = png.palette ? data.length / pixelCount : png.channels;
  const depth = png.palette ? 8 : png.depth;

  if (depth !== 8 && depth !== 16) {
    throw new Error(`Unsupported PNG bit depth: ${depth}`);
  }
  const to8Bit = (value: number) => (depth === 16 ? value >> 8 : value);
  const hasColor = channels >= 3;
  const hasAlpha = channels === 2 || channels === 4;

  const rgba = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const start = i * channels;
    rgba[i * 4] = to8Bit(data[start]);
    rgba[i * 4 + 1] = to8Bit(data[hasColor ? start + 1 : start]);
    rgba[i * 4 + 2] = to8Bit(data[hasColor ? start + 2 : start]);
    rgba[i * 4 + 3] = hasAlpha ? to8Bit(data[start + channels - 1]) : 255;
  }
  return rgba;
}

async function pixelsFromUri(uri: string): Promise<PhotoPixels> {
  // Passing only a width keeps the photo's proportions. Saving as PNG handles JPEG
  // originals too, and PNG is the only format that can keep transparency here.
  const image = await ImageManipulator.manipulate(uri)
    .resize({ width: RESIZED_WIDTH })
    .renderAsync();
  const resized = await image.saveAsync({ format: SaveFormat.PNG });

  const png = decode(new Uint8Array(await readBytes(resized.uri)));
  if (Platform.OS !== "web") new File(resized.uri).delete();

  return { width: png.width, height: png.height, rgba: toRgba(png) };
}

/** Reads a small version of a photo from the clothing-photos bucket as raw pixels. */
export async function readPhotoPixels(imagePath: string): Promise<PhotoPixels> {
  // The link only needs to last long enough to download the photo.
  const url = await getPhotoUrl(imagePath, 60);

  // On web there's no local file system to download to, so load the link directly.
  if (Platform.OS === "web") return pixelsFromUri(url);

  // The docs describe image-manipulator as working on local files, so download first.
  const name = imagePath.split("/").pop() ?? "photo.png";
  const download = await File.downloadFileAsync(
    url,
    new File(Paths.cache, `extract-${name}`),
    { idempotent: true },
  );
  try {
    return await pixelsFromUri(download.uri);
  } finally {
    download.delete();
  }
}
