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
};

// Índices que se agregaron después del esquema inicial (van después de las columnas nuevas).
const INDICES = [
  'CREATE INDEX IF NOT EXISTS movimientos_pedido ON movimientos (pedido)',
  'CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero ON pedidos (numero)',
  'CREATE INDEX IF NOT EXISTS pedidos_cliente ON pedidos (cliente)',
  'CREATE INDEX IF NOT EXISTS sesiones_clientes_cliente ON sesiones_clientes (cliente)',
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
