/**
 * Seed idempotente de Plazapp.
 *
 * Carga el catálogo global de roles (T-017) y un superadmin inicial (T-018).
 * Es seguro ejecutarlo varias veces: usa `upsert` por claves naturales.
 *
 * ⚠️ Solo dev: el superadmin trae una contraseña conocida. En producción
 * se debe rotar inmediatamente (ver docs/02-stack-tecnologico.md §2.11).
 *
 * Ejecutar con: `npm run prisma:seed` (o `prisma migrate dev`, que lo invoca).
 * Detalles: PLANIFICACION/02-autenticacion-usuarios.md (T-017, T-018, T-019).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client as MinioClient } from 'minio';
import bcrypt from 'bcrypt';
import { PERMISOS_CATALOG, PERMISOS_ROL_ADMIN_TODOS } from './seed-data/permisos';

const BCRYPT_COST = 12;

// Roles globales (catálogo fijo, sin plaza_id). Códigos inmutables.
const ROLES_GLOBALES = [
  {
    codigo: 'superadmin',
    nombre: 'Superadministrador',
    descripcion: 'Administrador de la plataforma. Sin plaza asociada.',
  },
  {
    codigo: 'admin_plaza',
    nombre: 'Administrador de plaza',
    descripcion: 'Gestiona una plaza: usuarios, locales, contratos y solicitudes.',
  },
  {
    codigo: 'inquilino',
    nombre: 'Inquilino',
    descripcion: 'Usuario de un inquilino. Crea y da seguimiento a sus solicitudes.',
  },
] as const;

const SUPERADMIN_EMAIL = 'superadmin@plazapp.com';
const SUPERADMIN_PASSWORD = 'Plazapp2026!'; // solo dev

/**
 * T-RBAC-1: siembra el catálogo global de permisos. Idempotente: solo añade
 * los permisos nuevos; los existentes no se tocan (mantiene la descripción
 * original incluso si cambia el archivo seed).
 */
async function seedPermisos(prisma: PrismaClient): Promise<void> {
  let added = 0;
  let existing = 0;
  for (const p of PERMISOS_CATALOG) {
    const found = await prisma.permiso.findUnique({ where: { codigo: p.codigo } });
    if (found) {
      existing++;
      continue;
    }
    await prisma.permiso.create({
      data: {
        codigo: p.codigo,
        modulo: p.modulo,
        accion: p.accion,
        descripcion: p.descripcion,
      },
    });
    added++;
  }
  console.log(
    `✓ Permisos sembrados (nuevos: ${added}, existentes: ${existing}, total catálogo: ${PERMISOS_CATALOG.length}).`,
  );
}

/**
 * T-RBAC-1: crea/actualiza el rol_staff "admin" del sistema con `es_sistema=true`
 * y le asigna TODOS los permisos del catálogo. Es idempotente: si el rol ya
 * existe, solo añade los permisos nuevos que falten. Devuelve el rol creado.
 */
async function seedRolAdmin(
  prisma: PrismaClient,
  plazaId: string,
): Promise<{ id: string; codigo: string }> {
  const rolAdmin = await prisma.rol_staff.upsert({
    where: { plaza_id_codigo: { plaza_id: plazaId, codigo: 'admin' } },
    update: {
      // El trigger fn_rol_staff_sistema_inamovible rechaza cambios en codigo
      // / nombre / plaza_id cuando es_sistema=true. Aquí solo forzamos el flag.
      es_sistema: true,
    },
    create: {
      plaza_id: plazaId,
      codigo: 'admin',
      nombre: 'Administrador del sistema',
      descripcion:
        'Rol inamovible con todos los permisos del sistema. Único capaz de gestionar roles y asignar permisos. Se siembra automáticamente; no se puede borrar ni renombrar.',
      es_sistema: true,
    },
  });

  // Asignar permisos: el rol admin recibe todos los del catálogo. Para
  // idempotencia, solo insertamos los que falten (PK compuesta evita dup).
  const permisos = await prisma.permiso.findMany({
    where: { codigo: { in: [...PERMISOS_ROL_ADMIN_TODOS] } },
    select: { id: true, codigo: true },
  });
  const yaAsignados = await prisma.rol_staff_permiso.findMany({
    where: { rol_staff_id: rolAdmin.id },
    select: { permiso_id: true },
  });
  const asignadosSet = new Set(yaAsignados.map((r) => r.permiso_id));
  const nuevos = permisos.filter((p) => !asignadosSet.has(p.id));

  if (nuevos.length > 0) {
    await prisma.rol_staff_permiso.createMany({
      data: nuevos.map((p) => ({
        rol_staff_id: rolAdmin.id,
        permiso_id: p.id,
        plaza_id: plazaId,
      })),
      skipDuplicates: true,
    });
  }
  console.log(
    `✓ Rol "admin" del sistema: ${rolAdmin.id} (permisos totales: ${permisos.length}, nuevos asignados: ${nuevos.length}).`,
  );
  return rolAdmin;
}

