# Comiqueria glosario
terminos que se usan en el sistema de la comiqueria y en su idea del cliente (idea_comiqueria.md)

## personas
- **administrador**: usuario con acceso total al sistema, administra el catalogo, el stock, los avisos y los empleados, y puede perdonar deudas
- **empleado**: usuario que atiende en el local, crea cuentas, cobra, marca retiros y deudas pagadas, y actualiza la cantidad de libros
- **cliente**: persona con cuenta, puede ver el catalogo, reservar y cancelar reservas
- **visitante**: persona sin cuenta, solo puede ver el catalogo
- **adulto responsable**: persona mayor de edad que acompana al cliente de 15 a 17 años al crear su cuenta, los menores de 15 no pueden tener cuenta

## catalogo
- **catalogo**: lista publica de todos los libros que vende la comiqueria, se puede ver sin cuenta
- **libro**: manga o libro de anime que se vende, con su titulo, tomo, autor, precio y cantidad disponible
- **serie**: grupo de tomos de una misma obra, se muestran juntos y en orden
- **tomo**: cada libro individual dentro de una serie
- **clasificacion por edad**: indica para que edad es el libro, los menores de 18 no pueden reservar los libros para mayores (+18)
- **disponible**: libro que tiene al menos una copia que no esta reservada
- **agotado**: libro sin copias disponibles, sigue visible pero no se puede reservar
- **cantidad disponible**: copias del libro que no estan reservadas, baja apenas alguien reserva
- **ocultar**: sacar un libro del catalogo sin borrarlo, es lo unico permitido si tiene reservas o historial
- **novedades**: seccion del catalogo con los libros recien ingresados
- **ofertas**: seccion del catalogo con los libros que tienen descuento

## reservas
- **reserva**: pedido online para que la comiqueria guarde 1 libro (1 libro = 1 reserva), no se paga online
- **reserva activa**: reserva que todavia no se retiro, no se cancelo y no vencio, cada cliente puede tener hasta 5 (5 libros)
- **retiro**: momento en que el cliente va al local, paga y se lleva el libro, el empleado marca la reserva como retirada, cada libro se retira por separado y paga su propio 5%
- **plazo de reserva**: 24 horas desde que se reservo para ir a retirar
- **vencimiento**: momento en que se acaba el plazo, la reserva se cancela sola y el libro vuelve a estar disponible
- **cancelacion**: el cliente anula su reserva antes de que venza, sin costo y sin deuda, el libro se libera de inmediato
- **codigo de reserva**: codigo que recibe el cliente por correo, el empleado lo usa junto con el documento para buscar la reserva
- **contador**: tiempo restante que ve el cliente en su cuenta, es solo una referencia
- **recargo por reserva**: 5% extra del precio del libro que se paga al retirar por haberlo reservado
- **precio fijo**: el precio con el que se reservo, no cambia si el administrador lo modifica despues, salvo que el nuevo sea mas bajo, en ese caso se cobra el mas bajo
- **doble reserva**: 2 clientes intentando reservar la ultima copia a la vez, gana el que confirma primero y al otro le sale un aviso de libro ya reservado

## deudas
- **deuda**: monto que debe un cliente por reservas que vencieron sin retirarse, es el 5% del precio de cada libro
- **bloqueo de reservas**: mientras el cliente tenga una deuda no puede hacer reservas nuevas, solo ver el catalogo
- **pago de deuda**: se hace solo en persona y en efectivo, el empleado la marca como pagada y la cuenta queda libre
- **perdon de deuda**: el administrador elimina una deuda dejando el motivo escrito

## cuentas
- **cuenta**: perfil del cliente en el sistema, solo se crea en persona en el local
- **documento**: documento de identidad del cliente, es unico y se verifica al crear la cuenta
- **alta de cuenta**: proceso en el que el empleado crea la cuenta con los datos del cliente
- **baneo**: bloqueo permanente de una cuenta, solo puede ver el catalogo, se le cancelan todas las reservas y solo el administrador lo revierte
- **recuperacion de contraseña**: cambio de contraseña mediante un correo

## precios
- **precio base**: precio normal de un libro antes de descuentos
- **descuento**: baja de precio que define el administrador para un libro, una serie, una editorial o todo el catalogo, con fecha de inicio y fin
- **aumento**: suba de precio en un porcentaje que elige el administrador
- **efectivo**: unica forma de pago, no se aceptan tarjetas ni transferencias y el sistema no cobra online

## sistema
- **reloj del servidor**: hora oficial del sistema, manda para todos los plazos y vencimientos
- **atomico**: reserva que se registra completa o no se registra, evita que 2 personas tengan la misma copia
- **registro de actividad**: historial de quien hizo cada cambio en el sistema (precio, cantidad, retiro, deuda, perdon), no se puede borrar
- **aviso**: anuncio que publica el administrador (novedades, firmas, cierres), se ve en la seccion de avisos
- **correo de reserva**: correo que recibe el cliente al reservar, 6 horas antes del vencimiento y cuando vence
- **politicas**: seccion con el plazo de reserva, el recargo del 5% y las deudas
- **stock**: cantidad de copias de un libro que tiene la comiqueria, el empleado lo actualiza a mano cuando ingresa mercaderia o se vende en caja
