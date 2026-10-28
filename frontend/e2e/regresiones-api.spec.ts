import { execSync } from 'node:child_process';
import { test, expect, request } from '@playwright/test';
import { API_URL, CUENTAS, apiLogin, categoriaConSubcategoria, fechaPlazaMasDias } from './helpers/api';

/**
 * Regresiones de los bugs de severidad Alta corregidos en la auditoría del
 * 2026-10-27 (docs/08-auditoria-qa-y-mejoras.md §3):
 *  F1  editar una solicitud de remodelación respondía siempre 422;
 *  F5  el cambio de rol de staff de un usuario se ignoraba;
 *  F6  los usuarios deshabilitados no aparecían en ningún listado;
 *  F7  una plaza desactivada no impedía el login de sus usuarios.
 */
const ASISTENTES = {
  asistentes_estimados: 1,
  asistentes: [{ nombre: 'Asistente E2E', documento: '00000000-0' }],
};

test('F1: editar una remodelación guarda sus campos propios', async () => {
  const inq = await apiLogin(CUENTAS.inquilino);
  const locales = (await (await inq.get(`${API_URL}/locales?page=1&pageSize=1`)).json()) as {
    items: { id: string }[];
  };
  const { categoriaId, subcategoriaId } = await categoriaConSubcategoria(inq);
  const fecha = fechaPlazaMasDias(3);
  const creada = await inq.post(`${API_URL}/solicitudes`, {
    data: {
      localId: locales.items[0]!.id,
      tipo: 'remodelacion',
      titulo: `E2E-REG-F1-${Date.now()}`,
      descripcion: 'Regresión F1.',
      fechaEventoInicio: fecha,
      fechaEventoFin: fecha,
      horaInicio: '10:00',
      horaFin: '11:00',
      categoriaId,
      subcategoriaId,
      empresaNombre: 'E2E S.A.',
      empresaResponsable: 'Responsable',
      empresaTelefono: '+503 7000 0000',
      empresaEmail: 'e2e@example.com',
      emergenciaContacto: 'Contacto',
      emergenciaTelefono: '+503 7000 0001',
      esEmergencia: false,
      camposExtra: {
        fecha_inicio_estimada: fechaPlazaMasDias(4),
        duracion_dias: 2,
        empresa_constructora: 'Constructora',
        monto_presupuesto: 1000,
        ...ASISTENTES,
      },
    },
  });
  expect(creada.status(), await creada.text()).toBe(201);
  const { id } = (await creada.json()) as { id: string };

  const editada = await inq.patch(`${API_URL}/solicitudes/${id}`, {
    data: {
      tipo: 'remodelacion',
      esEmergencia: false,
      camposExtra: {
        fecha_inicio_estimada: fechaPlazaMasDias(4),
        duracion_dias: 5,
        empresa_constructora: 'Constructora 2',
        monto_presupuesto: 2500,
        ...ASISTENTES,
      },
    },
  });
  expect(editada.status(), await editada.text()).toBe(200);
  const body = (await editada.json()) as { camposExtra: Record<string, unknown> };
  expect(body.camposExtra.duracion_dias).toBe(5);
  expect(body.camposExtra.empresa_constructora).toBe('Constructora 2');

  // Lo inválido para el tipo sigue rechazándose.
  const invalida = await inq.patch(`${API_URL}/solicitudes/${id}`, {
    data: { tipo: 'remodelacion', esEmergencia: false, camposExtra: { duracion_dias: 'x' } },
  });
  expect(invalida.status()).toBe(422);
  await inq.post(`${API_URL}/solicitudes/${id}/cancelar`, { data: { motivo: 'Regresión F1' } });
  await inq.dispose();
});

test('F5 y F6: cambiar rol de staff y listar/reactivar deshabilitados', async () => {
  const adm = await apiLogin(CUENTAS.admin);
  const roles = (await (await adm.get(`${API_URL}/roles-staff?page=1&pageSize=50`)).json()) as {
    items: { id: string; codigo: string; activo: boolean }[];
  };
  const operativos = roles.items.filter((r) => r.activo && r.codigo !== 'admin');
  test.skip(operativos.length < 2, 'La plaza necesita al menos 2 roles de staff no-sistema');

  const alta = await adm.post(`${API_URL}/usuarios`, {
    data: {
      email: `e2e.reg.f5.${Date.now()}@example.com`,
      nombre: 'E2E Regresión F5',
      rol: 'admin_plaza',
      rolStaffId: operativos[0]!.id,
      password: 'Tmpe2e2026Xx1a',
    },
  });
  expect(alta.status(), await alta.text()).toBe(201);
  const { id } = (await alta.json()) as { id: string };

  // F5: el rol cambia de verdad.
  expect((await adm.patch(`${API_URL}/usuarios/${id}`, { data: { rolStaffId: operativos[1]!.id } })).status()).toBe(200);
  const det = (await (await adm.get(`${API_URL}/usuarios/${id}`)).json()) as { rolStaffId: string };
  expect(det.rolStaffId).toBe(operativos[1]!.id);
  // Nunca a null (sería "todos los permisos" por compatibilidad legacy).
  const aNull = await adm.patch(`${API_URL}/usuarios/${id}`, { data: { rolStaffId: null } });
  expect(aNull.status()).toBe(400);

  // F6: deshabilitado → solo aparece con activo=false → se reactiva.
  expect((await adm.delete(`${API_URL}/usuarios/${id}`, { data: { motivo: 'Regresión F6' } })).status()).toBe(204);
  const activos = (await (await adm.get(`${API_URL}/usuarios?page=1&pageSize=100`)).json()) as {
    items: { id: string }[];
  };
  const inactivos = (await (
    await adm.get(`${API_URL}/usuarios?page=1&pageSize=100&activo=false`)
  ).json()) as { items: { id: string }[] };
  expect(activos.items.map((u) => u.id)).not.toContain(id);
  expect(inactivos.items.map((u) => u.id)).toContain(id);
  expect((await adm.post(`${API_URL}/usuarios/${id}/reactivate`, { data: {} })).status()).toBe(201);
  await adm.delete(`${API_URL}/usuarios/${id}`, { data: { motivo: 'Limpieza regresión' } });
  await adm.dispose();
});

test('F7: una plaza desactivada no permite iniciar sesión', async () => {
  // Desactiva temporalmente la plaza QA "qa-c" directo en la BD local (no hay
  // endpoint para reactivar una plaza) y la restaura al terminar.
  const psql = (sql: string) =>
    execSync(`docker exec plazapp-postgres psql -U syssol -d syssol -tAc "${sql}"`, {
      stdio: 'pipe',
    }).toString();
  try {
    psql('select 1');
  } catch {
    test.skip(true, 'Requiere el contenedor plazapp-postgres local');
  }
  const ctx = await request.newContext();
  const login = () =>
    ctx.post(`${API_URL}/auth/login`, {
      data: { email: 'admin2@qa-c.com', password: CUENTAS.admin.password },
    });
  psql("update plaza set deleted_at = now() where slug = 'qa-c'");
  try {
    let res = await login();
    if (res.status() === 429) {
      await new Promise((r) => setTimeout(r, (Number(res.headers()['retry-after'] ?? 60) + 1) * 1000));
      res = await login();
    }
    expect(res.status()).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('PLAZA_INACTIVA');
  } finally {
    psql("update plaza set deleted_at = null where slug = 'qa-c'");
    await ctx.dispose();
  }
});
