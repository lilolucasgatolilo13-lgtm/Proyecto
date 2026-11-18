# Tareas: Comiquería

Hecho por el arquitecto a partir de `docs/specs.md` y `docs/plan.md`. Cada tarea es un cambio chico, de pocos archivos, que se puede revisar sola. Se ordenan por dependencia, no por número de HU. Estado: `[ ]` pendiente, `[x]` hecha.

## Datos de prueba comunes

Los casos de prueba de todas las tareas usan estos datos (los crea la tarea T-08):

- **Reloj fijo:** martes 2026-12-01 10:00 (hora de Buenos Aires).
- **Usuarios:** administrador Ada (doc 30000001), empleado Emi (doc 30000002), cliente Ana Pérez (doc 40111222, nacida 2000-05-10), cliente Bruno Gómez (doc 41222333, nacido 2010-06-01, 16 años), cliente Carla Díaz (doc 40333444, nacida 2001-03-15).
- **Libros:** Naruto 1 ($10.000, 3 copias), Naruto 2 ($10.000, 1 copia), Naruto 3 ($10.000, 0 copias), Berserk 1 (+18, $12.000, 2 copias), One Piece 1 ($9.000, 5 copias), Sailor Moon 1 ($8.000, 5 copias), Death Note 1 ($9.000, 2 copias), Dragon Ball 1 ($8.500, 4 copias).
- **Cuentas de ejemplo:** el 5% de un libro de $10.000 es $500, y el retiro de ese libro se cobra $10.500.

---

## Etapa 1: Base

### T-01 · Proyecto backend con framework de tests
**Agente:** dev backend · **Depende de:** — · **Cubre:** base (sin RN) · **Estado:** [x]
Crea el proyecto Node + TypeScript con Express y el framework de tests (Vitest) en `backend/`, con las carpetas `routes`, `controllers`, `services`, `repositories`, `middlewares`, `jobs`, `config` y `db`.
**Terminada cuando:**
- `npm test` corre y pasa 1 test de ejemplo.
- `GET /api/salud` responde 200 con `{"ok": true}`.

### T-02 · Base de datos y tablas
**Agente:** dev backend · **Depende de:** T-01 · **Cubre:** RN-05 · **Estado:** [x]
Conecta SQLite y crea las 12 tablas del plan (usuarios, sesiones, series, libros, reservas, deudas, descuentos, avisos, cierres_local, historial_cuenta, registro_actividad, correos).
**Terminada cuando:**
- Con la base vacía, al iniciar existen las 12 tablas.
- Insertar 2 usuarios con documento 40111222 falla por índice único. Lo mismo con el correo repetido.

### T-03 · Reloj
**Agente:** dev backend · **Depende de:** T-01 · **Cubre:** RN-23, RN-42 · **Estado:** [x]
Crea un `Reloj` que da la hora del servidor, con una versión falsa para los tests, y una función que da el mes calendario en la zona America/Argentina/Buenos_Aires.
**Terminada cuando:**
- Con el reloj falso en 2026-12-01 10:00, `ahora()` devuelve esa fecha.
- El mes calendario de 2026-12-31 23:59 es diciembre y el de 2027-01-01 00:00 es enero.

### T-04 · Correo simulado
**Agente:** dev backend · **Depende de:** T-01, T-02, T-03 · **Cubre:** RN-34, RN-35 · **Estado:** [x]
Crea un `CorreoService` simulado: no manda nada real, guarda cada correo en la tabla `correos` y en una lista que los tests pueden leer. Si un envío falla, se reintenta hasta 3 veces en total, con 1 minuto entre intentos.
**Terminada cuando:**
- Enviar un correo a ana@mail.com con asunto "Reserva confirmada" lo deja enviado y en la lista con ese destinatario y asunto.
- Con el simulado forzado a fallar, la función que lo llamó no lanza error y el correo queda pendiente con 1 intento.
- Tras 3 fallos (con el reloj avanzando 1 minuto cada vez), el correo queda fallido, hay 1 registro "correo fallido" en `registro_actividad` y no se intenta una 4.ª vez.

