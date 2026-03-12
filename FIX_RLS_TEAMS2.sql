-- Forzar que las políticas RLS funcionen correctamente
-- Primero ver qué políticas existen
SELECT * FROM pg_policies WHERE tablename = 'teams';

-- Eliminar todas las políticas existentes y crear unas nuevas más permisivas
DROP POLICY IF EXISTS "Allow all on teams" ON teams;
DROP POLICY IF EXISTS "Allow read teams" ON teams;
DROP POLICY IF EXISTS "Permitir lectura equipos" ON teams;
DROP POLICY IF EXISTS "Permitir insertar equipos" ON teams;
DROP POLICY IF EXISTS "Permitir actualizar equipos" ON teams;
DROP POLICY IF EXISTS "Permitir eliminar equipos" ON teams;

-- Crear política única muy permisiva
CREATE POLICY "teams_full_access" ON teams
FOR ALL
USING (true)
WITH CHECK (true);

-- Verificar que se aplicó
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'teams';
