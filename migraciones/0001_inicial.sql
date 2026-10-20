-- Essenze · esquema inicial de la base de datos (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS perfumes (
  id TEXT PRIMARY KEY,                 -- slug único, se usa en el link
  marca TEXT NOT NULL,
  nombre TEXT NOT NULL,
  concentracion TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL,                  -- arabe-masculino | arabe-femenino | disenador-masculino | disenador-femenino | nicho
  genero TEXT NOT NULL DEFAULT 'unisex',
  familia TEXT NOT NULL DEFAULT '',
  perfil TEXT NOT NULL DEFAULT '',     -- perfil aromático en una línea
  descripcion TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '{"salida":[],"corazon":[],"fondo":[],"destacadas":[]}',
  acordes TEXT NOT NULL DEFAULT '[]',
  estaciones TEXT NOT NULL DEFAULT '[]',
  ocasiones TEXT NOT NULL DEFAULT '[]',
  presentaciones TEXT NOT NULL DEFAULT '[]', -- [{ml, precio, precioAnterior, costo, stock}] (stock null = sin control)
  imagen TEXT,                         -- id de la foto principal
  imagen_fondo TEXT NOT NULL DEFAULT '', -- recorte | foto (copia de imagenes.fondo para no leer la tabla de fotos)
  imagenes TEXT NOT NULL DEFAULT '[]', -- ids de los cuadros del giro 360°
  modelo3d TEXT,
  frasco TEXT,                         -- ilustración de respaldo
  destacado INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0,
  fuente TEXT NOT NULL DEFAULT '',
  pagina_catalogo TEXT NOT NULL DEFAULT '',
  revisar TEXT NOT NULL DEFAULT '',    -- avisos del importador (ej. posible duplicado)
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS perfumes_tipo ON perfumes (tipo);
CREATE INDEX IF NOT EXISTS perfumes_marca ON perfumes (marca);

CREATE TABLE IF NOT EXISTS imagenes (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,                  -- image/webp, image/png, image/jpeg
  fondo TEXT NOT NULL DEFAULT 'foto',  -- recorte (fondo transparente) | foto
  ancho INTEGER,
  alto INTEGER,
  datos BLOB NOT NULL,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ofertas (
  id TEXT PRIMARY KEY,
  etiqueta TEXT NOT NULL DEFAULT '',
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  boton TEXT NOT NULL DEFAULT 'Ver más',
  enlace TEXT NOT NULL DEFAULT '/catalogo',
  perfume TEXT,
  imagen TEXT,
  activa INTEGER NOT NULL DEFAULT 1,
  desde TEXT,                          -- AAAA-MM-DD, opcional
  hasta TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,                 -- número que ve el cliente, ej. E-261020-K7Q2
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  origen TEXT NOT NULL DEFAULT 'web',  -- web | manual
  estado TEXT NOT NULL DEFAULT 'nuevo',-- nuevo | confirmado | cobrado | entregado | cancelado
  nombre TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  comentario TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',    -- [{id, marca, nombre, ml, cantidad, precio, costo}]
  total REAL NOT NULL DEFAULT 0,
  costo_total REAL NOT NULL DEFAULT 0,
  cobrado REAL,
  metodo_pago TEXT NOT NULL DEFAULT '',
  cobrado_en TEXT,
  notas TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS pedidos_creado ON pedidos (creado);
CREATE INDEX IF NOT EXISTS pedidos_estado ON pedidos (estado);

CREATE TABLE IF NOT EXISTS movimientos (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,                 -- AAAA-MM-DD
  tipo TEXT NOT NULL,                  -- ingreso | egreso
  categoria TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  monto REAL NOT NULL,                 -- en USD
  moneda TEXT NOT NULL DEFAULT 'USD',  -- moneda en que se cargó
  monto_original REAL,
  cotizacion REAL,
  pedido TEXT,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS movimientos_fecha ON movimientos (fecha);

CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intentos_login (
  ip TEXT NOT NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ajustes (clave, valor) VALUES
  ('whatsapp', '5493512484272'),
  ('ciudad', 'Córdoba, Argentina'),
  ('instagram', ''),
  ('cotizacion', '1590'),
  ('mostrar_ars', '1'),
  ('version', '1');
