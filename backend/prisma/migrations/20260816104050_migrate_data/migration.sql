-- =============================================================================
-- Migración de datos: importar locales e inquilinos del formato Excel
-- "INFORMACION PARA CREACION DE LOCALES / INQUILINOS" (Hojas 1 y 2).
--
-- Bitácora:
--   - Origen:        F:\sys-solicitudes\Formato Llenar Informacion Locales e
--                    Inquilinos para App.xlsx (analizado con openpyxl 3.1.5).
--   - Hoja 1:        9 locales (codigos 45, 56, 3, 3-A, 14, 24, 36, 5, 4).
--   - Hoja 2:        9 filas de inquilinos + contrato, de las cuales 8
--                    inquilinos únicos (PINTURAS NORTE / INDUSTRIAS CARICIA
--                    aparece 2 veces → un solo inquilino, dos contratos).
--   - Plaza destino: `demo` (slug='demo', id generado por gen_random_uuid()
--                    en el seed). Se busca por slug, NO por UUID hardcoded,
--                    para ser compatible con la shadow DB de Prisma (ver más
--                    abajo).
--   - Pareo local↔inquilino: por orden de fila dentro del Excel
--                    (sheet1 row 4 ↔ sheet2 row 5, ..., sheet1 row 12 ↔
--                    sheet2 row 13); los area_m2 coinciden 1:1.
--   - Decisiones:
--       * fecha_inicio = CURRENT_DATE, fecha_fin = NULL (vigente indefinido).
--       * monto_mensual = canon * area + cam * area  (coincide con col AA).
--       * representante_legal del inquilino PINTURAS NORTE = CARLOS CASTRO
--         (1ª fila); LEONEL MESSI (2ª fila) se guarda en `comentarios` del
--         inquilino y en `condiciones` del contrato del local 3-A.
--       * local.estado = 'alquilado' para los 9 (la app lo hace por T-054,
--         pero la migración escribe directo a BD y debe dejar consistencia).
--   - Columnas Excel sin datos (NIT, NRC, contacto*, fechas contrato, etc.)
--     se insertan como NULL — la fuente está vacía.
--
-- ⚠️ LOOKUP POR SLUG (no UUID hardcoded):
--   `prisma migrate dev` crea una **shadow database** para validar TODAS las
--   migraciones. Esa shadow DB es virgen (no ejecuta seed.ts), por lo que la
--   plaza `demo` — creada dinámicamente por el seed — NO existe. Si la
--   migración usara un UUID hardcoded, la FK de `local.plaza_id` fallaría
--   incluso aunque ese UUID existiera en la BD real. El lookup por slug
--   permite que la shadow DB salte la inserción limpiamente (no-op) y que
--   la BD real aplique los datos cuando la plaza `demo` exista (post-seed).
--
-- Idempotencia: si alguno de los 9 códigos del Excel ya existe en la plaza
-- demo, la migración aborta con MIGRATION_ALREADY_APPLIED. No usa
-- ON CONFLICT porque `inquilino` y `contrato` no tienen UNIQUE que permita
-- resolver conflictos trivialmente.
-- =============================================================================

BEGIN;

-- ── 0) Lookup por slug + guard de idempotencia + INSERTs ─────────────────────
DO $$
DECLARE
  v_plaza_id    uuid;
  v_existing_count integer;
