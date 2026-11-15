# Specs: sistema de reservas de la comiquería

Basado únicamente en `idea_comiqueria.md` y `glosario.md`. Todas las decisiones del cliente ya están incorporadas y no queda ningún punto [PENDIENTE].

## 1. Objetivo
La comiquería vende manga y libros de anime solo en el local y solo en efectivo. El sistema resuelve cómo ver el catálogo y reservar libros online para que la comiquería los guarde 24 horas, sin cobrar nada online. El pago y el retiro se hacen siempre en el local.

## 2. Usuarios y roles

| Rol | Qué puede hacer |
|---|---|
| **Visitante** (sin cuenta) | Ver el catálogo. Para reservar necesita una cuenta. |
| **Cliente** (con cuenta) | Ver el catálogo, reservar libros (hasta 5 reservas activas), cancelar sus reservas (hasta 5 por mes), ver su historial, su contador y su deuda. |
| **Empleado** (hasta 10) | Atender en el local, crear cuentas, restablecer contraseñas, buscar reservas, cobrar y marcarlas como retiradas, cobrar y marcar deudas como pagadas, actualizar la cantidad de libros, informar documentos ajenos. |
| **Administrador** (hasta 4) | Acceso total: administrar catálogo y stock, crear y editar empleados, descuentos y aumentos, perdonar deudas, banear, publicar avisos, cerrar el local y ver el registro de actividad. |

## 3. Alcance

**Entra:**
- Catálogo público con búsqueda y filtros.
- Cuentas de clientes creadas en persona.
- Reservas de 1 libro con plazo de 24 horas, cancelación (hasta 5 por mes) y retiro.
- Recargo del 5% al retirar y deuda por reservas vencidas.
- Baneo permanente por documento ajeno.
- Descuentos y aumentos de 10% a 50%.
- Avisos, cierre del local y correos de reserva.
- Registro de actividad.
- Secciones de contacto y políticas.

**Queda afuera:**
- Pagos online, tarjetas y transferencias.
- Registro online de cuentas y recuperación de contraseña por correo.
- Registro de ventas en caja (solo se actualiza la cantidad a mano).
- Préstamos, sala de lectura, lista de espera, reportes, caja, reseñas y eventos (se eliminaron por decisión del cliente).
- Más de 1 sucursal.

## 4. Reglas de negocio

**Local y pagos**
- **RN-01:** El local es 1 sola sucursal y todo pago se hace en efectivo en el local. El sistema online no cobra nada.
- **RN-02:** El local abre de lunes a sábado de 10:00 a 13:00 y de 15:00 a 20:00, y los domingos de 11:00 a 18:00 sin cierre al mediodía.
- **RN-38:** Si el administrador cierra el local un día, a las reservas activas que vencerían durante el cierre se les suman 24 horas a su vencimiento original. Se avisa por correo y en la sección de avisos.

**Cuentas**
- **RN-03:** Las cuentas solo se crean en persona en la comiquería. No existe registro online.
- **RN-04:** El empleado pide el documento y crea la cuenta en el local con nombre, apellido, documento, fecha de nacimiento, correo y teléfono. El cliente elige su contraseña ahí mismo. No se envía correo ni enlace.
- **RN-05:** El documento y el correo son únicos. Hay 1 sola cuenta por documento, y el documento se verifica al crearla.
- **RN-06:** La edad mínima para tener cuenta es 15 años. Los de 15 a 17 años necesitan ir con un adulto responsable al crear la cuenta y no pueden reservar libros para mayores (+18). Los menores de 15 no pueden tener cuenta. Solo los de 18 años o más reservan libros para mayores.
- **RN-07:** No hay recuperación de contraseña por correo. Si el cliente la olvida, va al local y el empleado la restablece verificando su documento.
- **RN-39:** Si el empleado ve que el documento no es de la persona que se presenta, lo informa al administrador. El administrador banea de forma permanente a quien prestó su documento, deja el motivo escrito y puede revertir el baneo. Una cuenta baneada solo puede ver el catálogo: no puede reservar nada ni tener nada a su nombre hasta que el administrador la desbanee. Al banear, se cancelan todas sus reservas activas y los libros se liberan.
- **RN-40:** El sistema permite como máximo 4 administradores y 10 empleados a la vez.

