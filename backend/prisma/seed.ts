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
import bcrypt from 'bcrypt';

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

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida en el entorno');
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

    // ── Roles de staff demo (T-019) ──────────────────────────────────────────
    // Solo si existe alguna plaza (las plazas se crean en el módulo 03). Defensivo.
    const plazaDemo = await prisma.plaza.findFirst({ where: { deleted_at: null } });
    if (plazaDemo) {
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
      console.log(`✓ Roles de staff demo sembrados para la plaza "${plazaDemo.slug}".`);
    } else {
      console.log('• Sin plazas aún: se omiten roles de staff demo (se crean en el módulo 03).');
    }

    console.log('Seed completado.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error en el seed:', err);
  process.exitCode = 1;
});
