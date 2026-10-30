import { ErrorCliente, slug, texto, numero, listaTextos } from './util.js';

export const TIPOS = ['arabe-masculino', 'arabe-femenino', 'disenador-masculino', 'disenador-femenino', 'nicho'];
const GENEROS = ['hombre', 'mujer', 'unisex'];
const ESTACIONES = ['primavera', 'verano', 'otono', 'invierno'];
const OCASIONES = ['dia', 'noche'];
const FORMAS = ['cuadrado', 'alto', 'redondo', 'facetado', 'joya'];
const TAPAS = ['oro', 'negro', 'plata', 'madera'];

const COLUMNAS = [
  'id', 'marca', 'nombre', 'concentracion', 'tipo', 'genero', 'familia', 'perfil', 'descripcion',
  'notas', 'acordes', 'estaciones', 'ocasiones', 'presentaciones', 'imagen', 'imagen_fondo', 'imagenes',
  'modelo3d', 'frasco', 'destacado', 'visible', 'orden', 'fuente', 'pagina_catalogo', 'revisar',
];
const JSONS = ['notas', 'acordes', 'estaciones', 'ocasiones', 'presentaciones', 'imagenes', 'frasco'];

function idImagen(v) {
  const s = texto(v, 40);
  return /^[a-z0-9-]{6,40}$/.test(s) ? s : null;
}

