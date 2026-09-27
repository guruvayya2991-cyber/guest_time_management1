/*
# Guest Timing Management System - Part 1: Tables & Functions

Creates staff_users, is_admin function, guests, extensions, settings, triggers.
*/

-- ============================================================
-- staff_users table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_staff_users" ON public.staff_users;
CREATE POLICY "staff_read_staff_users" ON public.staff_users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_own_profile" ON public.staff_users;
CREATE POLICY "staff_insert_own_profile" ON public.staff_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "staff_update_own_profile" ON public.staff_users;
CREATE POLICY "staff_update_own_profile" ON public.staff_users
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- is_admin() SECURITY DEFINER function
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Now add the admin-only delete policy (function exists now)
DROP POLICY IF EXISTS "admin_delete_staff_users" ON public.staff_users;
CREATE POLICY "admin_delete_staff_users" ON public.staff_users
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- guests table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number integer NOT NULL,
  guest_name text NOT NULL,
  in_time timestamptz NOT NULL,
  expected_out_time timestamptz NOT NULL,
  actual_out_time timestamptz,
  duration_minutes integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  remarks text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_created_at ON public.guests (created_at);
CREATE INDEX IF NOT EXISTS idx_guests_status ON public.guests (status);
CREATE INDEX IF NOT EXISTS idx_guests_in_time ON public.guests (in_time);

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_guests" ON public.guests;
CREATE POLICY "staff_select_guests" ON public.guests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_guests" ON public.guests;
CREATE POLICY "staff_insert_guests" ON public.guests
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_guests" ON public.guests;
CREATE POLICY "staff_update_guests" ON public.guests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_guests" ON public.guests;
CREATE POLICY "admin_delete_guests" ON public.guests
  FOR DELETE TO authenticated USING (public.is_admin());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guests_touch ON public.guests;
CREATE TRIGGER trg_guests_touch BEFORE UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- extensions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  extension_minutes integer NOT NULL,
  previous_out_time timestamptz NOT NULL,
  new_out_time timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extensions_guest_id ON public.extensions (guest_id);

ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_extensions" ON public.extensions;
CREATE POLICY "staff_select_extensions" ON public.extensions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_extensions" ON public.extensions;
CREATE POLICY "staff_insert_extensions" ON public.extensions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_extensions" ON public.extensions;
CREATE POLICY "staff_update_extensions" ON public.extensions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_extensions" ON public.extensions;
CREATE POLICY "admin_delete_extensions" ON public.extensions
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- Auto-create staff_users row on auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.staff_users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- settings table (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  park_name text NOT NULL DEFAULT 'Unlimited Fun',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ending_soon_minutes integer NOT NULL DEFAULT 10,
  notification_sound boolean NOT NULL DEFAULT true,
  browser_notifications boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'light',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_settings" ON public.settings;
CREATE POLICY "staff_read_settings" ON public.settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_settings" ON public.settings;
CREATE POLICY "admin_update_settings" ON public.settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_settings" ON public.settings;
CREATE POLICY "admin_insert_settings" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Seed default settings row
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = 1) THEN
    INSERT INTO public.settings (id) VALUES (1);
  END IF;
END $$;
