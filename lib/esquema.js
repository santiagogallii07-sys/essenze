// Agrega columnas nuevas a la base la primera vez que se usan, para no tener que correr SQL a mano.
let listo = false;

const COLUMNAS = {
  ofertas: {
    formato: "TEXT NOT NULL DEFAULT 'composicion'", // composicion (texto + frasco) | banner (imagen completa)
    imagen_movil: 'TEXT',
  },
};

// Índices que se agregaron después del esquema inicial.
const INDICES = ['CREATE INDEX IF NOT EXISTS movimientos_pedido ON movimientos (pedido)'];

export async function asegurarEsquema(env) {
  if (listo) return;
  for (const sql of INDICES) await env.DB.prepare(sql).run();
  for (const [tabla, columnas] of Object.entries(COLUMNAS)) {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${tabla})`).all();
    const existentes = new Set(results.map((c) => c.name));
    for (const [nombre, tipo] of Object.entries(columnas)) {
      if (!existentes.has(nombre)) await env.DB.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`).run();
    }
  }
  listo = true;
}
