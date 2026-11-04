-- Creates the clothing_items table, its security rules, and the private photo bucket.
-- Paste the whole file into the Supabase SQL Editor and run it once.
-- It stops with an "already exists" error if run a second time.
--
-- To change an allowed-values list later, write a new migration that replaces the
-- constraint, and update the matching list in src/lib/database.types.ts:
--
--   alter table public.clothing_items
--     drop constraint clothing_items_category_check,
--     add constraint clothing_items_category_check
--       check (category in ('top', 'bottom', 'new_value'));


-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  -- auth.uid() fills this in from the signed-in user, so the app never sends it.
  -- Deleting a user also deletes their rows, but not their files in Storage.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Path inside the clothing-photos bucket: <user_id>/<filename>
  image_path text not null,

  -- Attributes are nullable because a row is created before any model has filled them in.
  -- A check constraint allows null, so an unknown value is fine but an invalid one is not.
  category text,
  subcategory text,
  primary_color text,
  -- Lists default to empty rather than null, so the app only has one "nothing" case.
  secondary_colors text[] not null default '{}',
  color_hex text,
  pattern text,
  material text,
  fit text,
  season text[] not null default '{}',
  formality text,
  occasions text[] not null default '{}',
  style_tags text[] not null default '{}',
  warmth_level integer,

  -- Details the user enters
  brand text,
  size text,
  purchase_date date,
  -- numeric rather than float, so prices don't pick up rounding errors.
  price numeric(10, 2),
  care_instructions text,
  condition text,
  favorite boolean not null default false,

  -- Usage
  status text not null default 'in_closet',
  wear_count integer not null default 0,
  last_worn_at timestamptz,

  -- Where the attributes came from, e.g. 'color_kmeans', 'clip', 'custom_model', 'llm', 'user'
  extraction_source text,
  -- Per-field model scores, e.g. {"category": 0.92, "pattern": 0.61}
  extraction_confidence jsonb,
  -- Set to true once a person has confirmed or corrected the predictions.
  verified boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Allowed values. Keep these in sync with src/lib/database.types.ts.
  constraint clothing_items_category_check check (category in (
    'top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory',
    'activewear', 'swimwear', 'sleepwear', 'underwear'
  )),
  constraint clothing_items_formality_check check (formality in (
    'casual', 'smart_casual', 'business_casual', 'business', 'formal'
  )),
  constraint clothing_items_pattern_check check (pattern in (
    'solid', 'striped', 'plaid', 'checked', 'floral', 'polka_dot', 'graphic',
    'animal_print', 'camo', 'geometric', 'abstract', 'other'
  )),
  constraint clothing_items_status_check check (status in (
    'in_closet', 'in_laundry', 'stored', 'lent_out', 'donated', 'sold', 'discarded'
  )),
  constraint clothing_items_condition_check check (condition in (
    'new', 'like_new', 'good', 'fair', 'poor'
  )),
  constraint clothing_items_primary_color_check check (primary_color in (
    'black', 'white', 'gray', 'beige', 'brown', 'navy', 'blue', 'teal', 'green', 'olive',
    'yellow', 'orange', 'red', 'burgundy', 'pink', 'purple', 'gold', 'silver', 'multicolor'
  )),
  -- <@ means "every item in the left list also appears in the right list".
  constraint clothing_items_secondary_colors_check check (secondary_colors <@ array[
    'black', 'white', 'gray', 'beige', 'brown', 'navy', 'blue', 'teal', 'green', 'olive',
    'yellow', 'orange', 'red', 'burgundy', 'pink', 'purple', 'gold', 'silver', 'multicolor'
  ]::text[]),
  constraint clothing_items_season_check check (season <@ array[
    'spring', 'summer', 'fall', 'winter'
  ]::text[]),

  -- Value rules
  constraint clothing_items_color_hex_check check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  constraint clothing_items_warmth_level_check check (warmth_level between 1 and 5),
  constraint clothing_items_price_check check (price >= 0),
  constraint clothing_items_wear_count_check check (wear_count >= 0)
);

-- Makes "this user's items, newest first" fast as the table grows.
create index clothing_items_user_id_created_at_idx
  on public.clothing_items (user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- Keep updated_at current
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clothing_items_set_updated_at
  before update on public.clothing_items
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Row Level Security: users can only reach their own rows
-- ---------------------------------------------------------------------------

alter table public.clothing_items enable row level security;

-- Grants decide whether a role may use the table at all; the policies below then
-- limit which rows it can reach.
--
-- Anonymous sign-in users have the "authenticated" role. Supabase's "anon" role means
-- a request with no signed-in user, so it gets no access here.
grant select, insert, update, delete on table public.clothing_items to authenticated;

-- (select auth.uid()) makes Postgres work out the user once per query, not once per row.
create policy "Users can view their own items"
  on public.clothing_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own items"
  on public.clothing_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- using: which rows can be changed. with check: what they can become.
-- Together they stop a user from handing a row to someone else.
create policy "Users can update their own items"
  on public.clothing_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own items"
  on public.clothing_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- Private photo bucket: <user_id>/<filename>
-- ---------------------------------------------------------------------------

-- The size and file type limits help protect the free 1 GB of storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clothing-photos',
  'clothing-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
);

-- storage.foldername('abc/photo.png') returns {abc}, so [1] is the top-level folder.
create policy "Users can view their own photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'clothing-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'clothing-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'clothing-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'clothing-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'clothing-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
