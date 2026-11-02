import * as SQLite from "expo-sqlite";
import { removeFile } from "./storage";

export type Item = {
  id: number;
  image: string; // cutout filename (or the original if removal failed)
  original: string; // original photo filename
  created_at: number;
};

const db = SQLite.openDatabaseSync("closet.db");

db.execSync(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    original TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export const addItem = (image: string, original: string) =>
  db.runSync(
    "INSERT INTO items (image, original, created_at) VALUES (?, ?, ?)",
    image,
    original,
    Date.now(),
  );

export const getItems = () =>
  db.getAllSync<Item>("SELECT * FROM items ORDER BY created_at DESC");

export function deleteItem(item: Item) {
  db.runSync("DELETE FROM items WHERE id = ?", item.id);
  removeFile(item.image);
  if (item.original !== item.image) removeFile(item.original);
}
