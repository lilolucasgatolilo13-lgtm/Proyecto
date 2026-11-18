export const ESQUEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rol TEXT NOT NULL CHECK(rol IN ('cliente', 'empleado', 'administrador')),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  documento TEXT NOT NULL UNIQUE,
  correo TEXT NOT NULL UNIQUE,
  telefono TEXT NOT NULL,
  contrasena_hash TEXT NOT NULL,
  fecha_nacimiento TEXT NOT NULL,
  baneado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ultima_actividad TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS libros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  serie_id INTEGER NOT NULL REFERENCES series(id),
  numero_tomo INTEGER NOT NULL,
  autor TEXT NOT NULL,
  editorial TEXT NOT NULL,
  idioma TEXT NOT NULL,
  genero TEXT NOT NULL,
  clasificacion_edad TEXT NOT NULL,
  portada_url TEXT NOT NULL,
  sinopsis TEXT NOT NULL,
  precio REAL NOT NULL,
  cantidad_total INTEGER NOT NULL DEFAULT 0,
  oculto INTEGER NOT NULL DEFAULT 0,
  fecha_ingreso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
  libro_id INTEGER NOT NULL REFERENCES libros(id),
  precio_fijado REAL NOT NULL,
  fecha_reserva TEXT NOT NULL,
  fecha_vencimiento TEXT NOT NULL,
  estado TEXT NOT NULL CHECK(estado IN ('activa', 'retirada', 'cancelada', 'vencida')) DEFAULT 'activa',
  fecha_cancelacion TEXT,
  aviso_6h_para TEXT
);

CREATE TABLE IF NOT EXISTS deudas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
  reserva_id INTEGER NOT NULL REFERENCES reservas(id),
  monto REAL NOT NULL,
  estado TEXT NOT NULL CHECK(estado IN ('pendiente', 'pagada', 'perdonada')) DEFAULT 'pendiente',
  fecha TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS descuentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alcance TEXT NOT NULL CHECK(alcance IN ('libro', 'serie', 'editorial', 'catalogo')),
  referencia_id TEXT,
  tipo TEXT NOT NULL CHECK(tipo IN ('descuento', 'aumento')),
  porcentaje REAL NOT NULL,
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS avisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  fecha_publicacion TEXT NOT NULL,
  administrador_id INTEGER NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS cierres_local (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL UNIQUE,
  administrador_id INTEGER NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS historial_cuenta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('baneo', 'reversion_baneo', 'perdon_deuda')),
  motivo TEXT NOT NULL,
  fecha TEXT NOT NULL,
  administrador_id INTEGER NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS registro_actividad (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  detalle TEXT NOT NULL,
  fecha TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS correos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destinatario TEXT NOT NULL,
  asunto TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  estado TEXT NOT NULL CHECK(estado IN ('pendiente', 'enviado', 'fallido')) DEFAULT 'pendiente',
  intentos INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL
);
`;
