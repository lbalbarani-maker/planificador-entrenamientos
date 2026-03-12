-- Verificar políticas RLS en la tabla teams
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'teams';

-- Verificar si RLS está habilitado
SELECT 
    relname,
    relrowsecurity
FROM pg_class
WHERE relname = 'teams';
