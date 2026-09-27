/*
# Auto-confirm new users on signup

This trigger sets email_confirmed_at immediately when a new auth user is created,
so staff don't need to check their email to sign in. This is appropriate for
an internal staff management system where accounts are created by trusted staff.

## Changes
- New trigger `auto_confirm_new_user` on auth.users AFTER INSERT
- Sets email_confirmed_at = now() for new users
*/

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = now()
  WHERE id = NEW.id AND email_confirmed_at IS NULL;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_confirm_user() TO authenticated;

DROP TRIGGER IF EXISTS auto_confirm_new_user ON auth.users;
CREATE TRIGGER auto_confirm_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();
