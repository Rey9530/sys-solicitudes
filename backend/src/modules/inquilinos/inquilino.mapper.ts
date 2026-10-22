import type { inquilino as InquilinoModel } from '@prisma/client';
import type { InquilinoOutput } from '@app/contracts';

/** Mapeo snake_case → camelCase de un inquilino. */
export function inquilinoToOutput(i: InquilinoModel): InquilinoOutput {
  return {
    id: i.id,
    plazaId: i.plaza_id,
    // Identidad
    razonSocial: i.razon_social,
    identificacion: i.identificacion,
    nombreComercial: i.nombre_comercial,
    representanteLegal: i.representante_legal,
    numeroNrc: i.numero_nrc,
    // Canales
    correoRecepcionDte: i.correo_recepcion_dte,
    numeroTelefono: i.numero_telefono,
    direccion: i.direccion,
    // Contacto 1
    contacto1Nombre: i.contacto1_nombre,
    contacto1Cargo: i.contacto1_cargo,
    contacto1Email: i.contacto1_email,
    contacto1Telefono: i.contacto1_telefono,
    // Contacto 2
    contacto2Nombre: i.contacto2_nombre,
    contacto2Cargo: i.contacto2_cargo,
    contacto2Email: i.contacto2_email,
    contacto2Telefono: i.contacto2_telefono,
    // Clasificación
    tipoCliente: i.tipo_cliente,
    giroAutorizado: i.giro_autorizado,
    categoria: i.categoria,
    subcategoria: i.subcategoria,
    // Otros
    comentarios: i.comentarios,
    // Auditoría
    createdAt: i.created_at.toISOString(),
    updatedAt: i.updated_at.toISOString(),
    deletedAt: i.deleted_at?.toISOString() ?? null,
  };
}