**Catálogo y cantidad**
- **RN-08:** El catálogo es público. Cada libro tiene título, serie, número de tomo, autor, editorial, idioma, género, clasificación por edad, imagen de portada, sinopsis, precio y cantidad disponible.
- **RN-09:** Las series se agrupan y se ven todos sus tomos en orden. Se busca por título, autor o serie y se filtra por género, editorial, idioma, disponibilidad y precio. Hay secciones de novedades y ofertas.
- **RN-41:** Un libro recién ingresado aparece en novedades 2 días.
- **RN-10:** La cantidad que se muestra es la que no está reservada. Baja de inmediato cuando alguien reserva.
- **RN-11:** Un libro agotado sigue visible con la marca de agotado y no se puede reservar.
- **RN-12:** El administrador puede ocultar un libro sin borrarlo. No se puede borrar un libro con reservas o historial, solo ocultarlo.
- **RN-13:** El empleado actualiza la cantidad en el instante en que ingresa mercadería o se vende un libro directo en caja, y no puede vender un libro reservado por otra persona.

**Reservas**
- **RN-14:** Cada reserva es de 1 libro. El cliente puede tener como máximo 5 reservas activas a la vez (5 libros) y solo 1 copia de cada libro.
- **RN-15:** Una reserva activa es la que todavía no se retiró, no se canceló y no venció.
- **RN-16:** El cliente tiene 24 horas corridas desde que reservó para ir al local, aunque el local esté cerrado.
- **RN-17:** Al retirar paga el precio del libro más un 5% extra por haber reservado, todo en efectivo. El empleado busca la reserva por código o documento y la marca como retirada.
- **RN-18:** Si no va dentro de las 24 horas, la reserva vence sola, el libro vuelve a estar disponible y el cliente queda con una deuda.
- **RN-19:** El cliente puede cancelar su reserva en cualquier momento antes de que venza, sin costo y sin deuda, de a 1 reserva (1 libro) por vez. El libro se libera de inmediato.
- **RN-42:** El cliente puede cancelar como máximo 5 reservas por mes calendario. El contador se reinicia el día 1 de cada mes. En la sexta cancelación el sistema no deja cancelar: la reserva sigue activa y, si vence, genera deuda del 5% como cualquier otra.
- **RN-20:** El precio queda fijo al reservar. Si el administrador lo sube o lo baja después, la reserva mantiene el precio original, y si el nuevo es más bajo se cobra el más bajo.
- **RN-21:** El 5% se calcula sobre el precio que el cliente paga al retirar.
- **RN-22:** Como cada reserva es de 1 libro, cada libro se retira por separado y paga su propio 5%. Lo que no se retira vence a las 24 horas de su propia reserva y genera deuda del 5%.
- **RN-23:** Manda el reloj del servidor. El contador del cliente es solo una referencia. Si el plazo vence 1 segundo antes de que el empleado confirme el retiro, la reserva ya venció.
- **RN-24:** El cliente ve sus reservas con un contador del tiempo restante y recibe un correo con un código de reserva al reservar.
- **RN-25:** El sistema aparta el libro en el momento de confirmar la reserva. Si 2 clientes reservan la última copia, gana el que confirma primero y al otro le sale el letrero de libro ya reservado.

**Deudas**
- **RN-26:** La deuda es el 5% del precio de cada libro cuya reserva venció sin retirarse, calculado sobre el precio fijado al reservar.
- **RN-27:** Mientras tenga una deuda el cliente no puede hacer nuevas reservas, solo ver el catálogo.
- **RN-28:** La deuda solo se paga en persona y en efectivo. El empleado la marca como pagada y la cuenta queda libre para reservar.
- **RN-29:** Las reservas activas al generarse una deuda siguen vigentes hasta su plazo. Si también vencen, la deuda crece en el 5% de cada libro.
- **RN-30:** El cliente ve en su cuenta el monto de su deuda y de qué reservas viene.
- **RN-31:** El administrador puede perdonar una deuda dejando el motivo escrito.

