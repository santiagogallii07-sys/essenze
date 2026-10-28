import { TIPOS, GENEROS, ESTACIONES, OCASIONES } from './config.js';
import { iniciarPagina, tarjeta, activarTarjetas, escapar } from './interfaz.js';
import { precioDesde, hayInmediata, verEntregaInmediata, enOferta, normalizar, textoBuscable } from './datos.js';
import { icono } from './iconos.js';

const INTENSIDAD_ACORDE = 50;

// Grupos de filtros de selección múltiple. `valores(p)` devuelve los valores del perfume para ese grupo.
const GRUPOS = [
  { clave: 'marca', titulo: 'Marca', valores: (p) => [p.marca] },
  { clave: 'genero', titulo: 'Género', valores: (p) => [p.genero], etiquetas: GENEROS },
  { clave: 'acorde', titulo: 'Acorde principal', valores: (p) => p.acordes.filter((a) => a.intensidad >= INTENSIDAD_ACORDE).map((a) => a.nombre) },
  { clave: 'familia', titulo: 'Familia olfativa', valores: (p) => [p.familia] },
  { clave: 'estacion', titulo: 'Estación', valores: (p) => p.estaciones, etiquetas: ESTACIONES, orden: Object.keys(ESTACIONES) },
  { clave: 'ocasion', titulo: 'Ocasión', valores: (p) => p.ocasiones, etiquetas: OCASIONES, orden: Object.keys(OCASIONES) },
];

const ORDENES = {
  relevancia: 'Destacados',
  'precio-asc': 'Menor precio',
  'precio-desc': 'Mayor precio',
  nombre: 'Nombre (A–Z)',
};

const { perfumes } = await iniciarPagina('catalogo');
const POR_TANDA = 24;
let mostrados = POR_TANDA;
let filtroMarcas = '';
let resultados = [];
const conInmediata = verEntregaInmediata(perfumes);
const textos = new Map(perfumes.map((p) => [p.id, textoBuscable(p)]));

const el = {
  tabs: document.querySelector('[data-tabs]'),
  filtros: document.querySelector('[data-filtros]'),
  lateral: document.querySelector('[data-lateral]'),
  hoja: document.querySelector('[data-hoja]'),
  hojaCuerpo: document.querySelector('[data-hoja-cuerpo]'),
  grilla: document.querySelector('[data-grilla]'),
  vacio: document.querySelector('[data-vacio]'),
  cuenta: document.querySelectorAll('[data-cuenta]'),
  chips: document.querySelector('[data-chips]'),
  buscar: document.querySelector('[data-buscar]'),
  orden: document.querySelector('[data-orden]'),
  abrirFiltros: document.querySelector('[data-abrir-filtros]'),
  titulo: document.querySelector('[data-titulo]'),
  masResultados: document.querySelector('[data-mas-resultados]'),
};

function leerEstado() {
  const u = new URLSearchParams(location.search);
  const multi = (k) => (u.get(k) ? u.get(k).split(',').filter(Boolean) : []);
  const estado = {
    tipo: TIPOS[u.get('tipo')] ? u.get('tipo') : '',
    q: u.get('q') || '',
    oferta: u.get('oferta') === '1',
    stock: conInmediata && u.get('stock') === '1',
    orden: ORDENES[u.get('orden')] ? u.get('orden') : 'relevancia',
  };
  GRUPOS.forEach((g) => { estado[g.clave] = multi(g.clave); });
  return estado;
}

let estado = leerEstado();

function escribirEstado(reemplazar = false) {
  const u = new URLSearchParams();
  if (estado.tipo) u.set('tipo', estado.tipo);
  GRUPOS.forEach((g) => estado[g.clave].length && u.set(g.clave, estado[g.clave].join(',')));
  if (estado.oferta) u.set('oferta', '1');
  if (estado.stock) u.set('stock', '1');
  if (estado.q) u.set('q', estado.q);
  if (estado.orden !== 'relevancia') u.set('orden', estado.orden);
  const url = `${location.pathname}${u.toString() ? `?${u}` : ''}`;
  history[reemplazar ? 'replaceState' : 'pushState'](null, '', url);
}

