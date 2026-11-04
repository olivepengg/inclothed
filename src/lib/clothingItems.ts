import type {
  ClothingItem,
  ClothingItemInsert,
  ClothingItemUpdate,
} from "./database.types";
import { extractAttributes, type ExtractedAttributes } from "./extractAttributes";
import { deletePhoto, uploadPhoto } from "./photos";
import { supabase } from "./supabase";

// Row Level Security limits every query below to the signed-in user's rows,
// so none of them need to filter by user_id.

export async function createClothingItem(
  item: ClothingItemInsert,
): Promise<ClothingItem> {
  const { data, error } = await supabase
    .from("clothing_items")
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Returns the user's items, newest first. */
export async function listClothingItems(): Promise<ClothingItem[]> {
  const { data, error } = await supabase
    .from("clothing_items")
    .select()
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Returns one item, or null if it doesn't exist or belongs to another user. */
export async function getClothingItem(
  id: string,
): Promise<ClothingItem | null> {
  const { data, error } = await supabase
    .from("clothing_items")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Changes the given fields on an item. For example, to correct a prediction:
 * updateClothingItem(id, { category: "dress", verified: true })
 */
export async function updateClothingItem(
  id: string,
  changes: ClothingItemUpdate,
): Promise<ClothingItem> {
  const { data, error } = await supabase
    .from("clothing_items")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Uploads a local photo, runs extraction, and creates the item's row. */
export async function addClothingItemFromPhoto(
  localUri: string,
): Promise<ClothingItem> {
  const imagePath = await uploadPhoto(localUri);

  // A failed prediction shouldn't lose the item. It can be filled in later.
  let attributes: ExtractedAttributes = {};
  try {
    attributes = await extractAttributes(imagePath);
  } catch (e) {
    console.warn("Attribute extraction failed", e);
  }

  try {
    return await createClothingItem({ ...attributes, image_path: imagePath });
  } catch (e) {
    // Without a row pointing to it, the photo would use up storage forever.
    await deletePhoto(imagePath).catch((cleanupError) =>
      console.warn("Could not remove the uploaded photo", cleanupError),
    );
    throw e;
  }
}
