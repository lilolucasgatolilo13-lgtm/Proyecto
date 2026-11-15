# Plan técnico: Comiquería

Hecho por el arquitecto a partir de `docs/specs.md` y `docs/glosario.md`. No agrega reglas nuevas: lo que la spec no responde está en la sección 7.

## 1. ¿Cómo se organiza el sistema?

Cada pedido recorre las capas en este orden: **Route → Controller → Service → Repository → base de datos**.

| Capa | Qué hace | Qué NO hace |
|---|---|---|
| Controller | Recibe el pedido HTTP, valida el formato de los datos y responde. | No tiene reglas de negocio. |
| Service | Aplica las reglas de negocio (RN). Es el único lugar donde se decide algo. | No escribe SQL. |
| Repository | Lee y escribe en la base de datos. | No decide nada. |

Carpetas (nombres en español, como el glosario):

```
backend/src/
  routes/  controllers/  services/  repositories/
  middlewares/   (autenticación, roles, registro de actividad)
  jobs/          (vencimiento de reservas, correos, borrado del registro)
  config/        (horario, porcentajes, plazos)
  db/            (conexión y creación de tablas)
frontend/src/
  pages/  components/  api/  context/ (sesión del cliente o empleado)
```

## 2. ¿Qué base de datos usamos, y por qué?

**SQLite** (con la librería `better-sqlite3`).
- Es un solo archivo: no hay que instalar ni configurar un servidor, y sirve para 1 sola sucursal (RN-01).
- Soporta transacciones, que se necesitan para que 2 clientes no reserven la última copia (RN-25).
- Escribe de a una operación por vez, lo que simplifica la concurrencia.

## 3. ¿Qué datos guardamos?

| Tabla | Campos principales | Relaciones |
|---|---|---|
| `usuarios` | id, rol (cliente, empleado, administrador), nombre, apellido, documento (único), correo (único), telefono, contrasena_hash, fecha_nacimiento, baneado | — |
| `sesiones` | token, usuario_id, ultima_actividad | pertenece a un usuario |
| `series` | id, nombre | tiene muchos libros |
| `libros` | id, titulo, serie_id, numero_tomo, autor, editorial, idioma, genero, clasificacion_edad, portada, sinopsis, precio, cantidad_total, oculto, fecha_ingreso | pertenece a una serie |
| `reservas` | id, codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado (activa, retirada, cancelada, vencida), fecha_cancelacion | 1 reserva = 1 libro; pertenece a un cliente |
| `deudas` | id, cliente_id, reserva_id, monto, estado (pendiente, pagada, perdonada), fecha | pertenece a un cliente |
| `descuentos` | id, alcance (libro, serie, editorial, catalogo), referencia_id, tipo (descuento, aumento), porcentaje, fecha_inicio, fecha_fin | — |
| `avisos` | id, titulo, texto, fecha_publicacion, administrador_id | — |
| `cierres_local` | id, fecha, administrador_id | — |
| `historial_cuenta` | id, usuario_id, tipo (baneo, reversion_baneo, perdon_deuda), motivo, fecha, administrador_id | pertenece a un usuario |
| `registro_actividad` | id, usuario_id, accion, detalle, fecha | — |

Notas:
- La **cantidad disponible** no se guarda: se calcula como `cantidad_total` menos los libros con reserva activa (RN-10).
- Las **cancelaciones del mes** se cuentan sobre `reservas.fecha_cancelacion` (RN-42).

## 4. ¿Cómo se comunican front y back?

API REST en `/api`, con datos en JSON. El rol sale de la sesión, no del pedido.

