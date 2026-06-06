---
name: load-memory
description: Carga (o recarga) el knowledge graph inicial de sys-solicitudes en el MCP memory server. Usar la primera vez que se inicia el proyecto, o cuando el grafo de memoria se haya vaciado/dañado. Lee .claude/memory/seed.jsonl y crea las entidades y relaciones mediante las tools mcp__memory__create_entities y mcp__memory__create_relations.
---

# /load-memory

Siembra el knowledge graph persistente del proyecto en el MCP memory server.

## Cuándo invocarla

- **Primera vez** que se usa este proyecto con Claude Code.
- Después de borrar `.claude/memory/project-graph.jsonl`.
- Cuando `/project-status` reporta "Memoria no cargada".
- Cuando agregas una nueva entidad/relación al seed y quieres recargar.

## Procedimiento

### 1. Verificar disponibilidad del MCP memory server

Intenta invocar `mcp__memory__read_graph`. Si la tool no existe:

```
⚠️ El MCP server "memory" no está conectado.

Verificá:
1. ¿Existe .mcp.json en la raíz del proyecto?
2. ¿Se cargó al iniciar Claude Code? (debería aparecer en /mcp)
3. Si no: ejecutá /mcp y activá el server "memory"
4. Luego volvé a correr /load-memory
```

Abortá en este punto. No continúes.

### 2. Detectar si ya hay datos

Invocá `mcp__memory__read_graph` y observá la cantidad de entidades.

- Si `entities.length > 0` y NO es la primera carga: preguntá al usuario si quiere **sobrescribir** o **agregar**. No asumas.
- Si está vacío: continuá con la siembra.

### 3. Parsear el seed

Leé `.claude/memory/seed.jsonl` línea por línea. Cada línea es un JSON de una de estas formas:

**Entidad:**
```json
{"name": "...", "entityType": "...", "observations": ["...", "..."]}
```

**Relación:**
```json
{"from": "...", "to": "...", "relationType": "..."}
```

### 4. Cargar entidades y relaciones

**Paso 4a — Entidades:** agrupá todas las entidades (líneas sin `from`) en lotes de 20 e invocá:

```
mcp__memory__create_entities(entities=[{name, entityType, observations}, ...])
```

Repetí hasta vaciar la lista.

**Paso 4b — Relaciones:** agrupá todas las relaciones (líneas con `from`) en lotes de 50 e invocá:

```
mcp__memory__create_relations(relations=[{from, to, relationType}, ...])
```

### 5. Verificar y reportar

Invocá `mcp__memory__read_graph` de nuevo y contá entidades, relaciones y observaciones. Devolvé:

```
✅ Memoria de sys-solicitudes cargada.
   - Entidades: N
   - Relaciones: M
   - Observaciones: K
   - Archivo: ${CLAUDE_PROJECT_DIR}/.claude/memory/project-graph.jsonl

Ya podés usar /project-status para ver el dashboard completo.
```

## Restricciones

- **Project-only:** esta skill NO debe crear entidades globales ni tocar `~/.claude/`.
- **No destructivo por defecto:** si ya hay entidades, pregunta antes de sobrescribir.
- **Idempotencia parcial:** si la entidad ya existe, la tool `create_entities` la reemplaza (verificar si esto es aceptable para tu caso).
- **Rate limits:** el MCP memory server puede tener límites. Los lotes de 20-50 son seguros.

## Después de cargar

Una vez sembrada la memoria, podés probar con:

```
mcp__memory__search_nodes(query="multi-tenant")
mcp__memory__open_nodes(names=["Decision_T-V01"])
```

Deberían devolver los nodos relevantes. Si no, revisá `.claude/memory/project-graph.jsonl` directamente para ver qué se persistió.

## Formato del seed

El seed en `.claude/memory/seed.jsonl` sigue el formato estándar del MCP memory server. Para agregar más nodos, simplemente añadí líneas al final del archivo con el mismo formato JSONL y volvé a correr `/load-memory`.
