import { Directory, File, Paths } from "expo-file-system";

const closetDir = new Directory(Paths.document, "closet");

const newName = (ext: string) =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

const ensureDir = () => {
  if (!closetDir.exists) closetDir.create();
};

export const imageUri = (name: string) => new File(closetDir, name).uri;

export function saveFromUri(uri: string, ext = "jpg") {
  ensureDir();
  const name = newName(ext);
  new File(uri).copySync(new File(closetDir, name));
  return name;
}

export function saveBytes(bytes: Uint8Array, ext = "png") {
  ensureDir();
  const name = newName(ext);
  const file = new File(closetDir, name);
  file.create();
  file.writeSync(bytes);
  return name;
}

export function removeFile(name: string) {
  const file = new File(closetDir, name);
  if (file.exists) file.delete();
}