### T-05 · Crear cuentas
**Agente:** dev backend · **Depende de:** T-02, T-03 · **Cubre:** RN-03, RN-04, RN-05, RN-06, RN-36 · **HU:** HU-08 · **Estado:** [x]
El empleado crea la cuenta de un cliente con nombre, apellido, documento, fecha de nacimiento, correo y teléfono, y el cliente elige su contraseña. La contraseña se guarda cifrada.
**Terminada cuando:**
- Con el reloj en 2026-12-01, crear a Ana (doc 40111222, nacida 2000-05-10) funciona y la contraseña no se guarda en texto.
- Crear otra cuenta con el documento 40111222, o con el mismo correo, es rechazado.
- Fecha de nacimiento 2011-12-02 (14 años) es rechazada. Nacido 2010-06-01 (16 años) con adulto responsable se crea, y sin adulto es rechazado.
- No existe registro público: `POST /api/registro` responde 404.

### T-06 · Sesión y roles
**Agente:** dev backend · **Depende de:** T-03, T-05 · **Cubre:** RN-46, RN-36, RN-03 · **Estado:** [x]
Hace el login y el logout, y un middleware que identifica el rol y cierra la sesión por inactividad.
**Terminada cuando:**
- Login de Ana con contraseña correcta devuelve un token. Con contraseña incorrecta responde 401.
- Cliente sin uso 3 días: la sesión sigue válida. Sin uso 4 días y 1 minuto: vencida.
- Empleado sin uso 6 días: válida. Sin uso 7 días y 1 minuto: vencida.
- Un cliente que llama a un endpoint de empleado recibe 403.
- Un empleado que llama a un endpoint de administrador (por ejemplo, `POST /api/descuentos`) recibe 403.

### T-07 · Restablecer contraseña
**Agente:** dev backend · **Depende de:** T-06 · **Cubre:** RN-07 · **HU:** HU-07 · **Estado:** [x]
El empleado restablece la contraseña de un cliente, que elige la nueva en el local. No hay correo ni enlace.
**Terminada cuando:**
- Emi restablece la contraseña de Ana: Ana entra con la nueva y la vieja ya no sirve.
- Ana intenta restablecer su contraseña por su cuenta: 403.

### T-08 · Datos iniciales
**Agente:** dev backend · **Depende de:** T-02, T-05 · **Cubre:** base (sin RN) · **Estado:** [x]
Un script carga los usuarios y los libros de los "Datos de prueba comunes".
**Terminada cuando:**
- Tras el script hay 1 administrador, 1 empleado, 3 clientes y 8 libros con sus precios y copias.
- Correr el script 2 veces no duplica nada.

---

## Etapa 2: Catálogo, precio y horario

### T-09 · Catálogo y cantidad disponible
**Agente:** dev backend · **Depende de:** T-08 · **Cubre:** RN-08, RN-10, RN-11 · **HU:** HU-01 · **Estado:** [x]
`GET /api/libros` y `GET /api/libros/:id` para visitantes, con la ficha completa y la cantidad disponible calculada (copias menos reservas activas).
**Terminada cuando:**
- Sin sesión, `GET /api/libros` devuelve los 8 libros con su ficha.
- Naruto 3 (0 copias) aparece con la marca de agotado.
- Naruto 2 (1 copia) con 1 reserva activa muestra 0 disponibles.

### T-10 · Búsqueda, filtros, series y novedades
**Agente:** dev backend · **Depende de:** T-09 · **Cubre:** RN-09, RN-41 · **HU:** HU-02 · **Estado:** [x]
Agrega búsqueda por título, autor o serie, filtros por género, editorial, idioma, disponibilidad y precio, el agrupado por serie y la sección de novedades.
**Terminada cuando:**
- Buscar "naruto" devuelve los 3 tomos de Naruto y ningún otro libro.
- Abrir la serie Naruto devuelve los tomos 1, 2 y 3 en ese orden, y el 3 como agotado.
- Un libro con fecha de ingreso de hace 1 día está en novedades. Uno de hace 3 días no.

