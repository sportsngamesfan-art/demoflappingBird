-- Final RLS + storage + leaderboard fix, applied to the active project (owqqfjyisewemtxjgexq).
-- This is the authoritative migration; supersedes the leaderboard handling deferred in 002.
-- `leaderboard` is a real base table in this project (with a bigint id), so RLS + admin
-- delete apply directly. It was missing `game_name`, which is added here.

-- Add missing game_name column so leaderboard supports all games
ALTER TABLE public.leaderboard ADD COLUMN IF NOT EXISTS game_name TEXT;

-- ── Helper functions (SECURITY DEFINER = recursion-safe admin checks) ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'superadmin');
$$;

-- ── analytics_events: anon insert, admin read ──
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon insert analytics" ON analytics_events;
CREATE POLICY "anon insert analytics" ON analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admins read analytics" ON analytics_events;
CREATE POLICY "admins read analytics" ON analytics_events FOR SELECT TO authenticated USING (public.is_admin());

-- ── audit_logs: admin insert+read, append-only ──
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins insert audit" ON audit_logs;
CREATE POLICY "admins insert audit" ON audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins read audit" ON audit_logs;
CREATE POLICY "admins read audit" ON audit_logs FOR SELECT TO authenticated USING (public.is_admin());

-- ── admin_roles: admin read, superadmin write ──
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read roles" ON admin_roles;
CREATE POLICY "admins read roles" ON admin_roles FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "superadmins insert roles" ON admin_roles;
CREATE POLICY "superadmins insert roles" ON admin_roles FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());
DROP POLICY IF EXISTS "superadmins update roles" ON admin_roles;
CREATE POLICY "superadmins update roles" ON admin_roles FOR UPDATE TO authenticated USING (public.is_superadmin());
DROP POLICY IF EXISTS "superadmins delete roles" ON admin_roles;
CREATE POLICY "superadmins delete roles" ON admin_roles FOR DELETE TO authenticated USING (public.is_superadmin());

-- ── game_assets: public read, admin write ──
ALTER TABLE game_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read assets" ON game_assets;
CREATE POLICY "public read assets" ON game_assets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admins insert assets" ON game_assets;
CREATE POLICY "admins insert assets" ON game_assets FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins update assets" ON game_assets;
CREATE POLICY "admins update assets" ON game_assets FOR UPDATE TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admins delete assets" ON game_assets;
CREATE POLICY "admins delete assets" ON game_assets FOR DELETE TO authenticated USING (public.is_admin());

-- ── game_configs: public read, admin write ──
ALTER TABLE game_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read configs" ON game_configs;
CREATE POLICY "public read configs" ON game_configs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admins insert configs" ON game_configs;
CREATE POLICY "admins insert configs" ON game_configs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins update configs" ON game_configs;
CREATE POLICY "admins update configs" ON game_configs FOR UPDATE TO authenticated USING (public.is_admin());

-- ── leaderboard (real table here): public read+insert, admin delete ──
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read leaderboard" ON leaderboard;
CREATE POLICY "public read leaderboard" ON leaderboard FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public insert leaderboard" ON leaderboard;
CREATE POLICY "public insert leaderboard" ON leaderboard FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admins delete leaderboard" ON leaderboard;
CREATE POLICY "admins delete leaderboard" ON leaderboard FOR DELETE TO authenticated USING (public.is_admin());

-- ── Storage bucket for generated game art ──
INSERT INTO storage.buckets (id, name, public) VALUES ('game-assets', 'game-assets', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "public read game-assets" ON storage.objects;
CREATE POLICY "public read game-assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'game-assets');
DROP POLICY IF EXISTS "admins write game-assets" ON storage.objects;
CREATE POLICY "admins write game-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'game-assets' AND public.is_admin());
DROP POLICY IF EXISTS "admins update game-assets" ON storage.objects;
CREATE POLICY "admins update game-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'game-assets' AND public.is_admin());
DROP POLICY IF EXISTS "admins delete game-assets" ON storage.objects;
CREATE POLICY "admins delete game-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'game-assets' AND public.is_admin());
