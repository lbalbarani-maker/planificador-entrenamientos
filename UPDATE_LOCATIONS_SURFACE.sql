-- Cambiar columna surface de text a text[] para permitir múltiples superficies
ALTER TABLE locations ALTER COLUMN surface TYPE text[] USING array[surface];

-- Verificar el cambio
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'locations' AND column_name = 'surface';