function cumple(p, excepto) {
  if (excepto !== 'tipo' && estado.tipo && p.tipo !== estado.tipo) return false;
  if (estado.oferta && !enOferta(p)) return false;
  if (estado.stock && !hayInmediata(p)) return false;
  if (estado.q) {
    const t = textos.get(p.id);
    if (!normalizar(estado.q).split(/\s+/).filter(Boolean).every((w) => t.includes(w))) return false;
  }
  for (const g of GRUPOS) {
    if (g.clave === excepto || !estado[g.clave].length) continue;
    const vals = g.valores(p);
    if (!estado[g.clave].some((v) => vals.includes(v))) return false;
  }
  return true;
}

function ordenar(lista) {
  const l = [...lista];
  const porStock = (a, b) => Number(hayInmediata(b)) - Number(hayInmediata(a));
  if (estado.orden === 'precio-asc') l.sort((a, b) => precioDesde(a) - precioDesde(b));
  else if (estado.orden === 'precio-desc') l.sort((a, b) => precioDesde(b) - precioDesde(a));
  else if (estado.orden === 'nombre') l.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  else l.sort((a, b) => porStock(a, b) || Number(!!b.destacado) - Number(!!a.destacado) || Number(enOferta(b)) - Number(enOferta(a)));
  return l;
}

function pintarTabs() {
  const base = perfumes.filter((p) => cumple(p, 'tipo'));
  const opciones = [['', 'Todos'], ...Object.entries(TIPOS)];
  el.tabs.innerHTML = opciones.map(([clave, nombre]) => {
    const n = clave ? base.filter((p) => p.tipo === clave).length : base.length;
    const activo = estado.tipo === clave;
    return `<li><button type="button" class="pestana" data-tipo="${clave}" aria-pressed="${activo}">${nombre}<span>${n}</span></button></li>`;
  }).join('');
  const activa = el.tabs.querySelector('[aria-pressed="true"]');
  if (activa) el.tabs.scrollLeft = activa.parentElement.offsetLeft - el.tabs.offsetLeft - 8;
}

function pintarFiltros() {
  const grupos = GRUPOS.map((g) => {
    const base = perfumes.filter((p) => cumple(p, g.clave));
    const conteo = new Map();
    base.forEach((p) => new Set(g.valores(p)).forEach((v) => conteo.set(v, (conteo.get(v) || 0) + 1)));
    estado[g.clave].forEach((v) => conteo.has(v) || conteo.set(v, 0));
    let valores = [...conteo.keys()];
    if (g.orden) valores.sort((a, b) => g.orden.indexOf(a) - g.orden.indexOf(b));
    else valores.sort((a, b) => a.localeCompare(b, 'es'));
    if (!valores.length) return '';
    const seleccion = estado[g.clave].length;
    const conBuscador = g.clave === 'marca' && valores.length > 12;
    const items = valores.map((v) => {
      const marcado = estado[g.clave].includes(v);
      const n = conteo.get(v);
      const oculto = conBuscador && filtroMarcas && !normalizar(v).includes(normalizar(filtroMarcas)) && !marcado;
      return `<li ${oculto ? 'hidden' : ''} data-texto="${escapar(normalizar(v))}"><label class="opcion ${n === 0 && !marcado ? 'opcion--vacia' : ''}"><input type="checkbox" data-grupo="${g.clave}" value="${escapar(v)}" ${marcado ? 'checked' : ''}><span class="opcion__caja" aria-hidden="true">${icono('check')}</span><span class="opcion__texto">${escapar(g.etiquetas?.[v] || v)}</span><span class="opcion__cuenta">${n}</span></label></li>`;
    }).join('');
    const abierto = seleccion || ['marca', 'genero', 'acorde'].includes(g.clave);
    return `<details class="grupo" ${abierto ? 'open' : ''}><summary>${g.titulo}${seleccion ? `<span class="grupo__marcados">${seleccion}</span>` : ''}${icono('abajo')}</summary>${conBuscador ? `<input class="grupo__buscar" type="search" placeholder="Buscar marca" value="${escapar(filtroMarcas)}" data-buscar-marca aria-label="Buscar marca" enterkeyhint="search">` : ''}<ul class="grupo__opciones ${valores.length > 12 ? 'grupo__opciones--larga' : ''}">${items}</ul></details>`;
  }).join('');

  el.filtros.innerHTML = `
    <div class="interruptores">
      <label class="interruptor"><input type="checkbox" data-bandera="oferta" ${estado.oferta ? 'checked' : ''}><span class="interruptor__pista" aria-hidden="true"></span>Solo ofertas</label>
      ${conInmediata ? `<label class="interruptor"><input type="checkbox" data-bandera="stock" ${estado.stock ? 'checked' : ''}><span class="interruptor__pista" aria-hidden="true"></span>Entrega inmediata</label>` : ''}
    </div>
    ${grupos}`;
}

