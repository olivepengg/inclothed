import type {
  ClothingItem,
  ExtractableField,
  ExtractionConfidence,
} from "./database.types";

/**
 * What a model returns. Every field is optional, so a model can fill in only what it
 * knows: k-means might return just the colors, and CLIP the category and style tags.
 */
export type ExtractedAttributes = Partial<
  Pick<ClothingItem, ExtractableField>
> & {
  extraction_source?: string; // e.g. "color_kmeans", "clip", "custom_model"
  extraction_confidence?: ExtractionConfidence;
};

/**
 * Predicts clothing attributes from a photo in the clothing-photos bucket.
 *
 * This takes a Storage path rather than image data, so a model running on a server can
 * fetch the photo itself. Callers won't need to change when real models replace this stub.
 *
 * Any model that needs a secret key must run in a server-side function, such as a
 * Supabase Edge Function, because EXPO_PUBLIC_ values are visible to users.
 */
export async function extractAttributes(
  imagePath: string,
): Promise<ExtractedAttributes> {
  return {};
}
