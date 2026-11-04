// Hand-written to match supabase/migrations/.
//
// These lists must match the check constraints in the database. To change one,
// update it here and write a migration that replaces the constraint.
export const CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "accessory",
  "activewear",
  "swimwear",
  "sleepwear",
  "underwear",
] as const;

export const FORMALITIES = [
  "casual",
  "smart_casual",
  "business_casual",
  "business",
  "formal",
] as const;

export const PATTERNS = [
  "solid",
  "striped",
  "plaid",
  "checked",
  "floral",
  "polka_dot",
  "graphic",
  "animal_print",
  "camo",
  "geometric",
  "abstract",
  "other",
] as const;

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;

export const STATUSES = [
  "in_closet",
  "in_laundry",
  "stored",
  "lent_out",
  "donated",
  "sold",
  "discarded",
] as const;

export const CONDITIONS = ["new", "like_new", "good", "fair", "poor"] as const;

export const COLORS = [
  "black",
  "white",
  "gray",
  "beige",
  "brown",
  "navy",
  "blue",
  "teal",
  "green",
  "olive",
  "yellow",
  "orange",
  "red",
  "burgundy",
  "pink",
  "purple",
  "gold",
  "silver",
  "multicolor",
] as const;

// `as const` keeps the exact strings, so each type below becomes a union such as
// "spring" | "summer" | "fall" | "winter". The lists are also available at runtime,
// for example to fill a picker or check a model's output.
export type Category = (typeof CATEGORIES)[number];
export type Formality = (typeof FORMALITIES)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Season = (typeof SEASONS)[number];
export type Status = (typeof STATUSES)[number];
export type Condition = (typeof CONDITIONS)[number];
export type Color = (typeof COLORS)[number];

/** The attributes a model can predict from a photo. */
export type ExtractableField =
  | "category"
  | "subcategory"
  | "primary_color"
  | "secondary_colors"
  | "color_hex"
  | "pattern"
  | "material"
  | "fit"
  | "season"
  | "formality"
  | "occasions"
  | "style_tags"
  | "warmth_level";

/** Per-field model scores, e.g. { category: 0.92, pattern: 0.61 }. */
export type ExtractionConfidence = Partial<Record<ExtractableField, number>>;

/** A row in clothing_items, as returned by the database. */
export type ClothingItem = {
  id: string;
  user_id: string;
  image_path: string;
  category: Category | null;
  subcategory: string | null;
  primary_color: Color | null;
  secondary_colors: Color[];
  color_hex: string | null;
  pattern: Pattern | null;
  material: string | null;
  fit: string | null;
  season: Season[];
  formality: Formality | null;
  occasions: string[];
  style_tags: string[];
  warmth_level: number | null;
  brand: string | null;
  size: string | null;
  purchase_date: string | null; // "YYYY-MM-DD"
  price: number | null;
  care_instructions: string | null;
  condition: Condition | null;
  favorite: boolean;
  status: Status;
  wear_count: number;
  last_worn_at: string | null; // ISO timestamp
  extraction_source: string | null;
  extraction_confidence: ExtractionConfidence | null;
  verified: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};

// The database fills in these columns itself, so the app shouldn't set them.
type DatabaseManagedField = "id" | "user_id" | "created_at" | "updated_at";

/** Fields for a new row. Only image_path is required. */
export type ClothingItemInsert = Partial<
  Omit<ClothingItem, DatabaseManagedField | "image_path">
> & { image_path: string };

/** Fields that can be changed on an existing row. */
export type ClothingItemUpdate = Partial<
  Omit<ClothingItem, DatabaseManagedField>
>;

// This shape is what supabase-js expects. It's what makes queries on
// "clothing_items" return ClothingItem instead of an untyped result.
export type Database = {
  public: {
    Tables: {
      clothing_items: {
        Row: ClothingItem;
        Insert: ClothingItemInsert;
        Update: ClothingItemUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
