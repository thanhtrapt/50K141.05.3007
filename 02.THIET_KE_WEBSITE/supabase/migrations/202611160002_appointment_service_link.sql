-- Standalone appointments reference the service catalog directly.
-- Treatment-session appointments continue to use lichhen.mact_donmua.
ALTER TABLE public.lichhen
  ADD COLUMN IF NOT EXISTS madichvu character(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_lichhen_dichvu'
      AND conrelid = 'public.lichhen'::regclass
  ) THEN
    ALTER TABLE public.lichhen
      ADD CONSTRAINT fk_lichhen_dichvu
      FOREIGN KEY (madichvu) REFERENCES public.dichvu(madichvu);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_lichhen_madichvu ON public.lichhen(madichvu);
