# Comiqueria idea del cliente
somos una comiqueria de anime y manga que trabaja de forma fisica y solo con pagos en efectivo, necesitamos un sistema simple que permita ver el catalogo de libros y reservarlos de forma online para que los guardemos, el pago y el retiro se hacen en el local

## local
-1 sola sucursal
-el sistema online no cobra nada, todo pago se hace en efectivo en el local

## horario

-el local abre de lunes a sabado de 10:00 a 13:00 y de 15:00 a 20:00
-los domingos abre de 11:00 a 18:00 sin cierre al mediodia
-[NUEVO] si el administrador cierra el local un dia, a las reservas activas que vencerian durante el cierre se les suman 24 horas a su vencimiento original

## usuarios

- **administradores** tienen acceso total al sistema, administran el catalogo y el stock, publican avisos, crean y editan empleados y pueden ver el registro de actividad
- **empleados** atienden en el local, crean las cuentas de los clientes, marcan las reservas como retiradas al cobrar, cobran y marcan las deudas como pagadas, y actualizan la cantidad de libros
- **clientes** con cuenta pueden ver el catalogo, reservar libros, cancelar sus reservas y ver su historial, pueden tener hasta 5 reservas activas a la vez (5 libros)
- **visitantes** sin cuenta solo pueden ver el catalogo, para reservar necesitan una cuenta
- [NUEVO] el sistema permite como maximo 4 administradores y 10 empleados a la vez

## cuentas
- las cuentas solo se crean en persona en la comiqueria, no existe el registro online
- [CAMBIO] el empleado pide el documento del cliente y crea la cuenta en el local con nombre, apellido, documento, fecha de nacimiento, correo y telefono, y el cliente elige su contraseña ahi mismo, no se envia ningun correo ni enlace
- el documento y el correo son unicos, no puede haber 2 cuentas con los mismos datos
- [NUEVO] el documento se verifica en el momento de crear la cuenta, 1 sola cuenta por documento
- [NUEVO] si el empleado ve que el documento no es de la persona que se presenta, lo informa al administrador, quien banea de forma permanente a la persona que presto su documento, deja el motivo escrito y puede revertir el baneo
- [NUEVO] una cuenta baneada solo puede ver el catalogo, no puede reservar nada ni tener nada a su nombre hasta que el administrador la desbanee, al banear se cancelan todas sus reservas activas y los libros se liberan
- [CAMBIO] no hay recuperacion de contraseña por correo, si el cliente la olvida va al local y el empleado la restablece verificando su documento
- [CAMBIO] la edad minima para tener cuenta es 15 años, los de 15 a 17 años necesitan ir con un adulto responsable al crear la cuenta y no pueden reservar libros para mayores, solo los de 18 años o mas los reservan, los menores de 15 no pueden tener cuenta

## catalogo
- cada libro tiene titulo, serie, numero de tomo, autor, editorial, idioma, genero, clasificacion por edad, imagen de portada, sinopsis, precio y cantidad disponible
- las series se agrupan, el cliente ve todos los tomos de una serie en orden y cuales estan disponibles o agotados
- se puede buscar por titulo, autor o serie, y filtrar por genero, editorial, idioma, disponibilidad y precio
- hay secciones de novedades y ofertas
- [CAMBIO] un libro recien ingresado aparece en novedades 2 dias
- un libro agotado sigue visible en el catalogo con la marca de agotado y no se puede reservar
- la cantidad que se muestra es la que no esta reservada, si el cliente reserva un libro la cantidad baja de inmediato
- un administrador puede ocultar un libro del catalogo sin borrarlo, y no se puede borrar un libro que tenga reservas o historial, solo ocultarlo
- [CAMBIO] el empleado actualiza la cantidad en el instante en que ingresa mercaderia o se vende un libro directo en caja, y no puede vender un libro que este reservado por otra persona

