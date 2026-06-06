---
name: project-status
description: Dashboard completo del estado del proyecto sys-solicitudes (Plazapp). Muestra rama actual, último commit, progreso de PLANIFICACION/, supuestos pendientes, decisiones vinculantes y salud de la memoria MCP. Usar cuando el usuario pregunte "cómo va el proyecto", "estado", "dashboard", "qué falta", o al iniciar una sesión para orientación.
---

# /project-status

Genera un dashboard en markdown con el estado actual de `sys-solicitudes`.

## Cuándo invocarla

- El usuario dice "cómo va el proyecto", "estado", "qué falta", "dashboard", "status"
- Al iniciar una sesión de trabajo para orientarte antes de actuar
- Antes de tomar una tarea nueva (para saber qué está bloqueado)

## Procedimiento

Ejecuta estos pasos en orden. Devuelve un único bloque de markdown con todo.

### 1. Git y rama

```
git -C ${CLAUDE_PROJECT_DIR} rev-parse --abbrev-ref HEAD
git -C ${CLAUDE_PROJECT_DIR} log -3 --oneline
git -C ${CLAUDE_PROJECT_DIR} status --short
```

### 2. Progreso de PLANIFICACION

Lee `PLANIFICACION/00-INDICE.md` y extrae:
- Total de tareas y completadas
- Por módulo: rango, total, completadas, progreso
- Lista de T-Vxx **pendientes** (estado ≠ "Completada" en la bitácora)

### 3. Supuestos y decisiones vinculantes

- Lista los IDs `T-Vxx` con estado `Completada` (decisiones vinculantes tomadas).
- Lista los IDs `T-Vxx` con estado pendiente o bloqueado (siguiente acción del cliente).
- Para cada supuesto `S-*` referenciado, indica el documento de origen.

### 4. Memoria MCP

Intenta invocar la tool `mcp__memory__read_graph` del server `memory` configurado en `.mcp.json`:
- Si **falla** o no hay entidades: muestra `⚠️ Memoria no cargada. Ejecutá .claude/memory/load-seed.sh o pedime que la siembre.`
- Si **funciona**: cuenta entidades, relaciones y observaciones. Lista las 5 entidades más relevantes (las que tienen más relaciones salientes: `Proyecto_sys-solicitudes`, `Decision_T-V01`, `Modulo_solicitudes`, `Invariante_plaza_id`, `Stack_Tecnologico`).

### 5. Salud de scopes (verificar invariantes del proyecto)

Comprueba que estos archivos/punteros existen y son del proyecto, NO globales:

- `F:/sys-solicitudes/.mcp.json` ← debe existir (project scope)
- `F:/sys-solicitudes/.claude/skills/project-status/SKILL.md` ← debe existir
- `F:/sys-solicitudes/.claude/memory/project-graph.jsonl` ← archivo de memoria del proyecto
- `~/.claude/CLAUDE.md` ← **NO debe contener** información específica de sys-solicitudes

Si encuentras algo en `~/.claude/` específico de este proyecto, **alerta al usuario** (viola la regla `Regla_scope_project_only`).

### 6. Output

Devuelve un único reporte con esta estructura (en español, formato markdown):

```markdown
# 📊 Estado de sys-solicitudes (Plazapp)

## 🌿 Git
- **Rama:** <branch>
- **Último commit:** <hash corto> <msg>
- **Working tree:** <clean | N archivos modificados>

## 📋 PLANIFICACION
- **Total:** 175 tareas · **Completadas:** N · **Progreso global:** X%
- **Por módulo:**
  | Módulo | Total | ✅ | Progreso |
  |---|---|---|---|
  | 01-setup-base | 16 | 0 | 0% |
  | ... |
- **🔴 T-Vxx pendientes:** T-V02, T-V03, ...

## 📌 Decisiones vinculantes
- ✅ T-V01 — Estrategia multi-tenant (DB compartida + single subdomain)
- ⏳ T-V02 — Roles y categorías (pendiente)
- ...

## 🧠 Memoria MCP
- Entidades: N · Relaciones: M · Observaciones: K
- (O bien: ⚠️ No cargada)

## ✅ Scopes
- Todo dentro del proyecto ✓ | 0 violaciones

## 🎯 Siguiente paso sugerido
<una sola oración basada en el estado>
```

## Restricciones

- **Solo lectura.** Esta skill no modifica archivos.
- **Project-only.** No debe leer ni escribir fuera de `${CLAUDE_PROJECT_DIR}` ni `~/.claude/` (solo este último para *verificar* que no haya contaminación).
- **Sin instalar nada.** No ejecuta `npm install`, `docker compose up`, etc.
- **Si algo falla**, reporta el error y continúa con el resto. No abortes el dashboard entero.

## Notas operativas

- La skill se invoca con `/project-status` (porque el archivo está en `.claude/skills/project-status/SKILL.md` y el frontmatter `name` coincide con el directorio).
- Si Claude decide invocarla automáticamente, lo hará cuando el `description` del frontmatter coincida con el contexto del prompt.
- Es una skill **proactiva** del modelo (puede auto-invocarse); no la marques como `disable-model-invocation`.