**Precios, avisos y seguridad**
- **RN-32:** El administrador puede poner descuentos a un libro, una serie, una editorial o todo el catálogo, con fecha de inicio y fin, y modificarlos. También puede aumentar el precio en un porcentaje que elija.
- **RN-43:** Los descuentos y los aumentos van de un mínimo de 10% a un máximo de 50%. No se puede poner un descuento ni un aumento de 5%.
- **RN-33:** El administrador publica avisos y anuncios (novedades, firmas, cierres) en la sección de avisos.
- **RN-44:** Cada aviso queda visible 7 días.
- **RN-34:** El sistema envía 3 correos por cada reserva: al confirmarla (con el código), 6 horas antes de que venza y cuando vence.
- **RN-35:** El registro de actividad guarda quién hizo cada cambio (precio, cantidad, retiro, deuda, perdón de deuda) y nadie puede borrarlo a mano.
- **RN-45:** El registro de actividad se borra solo al pasar 1 mes. Los baneos y los perdones de deuda quedan guardados en la propia cuenta con fecha y motivo.
- **RN-36:** Las contraseñas se guardan cifradas.
- **RN-46:** Las sesiones se cierran solas tras 4 días sin uso para el cliente y 7 días sin uso para el empleado.
- **RN-37:** Hay una sección de contacto (dirección, horario, teléfono y correo) y una de políticas (plazo de reserva, 5% extra y deudas).

## 5. Historias de usuario

**HU-01 (visitante):** Quiero ver el catálogo sin cuenta, para saber qué libros hay antes de ir al local.
- Dado que soy visitante, cuando entro al catálogo, entonces veo los libros con su ficha y su cantidad disponible. (RN-08, RN-10)
- Dado que quiero reservar sin cuenta, cuando intento reservar, entonces el sistema me indica que necesito una cuenta. (RN-03)

**HU-02 (visitante o cliente):** Quiero buscar y filtrar libros, para encontrar rápido el tomo que busco.
- Dado que estoy en el catálogo, cuando busco por título, autor o serie, entonces veo los libros que coinciden. (RN-09)
- Dado que filtro por género, editorial, idioma, disponibilidad o precio, cuando aplico el filtro, entonces solo veo los libros que cumplen. (RN-09)
- Dado que busco una serie, cuando la abro, entonces veo todos sus tomos en orden, disponibles o agotados. (RN-09, RN-11)
- Dado que ingresó un libro hace menos de 2 días, cuando miro novedades, entonces aparece ahí. (RN-41)

**HU-03 (cliente):** Quiero reservar un libro, para que me lo guarden hasta ir al local.
- Dado que tengo cuenta, sin deuda y menos de 5 reservas activas, cuando reservo un libro con cantidad disponible, entonces la reserva queda activa por 24 horas y la cantidad baja de inmediato. (RN-14, RN-16, RN-10, RN-27)
- Dado que ya tengo 5 reservas activas o ya reservé 1 copia de ese libro, cuando intento reservar, entonces el sistema no me deja. (RN-14)
- Dado que tengo menos de 18 años, cuando intento reservar un libro para mayores, entonces no puedo. (RN-06)
- Dado que mi cuenta está baneada, cuando intento reservar, entonces no puedo. (RN-39)
- Dado que otro cliente confirmó antes la última copia, cuando confirmo, entonces veo el letrero de libro ya reservado. (RN-25)
- Dado que reservé, cuando se confirma, entonces recibo un correo con el código de reserva. (RN-24, RN-34)