### T-11 · Administrar libros
**Agente:** dev backend · **Depende de:** T-09, T-10 · **Cubre:** RN-08, RN-12, RN-41 · **HU:** HU-14 · **Estado:** [x]
El administrador carga, edita y oculta libros, y no puede borrar uno con reservas o historial. Carga la portada como enlace y crea la serie si es nueva.
**Terminada cuando:**
- Ada oculta Dragon Ball 1: ya no aparece en el catálogo y sigue en la base.
- Ada intenta borrar Naruto 1 con 1 reserva: rechazado, solo puede ocultarlo.
- Emi intenta ocultar un libro: 403.
- Ada carga "Dragon Ball 2" ($8.500, 4 copias, serie Dragon Ball ya existente, portada con un enlace): aparece en el catálogo y en novedades.
- Ada carga un libro con la serie nueva "Bleach": se crea la serie y el libro queda dentro.
- Cargar un libro sin título o sin precio: rechazado.
- Ada cambia el precio de Naruto 1 a $11.000: el catálogo muestra el nuevo.

### T-12 · Actualizar cantidad
**Agente:** dev backend · **Depende de:** T-09, T-06 · **Cubre:** RN-13, RN-41 · **HU:** HU-12 · **Estado:** [x]
El empleado o el administrador actualizan la cantidad de copias al ingresar mercadería o al vender en caja.
**Terminada cuando:**
- Emi sube Naruto 1 de 3 a 10 copias y el catálogo muestra el valor nuevo en el instante.
- Naruto 1 con 2 reservas activas: bajar a 1 copia es rechazado. Bajar a 2 funciona.
- Ada sube Sailor Moon 1 de 5 a 8 copias: el catálogo muestra 8.
- Emi suma 3 copias a Death Note 1 (ya existía): no aparece en novedades.

### T-13 · Horario, contacto y políticas
**Agente:** dev backend · **Depende de:** T-01 · **Cubre:** RN-02, RN-37 · **HU:** HU-20 · **Estado:** [x]
Guarda el horario en `config` y publica `GET /api/contacto` y `GET /api/politicas`.
**Terminada cuando:**
- `GET /api/contacto` devuelve dirección, horario, teléfono y correo.
- `localAbierto`: lunes 10:30 es abierto, lunes 13:30 es cerrado, domingo 12:00 es abierto, domingo 18:30 es cerrado.
- `GET /api/politicas` incluye el plazo de 24 horas, el 5% extra y las deudas.

### T-14 · Descuentos y aumentos
**Agente:** dev backend · **Depende de:** T-09, T-03 · **Cubre:** RN-32, RN-43, RN-09 · **HU:** HU-15 · **Estado:** [x]
El administrador crea descuentos y aumentos de 10% a 50%, con fechas de inicio y fin, sobre un libro, una serie, una editorial o todo el catálogo. Calcula el precio vigente y alimenta la sección de ofertas.
**Terminada cuando:**
- Descuento del 20% vigente sobre Naruto 1 ($10.000): precio vigente $8.000, y aparece en ofertas.
- Aumento del 10% sobre Naruto 1: precio vigente $11.000.
- Descuento del 5% o del 60%: rechazado. Fuera de sus fechas: no tiene efecto.
- Emi intenta crear un descuento: 403.

---

## Etapa 3: Reservar

### T-15 · Crear reserva
**Agente:** dev backend · **Depende de:** T-09, T-14, T-06, T-04 · **Cubre:** RN-10, RN-11, RN-15, RN-16, RN-20, RN-24, RN-34 · **HU:** HU-03 · **Estado:** [x]
`POST /api/reservas`: el cliente reserva 1 libro. La reserva vence en 24 horas, guarda el precio fijado, genera el código y manda el correo de confirmación.
**Terminada cuando:**
- Con el reloj en 2026-12-01 10:00, Ana reserva Naruto 1: reserva activa, vence 2026-12-02 10:00, precio fijado $10.000, código generado, disponibles de 3 a 2, y el correo simulado recibe 1 correo con el código.
- Reservar Naruto 3 (0 copias): rechazado por libro agotado.
- Reservar sin sesión: 401.

### T-16 · Límites de reserva y plazo
**Agente:** dev backend · **Depende de:** T-15 · **Cubre:** RN-14, RN-16 · **HU:** HU-03 · **Estado:** [x]
Agrega el tope de 5 reservas activas y 1 copia por libro, y confirma que el plazo corre 24 horas seguidas.
**Terminada cuando:**
- Ana con 4 reservas activas reserva la 5.ª, y con 5 la 6.ª es rechazada.
- Ana con Naruto 1 activa intenta reservar otra copia de Naruto 1: rechazado.
- Reserva el domingo 2026-12-06 17:50 (el local cierra 18:00): vence el lunes 2026-12-07 17:50.

