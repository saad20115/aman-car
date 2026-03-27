-- Run this SQL in your Supabase SQL Editor
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
UPDATE public.services SET is_archived = false WHERE is_archived IS NULL;
