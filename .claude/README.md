# `.claude/` — Configuración de Claude Code para `sys-solicitudes`

> **Política de scope:** todo lo de Claude Code específico de este proyecto vive en esta carpeta y en `.mcp.json` (ambos commiteados). **Nunca** se modifica `~/.claude/` ni `~/.claude.json` desde el trabajo de este repo. Ver [§ Scope y política](#scope-y-política) al final.

---

## 📂 Contenido

```
.claude/
├── README.md                       ← este archivo
├── settings.json                   ← settings del proyecto (commiteado)
├── settings.local.json.example     ← plantilla para overrides personales (NO commitear el .local.json)
├── skills/
│   ├── project-status/SKILL.md     ← `/project-status` — dashboard del estado del proyecto
│   └── load-memory/SKILL.md        ← `/load-memory` — siembra el knowledge graph inicial
├── agents/
│   └── multi-tenant-auditor.md     ← sub-agente que audita multi-tenancy
├── hooks/                          ← (vacío por ahora; ver §Hooks abajo)
└── memory/
    ├── seed.jsonl                  ← knowledge graph inicial (commiteado)
    └── project-graph.jsonl         ← estado de memoria (gitignored, se regenera con /load-memory)
```

Y en la raíz del proyecto:
```
.mcp.json                           ← MCP servers a nivel de proyecto (commiteado)
```

---

## 🚀 Quickstart para un dev nuevo

1. **Clonar el repo** — todo viene commiteado, no hay pasos adicionales para el equipo.
2. **Iniciar Claude Code** en la raíz del proyecto.
3. **Verificar MCP servers conectados** (escribí `/mcp` o pedí que liste servers). Deberías ver:
   - `memory` (knowledge graph)
   - `filesystem` (lectura de archivos con scope al proyecto)
   - `git` (operaciones git)
4. **Cargar la memoria** (solo la primera vez):
   ```
   /load-memory
   ```
   Va a leer `.claude/memory/seed.jsonl` y poblar el grafo con ~40 entidades (proyecto, stack, decisiones T-Vxx, módulos backend, roles, invariantes, reglas operativas).
5. **Probar el dashboard**:
   ```
   /project-status
   ```
   Debería mostrar progreso de PLANIFICACION/, supuestos pendientes, etc.

---

## 🧠 Skills disponibles

| Skill | Invocación | Cuándo se auto-invoca |
|---|---|---|
| `/project-status` | `> /project-status` | Cuando el usuario pregunta por estado, dashboard, "cómo va", al iniciar sesión |
| `/load-memory` | `> /load-memory` | Cuando `/project-status` reporta memoria vacía, o primera vez |

Ambas son **proactivas** (Claude puede invocarlas automáticamente si el contexto coincide con el `description` del frontmatter). Si querés que solo vos las invoques (nunca el modelo), agregá `disable-model-invocation: true` al frontmatter de cada SKILL.md.

---

## 🤖 Sub-agentes disponibles

| Agente | Cuándo se auto-invoca |
|---|---|
| `multi-tenant-auditor` | Después de crear/modificar controllers, services, o DTOs del backend NestJS |

Para invocarlo manualmente:
```
> Usá el agente multi-tenant-auditor para revisar backend/src/modules/solicitudes/
```

El agente corre en su propio context window, lee lo necesario, y devuelve un reporte markdown con hallazgos. No modifica código (solo reporta).

---

## 🔌 MCP servers (declarados en `.mcp.json`)

| Server | Propósito | Estado del archivo de estado |
|---|---|---|
| `memory` | Knowledge graph persistente del proyecto | `.claude/memory/project-graph.jsonl` (gitignored) |
| `filesystem` | Lectura/escritura con scope a `${CLAUDE_PROJECT_DIR}` | — |
| `git` | Operaciones git sobre el repo | — |

Para agregar uno nuevo, editá `.mcp.json` y agregá la entrada. La variable `${CLAUDE_PROJECT_DIR}` se resuelve al directorio del proyecto en runtime, así que la config es **portable entre máquinas**.

---

## 📏 Reglas operativas aplicables (en CLAUDE.md)

Estas reglas están documentadas en el `CLAUDE.md` raíz pero se reiteran acá porque aplican específicamente a este directorio:

- **R-Investigación de versiones** — antes de añadir deps en `package.json`, consultar registry.
- **R-Documentación de tareas** — toda tarea de `PLANIFICACION/*.md` debe terminar con bitácora.
- **R-Comunicación** — preguntar si hay ambigüedad; no asumir.
- **R-Scope project-only** — *esta* — todo vive en `.claude/` del proyecto, nunca en `~/.claude/`.

---

## ⚙️ Settings del proyecto (`.claude/settings.json`)

Commiteado y compartido. Define:

- **Permisos allow:** comandos git, npm, npx, docker compose, lectura/edición del proyecto.
- **Permisos deny:** comandos destructivos (`rm -rf /`, `mkfs`, force-push a ramas protegidas).
- **`enableAllProjectMcpServers: true`** — carga todos los MCP servers declarados en `.mcp.json`.

### Overrides personales

Si necesitás permisos extra (por ejemplo, abrir el editor con `code .`):

1. Copiá `.claude/settings.local.json.example` a `.claude/settings.local.json`
2. Editá lo que necesites

El archivo `.local.json` está en `.gitignore`, así que no se commitea. Tiene prioridad sobre `settings.json` por scope (Local > Project).

---

## 🪝 Hooks

Por ahora `.claude/hooks/` está vacío. Si necesitás automatización reactiva:

- **Lint post-edit:** hook `PostToolUse` con matcher `Edit|Write` que corra `npm run lint --workspace=<area>`.
- **Recordatorio de stack:** hook `PostToolUse` que inyecte convenciones según el archivo tocado (NestJS vs Next.js vs Prisma).
- **Bloqueo de push a main:** hook `PreToolUse` con matcher `Bash` que deniegue `git push ... main`.

Para agregarlos, creá un archivo `.claude/hooks/<nombre>.sh` y referenciálo desde `settings.json` con la sintaxis:

```json
"hooks": {
  "PostToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [{"type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/post-edit.sh"}]
    }
  ]
}
```

---

## 🚨 Scope y política (LECTURA OBLIGATORIA)

> **El owner de este proyecto trabaja en múltiples repositorios.** Por lo tanto, **toda la configuración de Claude Code para `sys-solicitudes` está estrictamente scoped a este proyecto.**

### ✅ Lo que SÍ está permitido

- Crear/modificar archivos en `./.claude/`
- Crear/modificar `./.mcp.json`
- Crear/modificar `./CLAUDE.md`
- Crear `CLAUDE.md` jerárquicos en subcarpetas (`backend/CLAUDE.md`, `frontend/CLAUDE.md`) que solo aplican al cargar archivos de esa carpeta

### ❌ Lo que NO está permitido

- Modificar `~/.claude/settings.json`
- Modificar `~/.claude/CLAUDE.md`
- Crear skills/agents/hooks en `~/.claude/`
- Modificar `~/.claude.json`
- Instalar plugins de manera global sin confirmación explícita

### 🤔 ¿Cuándo SÍ algo debería ser global?

Solo si:
1. La funcionalidad es útil en TODOS los proyectos del owner, Y
2. El owner lo confirma explícitamente con un mensaje del estilo *"hacelo global"*

Por ejemplo, una skill genérica de "revisar PRs" puede ser global. Una skill específica de "auditar el state machine de solicitudes" es **de este proyecto**.

### 🛡️ Cómo verificar

El sub-agente `multi-tenant-auditor` y la skill `/project-status` chequean esto. Si `/project-status` reporta violaciones, **es un bug que debe corregirse** (probablemente alguien ejecutó una tool que tocó el scope global por accidente).

### 📚 Por qué

- Si el owner abre un día otro proyecto (digamos `sys-facturacion`), no quiere que Claude le hable de `sys-solicitudes` ahí.
- Los MCP servers globales acarrean archivos de estado en `~/.claude/` que pueden tener keys/secretos/paths de otros proyectos.
- Las skills globales no se pueden desinstalar fácilmente y crecen con el tiempo.
- El scope del proyecto vive y muere con el proyecto (se borra todo al hacer `rm -rf`).

---

## 📖 Referencias

- [Claude Code — Settings](https://code.claude.com/docs/en/settings)
- [Claude Code — Skills](https://code.claude.com/docs/en/skills)
- [Claude Code — Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code — Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code — MCP](https://code.claude.com/docs/en/mcp)
- [MCP Registry](https://registry.modelcontextprotocol.io)
- [Agent Skills open standard](https://agentskills.io)
- [Catálogo de skills de la comunidad](https://www.skills.sh/)
