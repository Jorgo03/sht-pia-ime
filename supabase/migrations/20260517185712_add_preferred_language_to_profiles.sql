ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'sq'
  CHECK (preferred_language IN ('sq','en','de','it','es','pl','ru','fr'));