### T-17 · Libros para mayores
**Agente:** dev backend · **Depende de:** T-15, T-05 · **Cubre:** RN-06 · **HU:** HU-03 · **Estado:** [x]
Bloquea la reserva de libros +18 a menores de 18 años.
**Terminada cuando:**
- Bruno (16 años) reserva Berserk 1 (+18): rechazado.
- Ana (26 años) lo reserva sin problema.
- Un cliente nacido el 2008-12-01, con el reloj en 2026-12-01 (cumple 18 ese día), reserva Berserk 1 sin problema.

### T-18 · Concurrencia
**Agente:** dev backend · **Depende de:** T-15 · **Cubre:** RN-25 · **HU:** HU-03 · **Estado:** [x]
La reserva se hace en una transacción que cuenta las copias libres y crea la reserva en el mismo paso.
**Terminada cuando:**
- Naruto 2 (1 copia): Ana y Carla lo reservan a la vez. Queda 1 reserva activa y el otro recibe "libro ya reservado". Disponibles: 0.
- Con 2 copias y los mismos 2 pedidos a la vez, ambos funcionan.

### T-19 · Mis reservas y contador
**Agente:** dev backend · **Depende de:** T-15, T-03 · **Cubre:** RN-23, RN-24 · **HU:** HU-04 · **Estado:** [x]
`GET /api/reservas/mias` devuelve las reservas activas con el tiempo restante calculado con el reloj del servidor.
**Terminada cuando:**
- Reserva hecha 2026-12-01 10:00 y reloj en 14:00: quedan 20 horas (72.000 segundos).
- Con el reloj en 2026-12-02 10:00:01 la reserva ya no figura como activa.
- Si el cliente manda una hora propia en el pedido, el servidor la ignora.

---

## Etapa 4: Retiro y cancelar

### T-20 · Buscar y retirar una reserva
**Agente:** dev backend · **Depende de:** T-15 · **Cubre:** RN-01, RN-17, RN-23 · **HU:** HU-09 · **Estado:** [x]
El empleado busca una reserva por código o documento, cobra en efectivo (precio más 5%) y la marca como retirada.
**Terminada cuando:**
- Buscar por el código de la reserva de Ana devuelve a Ana, el libro y el estado actual. Buscar por documento 40111222 devuelve sus reservas activas.
- Retirar una reserva activa de $10.000: estado retirada y total $10.500.
- Retirar una reserva que venció 1 segundo antes: rechazado.
- `POST /api/pagos` (pago online) responde 404, y un cliente que intenta marcar un retiro recibe 403.

### T-21 · Precio al retirar y retiro por libro
**Agente:** dev backend · **Depende de:** T-20, T-14 · **Cubre:** RN-20, RN-21, RN-22 · **HU:** HU-09, HU-10 · **Estado:** [x]
Cobra el precio fijado al reservar (o el más bajo si bajó) más el 5%, y permite retirar cada libro por separado.
**Terminada cuando:**
- Precio fijado $10.000 y precio actual $8.000: cobra $8.400.
- Precio actual $12.000: cobra $10.500.
- Descuento del 20% vigente al retirar (precio vigente $8.000): cobra $8.400. Con un aumento del 10% (vigente $11.000): cobra $10.500.
- Ana con 3 reservas activas retira 1: paga el 5% solo de ese libro y las otras 2 siguen activas con su propio vencimiento.

### T-22 · Cancelar una reserva
**Agente:** dev backend · **Depende de:** T-15 · **Cubre:** RN-19 · **HU:** HU-05 · **Estado:** [x]
El cliente cancela 1 reserva (1 libro) por vez, sin costo ni deuda, y el libro se libera de inmediato.
**Terminada cuando:**
- Ana cancela una reserva activa de Naruto 1: estado cancelada, sin deuda, y disponibles +1 en el instante.
- Cancelar una reserva ya vencida: rechazado.
- Ana con 3 reservas cancela 1: las otras 2 siguen activas.

