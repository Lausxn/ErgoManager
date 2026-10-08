-- MySQL 8: revisión manual antes de aplicar la restricción en una BD existente.
-- Ejecutar en el esquema de ErgoManager durante una ventana sin escrituras.
-- 1. Esta consulta debe devolver CERO filas. Si hay duplicados, detenerse
--    y acordar su resolución con MGS. No borrar ni renombrar datos automáticamente.
SELECT LOWER(TRIM(business_name)) COLLATE utf8mb4_0900_as_ci AS nombre,
       COUNT(*) AS cantidad, GROUP_CONCAT(id ORDER BY id) AS perfiles
FROM companies
GROUP BY nombre
HAVING COUNT(*) > 1;

-- 2. Solo después de resolver duplicados y respaldar la BD:
--    Comparación sin distinguir mayúsculas, conservando diferencias de acentos.
--    La restricción impide duplicados incluso ante solicitudes simultáneas.
ALTER TABLE companies
    MODIFY business_name VARCHAR(150) CHARACTER SET utf8mb4
        COLLATE utf8mb4_0900_as_ci NOT NULL,
    ADD CONSTRAINT uk_companies_business_name UNIQUE (business_name);

-- No ejecutar si uk_companies_business_name ya existe (p. ej. creada por Hibernate).
-- El perfil prod usa ddl-auto=validate: el despliegue debe aplicar este cambio
-- explícitamente; validate no garantiza la existencia del índice único.
