// Agrega tablas y columnas nuevas a la base la primera vez que se usan, para no tener que correr SQL a mano.
let listo = false;

const TABLAS = [
  // Cuentas de clientes de la tienda (email y contraseña; la contraseña se guarda solo como hash PBKDF2).
  `CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    clave TEXT NOT NULL,
    favoritos TEXT NOT NULL DEFAULT '[]',
    creado TEXT NOT NULL DEFAULT (datetime('now')),
    ultimo_ingreso TEXT
  )`,
  // Sesiones de clientes: se guarda el hash del token de la cookie, nunca el token.
  `CREATE TABLE IF NOT EXISTS sesiones_clientes (
    token TEXT PRIMARY KEY,
    cliente TEXT NOT NULL,
    vence TEXT NOT NULL
  )`,
  // Eventos de precios (Cyber Day…): reglas, fechas y la foto de los precios de antes para devolverlos al terminar.
  `CREATE TABLE IF NOT EXISTS eventos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    desde TEXT NOT NULL DEFAULT '',
    hasta TEXT NOT NULL DEFAULT '',
    modo TEXT NOT NULL DEFAULT 'manual',
    estado TEXT NOT NULL DEFAULT 'borrador',
    config TEXT NOT NULL DEFAULT '{}',
    aplicado TEXT NOT NULL DEFAULT '[]',
    creado TEXT NOT NULL DEFAULT (datetime('now')),
    activado TEXT,
    terminado TEXT
  )`,
  // Costos de proveedores: qué renglón de qué lista es qué perfume y tamaño (o "ignorar"), para cargar solo la próxima vez.
  `CREATE TABLE IF NOT EXISTS costos_vinculos (
    clave TEXT PRIMARY KEY,
    perfume TEXT,
    ml INTEGER,
    ignorar INTEGER NOT NULL DEFAULT 0,
    descripcion TEXT NOT NULL DEFAULT '',
    actualizado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Historial de cargas de costos: cómo estaba todo antes de cada una, para poder deshacerla.
  `CREATE TABLE IF NOT EXISTS costos_cargas (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    archivos TEXT NOT NULL DEFAULT '[]',
    tamanos INTEGER NOT NULL DEFAULT 0,
    costos TEXT NOT NULL DEFAULT '[]',
    vinculos TEXT NOT NULL DEFAULT '[]',
    deshecha INTEGER NOT NULL DEFAULT 0
  )`,
  // Deudas: lo que les deben (una venta pagada en parte o fiada, o cargada a mano) o lo que deben ellos.
  // Lo pagado no se guarda acá: es la suma de sus pagos en la caja (movimientos con esta deuda), en la moneda de la deuda.
  `CREATE TABLE IF NOT EXISTS deudas (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL DEFAULT 'cobrar',
    pedido TEXT,
    nombre TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    concepto TEXT NOT NULL DEFAULT '',
    moneda TEXT NOT NULL DEFAULT 'ARS',
    monto REAL NOT NULL DEFAULT 0,
    fecha TEXT NOT NULL,
    notas TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Stock de perfumes que no están en el catálogo (comprados para vender, pero sin publicar en la tienda).
  `CREATE TABLE IF NOT EXISTS stock_libre (
    id TEXT PRIMARY KEY,
    marca TEXT NOT NULL DEFAULT '',
    nombre TEXT NOT NULL,
    ml INTEGER NOT NULL DEFAULT 0,
    cantidad INTEGER NOT NULL DEFAULT 0,
    costo REAL,
    creado TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Compras de mercadería: suman stock, dejan el último costo y van a la caja (o a Deudas si quedó debiendo).
  // items guarda cómo estaba cada costo antes, para poder deshacer la compra.
  `CREATE TABLE IF NOT EXISTS compras (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    proveedor TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL DEFAULT '[]',
    moneda TEXT NOT NULL DEFAULT 'USD',
    total REAL NOT NULL DEFAULT 0,
    pago TEXT NOT NULL DEFAULT 'pagado',
    creado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

const COLUMNAS = {
  ofertas: {
    formato: "TEXT NOT NULL DEFAULT 'composicion'", // composicion (texto + frasco) | banner (imagen completa)
    imagen_movil: 'TEXT',
  },
  pedidos: {
    numero: 'INTEGER', // número que ve el cliente: 1001, 1002…
    cliente: 'TEXT', // cuenta de cliente a la que suma el pedido (si tiene)
  },
  costos_cargas: {
    listas: 'TEXT', // renglones leídos de cada lista, para volver a revisar la carga sin subir los archivos
  },
  movimientos: {
    deuda: 'TEXT', // pago de una deuda (lo cobrado o pagado después): suma a lo pagado de esa deuda
    compra: 'TEXT', // gasto de una compra de mercadería (se borra si se deshace la compra)
  },
  deudas: {
    compra: 'TEXT', // compra de mercadería que quedaron debiendo al proveedor
  },
};

// Índices que se agregaron después del esquema inicial (van después de las columnas nuevas).
const INDICES = [
  'CREATE INDEX IF NOT EXISTS movimientos_pedido ON movimientos (pedido)',
  'CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero ON pedidos (numero)',
  'CREATE INDEX IF NOT EXISTS pedidos_cliente ON pedidos (cliente)',
  'CREATE INDEX IF NOT EXISTS sesiones_clientes_cliente ON sesiones_clientes (cliente)',
  'CREATE INDEX IF NOT EXISTS movimientos_deuda ON movimientos (deuda)',
  'CREATE INDEX IF NOT EXISTS deudas_pedido ON deudas (pedido)',
];

export async function asegurarEsquema(env) {
  if (listo) return;
  for (const sql of TABLAS) await env.DB.prepare(sql).run();
  for (const [tabla, columnas] of Object.entries(COLUMNAS)) {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${tabla})`).all();
    const existentes = new Set(results.map((c) => c.name));
    for (const [nombre, tipo] of Object.entries(columnas)) {
      if (!existentes.has(nombre)) await env.DB.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`).run();
    }
  }
  // Los pedidos sin número (los que ya existían) se numeran del más viejo al más nuevo, siguiendo al último.
  const { ultimo } = await env.DB.prepare('SELECT COALESCE(MAX(numero), 1000) AS ultimo FROM pedidos').first();
  await env.DB.prepare(
    `UPDATE pedidos SET numero = ? + o.n
     FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY creado, rowid) AS n FROM pedidos WHERE numero IS NULL) AS o
     WHERE pedidos.id = o.id`,
  ).bind(ultimo).run();
  for (const sql of INDICES) await env.DB.prepare(sql).run();
  // Contador de cambios para que el panel abierto se actualice solo.
  await env.DB.prepare("INSERT OR IGNORE INTO ajustes (clave, valor) VALUES ('cambios', '1')").run();
  listo = true;
}