**HU-04 (cliente):** Quiero ver mis reservas y el tiempo que me queda, para llegar al local a tiempo.
- Dado que tengo reservas activas, cuando entro a mi cuenta, entonces veo un contador por reserva. (RN-24)
- Dado que el contador de mi pantalla marca tiempo, cuando el servidor ya venció la reserva, entonces vale la hora del servidor. (RN-23)
- Dado que faltan 6 horas para que venza, cuando llega ese momento, entonces recibo un correo de aviso. (RN-34)
- Dado que reservo y el plazo cae con el local cerrado, cuando pasan las 24 horas, entonces vence igual. (RN-16)

**HU-05 (cliente):** Quiero cancelar una reserva, para liberar el libro si no voy a ir.
- Dado que mi reserva sigue activa y llevo menos de 5 cancelaciones en el mes, cuando la cancelo, entonces no pago nada, no genero deuda y el libro se libera de inmediato. (RN-19, RN-42)
- Dado que ya hice 5 cancelaciones en el mes calendario, cuando intento la sexta, entonces el sistema no me deja y la reserva sigue activa. (RN-42)
- Dado que no cancelo y la reserva vence, cuando pasa el plazo, entonces genero deuda del 5%. (RN-18, RN-42)
- Dado que empieza un mes nuevo, cuando llega el día 1, entonces mi contador de cancelaciones vuelve a 0. (RN-42)
- Dado que mi reserva ya venció, cuando intento cancelarla, entonces ya no es una reserva activa. (RN-15, RN-18)

**HU-06 (cliente):** Quiero ver mi deuda y de qué reservas viene, para saber cuánto debo pagar en el local.
- Dado que tengo reservas vencidas, cuando entro a mi cuenta, entonces veo el monto y las reservas que lo generaron. (RN-26, RN-30)
- Dado que tengo deuda, cuando intento reservar, entonces solo puedo ver el catálogo. (RN-27)
- Dado que tengo reservas activas cuando se genera la deuda, cuando las retiro a tiempo, entonces siguen vigentes. (RN-29)

**HU-07 (cliente):** Quiero recuperar mi contraseña, para volver a entrar a mi cuenta.
- Dado que olvidé mi contraseña, cuando voy al local con mi documento, entonces el empleado la restablece. (RN-07)
- Dado que no hay correo ni enlace de recuperación, cuando intento recuperarla desde el sistema, entonces no existe esa opción. (RN-07)

**HU-08 (empleado):** Quiero crear la cuenta de un cliente, para que pueda reservar.
- Dado que el cliente está en el local con su documento, cuando cargo nombre, apellido, documento, correo y teléfono, entonces la cuenta se crea y el cliente elige su contraseña ahí mismo. (RN-03, RN-04)
- Dado que el documento o el correo ya existen, cuando intento crear la cuenta, entonces el sistema no la crea. (RN-05)
- Dado que el cliente tiene de 15 a 17 años, cuando crea la cuenta, entonces debe estar con un adulto responsable. (RN-06)
- Dado que el cliente tiene menos de 15 años, cuando intento crear la cuenta, entonces no se crea. (RN-06)
- Dado que cargo la cuenta, cuando completo los datos, entonces pido la fecha de nacimiento. (RN-04)
- Dado que ya hay 10 empleados, cuando el administrador intenta crear otro, entonces no puede. (RN-40)

**HU-09 (empleado):** Quiero registrar el retiro y el cobro de una reserva, para entregar los libros y marcar la reserva como retirada.
- Dado que el cliente presenta su código o documento, cuando busco la reserva, entonces el sistema me muestra su estado actual. (RN-17, RN-24)
- Dado que la reserva está activa, cuando cobro el precio más el 5% en efectivo, entonces la marco como retirada. (RN-17, RN-21)
- Dado que el precio cambió después de reservar, cuando cobro, entonces cobro el precio fijado al reservar, o el más bajo si bajó. (RN-20)
- Dado que la reserva venció antes de mi confirmación, cuando intento marcarla, entonces no puedo. (RN-23)

