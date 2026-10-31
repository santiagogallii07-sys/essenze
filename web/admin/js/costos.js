// Costos desde las listas de los proveedores (Word, PDF, Excel o CSV): leer los renglones y emparejarlos con
// los perfumes del catálogo. Las funciones de lectura y emparejado no usan la página: se prueban también en Node.

/* ---------- Leer el texto de los archivos ---------- */

async function descomprimir(bytes, formato) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(formato));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

// Archivo .docx: es un zip; el texto está en word/document.xml.
async function textoDeDocx(buf) {
  const b = new Uint8Array(buf);
  const vista = new DataView(buf);
  for (let i = 0; i < b.length - 30;) {
    if (vista.getUint32(i, true) !== 0x04034b50) { i++; continue; }
    const metodo = vista.getUint16(i + 8, true);
    const largo = vista.getUint32(i + 18, true);
    const nombreLargo = vista.getUint16(i + 26, true);
    const extra = vista.getUint16(i + 28, true);
    const nombre = new TextDecoder().decode(b.subarray(i + 30, i + 30 + nombreLargo));
    const ini = i + 30 + nombreLargo + extra;
    if (nombre === 'word/document.xml') {
      const datos = b.subarray(ini, ini + largo);
      const xml = new TextDecoder().decode(metodo === 8 ? await descomprimir(datos, 'deflate-raw') : datos);
      return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
    i = ini + largo;
  }
  throw new Error('No encontré el texto dentro del Word.');
}

// Archivo .pdf de lista (los que generan los sistemas de los proveedores): cada renglón es un texto del PDF.
async function textoDePdf(buf) {
  const b = new Uint8Array(buf);
  const s = new TextDecoder('latin1').decode(b);
  const lineas = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const ini = m.index + m[0].length;
    const fin = s.indexOf('endstream', ini);
    if (fin < 0) break;
    let t;
    try {
      t = new TextDecoder('latin1').decode(await descomprimir(b.subarray(ini, fin), 'deflate'));
    } catch { continue; }
    for (const x of t.matchAll(/\(((?:\\.|[^)\\])*)\)\s*(?:'|Tj)/g)) {
      lineas.push(x[1].replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\(.)/g, '$1'));
    }
  }
  if (!lineas.length) throw new Error('Este PDF no tiene texto que se pueda leer (¿es una foto escaneada?).');
  return lineas.join('\n');
}

// Lector de Excel (el mismo que usa la importación de ventas).
const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisá internet.'));
    document.head.append(s);
  });
}

// Devuelve los renglones de una lista: [{codigo, descripcion, referencia, costo}]
export async function leerLista(archivo) {
  const buf = await archivo.arrayBuffer();
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.docx')) return filasDeTexto(await textoDeDocx(buf));
  if (nombre.endsWith('.pdf')) return filasDeTexto(await textoDePdf(buf));
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) return filasDeTexto(new TextDecoder().decode(buf));
  if (/\.xlsx?$/.test(nombre)) {
    const XLSX = await cargarSheetJS();
    const libro = XLSX.read(buf, { type: 'array' });
    return filasDeTablas(libro.SheetNames.map((n) => ({ filas: XLSX.utils.sheet_to_json(libro.Sheets[n], { header: 1, raw: true }) })));
  }
  throw new Error('Formato no soportado: subí Word (.docx), PDF, Excel o CSV.');
}

/* ---------- Renglones de cada formato ---------- */

const numeroPrecio = (t) => {
  const s = String(t).trim().replace(/\s/g, '');
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(s)) return null;
  return Number(s.replace(',', '.'));
};

