// Lectura del Excel del catálogo. Funciona con ExcelJS en el navegador (y en Node para pruebas).
// Cada hoja es un tipo de perfume; las filas con N° son perfumes; las filas con la marca repetida son separadores.

const SIN_TILDES = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (t) => SIN_TILDES(t).toLowerCase().trim();

export function slug(texto) {
  return norm(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function valorCelda(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((x) => x.text).join('');
    if ('result' in v) return v.result ?? '';
    if (v.text) return v.text;
    if (v.hyperlink) return v.hyperlink;
    return '';
  }
  return v;
}

export function tipoDeHoja(nombre) {
  const n = norm(nombre);
  const fem = /femen|femin|mujer/.test(n);
  if (n.includes('nicho')) return 'nicho';
  if (n.includes('arabe')) return fem ? 'arabe-femenino' : 'arabe-masculino';
  if (n.includes('disenador') || n.includes('designer')) return fem ? 'disenador-femenino' : 'disenador-masculino';
  return null;
}

const CONCENTRACIONES = [
  [/\bEXTRAIT DE PARFUM\b/, 'Extrait de Parfum'],
  [/\b(EAU DE PARFUM|EDP) INTENSE\b/, 'Eau de Parfum Intense'],
  [/\bEAU DE PARFUM\b|\bEDP\b/, 'Eau de Parfum'],
  [/\b(EAU DE TOILETTE|EDT) INTENSE\b/, 'Eau de Toilette Intense'],
  [/\bEAU DE TOILETTE\b|\bEDT\b/, 'Eau de Toilette'],
  [/\bEAU DE COLOGNE\b|\bEDC\b|\bCOLOGNE\b/, 'Eau de Cologne'],
  [/\bPARFUM\b/, 'Parfum'],
];
const MINUSCULAS = new Set(['de', 'del', 'di', 'du', 'des', 'y', 'et', 'of', 'and', 'en', 'da', 'do']);

function capitalizar(palabra, primera) {
  if (/\d/.test(palabra) || !/[aeiouáéíóúy]/i.test(palabra)) return palabra.toUpperCase();
  const minus = palabra.toLowerCase();
  if (!primera && MINUSCULAS.has(minus)) return minus;
  return minus.replace(/(^|[(\-'’.])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}

// "BLACK SEDUCTION EDT 100ML" → { nombre: "Black Seduction", concentracion: "Eau de Toilette", ml: 100, genero: null }
export function analizarNombre(original) {
  let t = ` ${String(original || '').toUpperCase().replace(/\s+/g, ' ').trim()} `;
  let ml = 0;
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*ML\b/);
  if (m) {
    ml = Math.round(parseFloat(m[1].replace(',', '.')));
    t = t.replace(m[0], ' ');
  }
  let concentracion = '';
  // "LE PARFUM" es parte del nombre (Le Male Le Parfum, I Want Choo Le Parfum).
  if (/LE PARFUM/.test(t)) concentracion = 'Parfum';
  else for (const [re, nombre] of CONCENTRACIONES) {
    if (re.test(t)) {
      concentracion = nombre;
      t = t.replace(re, ' ');
      break;
    }
  }
  let genero = null;
  if (/\b(MASCULINO|MASC)\b/.test(t)) genero = 'hombre';
  if (/\b(FEMENINO|FEMININO|FEM)\b/.test(t)) genero = 'mujer';
  if (/\b(UNISEX|UNISSEX)\b/.test(t)) genero = 'unisex';
  t = t.replace(/\b(MASCULINO|MASC|FEMENINO|FEMININO|FEM|UNISEX|UNISSEX)\b/g, ' ');
  const palabras = t.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const nombre = palabras.map((p, i) => capitalizar(p, i === 0)).join(' ').replace(/\s+([).,])/g, '$1').trim();
  return { nombre: nombre || String(original).trim(), concentracion, ml, genero };
}

// "Bleu de" (el Excel omite la marca) → "Bleu de Chanel"
function completarConMarca(nombre, marca) {
  return /\s(de|du|di|by)$/i.test(nombre) ? `${nombre} ${marca}` : nombre;
}

// Adjetivos del perfil que no son acordes olfativos.
const NO_ACORDES = /^(elegante|versatil|femenin[oa]|masculin[oa]|unisex|complej[oa]|luminos[oa]|envolvente|intens[oa]|suave|modern[oa]|clasic[oa]|sofisticad[oa]|sensual|seductor[a]?|juvenil|potente|refinad[oa]|delicad[oa]|atrevid[oa]|misterios[oa]|ligero|persistente|magnetic[oa]|energetic[oa]|vibrante|nocturn[oa]|diurn[oa]|levemente .*|ligeramente .*|con .*)$/;

export function acordesDePerfil(perfil) {
  const partes = separarLista(perfil);
  if (!partes.length) return [];
  // La primera parte es la familia ("Ámbar especiado") → se separa en dos acordes.
  const primeras = partes[0].split(/\s+/).filter((p) => p.length > 2).map(capitalPrimera);
  const vistos = new Set();
  return [...primeras, ...partes.slice(1)].filter((a) => {
    const k = norm(a);
    if (NO_ACORDES.test(k) || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, 6);
}

function capitalPrimera(t) {
  const s = String(t).trim().replace(/\.$/, '');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

export function separarLista(texto) {
  return String(texto || '')
    .replace(/\.$/, '')
    .split(/,|\s+y\s+|\s+e\s+(?=[aeiou])/i)
    .map(capitalPrimera)
    .filter(Boolean);
}

const FRESCOS = /fresc|acuatic|citric|marin|verde|aromatic|limpi|ligero|herbal|acuoso|ozon|lavanda|floral|frutal/;
const CALIDOS = /ambar|ambarad|especiad|dulce|vainill|oud|cuero|tabac|gourmand|resin|oriental|intens|ahumad|calid|caramel|incienso/;

export function sugerirUso(texto) {
  const t = norm(texto);
  const frescos = (t.match(new RegExp(FRESCOS, 'g')) || []).length;
  const calidos = (t.match(new RegExp(CALIDOS, 'g')) || []).length;
  if (!frescos && !calidos) return { estaciones: [], ocasiones: [] };
  if (frescos > calidos) return { estaciones: ['primavera', 'verano'], ocasiones: ['dia'] };
  if (calidos > frescos) return { estaciones: ['otono', 'invierno'], ocasiones: ['noche'] };
  return { estaciones: ['primavera', 'otono'], ocasiones: ['dia', 'noche'] };
}

function columnas(encabezados) {
  const buscar = (...claves) => encabezados.findIndex((h) => claves.some((c) => norm(h).includes(c)));
  return {
    marca: buscar('marca'),
    perfume: buscar('perfume', 'producto', 'nombre'),
    precio: buscar('precio usd', 'usd', 'precio'),
    perfil: buscar('perfil'),
    notas: buscar('notas'),
    pagina: buscar('pag'),
    fuente: buscar('fuente', 'fragrantica', 'link'),
    foto: buscar('foto', 'imagen'),
  };
}

// Recorre el libro y devuelve las filas de perfumes con su foto (si la hay).
export function leerLibro(libro) {
  let cotizacion = 0;
  const filas = [];
  const hojasIgnoradas = [];
  for (const hoja of libro.worksheets) {
    const tipo = tipoDeHoja(hoja.name);
    if (!tipo) {
      hojasIgnoradas.push(hoja.name);
      continue;
    }
    const fotos = new Map();
    for (const im of hoja.getImages()) {
      const fila = Math.floor(im.range.tl.nativeRow ?? im.range.tl.row) + 1;
      if (!fotos.has(fila)) fotos.set(fila, im.imageId);
    }
    let col = null;
    hoja.eachRow({ includeEmpty: false }, (row, n) => {
      const valores = row.values.slice(1).map(valorCelda);
      if (!cotizacion) {
        const i = valores.findIndex((v) => /cotiz/i.test(String(v)));
        if (i >= 0 && Number(valores[i + 1]) > 0) cotizacion = Number(valores[i + 1]);
      }
      if (!col) {
        if (valores.some((v) => norm(v) === 'marca') && valores.some((v) => /precio/i.test(String(v)))) col = columnas(valores);
        return;
      }
      const marca = String(valores[col.marca] ?? '').trim();
      const texto = String(valores[col.perfume] ?? '').trim();
      const precio = Number(valores[col.precio]);
      if (!marca || !texto || norm(marca) === norm(texto)) return; // separador de marca
      const imageId = fotos.get(n);
      const media = imageId !== undefined ? libro.getImage(imageId) : null;
      filas.push({
        hoja: hoja.name,
        fila: n,
        tipo,
        marca,
        texto,
        precio: Number.isFinite(precio) ? precio : 0,
        perfil: col.perfil >= 0 ? String(valores[col.perfil] ?? '').trim() : '',
        notas: col.notas >= 0 ? String(valores[col.notas] ?? '').trim() : '',
        pagina: col.pagina >= 0 ? String(valores[col.pagina] ?? '').trim() : '',
        fuente: col.fuente >= 0 ? String(valores[col.fuente] ?? '').trim() : '',
        foto: media ? { datos: media.buffer, extension: media.extension } : null,
      });
    });
  }
  return { cotizacion, filas, hojasIgnoradas };
}

// Agrupa filas del mismo perfume (distintos ml) y arma el registro para la base.
export function convertir(filas) {
  const perfumes = new Map();
  const avisos = [];
  for (const f of filas) {
    const a = analizarNombre(f.texto);
    a.nombre = completarConMarca(a.nombre, f.marca);
    const genero = f.tipo.endsWith('masculino') ? 'hombre' : f.tipo.endsWith('femenino') ? 'mujer' : a.genero || 'unisex';
    let base = slug(`${f.marca} ${a.nombre} ${a.concentracion}`);
    // El mismo nombre en otra hoja (ej. versión masculina y femenina) es otro perfume.
    if (perfumes.has(base) && perfumes.get(base).tipo !== f.tipo) base = slug(`${base} ${genero}`);
    let id = base;
    let n = 1;
    // Mismo perfume y mismo tamaño en dos filas: se separa y se marca para revisar.
    while (perfumes.has(id) && perfumes.get(id).presentaciones.some((p) => p.ml === a.ml)) {
      n++;
      id = `${base}-${n}`;
    }
    const familia = separarLista(f.perfil)[0] || '';
    const acordes = acordesDePerfil(f.perfil);
    const uso = sugerirUso(`${f.perfil} ${f.notas}`);
    if (!perfumes.has(id)) {
      perfumes.set(id, {
        id,
        marca: f.marca,
        nombre: a.nombre,
        concentracion: a.concentracion,
        tipo: f.tipo,
        genero,
        familia,
        perfil: capitalPrimera(f.perfil) ? `${capitalPrimera(f.perfil)}.` : '',
        notas: { salida: [], corazon: [], fondo: [], destacadas: separarLista(f.notas) },
        acordes: acordes.map((nombre, i) => ({ nombre, intensidad: Math.max(40, 100 - i * 16) })),
        estaciones: uso.estaciones,
        ocasiones: uso.ocasiones,
        presentaciones: [],
        fuente: f.fuente,
        pagina_catalogo: f.pagina,
        revisar: n > 1 ? `Posible duplicado de ${f.marca} ${a.nombre} (fila ${f.fila} de "${f.hoja}")` : '',
        _foto: f.foto,
        _filas: [],
      });
    }
    const p = perfumes.get(id);
    p.presentaciones.push({ ml: a.ml, precio: f.precio, precioAnterior: null, costo: null, stock: null });
    p._filas.push(`${f.hoja} · fila ${f.fila}`);
    if (!p._foto && f.foto) p._foto = f.foto;
    if (!f.precio) avisos.push(`${f.marca} ${a.nombre}: sin precio (fila ${f.fila} de "${f.hoja}")`);
    if (n > 1) avisos.push(`${f.marca} ${a.nombre} ${a.ml} ml aparece dos veces (fila ${f.fila} de "${f.hoja}")`);
  }
  return { perfumes: [...perfumes.values()], avisos };
}