async function main(): Promise<void> {
  // El seed crea el superadmin (usuario con plaza_id NULL) y, en T-045, la plaza
  // demo + su admin. Debe usar la conexión ADMIN (superusuario) para bypassar
  // RLS (T-038): insertar como syssol_app sería rechazado por las políticas.
  const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_ADMIN_URL/DATABASE_URL no está definida en el entorno');
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // ── Roles globales ───────────────────────────────────────────────────────
    for (const rol of ROLES_GLOBALES) {
      await prisma.rol.upsert({
        where: { codigo: rol.codigo },
        update: { nombre: rol.nombre, descripcion: rol.descripcion },
        create: rol,
      });
    }
    const rolesCount = await prisma.rol.count();
    console.log(`✓ Roles globales sembrados (total: ${rolesCount}).`);

    // ── Superadmin inicial ───────────────────────────────────────────────────
    const rolSuperadmin = await prisma.rol.findUniqueOrThrow({
      where: { codigo: 'superadmin' },
    });

    // El superadmin no tiene plaza_id; lo identificamos por email + rol.
    const existente = await prisma.usuario.findFirst({
      where: { email: SUPERADMIN_EMAIL, plaza_id: null },
    });

    if (existente) {
      console.log(`✓ Superadmin ya existe (${SUPERADMIN_EMAIL}), no se modifica.`);
    } else {
      const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, BCRYPT_COST);
      await prisma.usuario.create({
        data: {
          email: SUPERADMIN_EMAIL,
          password_hash: passwordHash,
          nombre: 'Superadministrador',
          rol_id: rolSuperadmin.id,
          plaza_id: null,
          rol_staff_id: null,
          inquilino_id: null,
        },
      });
      console.log(`✓ Superadmin creado: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD} (solo dev).`);
    }

    // ── Plaza demo + configuración + staff + admin (T-045) ────────────────────
    const plazaDemo = await prisma.plaza.upsert({
      where: { slug: 'demo' },
      update: {},
      create: { slug: 'demo', nombre_comercial: 'Plaza Demo', color_primario: '#2563eb' },
    });
    await prisma.configuracion.upsert({
      where: { plaza_id: plazaDemo.id },
      update: {},
      create: { plaza_id: plazaDemo.id },
    });

    const ROLES_STAFF_DEMO = [
      { codigo: 'tecnico', nombre: 'Técnico' },
      { codigo: 'ingeniero', nombre: 'Ingeniero' },
      { codigo: 'supervisor', nombre: 'Supervisor' },
    ];
    for (const rs of ROLES_STAFF_DEMO) {
      await prisma.rol_staff.upsert({
        where: { plaza_id_codigo: { plaza_id: plazaDemo.id, codigo: rs.codigo } },
        update: { nombre: rs.nombre },
        create: { plaza_id: plazaDemo.id, codigo: rs.codigo, nombre: rs.nombre },
      });
    }
    console.log(`✓ Plaza demo "${plazaDemo.slug}" + configuración + roles de staff.`);

    // ── T-RBAC-1: seed del catálogo de permisos + rol "admin" del sistema ───
    await seedPermisos(prisma);
    const rolAdmin = await seedRolAdmin(prisma, plazaDemo.id);

    const rolAdminPlaza = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'admin_plaza' } });
    const rolInquilino = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'inquilino' } });
    const ADMIN_DEMO_EMAIL = 'admin@demo.com';
    const INQUILINO_DEMO_EMAIL = 'inquilino@demo.com';
    const INQUILINO_RAZON_SOCIAL = 'Tienda Sol S.A. de C.V.';
    const adminDemo = await prisma.usuario.findFirst({
      where: { email: ADMIN_DEMO_EMAIL, plaza_id: plazaDemo.id },
    });
    if (adminDemo) {
      // Si ya existe el admin demo y NO tiene rol_staff_id apuntando al rol
      // "admin", lo actualizamos (migración para datos seed pre-RBAC).
      if (adminDemo.rol_staff_id !== rolAdmin.id) {
        await prisma.usuario.update({
          where: { id: adminDemo.id },
          data: { rol_staff_id: rolAdmin.id },
        });
        console.log(`✓ Admin demo actualizado: ahora con rol_staff "admin".`);
      } else {
        console.log(`✓ Admin demo ya existe (${ADMIN_DEMO_EMAIL}) con rol_staff "admin", no se modifica.`);
      }
    } else {
      const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, BCRYPT_COST); // misma clave dev
      await prisma.usuario.create({
        data: {
          plaza_id: plazaDemo.id,
          rol_id: rolAdminPlaza.id,
          rol_staff_id: rolAdmin.id,
          email: ADMIN_DEMO_EMAIL,
          password_hash: passwordHash,
          nombre: 'Admin Demo',
        },
      });
      console.log(`✓ Admin demo creado: ${ADMIN_DEMO_EMAIL} / ${SUPERADMIN_PASSWORD} (solo dev).`);
    }

    // ── T-extra: inquilino demo + local + contrato (T-048, T-049, T-053) ──────
    // Necesario para pruebas E2E de los 3 roles. Idempotente vía upsert + clave
    // natural (email para usuario, identificacion para inquilino, codigo para local).
    const inquilinoDemo = await prisma.inquilino.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {
        razon_social: INQUILINO_RAZON_SOCIAL,
        contacto1_nombre: 'María Pérez',
        contacto1_email: INQUILINO_DEMO_EMAIL,
        contacto1_telefono: '+503 7000-0001',
      },
      create: {
        // UUID fijo para idempotencia determinista.
        id: '00000000-0000-0000-0000-000000000001',
        plaza_id: plazaDemo.id,
        razon_social: INQUILINO_RAZON_SOCIAL,
        identificacion: 'SOL-050101-001-1',
        direccion: 'San Salvador, El Salvador',
        contacto1_nombre: 'María Pérez',
        contacto1_email: INQUILINO_DEMO_EMAIL,
        contacto1_telefono: '+503 7000-0001',
      },
    });
    await prisma.local.upsert({
      where: { plaza_id_codigo: { plaza_id: plazaDemo.id, codigo: 'L-SOL-1' } },
      update: {},
      create: {
        plaza_id: plazaDemo.id,
        codigo: 'L-SOL-1',
        area_m2: '42.50',
        nivel: '1',
        modulo: 'NORTE',
        medidor_energia: '10456050',
        medidor_agua: '9999991',
      },
    });
    await prisma.local.upsert({
      where: { plaza_id_codigo: { plaza_id: plazaDemo.id, codigo: 'L-SOL-2' } },
      update: {},
      create: {
        plaza_id: plazaDemo.id,
        codigo: 'L-SOL-2',
        area_m2: '28.00',
        nivel: '2',
        modulo: 'SUR',
        medidor_energia: '10456051',
        medidor_agua: '9999992',
      },
    });
    const today = new Date();
    const inicio = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const fin = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 11, 28));
    await prisma.contrato.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {
        estado: 'vigente',
        fecha_inicio: inicio,
        fecha_fin: fin,
        monto_mensual: '1250.00',
        condiciones: 'Contrato demo generado por seed (solo dev).',
        // Campos nuevos Excel Hoja 2 U-AK (T-V14+; demo).
        plazo_meses: 12,
        area_mt2_medicion_real: '42.50',
        cuota_arrendamiento: '1200.00',
        cuota_cam: '50.00',
        deposito_garantia: '1250.00',
        periodo_gracia_dias: 90,
        condiciones_incremento_canon: 'Incremento anual según IPC.',
      },
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        plaza_id: plazaDemo.id,
        local_id: (
          await prisma.local.findUniqueOrThrow({
            where: { plaza_id_codigo: { plaza_id: plazaDemo.id, codigo: 'L-SOL-1' } },
            select: { id: true },
          })
        ).id,
        inquilino_id: inquilinoDemo.id,
        fecha_inicio: inicio,
        fecha_fin: fin,
        monto_mensual: '1250.00',
        moneda: 'USD',
        condiciones: 'Contrato demo generado por seed (solo dev).',
        estado: 'vigente',
        // Campos nuevos Excel Hoja 2 U-AK (T-V14+; demo).
        plazo_meses: 12,
        area_mt2_medicion_real: '42.50',
        cuota_arrendamiento: '1200.00',
        cuota_cam: '50.00',
        deposito_garantia: '1250.00',
        periodo_gracia_dias: 90,
        condiciones_incremento_canon: 'Incremento anual según IPC.',
      },
    });

    // Usuario del inquilino (vinculado por inquilino_id).
    const inquilinoUser = await prisma.usuario.findFirst({
      where: { email: INQUILINO_DEMO_EMAIL, plaza_id: plazaDemo.id },
    });
    if (inquilinoUser) {
      if (inquilinoUser.inquilino_id !== inquilinoDemo.id) {
        await prisma.usuario.update({
          where: { id: inquilinoUser.id },
          data: { inquilino_id: inquilinoDemo.id },
        });
      }
      console.log(`✓ Inquilino demo ya existe (${INQUILINO_DEMO_EMAIL}), no se modifica.`);
    } else {
      const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, BCRYPT_COST);
      await prisma.usuario.create({
        data: {
          email: INQUILINO_DEMO_EMAIL,
          password_hash: passwordHash,
          nombre: 'María Pérez',
          rol_id: rolInquilino.id,
          plaza_id: plazaDemo.id,
          inquilino_id: inquilinoDemo.id,
        },
      });
      console.log(`✓ Inquilino demo creado: ${INQUILINO_DEMO_EMAIL} / ${SUPERADMIN_PASSWORD} (solo dev).`);
    }

    // ── Categorías base de la plaza demo (T-063) ──────────────────────────────
    const CATEGORIAS_DEMO = [
      { nombre: 'Mantenimiento', descripcion: 'Reparaciones y mantenimiento general.' },
      { nombre: 'Eventos', descripcion: 'Eventos y activaciones en áreas comunes.' },
      { nombre: 'Remodelaciones', descripcion: 'Obras y remodelaciones de locales.' },
      { nombre: 'Otros', descripcion: 'Solicitudes que no encajan en las demás.' },
    ];
    for (const cat of CATEGORIAS_DEMO) {
      await prisma.categoria.upsert({
        where: { plaza_id_nombre: { plaza_id: plazaDemo.id, nombre: cat.nombre } },
        update: { descripcion: cat.descripcion },
        create: { plaza_id: plazaDemo.id, ...cat },
      });
    }
    console.log(`✓ Categorías base de la plaza demo (${CATEGORIAS_DEMO.length}).`);

    // ── Tipos de solicitud configurados para la plaza demo (T-V20) ────────────
    // Inserta las 4 filas canónicas con etiquetas default. El admin puede
    // luego renombrar/desactivar desde /admin/catalogos/tipos-solicitud.
    const TIPOS_DEMO: Array<{ codigo: string; etiqueta: string; descripcion: string; orden: number }> = [
      { codigo: 'mantenimiento', etiqueta: 'Mantenimiento', descripcion: 'Reparaciones y mantenimiento general.', orden: 0 },
      { codigo: 'evento',        etiqueta: 'Evento',        descripcion: 'Eventos y activaciones en áreas comunes.', orden: 1 },
      { codigo: 'remodelacion',  etiqueta: 'Remodelación',  descripcion: 'Obras y remodelaciones de locales.', orden: 2 },
      { codigo: 'otro',          etiqueta: 'Otro',          descripcion: 'Solicitudes que no encajan en las demás (no requiere categoría).', orden: 3 },
    ];
    for (const t of TIPOS_DEMO) {
      await prisma.solicitud_tipo_config.upsert({
        where: { plaza_id_codigo: { plaza_id: plazaDemo.id, codigo: t.codigo } },
        update: { etiqueta: t.etiqueta, descripcion: t.descripcion, orden: t.orden, activo: true },
        create: { plaza_id: plazaDemo.id, ...t, activo: true },
      });
    }
    console.log(`✓ Tipos de solicitud base de la plaza demo (${TIPOS_DEMO.length}).`);

    console.log('Seed completado.');

    // ── Buckets de MinIO para la plaza demo (T-111) ─────────────────────────────
    // Best-effort: si MinIO no está corriendo, la BD queda sembrada y los
    // buckets se materializarán en el primer `ensureBucket` al subir.
    try {
      const minio = new MinioClient({
        endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
        port: Number(process.env.MINIO_PORT ?? '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
        region: process.env.MINIO_REGION ?? 'us-east-1',
      });
      const plazaId = plazaDemo.id;
      const buckets = [
        `plaza-assets-${plazaId}`,
        `solicitudes-adjuntos-${plazaId}`,
        `locales-planos-${plazaId}`,
        `contratos-${plazaId}`,
        `quarantine-${plazaId}`,
      ];
      for (const b of buckets) {
        const exists = await minio.bucketExists(b).catch(() => false);
        if (!exists) {
          await minio.makeBucket(b, process.env.MINIO_REGION ?? 'us-east-1');
          console.log(`✓ Bucket MinIO creado: ${b}`);
        }
      }
      await minio.setBucketLifecycle(`quarantine-${plazaId}`, {
        Rule: [
          {
            ID: 'purge-quarantine-30d',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Expiration: { Days: 30 },
          },
        ],
      });
      console.log(`✓ Lifecycle policy 30d aplicada a quarantine-${plazaId}.`);
    } catch (err) {
      console.warn(`⚠️  MinIO no disponible, buckets no inicializados: ${String(err)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error en el seed:', err);
  process.exitCode = 1;
});