**HU-10 (empleado):** Quiero registrar el retiro de cada libro por separado, para entregar solo los libros que el cliente se lleva ahora.
- Dado que el cliente tiene varias reservas activas, cuando retira 1 libro, entonces paga el precio de ese libro más el 5% y las otras reservas siguen activas. (RN-14, RN-22)
- Dado que una de las otras reservas no se retira, cuando se cumplen sus 24 horas, entonces vence y genera deuda del 5%. (RN-22, RN-26)

**HU-11 (empleado):** Quiero cobrar una deuda, para que el cliente pueda volver a reservar.
- Dado que el cliente tiene deuda y paga en efectivo en el local, cuando la marco como pagada, entonces su cuenta queda libre para reservar. (RN-28)

**HU-12 (empleado):** Quiero actualizar la cantidad de libros en el instante, para que el catálogo muestre lo que realmente hay.
- Dado que ingresó mercadería o vendí un libro en caja, cuando actualizo la cantidad en ese momento, entonces el catálogo muestra el valor nuevo. (RN-13)
- Dado que un libro está reservado por otro cliente, cuando quiero venderlo en caja, entonces no puedo. (RN-13)

**HU-13 (empleado):** Quiero informar un documento ajeno, para que no se use una cuenta falsa.
- Dado que el documento no es de la persona que se presenta, cuando lo informo al administrador, entonces queda para su revisión. (RN-39)

**HU-14 (administrador):** Quiero administrar el catálogo, para mantenerlo actualizado.
- Dado que quiero sacar un libro, cuando lo oculto, entonces desaparece del catálogo sin borrarse. (RN-12)
- Dado que un libro tiene reservas o historial, cuando intento borrarlo, entonces el sistema no me deja, solo puedo ocultarlo. (RN-12)

**HU-15 (administrador):** Quiero poner descuentos y aumentos, para ajustar los precios.
- Dado que defino un descuento con fecha de inicio y fin, cuando lo aplico a un libro, serie, editorial o a todo el catálogo, entonces rige en ese período. (RN-32)
- Dado que pongo un porcentaje menor a 10% o mayor a 50%, cuando intento guardarlo, entonces el sistema no lo acepta. (RN-43)
- Dado que subo el precio con un porcentaje, cuando hay reservas ya hechas, entonces esas reservas mantienen su precio original. (RN-20, RN-32)

**HU-16 (administrador):** Quiero perdonar una deuda, para resolver casos especiales.
- Dado que un cliente tiene deuda, cuando la perdono dejando el motivo escrito, entonces la deuda se elimina y queda guardada en la cuenta con fecha y motivo. (RN-31, RN-45)

**HU-17 (administrador):** Quiero publicar avisos y cerrar el local un día, para informar novedades y proteger las reservas de los clientes.
- Dado que escribo un aviso, cuando lo publico, entonces aparece en la sección de avisos y queda visible 7 días. (RN-33, RN-44)
- Dado que cierro el local un día, cuando lo publico, entonces las reservas activas que vencerían durante el cierre suman 24 horas. (RN-38)
- Dado que cierro el local, cuando se publica, entonces se avisa por correo y en la sección de avisos. (RN-38)

**HU-18 (administrador):** Quiero crear empleados y ver el registro de actividad, para controlar quién hace cada cambio.
- Dado que hay un cambio de precio, cantidad, retiro, deuda o perdón, cuando reviso el registro, entonces veo quién lo hizo y no puedo borrarlo. (RN-35)
- Dado que pasó 1 mes, cuando se borra el registro, entonces los baneos y perdones siguen en la cuenta. (RN-45)
- Dado que ya hay 4 administradores, cuando intento crear otro, entonces no puedo. (RN-40)

**HU-19 (administrador):** Quiero banear a quien prestó su documento, para evitar cuentas falsas.
- Dado que el empleado informó un documento ajeno, cuando confirmo el motivo, entonces la persona queda baneada de forma permanente. (RN-39)
- Dado que baneo a un cliente con reservas activas, cuando confirmo, entonces se cancelan todas sus reservas, los libros se liberan y solo puede ver el catálogo. (RN-39)
- Dado que me equivoqué o se aclaró el caso, cuando revierto el baneo, entonces la cuenta vuelve a funcionar. (RN-39)