export function filasDeTexto(texto) {
  const lineas = texto.split(/\r?\n/).map((l) => l.replace(/\t+/g, ' ').trimEnd());
  const filas = [];
  // Presupuesto con columnas |Codigo|Cant.|Descripcion|Precio|Valor|
  for (const l of lineas) {
    const m = l.match(/^\|\s*(\d+)\|\s*\d+\|(.+?)\|\s*([\d.,]+)\|/);
    if (m) filas.push({ codigo: m[1], descripcion: m[2].trim(), referencia: '', costo: numeroPrecio(m[3]) });
  }
  if (filas.length) return filas;
  // Lista de precios "Codigo Descripcion..... Referencia Precio Cat."
  for (const l of lineas) {
    const m = l.match(/^\s*(\d{2,7})\s+(.+?)\.{2,}\s*(\d{8,14})?\s+(\d{1,5}\.\d{2})\s+\d+\s*$/);
    if (m) filas.push({ codigo: m[1], descripcion: m[2].trim(), referencia: m[3] || '', costo: Number(m[4]) });
  }
  if (filas.length) return filas;
  // Word: código, descripción y precio en renglones seguidos
  const utiles = lineas.map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < utiles.length - 2; i++) {
    if (!/^\d{2,7}$/.test(utiles[i])) continue;
    const costo = numeroPrecio(utiles[i + 2]);
    if (costo === null || /^\d+$/.test(utiles[i + 1])) continue;
    filas.push({ codigo: utiles[i], descripcion: utiles[i + 1], referencia: '', costo });
    i += 2;
  }
  if (filas.length) return filas;
  // CSV o texto con "descripción;precio" en cada renglón
  for (const l of lineas) {
    const partes = l.split(/[;\t]|,(?=\s*\d+[.,]?\d*\s*$)/).map((x) => x.trim()).filter(Boolean);
    if (partes.length < 2) continue;
    const costo = numeroPrecio(partes[partes.length - 1].replace(/^U?S?\$|^USD/i, ''));
    if (costo !== null) filas.push({ codigo: '', descripcion: partes.slice(0, -1).join(' '), referencia: '', costo });
  }
  return filas;
}

// Excel: en cada fila, la celda de texto más larga es la descripción y la última celda con número es el costo.
function filasDeTablas(hojas) {
  const filas = [];
  for (const hoja of hojas) {
    for (const fila of hoja.filas || []) {
      const celdas = fila.map((c) => (c === null || c === undefined ? '' : String(c).trim()));
      const descripcion = celdas.filter((c) => /[a-z]/i.test(c)).sort((a, b) => b.length - a.length)[0];
      const precios = celdas.map(numeroPrecio).filter((n) => n !== null && n > 0);
      if (descripcion && precios.length) filas.push({ codigo: '', descripcion, referencia: '', costo: precios[precios.length - 1] });
    }
  }
  return filas;
}

/* ---------- Emparejar con el catálogo ---------- */

export const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Cómo escriben los proveedores algunas marcas.
const ALIAS = {
  'antonio banderas': ['antonio', 'a banderas', 'banderas'],
  'yves saint laurent': ['ysl'],
  'carolina herrera': ['ch', 'c herrera', 'carolina'],
  'paco rabanne': ['paco', 'rabanne'],
  'giorgio armani': ['armani', 'g armani'],
  'dolce & gabbana': ['dolce', 'd&g', 'dyg', 'dolce gabbana'],
  'jean paul gaultier': ['jpg', 'gaultier', 'j p gaultier', 'jean paul'],
  'christian dior': ['dior'],
  'calvin klein': ['ck', 'calvin'],
  'hugo boss': ['boss', 'hugo'],
  'ralph lauren': ['ralph', 'polo'],
  'viktor & rolf': ['viktor', 'v&r', 'viktor rolf'],
  'lancome': ['lancome'],
  'maison alhambra': ['alhambra', 'm alhambra'],
  'al haramain': ['haramain'],
  'al wataniah': ['wataniah'],
  'fragrance world': ['f world', 'fragance world'],
  'french avenue': ['f avenue'],
  'paris corner': ['p corner'],
  'tommy hilfiger': ['tommy'],
  'narciso rodriguez': ['narciso'],
  'issey miyake': ['issey', 'miyake'],
  'jimmy choo': ['choo'],
  'marc jacobs': ['jacobs'],
  'michael kors': ['kors'],
  'parfums de marly': ['marly', 'pdm'],
  'maison francis kurkdjian': ['mfk', 'kurkdjian'],
  'initio parfums prives': ['initio'],
  'acqua di parma': ['acqua'],
  'bond no. 9': ['bond'],
  'maison margiela': ['margiela'],
  'elie saab': ['saab'],
  'ard al zaafaran': ['ard al zaafaran', 'zaafaran'],
  'lorenzo pazzaglia': ['pazzaglia'],
  'pendora scents': ['pendora'],
  'anfar 1950': ['anfar 1950'],
};