### T-23 · Límite de 5 cancelaciones por mes
**Agente:** dev backend · **Depende de:** T-22, T-03 · **Cubre:** RN-42 · **HU:** HU-05 · **Estado:** [x]
Cuenta las cancelaciones del mes calendario y bloquea la sexta.
**Terminada cuando:**
- Con 5 canceladas en diciembre (reloj 2026-12-20), la 6.ª es rechazada y la reserva sigue activa. Si esa reserva vence, genera deuda del 5%.
- Con 4 canceladas, la 5.ª funciona.
- Con el reloj en 2027-01-01 00:00 el contador vuelve a 0 y cancelar funciona.

---

## Etapa 5: Ausencias y bloqueos

### T-24 · Vencimiento automático y deuda
**Agente:** dev backend · **Depende de:** T-15, T-03 · **Cubre:** RN-18, RN-23, RN-26 · **HU:** HU-06 · **Estado:** [x]
Un job que corre cada minuto marca como vencidas las reservas activas pasadas de hora, libera el libro y crea la deuda del 5%.
**Terminada cuando:**
- Reserva de Naruto 1 ($10.000) que vence 2026-12-02 10:00, con el reloj en 10:01: estado vencida, disponibles +1 y deuda de $500 pendiente.
- Una reserva que vence a las 12:00 no cambia a las 10:01.
- Correr el job 2 veces deja 1 sola deuda.
- Con el reloj en 10:00:01, retirar esa reserva es rechazado.

### T-25 · Ver mi deuda
**Agente:** dev backend · **Depende de:** T-24 · **Cubre:** RN-26, RN-30 · **HU:** HU-06 · **Estado:** [x]
`GET /api/deudas/mias` devuelve el monto y de qué reservas viene, calculado sobre el precio fijado al reservar.
**Terminada cuando:**
- Reserva vencida con precio fijado $10.000 y precio actual $12.000: la deuda es $500, no $600.
- Ana sin deudas recibe una lista vacía.

### T-26 · Bloqueo por deuda
**Agente:** dev backend · **Depende de:** T-24 · **Cubre:** RN-27, RN-29 · **HU:** HU-06 · **Estado:** [x]
Un cliente con deuda pendiente no puede hacer reservas nuevas, pero conserva las que ya tenía.
**Terminada cuando:**
- Ana con deuda de $500: `POST /api/reservas` es rechazado, pero puede ver el catálogo.
- Sus 2 reservas activas anteriores siguen vigentes. Si una vence, la deuda total pasa a $1.000.

### T-27 · Pagar y perdonar una deuda
**Agente:** dev backend · **Depende de:** T-24 · **Cubre:** RN-28, RN-31, RN-45 · **HU:** HU-11, HU-16 · **Estado:** [x]
El empleado marca la deuda como pagada en persona, y el administrador puede perdonarla con un motivo.
**Terminada cuando:**
- Emi marca pagada la deuda de $500: Ana puede reservar de nuevo.
- Ana intenta marcar pagada su propia deuda: 403.
- Ada perdona la deuda con el motivo "error del sistema": queda perdonada y se guarda en `historial_cuenta` con fecha y motivo. Sin motivo: rechazado. Emi intenta perdonar: 403.

### T-28 · Baneo
**Agente:** dev backend · **Depende de:** T-15, T-06 · **Cubre:** RN-39 · **HU:** HU-13, HU-19 · **Estado:** [x]
El empleado informa un documento ajeno y el administrador banea la cuenta, cancela sus reservas activas y puede revertir el baneo.
**Terminada cuando:**
- Emi informa un documento ajeno de Carla. Ada banea a Carla con el motivo "documento prestado".
- Carla tenía 3 reservas activas: se cancelan las 3, disponibles +3 y no se crea ninguna deuda.
- Carla ve el catálogo, pero `POST /api/reservas` es rechazado.
- Ada revierte el baneo: Carla vuelve a reservar. Emi intenta banear: 403.

---

## Etapa 6: Avisos, cierre y administración

### T-29 · Avisos
**Agente:** dev backend · **Depende de:** T-06, T-03 · **Cubre:** RN-33, RN-44 · **HU:** HU-17 · **Estado:** [x]
El administrador publica avisos que quedan visibles 7 días.
**Terminada cuando:**
- Aviso publicado 2026-12-01 10:00: visible el 2026-12-08 09:59 y no visible el 2026-12-08 10:01.
- Emi intenta publicar un aviso: 403.

