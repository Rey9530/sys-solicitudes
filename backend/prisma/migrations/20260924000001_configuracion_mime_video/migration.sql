-- Adjuntos: videos (video/mp4, video/quicktime, video/webm) permitidos por defecto (2026-09-24).
--
-- Bitácora:
--   - Decisión:  el cliente necesita adjuntar videos al crear solicitudes
--                (actualización de S-MimeTypes / T-V06; el máximo sigue en 50 MB).
--   - Cambia el DEFAULT de configuracion.mime_types_permitidos (plazas nuevas;
--                mismo orden que el @default de schema.prisma para evitar drift).
--   - Backfill idempotente en plazas existentes: solo agrega cada MIME de video
--                si falta; respeta plazas que hayan quitado otros tipos a mano.
--   - Fuente única de la lista: packages/contracts (MIME_PERMITIDOS_DEFAULT).

ALTER TABLE "configuracion"
  ALTER COLUMN "mime_types_permitidos"
  SET DEFAULT '["application/pdf","image/jpeg","image/png","image/webp","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/dwg","video/mp4","video/quicktime","video/webm"]';

UPDATE "configuracion"
   SET mime_types_permitidos = mime_types_permitidos || '["video/mp4"]'::jsonb,
       updated_at = CURRENT_TIMESTAMP
 WHERE jsonb_typeof(mime_types_permitidos) = 'array'
   AND NOT (mime_types_permitidos ? 'video/mp4');

UPDATE "configuracion"
   SET mime_types_permitidos = mime_types_permitidos || '["video/quicktime"]'::jsonb,
       updated_at = CURRENT_TIMESTAMP
 WHERE jsonb_typeof(mime_types_permitidos) = 'array'
   AND NOT (mime_types_permitidos ? 'video/quicktime');

UPDATE "configuracion"
   SET mime_types_permitidos = mime_types_permitidos || '["video/webm"]'::jsonb,
       updated_at = CURRENT_TIMESTAMP
 WHERE jsonb_typeof(mime_types_permitidos) = 'array'
   AND NOT (mime_types_permitidos ? 'video/webm');
