-- Script para verificar y corregir acceso a equipos

-- 1. Primero verificar si hay datos en la tabla teams
SELECT * FROM teams LIMIT 10;

-- 2. Verificar políticas RLS existentes
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'teams';

-- 3. Si RLS está habilitado y no hay políticas, crear política pública
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si hay problemas
DROP POLICY IF EXISTS "Permitir lectura equipos" ON teams;
DROP POLICY IF EXISTS "Allow all on teams" ON teams;

-- Crear política que permita leer todos los equipos
CREATE POLICY "Permitir lectura equipos" ON teams 
FOR SELECT USING (true);

-- Política para insertar
CREATE POLICY "Permitir insertar equipos" ON teams 
FOR INSERT WITH CHECK (true);

-- Política para actualizar
CREATE POLICY "Permitir actualizar equipos" ON teams 
FOR UPDATE USING (true);

-- Política para eliminar
CREATE POLICY "Permitir eliminar equipos" ON teams 
FOR DELETE USING (true);
