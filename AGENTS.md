# AGENTS.md

## 1. El proyecto
Comiquería es un sistema web para ver el catálogo de una comiquería de anime y manga y reservar libros online.
Las reservas se guardan 24 horas y el pago y el retiro se hacen en efectivo en el local, sin cobrar nada online.

## 2. Documentos
- `docs/specs.md`: fuente de verdad del sistema. Tiene objetivo, roles, alcance, reglas de negocio (RN), historias de usuario (HU) y casos borde.
- `docs/glosario.md`: términos del sistema y su definición.
- `docs/decisiones.md`: las 10 preguntas esenciales que se hizo el analista, cada una con su respuesta.
- `docs/idea.md`: idea original del cliente.
- `docs/plan.md` y `docs/tasks.md`: se crean más adelante.

## 3. Stack
- Frontend: React + TypeScript.
- Backend: Node.js + TypeScript con Express, en capas Controller, Service y Repository.
- Base de datos: la define el arquitecto en `docs/plan.md`.

## 4. Reglas para todos los agentes
- Antes de actuar, leer `docs/specs.md` y `docs/glosario.md`.
- No inventar reglas. Si algo no está en la spec, no completarlo: frenar y preguntar.
- Cada cambio cita la RN o la HU que cumple.
- Solo el analista modifica `specs.md`, `decisiones.md` y `glosario.md`. Los demás reportan los problemas que encuentren.
- Cambios chicos: una tarea por vez. No tocar archivos fuera del área propia.
- Si un pedido contradice la spec, avisar antes de hacer nada.
- Usar los términos del glosario, también en los nombres del código.
- Al terminar, listar los archivos tocados y las RN o HU que cubren.

## 5. Agentes

| Agente | Qué hace | Reglas en |
|---|---|---|
| Analista | Mantiene `specs.md`, `decisiones.md` y `glosario.md`. | `.cursor/rules/analista.mdc` |
| Arquitecto | Define la base de datos y crea `plan.md` y `tasks.md`. | `.cursor/rules/arquitecto.mdc` |
| Dev backend | Implementa el backend en `backend/`. | `.cursor/rules/dev-backend.mdc` |
| Dev frontend | Implementa el frontend en `frontend/`. | `.cursor/rules/dev-frontend.mdc` |
| Tester | Escribe y corre pruebas según las RN y HU. | `.cursor/rules/tester.mdc` |
| Revisor | Revisa que los cambios cumplan la spec. | `.cursor/rules/revisor.mdc` |
