BEGIN;

ALTER TABLE public.donmuadv
  ADD COLUMN IF NOT EXISTS ngaybatdau date,
  ADD COLUMN IF NOT EXISTS ngayketthucdukien date;

UPDATE public.donmuadv
SET ngaybatdau = ngaymua::date
WHERE ngaybatdau IS NULL AND ngaymua IS NOT NULL;

COMMIT;