// Palabras que no ayudan a reconocer el perfume (el género se mira aparte).
const RUIDO = new Set(['edp', 'edt', 'edc', 'exdp', 'parfum', 'perfume', 'eau', 'de', 'd', 'toilette', 'cologne', 'masc', 'fem', 'femme',
  'homme', 'men', 'man', 'woman', 'women', 'pour', 'for', 'him', 'm', 'f', 'h', 'u', 'w', 'unisex', 'new', 'impo', 'ml', 'spray', 'vapo',
  'the', 'y', 'el', 'la', 'le', 'by', 'del', 'p', 'nuevo', 'tester', 'set', 'estuche', 'and']);

// Colores que los proveedores escriben en castellano.
const SINONIMOS = { negro: 'black', blanco: 'white', rosa: 'pink', azul: 'blue', rojo: 'red', dorado: 'gold', oro: 'gold', plata: 'silver', verde: 'green', amarillo: 'yellow', violeta: 'purple', marron: 'brown' };

const palabras = (t) => normalizar(t).replace(/&/g, ' ').replace(/(\d)\s*ml\b/g, '$1 ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean)
  .map((w) => SINONIMOS[w] || w);

// Género que dice la descripción del proveedor (o null si no dice).
function generoDe(desc) {
  const w = new Set(palabras(desc));
  const mujer = ['f', 'fem', 'femme', 'woman', 'women', 'her', 'mujer', 'lady'].some((x) => w.has(x));
  const hombre = ['m', 'h', 'masc', 'homme', 'men', 'man', 'him', 'hombre'].some((x) => w.has(x));
  if (mujer && !hombre) return 'mujer';
  if (hombre && !mujer) return 'hombre';
  return null;
}

// Palabras que marcan otra versión del perfume: si el proveedor las dice y el catálogo no, es otro perfume.
const VERSIONES = new Set(['elixir', 'intense', 'intenso', 'absolu', 'absolute', 'extreme', 'sport', 'noir', 'night', 'red', 'pink', 'gold',
  'golden', 'black', 'blue', 'white', 'rouge', 'royal', 'prive', 'oud', 'forest', 'candy', 'tropical', 'cherry', 'vanilla', 'silver', 'green',
  'purple', 'yellow', 'brown', 'limited', 'edition', 'collector', 'privee', 'parfum', 'extrait', 'exclusive', 'platinum', 'diamond', 'crystal',
  'fresh', 'aqua', 'summer', 'winter', 'gourmand', 'creamy', 'delight', 'legend', 'king', 'queen', 'men', 'women', 'femme', 'homme']);

// Sets, kits y muestras: no son el perfume suelto del catálogo.
const ES_KIT = /\b(kit|set|pcs|piezas|estuche|tester|miniatura|mini|decant|deo|desodo|desodorante|body|lotion|gel|crema|shower)\b|\+/i;

// Una palabra del proveedor "nombra" a una del catálogo si es igual o una abreviatura de al menos 3 letras ("sed" → "seduction").
const nombra = (w, n) => w === n || (w.length >= 3 && n.startsWith(w)) || (n.length >= 3 && w.startsWith(n) && w.length - n.length <= 2);

function mlDe(desc) {
  const m = normalizar(desc).match(/(\d{2,3})\s*ml/);
  return m ? Number(m[1]) : null;
}

function concentracionDe(t) {
  const n = normalizar(t);
  if (/extrait|extracto/.test(n)) return 'extrait';
  if (/\bparfum\b|le parfum|elixir/.test(n) && !/eau de parfum/.test(n)) return 'parfum';
  if (/\bedp\b|eau de parfum|exdp/.test(n)) return 'edp';
  if (/\bedt\b|eau de toilette/.test(n)) return 'edt';
  if (/\bedc\b|cologne/.test(n)) return 'edc';
  return null;
}

// Descripción del proveedor sin códigos de barra, puntos de relleno ni el "P." del principio.
export function limpiarDescripcion(d) {
  return String(d)
    .replace(/^P\./i, '')
    .replace(/\.{2,}/g, ' ')
    .replace(/\(\s*\d+\s*\)|\b\d{4,}(\/\d{4,})*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function prepararCatalogo(perfumes) {
  const marcas = new Map();
  for (const p of perfumes) {
    const clave = normalizar(p.marca);
    if (!marcas.has(clave)) marcas.set(clave, { marca: p.marca, formas: [palabras(p.marca).join(' '), ...(ALIAS[clave] || []).map((a) => palabras(a).join(' '))], perfumes: [] });
    marcas.get(clave).perfumes.push({ ...p, palabras: palabras(p.nombre).filter((w) => !RUIDO.has(w) && !/^[()]$/.test(w)), conc: concentracionDe(p.concentracion), genero: p.genero || generoDe(p.nombre) });
  }
  // Palabras que la marca usa para distinguir sus perfumes (si sobran en el proveedor, es probable que sea otro).
  for (const m of marcas.values()) m.vocabulario = new Set(m.perfumes.flatMap((p) => p.palabras).filter((w) => w.length > 2));
  // Las formas más largas primero (así "al haramain" gana a "al").
  return {
    marcas: [...marcas.values()].sort((a, b) => Math.max(...b.formas.map((x) => x.length)) - Math.max(...a.formas.map((x) => x.length))),
    porId: new Map([...marcas.values()].flatMap((m) => m.perfumes.map((p) => [p.id, p]))),
  };
}

/**
 * Busca el perfume y el tamaño de un renglón del proveedor.
 * Devuelve {perfume, ml, puntaje (0 a 1), motivo} o null. Con puntaje 1 es seguro; menos, conviene revisarlo.
 */
export function emparejar(fila, catalogo) {
  const desc = limpiarDescripcion(fila.descripcion);
  if (ES_KIT.test(desc)) return null;
  const texto = ` ${palabras(desc).join(' ')} `;
  const marca = catalogo.marcas.find((m) => m.formas.some((f) => texto.startsWith(` ${f} `) || texto.includes(` ${f} `)));
  if (!marca) return null;
  const forma = marca.formas.filter((f) => texto.includes(` ${f} `)).sort((a, b) => b.length - a.length)[0];
  const resto = new Set(texto.replace(` ${forma} `, ' ').trim().split(' ').filter((w) => w && !RUIDO.has(w) && !/^\d+$/.test(w)));
  const ml = mlDe(desc);
  const conc = concentracionDe(desc);
  const genero = generoDe(desc);
  const resultados = [];
  for (const p of marca.perfumes) {
    if (!p.palabras.length) continue;
    const en = p.palabras.filter((n) => [...resto].some((w) => nombra(w, n))).length;
    if (!en) continue;
    // Cuánto del nombre del catálogo aparece, y cuánto de lo que dice el proveedor sobra.
    const cubre = en / p.palabras.length;
    const sobrantes = [...resto].filter((w) => !p.palabras.some((n) => nombra(w, n)));
    const sobra = sobrantes.length;
    // Una palabra de otra versión (Elixir, Intense, Pink…) o que la marca usa en otro perfume pesa mucho; el resto, poco.
    const otraVersion = sobrantes.filter((w) => VERSIONES.has(w) || marca.vocabulario.has(w)).length;
    let puntaje = cubre - otraVersion * 0.35 - Math.min(0.25, (sobra - otraVersion) * 0.06);
    if (conc && p.conc && conc !== p.conc) puntaje -= 0.3;
    if (genero && p.genero && p.genero !== 'unisex' && genero !== p.genero) puntaje -= 0.4;
    const pres = p.presentaciones.find((x) => x.ml === ml) || (p.presentaciones.length === 1 && (!ml || !p.presentaciones[0].ml) ? p.presentaciones[0] : null);
    if (!pres) puntaje -= 0.5;
    resultados.push({ perfume: p, ml: pres ? pres.ml : null, puntaje, cubre, sobra });
  }
  resultados.sort((a, b) => b.puntaje - a.puntaje || b.perfume.palabras.length - a.perfume.palabras.length);
  const [mejor, segundo] = resultados;
  if (!mejor || mejor.puntaje < 0.45) return null;
  // Seguro: está todo el nombre, el tamaño existe, no choca concentración ni género y no hay otro igual de parecido.
  const seguro = mejor.cubre === 1 && mejor.sobra <= 1 && mejor.ml !== null && mejor.puntaje >= 0.74 && (!segundo || mejor.puntaje - segundo.puntaje >= 0.15);
  return { perfume: mejor.perfume, ml: mejor.ml, puntaje: Math.max(0, Math.min(1, mejor.puntaje)), seguro, sobra: mejor.sobra };
}

/**
 * Junta todas las listas y arma la propuesta: para cada tamaño del catálogo, el renglón elegido y los demás como alternativas.
 * listas: [{nombre, filas, recargo (% que se suma al costo de esa lista)}]
 * vinculos: renglones ya confirmados otras veces {clave: {id, ml} | {ignorar: true}}
 * criterio: 'barato' (el costo más bajo entre los que coinciden igual de bien) o 'ultimo' (el de la última lista).
 */
export function armarPropuesta(listas, catalogo, { vinculos = {}, criterio = 'barato' } = {}) {
  const porTamano = new Map();
  const sinPareja = [];
  listas.forEach((lista, orden) => {
    for (const f of lista.filas) {
      const costo = Math.round(f.costo * (1 + (Number(lista.recargo) || 0) / 100) * 100) / 100;
      const clave = claveRenglon(f);
      const renglon = { ...f, costo, lista: lista.nombre, orden, clave };
      const v = vinculos[clave];
      let e = null;
      if (v?.ignorar) continue;
      if (v) {
        const p = catalogo.porId.get(v.id);
        if (p) e = { perfume: p, ml: v.ml, puntaje: 1, seguro: true, sobra: 0, recordado: true };
      } else {
        e = emparejar(f, catalogo);
      }
      if (!e || e.ml === null) {
        sinPareja.push({ renglon, sugerido: e });
        continue;
      }
      const k = `${e.perfume.id}|${e.ml}`;
      if (!porTamano.has(k)) porTamano.set(k, { clave: k, perfume: e.perfume, ml: e.ml, candidatos: [] });
      porTamano.get(k).candidatos.push({ renglon, puntaje: e.puntaje, seguro: e.seguro, sobra: e.sobra, recordado: !!e.recordado });
    }
  });
  const propuestas = [];
  for (const t of porTamano.values()) {
    const c = t.candidatos.sort((a, b) => Number(b.recordado) - Number(a.recordado) || b.puntaje - a.puntaje);
    const mejores = c.filter((x) => x.recordado === c[0].recordado && x.puntaje >= c[0].puntaje - 1e-9);
    mejores.sort(criterio === 'ultimo'
      ? (a, b) => b.renglon.orden - a.renglon.orden || a.renglon.costo - b.renglon.costo
      : (a, b) => a.renglon.costo - b.renglon.costo);
    const elegido = mejores[0];
    // Dos renglones distintos de la misma lista igual de parecidos (ej. Ana Abiyedh Coral y Scarlet): se elige a mano.
    const ambiguo = !elegido.recordado && new Set(mejores.filter((x) => x.renglon.orden === elegido.renglon.orden).map((x) => x.renglon.clave)).size > 1;
    const actual = t.perfume.presentaciones.find((x) => x.ml === t.ml)?.costo ?? null;
    propuestas.push({ ...t, elegido, actual, seguro: elegido.recordado || (elegido.seguro && !ambiguo) });
  }
  propuestas.sort((a, b) => `${a.perfume.marca} ${a.perfume.nombre}`.localeCompare(`${b.perfume.marca} ${b.perfume.nombre}`, 'es') || a.ml - b.ml);
  return { propuestas, sinPareja };
}

// Clave para recordar un renglón del proveedor la próxima vez (aunque cambie el precio).
export function claveRenglon(fila) {
  if (fila.referencia) return `ean:${fila.referencia}`;
  return `desc:${palabras(limpiarDescripcion(fila.descripcion)).join(' ')}`;
}