### T-30 · Cierre del local
**Agente:** dev backend · **Depende de:** T-15, T-29, T-04 · **Cubre:** RN-38 · **HU:** HU-17 · **Estado:** [x]
El administrador cierra el local un día: a las reservas activas que vencerían ese día se les suman 24 horas, y se avisa por correo y en avisos.
**Terminada cuando:**
- Reserva que vence 2026-12-08 11:00 y cierre el 2026-12-08: pasa a vencer 2026-12-09 11:00.
- Reserva que vence 2026-12-10: sin cambios.
- El correo simulado recibe un correo de los clientes afectados y aparece un aviso nuevo.

### T-31 · Correos de reserva
**Agente:** dev backend · **Depende de:** T-15, T-24, T-04, T-30 · **Cubre:** RN-34, RN-38 · **HU:** HU-04 · **Estado:** [x]
El job manda 3 correos por reserva: al confirmar, 6 horas antes de que venza y cuando vence, sin duplicarlos. El aviso de 6 horas se calcula sobre el vencimiento vigente y se repite si un cierre lo cambia.
**Terminada cuando:**
- Reserva 2026-12-01 10:00: con el reloj en 2026-12-02 04:00 sale 1 correo de "faltan 6 horas". Correr el job de nuevo a las 04:05 no lo repite.
- Con el reloj en 10:01 sale el correo de "venció". En total son 3 correos con el de confirmación.
- Si el correo simulado falla, la reserva se crea igual y el correo se reintenta (ver T-04).
- Reserva que vence 2026-12-08 11:00: recibe el aviso de 6 horas el 2026-12-08 05:00. Si ese día se cierra el local y pasa a vencer 2026-12-09 11:00, recibe otro aviso el 2026-12-09 05:00 (2 avisos de 6 horas en total).

### T-32 · Empleados y límites de usuarios
**Agente:** dev backend · **Depende de:** T-06 · **Cubre:** RN-40 · **HU:** HU-08, HU-18 · **Estado:** [x]
El administrador crea empleados y administradores, con un máximo de 10 empleados y 4 administradores.
**Terminada cuando:**
- Con 10 empleados, crear el 11.º es rechazado. Con 4 administradores, crear el 5.º es rechazado.
- Emi intenta crear un empleado: 403.

### T-33 · Registro de actividad
**Agente:** dev backend · **Depende de:** T-14, T-27 · **Cubre:** RN-35, RN-45 · **HU:** HU-18 · **Estado:** [x]
Guarda quién hizo cada cambio (precio, cantidad, retiro, deuda, perdón), nadie lo borra a mano y un job borra lo de más de 1 mes.
**Terminada cuando:**
- Ada cambia un precio: hay 1 registro con su usuario y la fecha.
- Un registro de hace 31 días se borra con el job. Uno de hace 29 días queda.
- Un baneo o un perdón de hace 40 días sigue en `historial_cuenta`.

---

## Etapa 7: Frontend

### T-34 · Proyecto frontend y sesión
**Agente:** dev frontend · **Depende de:** T-06 · **Cubre:** RN-46 · **Estado:** [x]
Crea el proyecto SPA ligera en `frontend/` (HTML5 + Vanilla JS servido directamente por Express) con rutas, la pantalla de login y el contexto de sesión.
**Terminada cuando:**
- Abrir `/` muestra el catálogo sin login.
- Login de Ana: aparece "Mis reservas". Con contraseña incorrecta se ve un mensaje de error.
- Con la sesión vencida, la persona vuelve al login.

### T-35 · Catálogo y búsqueda
**Agente:** dev frontend · **Depende de:** T-34, T-10 · **Cubre:** RN-08, RN-09, RN-10, RN-11, RN-41 · **HU:** HU-01, HU-02 · **Estado:** [x]
Pantallas de catálogo, búsqueda, filtros, series, novedades y ofertas.
**Terminada cuando:**
- Buscar "naruto" muestra 3 tomos en orden.
- Naruto 3 muestra la marca de agotado y el botón de reservar deshabilitado.
- Un visitante que toca "Reservar" ve que necesita una cuenta.