## reservas
- el cliente reserva un libro para que se lo guarden, sin pagar nada online, [CAMBIO] 1 libro es 1 reserva y 2 libros son 2 reservas
- [CAMBIO] cada cliente puede tener como maximo 5 reservas activas a la vez (5 libros), y solo 1 copia de cada libro
- [NUEVO] una reserva activa es la que todavia no se retiro, no se cancelo y no vencio
- [CAMBIO] el cliente tiene 24 horas corridas desde que reservo para ir al local, aunque el local este cerrado, al ir paga el precio del libro mas un 5% extra por haber reservado, todo en efectivo
- si no va dentro de las 24 horas, la reserva vence sola, el libro vuelve a estar disponible y el cliente queda con una deuda
- el cliente puede cancelar su reserva en cualquier momento antes de que venza, sin costo y sin deuda, y el libro se libera de inmediato, [CAMBIO] se cancela 1 libro (1 reserva) a la vez
- [NUEVO] el cliente puede cancelar como maximo 5 reservas por mes calendario, el contador se reinicia el dia 1 de cada mes
- [NUEVO] en la sexta cancelacion del mes el sistema no deja cancelar, la reserva sigue activa y si vence genera deuda del 5% como cualquier otra
- el precio queda fijo al momento de reservar, si el administrador lo sube o lo baja despues, la reserva mantiene el precio original, si el precio nuevo es mas bajo se le cobra el mas bajo
- [NUEVO] el 5% se calcula sobre el precio que el cliente paga al retirar (el precio fijado al reservar, o el mas bajo si bajo)
- el cliente ve en su cuenta sus reservas con un contador del tiempo que le queda, y recibe un correo con un codigo de reserva al reservar
- el empleado busca la reserva por codigo o documento, cobra en efectivo (precio mas el 5%) y la marca como retirada
- [CAMBIO] como cada reserva es de 1 libro, cada libro se retira por separado y paga su propio 5%
- [CAMBIO] el libro que no se retira dentro de las 24 horas de su propia reserva vence y genera una deuda del 5%
- la hora que manda siempre es la del servidor, el contador del cliente es solo una referencia, si el plazo vence 1 segundo antes de que el empleado confirme el retiro, la reserva ya vencio

## 2 reservas al mismo libro
-para evitar que 2 clientes reserven la ultima copia a la vez, el sistema aparta el libro en el momento de confirmar la reserva, el que confirma primero se queda con el libro y al otro le sale un letrero de libro ya reservado antes de volver al catalogo, como no hay pagos online no existen dobles pagos

## deudas
- la deuda es el 5% del precio de cada libro cuya reserva vencio sin retirarse
- [NUEVO] el 5% se calcula sobre el precio fijado al reservar, no sobre el precio vigente cuando vencio
- mientras tenga una deuda, el cliente no puede hacer nuevas reservas, solo puede ver el catalogo
- la deuda solo se paga en persona en el local y en efectivo, el empleado la marca como pagada y la cuenta queda libre para reservar de nuevo
- las reservas que ya estaban activas cuando se genera una deuda siguen vigentes hasta su plazo
- [NUEVO] si esas reservas tambien vencen, la deuda crece en el 5% de cada libro que venza
- el cliente ve en su cuenta el monto de su deuda y de que reservas viene
- el administrador puede perdonar una deuda dejando el motivo escrito
- como las cuentas solo se crean en persona con documento, un cliente con deuda no puede abrir otra cuenta para seguir reservando

## aumentos y bajadas de precio
- El administrador debe tener la opcion de agregar descuentos a un libro, a una serie, a una editorial o a todo el catalogo, en dias festivos o no, con fecha de inicio y fin, y modificar el descuento a su eleccion, asi como poder aumentar el precio en un cierto porcentaje que elija
- [NUEVO] los descuentos y los aumentos van de un minimo de 10% a un maximo de 50%, no se puede poner un descuento ni un aumento de 5%

## avisos
- el administrador puede publicar avisos y anuncios en el sistema (novedades, firmas, cierres), visibles en una seccion de avisos
- [NUEVO] cada aviso queda visible 7 dias en la seccion de avisos
- [CAMBIO] el sistema envia 3 correos por cada reserva: cuando se confirma (con el codigo de reserva), cuando faltan 6 horas para que venza y cuando vence
- [NUEVO] cuando el administrador cierra el local un dia, avisa por correo y en la seccion de avisos, y a las reservas activas afectadas se les suman 24 horas

## administrador
- [NUEVO] puede administrar el catalogo: cargar, editar y ocultar libros, y no puede borrar un libro con reservas o historial
- [NUEVO] puede administrar el stock y la cantidad de cada libro
- [NUEVO] puede crear y editar empleados, hasta 10 a la vez, y puede haber hasta 4 administradores
- [NUEVO] puede poner descuentos y aumentos de 10% a 50%, con fecha de inicio y fin
- [NUEVO] puede perdonar una deuda dejando el motivo escrito
- [NUEVO] puede publicar avisos y anuncios, cada uno visible 7 dias
- [NUEVO] puede banear de forma permanente a quien preste su documento, dejando el motivo escrito, y puede revertir el baneo
- [NUEVO] puede ver el registro de actividad, que guarda quien hizo cada cambio

## seguridad
- el sistema guarda un registro de actividad de quien hizo cada cambio (precio, cantidad, retiro, deuda, perdon de deuda), nadie puede borrarlo
- [NUEVO] el registro de actividad se borra solo al pasar 1 mes, los baneos y los perdones de deuda quedan guardados en la propia cuenta con fecha y motivo
- las contraseñas se guardan cifradas
- [CAMBIO] las sesiones se cierran solas tras 4 dias sin uso para el cliente y 7 dias sin uso para el empleado

## contacto
- habra una seccion de contacto con la direccion, el horario, el telefono y el correo electronico de la comiqueria
- habra una seccion de politicas con el plazo de reserva, el 5% extra y las deudas