function pintarChips() {
  const chips = [];
  if (estado.q) chips.push({ texto: `“${estado.q}”`, quitar: () => { estado.q = ''; el.buscar.value = ''; } });
  if (estado.oferta) chips.push({ texto: 'Ofertas', quitar: () => { estado.oferta = false; } });
  if (estado.stock) chips.push({ texto: 'Entrega inmediata', quitar: () => { estado.stock = false; } });
  GRUPOS.forEach((g) => estado[g.clave].forEach((v) => chips.push({
    texto: g.etiquetas?.[v] || v,
    quitar: () => { estado[g.clave] = estado[g.clave].filter((x) => x !== v); },
  })));
  el.chips.hidden = chips.length === 0;
  el.chips.replaceChildren(...chips.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = `${escapar(c.texto)}${icono('cerrar')}`;
    b.setAttribute('aria-label', `Quitar filtro ${c.texto}`);
    b.addEventListener('click', () => { c.quitar(); actualizar(); });
    return b;
  }));
  if (chips.length > 1) {
    const limpiar = document.createElement('button');
    limpiar.type = 'button';
    limpiar.className = 'chip chip--limpiar';
    limpiar.textContent = 'Limpiar todo';
    limpiar.addEventListener('click', limpiarTodo);
    el.chips.append(limpiar);
  }
  const n = chips.length;
  el.abrirFiltros.querySelector('[data-n]').textContent = n ? `(${n})` : '';
}

function limpiarTodo() {
  const tipo = estado.tipo;
  estado = { tipo, q: '', oferta: false, stock: false, orden: estado.orden };
  GRUPOS.forEach((g) => { estado[g.clave] = []; });
  el.buscar.value = '';
  actualizar();
}

function pintarResultados() {
  resultados = ordenar(perfumes.filter((p) => cumple(p)));
  const lista = resultados;
  mostrados = POR_TANDA;
  el.grilla.innerHTML = lista.slice(0, mostrados).map((p) => tarjeta(p)).join('');
  el.masResultados.hidden = lista.length <= mostrados;
  el.vacio.hidden = lista.length > 0;
  const texto = `${lista.length} ${lista.length === 1 ? 'perfume' : 'perfumes'}`;
  el.cuenta.forEach((c) => { c.textContent = texto; });
  el.titulo.textContent = estado.oferta && !estado.tipo ? 'Ofertas' : estado.tipo ? TIPOS[estado.tipo] : 'Catálogo';
  document.title = `${el.titulo.textContent} · Essenze Parfum & Decants`;
}

function actualizar({ historial = true } = {}) {
  if (historial) escribirEstado();
  pintarTabs();
  pintarFiltros();
  pintarChips();
  pintarResultados();
}

/* Eventos */

