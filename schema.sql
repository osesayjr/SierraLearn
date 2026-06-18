-- ============================================================
-- SierraLearn v7 — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ── 1. PROFILES TABLE ────────────────────────────────────────
-- Extends Supabase auth.users with role and display info
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. RESOURCES TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  subject         TEXT NOT NULL,
  level           TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('pdf','doc','vid','img','link','txt')),
  license         TEXT NOT NULL DEFAULT 'MIT',
  tags            TEXT[] DEFAULT '{}',
  file_url        TEXT,
  file_name       TEXT,
  file_size       TEXT,
  file_mime       TEXT,
  storage_path    TEXT,
  uploader_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploader_name   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_note  TEXT,
  downloads       INTEGER DEFAULT 0,
  rating_sum      NUMERIC DEFAULT 0,
  rating_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. RATINGS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, user_id)   -- one rating per user per resource
);

-- ── 4. STORAGE BUCKET ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT (id) DO NOTHING;

-- ── 5. ENABLE ROW LEVEL SECURITY ─────────────────────────────
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings   ENABLE ROW LEVEL SECURITY;

-- ── 6. PROFILES POLICIES ─────────────────────────────────────

-- Anyone can read profiles (needed for author names)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only insert their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── 7. RESOURCES POLICIES ────────────────────────────────────

-- Anyone (including guests) can see APPROVED resources
CREATE POLICY "resources_select_approved"
  ON public.resources FOR SELECT
  USING (
    status = 'approved'
    OR uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only teachers can insert (creates a pending resource)
CREATE POLICY "resources_insert_teacher"
  ON public.resources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
  );

-- Teachers can update their own; admins can update any (for approval)
CREATE POLICY "resources_update"
  ON public.resources FOR UPDATE
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Teachers can delete their own pending; admins can delete any
CREATE POLICY "resources_delete"
  ON public.resources FOR DELETE
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 8. RATINGS POLICIES ──────────────────────────────────────

-- Anyone can read ratings
CREATE POLICY "ratings_select_all"
  ON public.ratings FOR SELECT
  USING (true);

-- Logged-in users can insert one rating per resource
CREATE POLICY "ratings_insert_auth"
  ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 9. STORAGE POLICIES ──────────────────────────────────────

-- Anyone can download files from approved resources
CREATE POLICY "storage_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resources');

-- Only teachers/admins can upload files
CREATE POLICY "storage_insert_teacher"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resources'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
  );

-- Only the uploader or admin can delete files
CREATE POLICY "storage_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resources'
    AND (
      auth.uid()::TEXT = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ── 10. AUTO-CREATE PROFILE ON SIGNUP ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 11. BUMP DOWNLOAD COUNT FUNCTION ─────────────────────────
CREATE OR REPLACE FUNCTION public.increment_download(resource_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.resources
  SET downloads = downloads + 1
  WHERE id = resource_id;
END;
$$;

-- ── 12. SUBMIT RATING FUNCTION ───────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_rating(
  p_resource_id UUID,
  p_user_id     UUID,
  p_score       INTEGER
)
RETURNS TABLE(avg_rating NUMERIC, total_ratings INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert or update rating
  INSERT INTO public.ratings (resource_id, user_id, score)
  VALUES (p_resource_id, p_user_id, p_score)
  ON CONFLICT (resource_id, user_id)
  DO UPDATE SET score = EXCLUDED.score;

  -- Recalculate aggregate on resources table
  UPDATE public.resources r
  SET
    rating_sum   = (SELECT COALESCE(SUM(score),0) FROM public.ratings WHERE resource_id = p_resource_id),
    rating_count = (SELECT COUNT(*)               FROM public.ratings WHERE resource_id = p_resource_id)
  WHERE r.id = p_resource_id;

  -- Return updated stats
  RETURN QUERY
    SELECT
      ROUND(rating_sum::NUMERIC / NULLIF(rating_count,0), 1),
      rating_count
    FROM public.resources
    WHERE id = p_resource_id;
END;
$$;

-- ── 13. ADMIN STATS VIEW ─────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles)                          AS total_users,
  (SELECT COUNT(*) FROM public.profiles WHERE role='student')     AS total_students,
  (SELECT COUNT(*) FROM public.profiles WHERE role='teacher')     AS total_teachers,
  (SELECT COUNT(*) FROM public.resources WHERE status='approved') AS approved_resources,
  (SELECT COUNT(*) FROM public.resources WHERE status='pending')  AS pending_resources,
  (SELECT COUNT(*) FROM public.resources WHERE status='rejected') AS rejected_resources,
  (SELECT COALESCE(SUM(downloads),0) FROM public.resources)       AS total_downloads,
  (SELECT COALESCE(SUM(rating_count),0) FROM public.resources)    AS total_ratings;

-- ── 14. SEED ONE ADMIN USER ──────────────────────────────────
-- After running this schema, sign up normally via the app,
-- then run this to promote yourself to admin:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';

-- ============================================================
-- DONE. Your Supabase project is ready for SierraLearn v7.
-- ============================================================