**HU-20 (cliente):** Quiero ver las políticas y el contacto, para saber las reglas y cómo comunicarme con la comiquería.
- Dado que entro a políticas, cuando las abro, entonces veo el plazo de reserva, el 5% extra y las deudas. (RN-37)
- Dado que entro a contacto, cuando lo abro, entonces veo dirección, horario, teléfono y correo. (RN-02, RN-37)

## 6. Casos borde

- **CB-01 (plazo con el local cerrado):** reservar a las 19:50 da 24 horas corridas hasta las 19:50 del día siguiente, y un domingo cierra a las 18:00. Venció igual (RN-16).
- **CB-02 (reservar y cancelar sin límite):** un cliente puede cancelar hasta 5 veces por mes sin costo. En la sexta no puede cancelar y su reserva vence con deuda (RN-19, RN-42).
- **CB-03 (última copia):** 2 clientes confirman a la vez. Gana el primero y el otro ve el letrero de libro ya reservado (RN-25).
- **CB-04 (vence 1 segundo antes):** el cliente está en el local, pero el servidor ya venció la reserva. La reserva ya venció (RN-23).
- **CB-05 (venta en caja de una copia reservada):** el empleado no puede venderla (RN-13). Si vende otra copia, actualiza la cantidad en el instante (RN-13).
- **CB-06 (cambio de precio tras reservar):** manda el precio fijado al reservar, o el más bajo si bajó. El 5% de retiro y el de deuda salen de ese precio (RN-20, RN-21, RN-26).
- **CB-07 (varias reservas):** cada libro es una reserva con su propio plazo de 24 horas. Se retira por separado y cada uno que vence genera su deuda del 5% (RN-14, RN-22).
- **CB-08 (deuda con reservas activas):** siguen vigentes, pero si vencen, la deuda crece (RN-29). Hasta pagar no hay reservas nuevas (RN-27).
- **CB-09 (documento ajeno):** un cliente con deuda usa el documento de otra persona. Si el empleado lo detecta, el administrador banea de forma permanente a quien lo prestó y puede revertirlo (RN-05, RN-39).
- **CB-10 (borrar un libro con reservas):** no se puede, solo ocultarlo (RN-12).
- **CB-11 (menor de 18 y libro para mayores):** no puede reservarlo (RN-06).
- **CB-12 (6.ª reserva o 2.ª copia):** el sistema no la permite (RN-14).
- **CB-13 (libro agotado):** se ve en el catálogo pero no se reserva (RN-11).
- **CB-14 (cierre del local con reservas activas):** a las reservas que vencerían durante el cierre se les suman 24 horas a su vencimiento original (RN-38).
- **CB-15 (contraseña olvidada):** no hay enlace ni correo. El cliente va al local y el empleado la restablece con el documento (RN-07).
- **CB-16 (sesión sin uso):** se cierra a los 4 días sin uso para el cliente y a los 7 días para el empleado (RN-46).
- **CB-17 (registro de actividad vencido):** el registro se borra al mes, pero los baneos y perdones siguen guardados en la cuenta (RN-45).
- **CB-18 (límite de usuarios):** al llegar a 4 administradores o a 10 empleados, el sistema no deja crear más (RN-40).
- **CB-19 (cambio de mes):** el contador de cancelaciones vuelve a 0 el día 1 (RN-42).
- **CB-20 (porcentaje fuera de rango):** un descuento o aumento de 5% o de 60% no se acepta (RN-43).
- **CB-21 (menor de 15 años):** no puede tener cuenta. Con 15 a 17 años, solo con adulto responsable (RN-06).
- **CB-22 (cuenta baneada con reservas):** se cancelan todas sus reservas, los libros se liberan y la cuenta solo ve el catálogo hasta que el administrador la desbanee (RN-39).