### T-36 · Reservar y mis reservas
**Agente:** dev frontend · **Depende de:** T-35, T-19, T-22, T-25 · **Cubre:** RN-14, RN-19, RN-24, RN-27, RN-30, RN-39 · **HU:** HU-03, HU-04, HU-05, HU-06 · **Estado:** [x]
Botón de reservar, lista de reservas con contador, cancelar y vista de la deuda.
**Terminada cuando:**
- Ana reserva Naruto 1: ve su reserva con el contador en 24 h y el código.
- Ana cancela la reserva: sale de las activas.
- Ana con deuda de $500: el botón de reservar está bloqueado y se ve el monto. Con la cuenta baneada se ve un aviso y no puede reservar.

### T-37 · Panel del empleado
**Agente:** dev frontend · **Depende de:** T-34, T-20, T-21, T-27, T-12, T-07, T-05 · **Cubre:** RN-04, RN-07, RN-13, RN-17, RN-28, RN-39 · **HU:** HU-07, HU-08, HU-09, HU-10, HU-11, HU-12, HU-13 · **Estado:** [x]
Una sección con menú lateral de 5 submódulos: Cuentas, Retiros, Deudas, Cantidad y Documentos. Incluye formularios para crear cuenta (con fecha de nacimiento), restablecer contraseña, buscar y retirar reservas, cobrar deudas, actualizar cantidad e informar un documento ajeno.
**Terminada cuando:**
- Emi busca la reserva de Ana por código y retira: se ve el total $10.500 y la reserva queda retirada.
- Emi crea una cuenta con una fecha de nacimiento de 14 años: se muestra el error.
- Emi marca pagada una deuda: Ana vuelve a poder reservar.
- Emi entra a `/empleado` y ve las 5 secciones.
- Un cliente que entra a `/empleado` es redirigido, y la API le responde 403.

### T-38 · Panel del administrador
**Agente:** dev frontend · **Depende de:** T-34, T-11, T-12, T-14, T-27, T-28, T-29, T-30, T-32, T-33 · **Cubre:** RN-12, RN-31, RN-32, RN-33, RN-38, RN-39, RN-40, RN-43 · **HU:** HU-14 a HU-19 · **Estado:** [x]
Una sección con menú lateral y 6 submódulos: Libros (cargar, editar, ocultar y cantidad), Precios, Avisos y cierre, Deudas, Cuentas (baneos y empleados) y Registro de actividad.
**Terminada cuando:**
- Ada pone un descuento del 5%: se muestra el error de rango. Con 20% funciona.
- Ada banea a Carla con motivo y ve la lista de baneados. Sin motivo no deja guardar.
- Ada cierra el local un día y se ve el aviso publicado.
- Ada entra a `/admin` y ve las 6 secciones.
- Emi o Ana entran a `/admin`: son redirigidas y la API responde 403.
- Ada carga un libro con serie nueva desde la sección Libros y aparece en el catálogo.

### T-39 · Contacto, políticas y avisos
**Agente:** dev frontend · **Depende de:** T-34, T-13, T-29 · **Cubre:** RN-02, RN-33, RN-37, RN-44 · **HU:** HU-17, HU-20 · **Estado:** [x]
Secciones de contacto, políticas y avisos.
**Terminada cuando:**
- Contacto muestra dirección, horario, teléfono y correo.
- Políticas muestra el plazo de 24 horas, el 5% extra y las deudas.
- Un aviso de más de 7 días no aparece.

---

## Etapa 8: Cierre

### T-40 · Prueba de casos borde
**Agente:** tester · **Depende de:** T-01 a T-39 · **Cubre:** CB-01 a CB-24 · **Estado:** [x]
Revisa que cada caso borde de la spec tenga un test que pase.
**Terminada cuando:**
- Hay 1 test que pasa por cada CB-01 a CB-24, y la lista de los que no tienen test está vacía.
- Las 3 pruebas más delicadas pasan: concurrencia (T-18), vencimiento (T-24) y límite de cancelaciones (T-23).

### T-41 · Revisión final
**Agente:** revisor · **Depende de:** T-40 · **Cubre:** RN-01 a RN-46, HU-01 a HU-20 · **Estado:** [x]
Comprueba que cada RN y cada HU tenga una tarea hecha y que el código use los términos del glosario.
**Terminada cuando:**
- Una tabla de RN y HU contra tareas no deja ninguna sin cubrir.
- El código no usa nombres fuera del glosario (por ejemplo, `booking` en lugar de `reserva`).
- No quedan dudas abiertas en la sección 7 del plan.
