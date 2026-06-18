/* ============================================================
   SierraLearn v10 — schema_v10_addition.sql
   Run this AFTER the original schema.sql has already been applied.
   This adds a per-user download log so the Student Profile can
   show exactly which resources a student has downloaded — the
   original schema only tracked an aggregate downloads count on
   the resource row, with no record of who downloaded what.
   ============================================================ */

-- ── DOWNLOADS LOG TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.downloads_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id  UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.downloads_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own download history; admins can see all
CREATE POLICY "downloads_log_select_own" ON public.downloads_log
  FOR SELECT USING (auth.uid() = user_id);

-- Any authenticated user can log their own download
CREATE POLICY "downloads_log_insert_own" ON public.downloads_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Helpful index for the per-user lookup used on the Student Profile
CREATE INDEX IF NOT EXISTS idx_downloads_log_user ON public.downloads_log(user_id, created_at DESC);

-- ── UPDATED increment_download FUNCTION ──────────────────────
-- Now also logs which user performed the download, in addition to
-- bumping the existing aggregate counter on the resource row.
CREATE OR REPLACE FUNCTION public.increment_download(resource_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.resources
  SET downloads = downloads + 1
  WHERE id = resource_id;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.downloads_log (resource_id, user_id)
    VALUES (resource_id, p_user_id);
  END IF;
END;
$$;