BEGIN
  -- Lookup por slug (no UUID hardcoded → compatible con shadow DB).
  SELECT id INTO v_plaza_id FROM plaza WHERE slug = 'demo' LIMIT 1;

  -- Si la plaza no existe (shadow DB sin seed), salir silenciosamente.
  IF v_plaza_id IS NULL THEN
    RAISE NOTICE '[20260816104050_migrate_data] Plaza demo no existe — saltando migración (entorno shadow DB / sin seed).';
    RETURN;
  END IF;

  -- Guard de idempotencia: si ya hay locales del Excel en la plaza, abortar.
  SELECT COUNT(*) INTO v_existing_count
  FROM local
  WHERE plaza_id = v_plaza_id
    AND codigo IN ('45','56','3','3-A','14','24','36','5','4');

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ALREADY_APPLIED: % de los 9 locales del Excel ya existen en la plaza demo. Abortando.',
      v_existing_count;
  END IF;

  -- ── 1) INSERT 9 locales (estado='alquilado' desde el inicio) ──────────────
  --    ⚠️ `updated_at` no tiene DEFAULT en la columna (Prisma @updatedAt solo lo
  --    gestiona el client). Las inserciones raw deben setearlo a NOW().
  INSERT INTO local (
    id, plaza_id, codigo, modulo, nivel, area_m2,
    medidor_energia, medidor_agua, estado,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    v_plaza_id,
    g.codigo, g.modulo, g.nivel, g.area_m2,
    g.medidor_energia, g.medidor_agua,
    'alquilado'::local_estado,
    NOW()
  FROM (VALUES
    ('45',  'A',   '1',   556.22, '10456050', '9999999'),
    ('56',  'B',   '2',   230.77, '96700465', '9999998'),
    ('3',   'C',   '1',    96.00, '96746914', '9999997'),
    ('3-A', 'C',   '1',    54.64, '96741831', '9999996'),
    ('14',  'D',   '2',    93.37, '96700456', '9999995'),
    ('24',  'E',   '2',    73.15, '96747368', '9999994'),
    ('36',  'F',   '1',    73.15, '96746108', '9999993'),
    ('5',   'K',   '1',   146.30, '96700436', '9999992'),
    ('4',   'PAD', '1',    49.00, '96700476', '9999991')
  ) AS g(codigo, modulo, nivel, area_m2, medidor_energia, medidor_agua);

  -- ── 2) INSERT 8 inquilinos únicos (PINTURAS NORTE se consolida) ───────────
  --    ⚠️ `updated_at` no tiene DEFAULT en la columna → set NOW() explícito.
  INSERT INTO inquilino (
    id, plaza_id,
    razon_social, nombre_comercial, representante_legal,
    tipo_cliente, giro_autorizado, categoria, subcategoria,
    comentarios,
    updated_at
  )
  VALUES
    (gen_random_uuid(), v_plaza_id,
     'ENTRETENIMIENTO Y TECNOLOGÍA, S.A. DE C.V.', 'EL VENDEDOR', 'JUAN PEREZ',
     'grande', 'Venta de ropa', 'MODA & ACCESORIOS', 'MODA FEMENINA',
     'Importado del formato Excel (Hoja 2). Origen: F:\sys-solicitudes\Formato Llenar Informacion Locales e Inquilinos para App.xlsx',
     NOW()),

    (gen_random_uuid(), v_plaza_id,
     'SANTOS MOLINA ALFARO', 'LA CASA DE LAS LAMPARAS', 'JUAN PORRAS',
     'mediano', 'VENTA DE LAMPARAS', 'RETAIL ESPECIALIZADO', 'HOGAR Y DECORACION',
     'Importado del formato Excel (Hoja 2).',
     NOW()),

    (gen_random_uuid(), v_plaza_id,
     'INDUSTRIAS CARICIA, S.A. DE C.V.', 'PINTURAS NORTE', 'CARLOS CASTRO',
     'otro', 'Venta de alimentos y bebidas', 'ALIMENTOS Y BEBIDAS', 'HELADERIA',
     'Importado del formato Excel (Hoja 2). El Excel lista DOS representantes legales para esta empresa (uno por local): CARLOS CASTRO (local 3) y LEONEL MESSI (local 3-A). Solo CARLOS CASTRO se conserva en `representante_legal`; LEONEL MESSI queda registrado en `condiciones` del contrato del local 3-A.',
     NOW()),

    (gen_random_uuid(), v_plaza_id,
     'TELMA JANETH RODRÍGUEZ RIVERA', 'OPTICAS TELMA', 'LUIS SUAREZ',
     'grande', 'Venta de lentes', 'SERVICIOS', 'OPTICA',
     'Importado del formato Excel (Hoja 2).',
     NOW()),

    (gen_random_uuid(), v_plaza_id,
     'INTRADE, S.A. DE C.V.', 'LA PAMPA USULUTECA', 'LUIS VELASQUEZ',
     'mediano', 'Venta de alimentos y bebidas', 'ALIMENTOS Y BEBIDAS', 'RESTAURANTE',
     'Importado del formato Excel (Hoja 2).',
     NOW()),

    (gen_random_uuid(), v_plaza_id,
     'CORPORACION BM, S.A. de C.V.', 'BANCO MUNICIPAL', 'JOSE LUIS MENDEZ',
     'grande', 'Banco', 'SERVICIOS', 'BANCO',
     'Importado del formato Excel (Hoja 2).',
     NOW()),

    (gen_random_uuid(), v_plaza_id,
     'HPR RESTAURANTES, S.A. DE C.V.', 'TAQUERIA LOS POTRILLOS', 'MANUEL CASTRO',
     'mediano', 'Venta de alimentos y bebidas', 'ALIMENTOS Y BEBIDAS', 'RESTAURANTE',
     'Importado del formato Excel (Hoja 2).',
     NOW()),

    (gen_random_uuid(), v_plaza_id,
     'UNICOMER, S.A. DE C.V.', 'RADIOSHACK', 'RAFAEL VARGAS',
     'grande', 'Venta de electrónicos', 'RETAIL ESPECIALIZADO', 'TECNOLOGIA',
     'Importado del formato Excel (Hoja 2).',
     NOW());

  -- ── 3) INSERT 9 contratos (uno por local; PINTURAS NORTE firma dos) ───────
  --    ⚠️ `updated_at` no tiene DEFAULT en la columna → set NOW() explícito.
  INSERT INTO contrato (
    id, plaza_id, local_id, inquilino_id,
    fecha_inicio, fecha_fin,
    monto_mensual, moneda, condiciones,
    estado,
    plazo_anios, area_mt2_medicion_real,
    cuota_arrendamiento, cuota_cam,
    deposito_garantia,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    v_plaza_id,
    l.id,
    i.id,
    CURRENT_DATE,
    NULL,
    (m.canon * m.area) + (m.cam * m.area),
    'USD',
    m.condiciones,
    'vigente'::contrato_estado,
    m.plazo,
    m.area,
    m.canon,
    m.cam,
    m.deposito,
    NOW()
  FROM (VALUES
    ('45',  'ENTRETENIMIENTO Y TECNOLOGÍA, S.A. DE C.V.', 1, 556.22, 10.00, 2.50, 1000.00,
       'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE (Excel sin columna AD poblada).'),
    ('56',  'SANTOS MOLINA ALFARO', 2, 230.77, 11.00, 3.00, 1100.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE.'),
    ('3',   'INDUSTRIAS CARICIA, S.A. DE C.V.', 3,  96.00, 12.00, 3.50, 1200.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE. Representante legal: CARLOS CASTRO.'),
    ('3-A', 'INDUSTRIAS CARICIA, S.A. DE C.V.', 3,  54.64,  7.00, 4.00, 1300.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE. Representante legal de este local: LEONEL MESSI (ver comentarios del inquilino INDUSTRIAS CARICIA).'),
    ('14',  'TELMA JANETH RODRÍGUEZ RIVERA', 2,  93.37,  8.00, 4.50, 1400.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE.'),
    ('24',  'INTRADE, S.A. DE C.V.', 1,  73.15, 19.00, 5.00, 1500.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE.'),
    ('36',  'CORPORACION BM, S.A. de C.V.', 1,  73.15, 20.00, 6.00, 1600.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE.'),
    ('5',   'HPR RESTAURANTES, S.A. DE C.V.', 1, 146.30, 21.00, 6.50, 1700.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE.'),
    ('4',   'UNICOMER, S.A. DE C.V.', 1,  49.00, 22.00, 7.00, 1800.00,
     'Importado del formato Excel (Hoja 2). Fecha inicio = CURRENT_DATE.')
  ) AS m(local_codigo, inquilino_razon_social, plazo, area, canon, cam, deposito, condiciones)
  JOIN local l
    ON l.plaza_id = v_plaza_id
   AND l.codigo = m.local_codigo
  JOIN inquilino i
    ON i.plaza_id = v_plaza_id
   AND i.razon_social = m.inquilino_razon_social;

  -- ── 4) Defensa: forzar estado='alquilado' en los 9 locales (la app lo hace
  --       por T-054 al crear contratos, pero aquí la migración escribe directo).
  UPDATE local
  SET estado = 'alquilado'::local_estado
  WHERE plaza_id = v_plaza_id
    AND codigo IN ('45','56','3','3-A','14','24','36','5','4');
END
$$;

COMMIT;
