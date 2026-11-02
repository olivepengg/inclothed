import { File } from "expo-file-system";

const KEY = process.env.EXPO_PUBLIC_POOF_KEY;

export async function removeBackground(uri: string): Promise<Uint8Array> {
  if (!KEY) throw new Error("Missing EXPO_PUBLIC_POOF_KEY");

  const form = new FormData();
  form.append("file", new File(uri));
  form.append("format", "png");
  form.append("size", "medium"); // smaller file, plenty for a closet grid
  form.append("crop", "true"); // trims empty space so items fill their tile

  const res = await fetch("https://api.poof.bg/v1/remove", {
    method: "POST",
    headers: { "x-api-key": KEY },
    body: form,
  });

  if (res.status === 402) throw new Error("Out of Poof credits for this month");
  if (!res.ok) throw new Error(`Poof error ${res.status}`);

  return new Uint8Array(await res.arrayBuffer());
}