el.tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tipo]');
  if (!b) return;
  estado.tipo = b.dataset.tipo;
  actualizar();
});

el.filtros.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-buscar-marca]')) return;
  if (t.dataset.grupo) {
    const g = t.dataset.grupo;
    estado[g] = t.checked ? [...estado[g], t.value] : estado[g].filter((v) => v !== t.value);
  } else if (t.dataset.bandera) {
    estado[t.dataset.bandera] = t.checked;
  }
  // Mantener qué grupos estaban abiertos y el foco tras repintar.
  const abiertos = [...el.filtros.querySelectorAll('details[open] summary')].map((s) => s.firstChild.textContent);
  const foco = t.dataset.grupo ? `[data-grupo="${t.dataset.grupo}"][value="${CSS.escape(t.value)}"]` : `[data-bandera="${t.dataset.bandera}"]`;
  actualizar();
  el.filtros.querySelectorAll('details').forEach((d) => {
    if (abiertos.includes(d.querySelector('summary').firstChild.textContent)) d.open = true;
  });
  el.filtros.querySelector(foco)?.focus();
});

let espera = 0;
el.buscar.value = estado.q;
el.buscar.addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    estado.q = el.buscar.value.trim();
    escribirEstado(true);
    pintarTabs();
    pintarFiltros();
    pintarChips();
    pintarResultados();
  }, 180);
});
el.buscar.closest('form').addEventListener('submit', (e) => e.preventDefault());

el.orden.innerHTML = Object.entries(ORDENES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
el.orden.value = estado.orden;
el.orden.addEventListener('change', () => {
  estado.orden = el.orden.value;
  actualizar();
});

document.querySelector('[data-limpiar-vacio]').addEventListener('click', () => {
  estado.tipo = '';
  limpiarTodo();
});

// En celulares los filtros se abren en una hoja; se mueve el mismo bloque para no duplicarlo.
el.abrirFiltros.addEventListener('click', () => {
  el.hojaCuerpo.append(el.filtros);
  el.hoja.showModal();
  requestAnimationFrame(() => el.hoja.classList.add('es-visible'));
});
function cerrarHoja() {
  el.hoja.classList.remove('es-visible');
  setTimeout(() => {
    el.hoja.close();
    el.lateral.append(el.filtros);
  }, 240);
}
el.hoja.addEventListener('click', (e) => {
  if (e.target === el.hoja || e.target.closest('[data-cerrar-hoja]')) cerrarHoja();
});
el.hoja.addEventListener('cancel', (e) => {
  e.preventDefault();
  cerrarHoja();
});

window.addEventListener('popstate', () => {
  estado = leerEstado();
  el.buscar.value = estado.q;
  el.orden.value = estado.orden;
  actualizar({ historial: false });
});

activarTarjetas(el.grilla);

// Búsqueda dentro de la lista de marcas, sin repintar los filtros.
el.filtros.addEventListener('input', (e) => {
  if (!e.target.matches('[data-buscar-marca]')) return;
  filtroMarcas = e.target.value;
  const q = normalizar(filtroMarcas);
  e.target.nextElementSibling.querySelectorAll('li').forEach((li) => {
    li.hidden = !!q && !li.dataset.texto.includes(q) && !li.querySelector('input').checked;
  });
});

// Carga progresiva: se agregan más perfumes al acercarse al final.
function mostrarMas() {
  if (mostrados >= resultados.length) return;
  const desde = mostrados;
  mostrados += POR_TANDA;
  el.grilla.insertAdjacentHTML('beforeend', resultados.slice(desde, mostrados).map((p) => tarjeta(p)).join(''));
  el.masResultados.hidden = mostrados >= resultados.length;
}
el.masResultados.querySelector('button').addEventListener('click', mostrarMas);
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entradas) => {
    if (entradas.some((x) => x.isIntersecting)) mostrarMas();
  }, { rootMargin: '600px 0px' }).observe(el.masResultados);
}
actualizar({ historial: false });
