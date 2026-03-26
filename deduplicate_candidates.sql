-- Script para eliminar candidatos duplicados manteniendo el más reciente
-- Puedes ejecutar esto en el SQL Editor de Supabase

DELETE FROM candidates
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY LOWER(TRIM(nombre_completo)), COALESCE(NULLIF(UPPER(TRIM(rut)), 'NULL'), '')
                   ORDER BY created_at DESC
               ) as row_num
        FROM candidates
    ) t
    WHERE t.row_num > 1
);