function enteroONulo(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.floor(numero(v, NaN));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function limpiarPresentaciones(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const salida = [];
  for (const p of lista.slice(0, 12)) {
    const ml = Math.max(0, Math.round(numero(p?.ml, 0)));
    if (vistos.has(ml)) continue;
    vistos.add(ml);
    const precio = Math.max(0, Math.round(numero(p?.precio, 0) * 100) / 100);
    const anterior = numero(p?.precioAnterior, 0);
    // Oferta exclusiva para clientes con cuenta: solo vale si es más barata que el precio de lista.
    const cuenta = numero(p?.precioCuenta, 0);
    const costo = p?.costo === null || p?.costo === undefined || p?.costo === '' ? null : Math.max(0, numero(p.costo, 0));
    salida.push({
      ml,
      precio,
      precioAnterior: anterior > precio ? Math.round(anterior * 100) / 100 : null,
      precioCuenta: cuenta > 0 && cuenta < precio ? Math.round(cuenta * 100) / 100 : null,
      costo,
      stock: enteroONulo(p?.stock),
    });
  }
  return salida.sort((a, b) => a.ml - b.ml);
}

export function limpiarPerfume(e) {
  const marca = texto(e.marca, 80);
  const nombre = texto(e.nombre, 120);
  if (!marca || !nombre) throw new ErrorCliente(400, 'Falta la marca o el nombre del perfume.');
  const tipo = TIPOS.includes(e.tipo) ? e.tipo : null;
  if (!tipo) throw new ErrorCliente(400, `Tipo inválido para ${nombre}.`);
  const concentracion = texto(e.concentracion, 60);
  const id = slug(e.id) || slug(`${marca} ${nombre} ${concentracion}`);
  if (!id) throw new ErrorCliente(400, 'No se pudo generar el identificador del perfume.');
  const presentaciones = limpiarPresentaciones(e.presentaciones);
  if (!presentaciones.length) throw new ErrorCliente(400, `${nombre} necesita al menos un tamaño con precio.`);

  const notas = e.notas || {};
  const f = e.frasco && typeof e.frasco === 'object' ? e.frasco : null;
  const modelo = texto(e.modelo3d, 500);

  return {
    id,
    marca,
    nombre,
    concentracion,
    tipo,
    genero: GENEROS.includes(e.genero) ? e.genero : 'unisex',
    familia: texto(e.familia, 80),
    perfil: texto(e.perfil, 200),
    descripcion: texto(e.descripcion, 2000),
    notas: {
      salida: listaTextos(notas.salida),
      corazon: listaTextos(notas.corazon),
      fondo: listaTextos(notas.fondo),
      destacadas: listaTextos(notas.destacadas),
    },
    acordes: (Array.isArray(e.acordes) ? e.acordes : [])
      .map((a) => ({ nombre: texto(a?.nombre, 40), intensidad: Math.min(100, Math.max(0, Math.round(numero(a?.intensidad, 50)))) }))
      .filter((a) => a.nombre)
      .slice(0, 12),
    estaciones: (Array.isArray(e.estaciones) ? e.estaciones : []).filter((x) => ESTACIONES.includes(x)),
    ocasiones: (Array.isArray(e.ocasiones) ? e.ocasiones : []).filter((x) => OCASIONES.includes(x)),
    presentaciones,
    imagen: idImagen(e.imagen),
    imagen_fondo: e.imagen_fondo === 'recorte' ? 'recorte' : e.imagen ? 'foto' : '',
    imagenes: (Array.isArray(e.imagenes) ? e.imagenes : []).map(idImagen).filter(Boolean).slice(0, 72),
    modelo3d: /^(https:\/\/|\/)[^\s"'<>]+$/.test(modelo) ? modelo : null,
    frasco: f
      ? {
          forma: FORMAS.includes(f.forma) ? f.forma : 'cuadrado',
          liquido: /^#[0-9a-f]{6}$/i.test(f.liquido) ? f.liquido : '#7a5a25',
          tapa: TAPAS.includes(f.tapa) ? f.tapa : 'oro',
          vidrio: f.vidrio === 'oscuro' ? 'oscuro' : 'claro',
        }
      : null,
    destacado: e.destacado ? 1 : 0,
    visible: e.visible === false || e.visible === 0 ? 0 : 1,
    orden: Math.round(numero(e.orden, 0)),
    fuente: texto(e.fuente, 300),
    pagina_catalogo: texto(e.pagina_catalogo, 20),
    revisar: texto(e.revisar, 200),
  };
}

export function sentenciaGuardar(env, p) {
  const valores = COLUMNAS.map((c) => (JSONS.includes(c) ? (p[c] === null ? null : JSON.stringify(p[c])) : p[c]));
  const marcadores = COLUMNAS.map(() => '?').join(', ');
  const actualizar = COLUMNAS.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
  return env.DB.prepare(
    `INSERT INTO perfumes (${COLUMNAS.join(', ')}, actualizado) VALUES (${marcadores}, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET ${actualizar}, actualizado = datetime('now')`,
  ).bind(...valores);
}

export function filaAPerfume(f) {
  if (!f) return null;
  const p = { ...f };
  for (const c of JSONS) {
    try {
      p[c] = f[c] ? JSON.parse(f[c]) : c === 'frasco' ? null : c === 'notas' ? {} : [];
    } catch {
      p[c] = c === 'frasco' ? null : [];
    }
  }
  p.destacado = !!f.destacado;
  p.visible = !!f.visible;
  return p;
}

// Lista como un único texto JSON armado por SQLite, en tandas, para no gastar CPU del Worker.
// liviana: solo lo que hace falta para buscar perfumes al cargar una venta (nombre, tamaños con costo, foto y frasco).
export async function listaJSON(env, { soloVisibles, completa, liviana }) {
  const campos = liviana ? [
    `'id', id`, `'marca', marca`, `'nombre', nombre`, `'concentracion', concentracion`, `'presentaciones', json(presentaciones)`,
    `'imagen', imagen`, `'fondo', imagen_fondo`, `'frasco', json(frasco)`, `'visible', visible`,
  ] : [
    `'id', id`, `'marca', marca`, `'nombre', nombre`, `'concentracion', concentracion`, `'tipo', tipo`,
    `'genero', genero`, `'familia', familia`, `'perfil', perfil`, `'acordes', json(acordes)`,
    `'estaciones', json(estaciones)`, `'ocasiones', json(ocasiones)`, `'notas', json(notas)`,
    completa ? `'presentaciones', json(presentaciones)` : `'presentaciones', (SELECT json_group_array(json_remove(value, '$.costo')) FROM json_each(presentaciones))`, `'imagen', imagen`, `'fondo', imagen_fondo`,
    `'girable', json_array_length(imagenes) > 1`, `'frasco', json(frasco)`, `'destacado', destacado`,
  ];
  if (completa && !liviana) campos.push(`'visible', visible`, `'revisar', revisar`, `'actualizado', actualizado`, `'descripcion', length(descripcion) > 0`);
  const where = soloVisibles ? 'WHERE visible = 1' : '';
  const TANDA = 400;
  const partes = [];
  for (let desde = 0; ; desde += TANDA) {
    const fila = await env.DB.prepare(
      `SELECT json_group_array(json_object(${campos.join(', ')})) AS datos, count(*) AS n
       FROM (SELECT * FROM perfumes ${where} ORDER BY destacado DESC, orden, marca, nombre LIMIT ? OFFSET ?)`,
    ).bind(TANDA, desde).first();
    if (fila && fila.n > 0) partes.push(fila.datos.slice(1, -1));
    if (!fila || fila.n < TANDA) break;
  }
  return `[${partes.join(',')}]`;
}