| Endpoint | Quién | HU |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout` | todos | RN-46 |
| `GET /libros` (con filtros), `GET /libros/:id`, `GET /series/:id` | visitante, cliente | HU-01, HU-02 |
| `GET /libros/novedades`, `GET /libros/ofertas` | visitante, cliente | HU-02 |
| `POST /reservas` | cliente | HU-03 |
| `GET /reservas/mias` | cliente | HU-04 |
| `POST /reservas/:id/cancelar` | cliente | HU-05 |
| `GET /deudas/mias` | cliente | HU-06 |
| `POST /usuarios` (crear cuenta) | empleado | HU-08 |
| `POST /usuarios/:id/contrasena` (restablecer) | empleado | HU-07 |
| `GET /reservas/buscar?codigo=&documento=` | empleado | HU-09 |
| `POST /reservas/:id/retiro` (1 libro) | empleado | HU-09, HU-10 |
| `POST /deudas/:id/pago` | empleado | HU-11 |
| `PATCH /libros/:id/cantidad` | empleado | HU-12 |
| `POST /usuarios/:id/informe-documento` | empleado | HU-13 |
| `POST /libros`, `PATCH /libros/:id`, `PATCH /libros/:id/ocultar` | administrador | HU-14 |
| `POST /descuentos` | administrador | HU-15 |
| `POST /deudas/:id/perdon` | administrador | HU-16 |
| `GET /avisos`, `POST /avisos`, `POST /cierres` | todos (GET), administrador | HU-17 |
| `POST /empleados`, `GET /registro-actividad` | administrador | HU-18 |
| `POST /usuarios/:id/baneo`, `DELETE /usuarios/:id/baneo` | administrador | HU-19 |
| `GET /contacto`, `GET /politicas` | todos | HU-20 |

## 5. ¿Dónde vive cada regla?

| RN | Dónde se programa |
|---|---|
| RN-01 | No existe ningún endpoint de pago. El cobro solo se registra en `ReservaService.registrarRetiro`. |
| RN-02 | `config/horario.ts`; se muestra en `GET /contacto`. |
| RN-03 | No existe registro público. Las cuentas salen de `UsuarioService.crearCuenta`, solo para empleado (middleware de roles). |
| RN-04 | `UsuarioService.crearCuenta`: el empleado carga los datos (con fecha de nacimiento) y la contraseña que elige el cliente. |
| RN-05 | Índices únicos de `documento` y `correo` en `usuarios`, más validación en `UsuarioService`. |
| RN-06 | `UsuarioService.crearCuenta` (rechaza menores de 15; de 15 a 17 exige adulto responsable) y `ReservaService.crear` (bloquea libros para mayores a menores de 18). |
| RN-07 | `UsuarioService.restablecerContrasena`, solo empleado. |
| RN-08, RN-09 | `LibroService.buscar` y `LibroRepository` (búsqueda, filtros, series, ofertas); pantalla de catálogo. |
| RN-10 | `LibroRepository.cantidadDisponible` (cálculo, no campo guardado). |
| RN-11 | `LibroService` (marca de agotado) y `ReservaService.crear` (rechaza si no hay). |
| RN-12 | `LibroService.ocultar` y `LibroService.borrar` (rechaza si hay reservas o historial). |
| RN-13 | `LibroService.actualizarCantidad`: no deja bajar la cantidad por debajo de los libros reservados. |
| RN-14, RN-15 | `ReservaService.crear` (1 reserva = 1 libro; tope de 5 activas y 1 copia por libro) y `ReservaRepository.contarActivas`. |
| RN-16 | `ReservaService.crear`: `fecha_vencimiento` = ahora + 24 horas corridas. |
| RN-17, RN-21 | `ReservaService.registrarRetiro`: total = precio + 5% (valor en `config`). |
| RN-18 | `VencimientoJob` y `ReservaService.vencer`: pasa a vencida, libera el libro y crea la deuda. |
| RN-19, RN-42 | `ReservaService.cancelar`: cuenta las cancelaciones del mes calendario y bloquea la sexta. |
| RN-20 | `reservas.precio_fijado` al reservar; en el retiro se cobra el menor entre el fijado y el vigente. |
| RN-22 | `ReservaService.registrarRetiro`: cada reserva (1 libro) se retira y vence por separado. |
| RN-23 | Todo plazo se calcula con la hora del servidor; el front solo muestra el contador. |
| RN-24 | `ReservaService.crear` genera el código; el contador de la pantalla usa `fecha_vencimiento`. |
| RN-25 | Transacción en `ReservaRepository.crearConLock` (ver sección 6). |
| RN-26, RN-27, RN-29, RN-30 | `DeudaService` (cálculo sobre `precio_fijado`, bloqueo de reservas nuevas, consulta del cliente). |
| RN-28 | `DeudaService.registrarPago`, solo empleado. |
| RN-31 | `DeudaService.perdonar`, solo administrador, con motivo en `historial_cuenta`. |
| RN-32, RN-43 | `DescuentoService`: valida de 10% a 50% y las fechas de inicio y fin. |
| RN-33, RN-44 | `AvisoService`; la consulta devuelve solo avisos de los últimos 7 días. |
| RN-34 | `CorreoService` y `VencimientoJob` (3 correos por reserva). |
| RN-35, RN-45 | Middleware `registrarActividad` y `LimpiezaJob` (borra registros de más de 1 mes; `historial_cuenta` no se borra). |
| RN-36 | Contraseñas con `bcrypt` en `UsuarioService`. |
| RN-37 | `GET /contacto` y `GET /politicas`. |
| RN-38 | `CierreService.crear`: suma 24 horas a las reservas activas que vencerían durante el cierre y avisa. |
| RN-39 | `UsuarioService.informarDocumento` (empleado) y `UsuarioService.banear` y `revertirBaneo` (administrador). Al banear se cancelan todas las reservas activas del cliente y el middleware de roles bloquea `POST /reservas` a cuentas baneadas. |
| RN-40 | `UsuarioService.crearEmpleado` y la creación de administradores: cuentan antes de crear (máximo 10 y 4). |
| RN-41 | `LibroRepository.novedades`: libros con `fecha_ingreso` de los últimos 2 días. |
| RN-46 | Middleware `autenticar`: cierra la sesión sin uso (4 días cliente, 7 días empleado). |

## 6. ¿Cómo resolvemos las partes difíciles?

**Concurrencia (RN-25).** Cada reserva se hace dentro de una transacción de SQLite: se cuentan las copias libres y se inserta la reserva en el mismo paso. Como SQLite escribe de a uno, el segundo cliente encuentra la copia ya apartada y recibe "libro ya reservado". La misma regla cubre la venta en caja (RN-13).

**Tiempo (RN-16, RN-18, RN-23, RN-38, RN-42, RN-46).**
- Las fechas se guardan en UTC y el "mes calendario" y el horario se calculan en la zona `America/Argentina/Buenos_Aires`.
- `VencimientoJob` corre cada minuto: marca como vencidas las reservas activas con `fecha_vencimiento` pasada y crea sus deudas. Es seguro repetirlo porque solo toca reservas todavía activas.
- Además, cada consulta y cada retiro verifican el vencimiento con la hora del servidor, por si el job no corrió.
- El contador del cliente se calcula en pantalla desde `fecha_vencimiento`, y solo informa.

**Correos (RN-34).** Un `CorreoService` con `nodemailer` envía 3 correos por reserva: al confirmar (con el código), 6 horas antes y al vencer. El job busca las reservas que cruzan esas marcas y guarda qué correo ya se mandó, para no duplicarlo. El envío no puede frenar una reserva.

## 7. ¿Qué dudas quedan para el analista?

Cerradas con el analista: edad mínima de 15 años con fecha de nacimiento, libros para mayores solo desde los 18, tope de 5 libros, 1 libro = 1 reserva y qué pasa con una cuenta baneada.

1. **Precio más bajo (RN-20):** ¿un descuento de fecha que está vigente al retirar cuenta como "precio nuevo más bajo"?
2. **Cierre del local (RN-34, RN-38):** si una reserva suma 24 horas por un cierre, ¿el correo de 6 horas antes se recalcula con el nuevo vencimiento?
3. **Correo fallido (RN-34):** si el envío falla, ¿se reintenta, se avisa al empleado o se ignora?
