// Lista de perfumes con búsqueda, filtros y cambios rápidos (visible / destacado).
import { api } from '../api.js';
import { icono, escapar, usd, precioDoble, miniatura, demorar, avisoError, aviso, TIPOS } from '../ui.js';
import { dialogoDescuento } from './ofertas.js';

const POR_PAGINA = 60;
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const FILTROS = {
  todos: { texto: 'Todos', prueba: () => true },
  visibles: { texto: 'Visibles', prueba: (p) => p.visible },
  ocultos: { texto: 'Ocultos', prueba: (p) => !p.visible },
  sinFoto: { texto: 'Sin foto', prueba: (p) => !p.imagen },
  oferta: { texto: 'En oferta', prueba: (p) => p.presentaciones.some((x) => x.precioAnterior) },
  destacados: { texto: 'Destacados', prueba: (p) => p.destacado },
  sinStock: { texto: 'Sin stock', prueba: (p) => p.presentaciones.every((x) => x.stock === 0) },
  sinAroma: { texto: 'Sin aroma', prueba: (p) => !p.acordes.length },
  revisar: { texto: 'Para revisar', prueba: (p) => !!p.revisar },
};

function precioTexto(p) {
  return p.presentaciones.map((x) => `${x.ml ? `${x.ml} ml ` : ''}<strong>${precioDoble(x.precio)}</strong>${x.precioAnterior ? ` <s>${usd(x.precioAnterior)}</s>` : ''}${x.stock !== null && x.stock !== undefined ? ` · ${x.stock === 0 ? 'agotado' : `stock ${x.stock}`}` : ''}`).join(' · ');
}

function fila(p) {
  return `
    <li class="item-perfume ${p.visible ? '' : 'es-oculto'}" data-id="${escapar(p.id)}">
      <a class="item-perfume__enlace" href="#/perfumes/${encodeURIComponent(p.id)}" aria-label="Editar ${escapar(p.marca)} ${escapar(p.nombre)}">
        ${miniatura(p)}
        <span class="item-perfume__texto">
          <span class="item-perfume__marca">${escapar(p.marca)}</span>
          <span class="item-perfume__nombre">${escapar(p.nombre)}</span>
          <span class="item-perfume__detalle">${precioTexto(p)}</span>
          ${p.revisar ? `<span class="marca-revisar">${icono('alerta')}${escapar(p.revisar)}</span>` : ''}
        </span>
      </a>
      <span class="item-perfume__acciones">
        <button class="boton-icono ${p.destacado ? 'es-activo' : ''}" type="button" data-accion="destacado" aria-pressed="${p.destacado}" aria-label="${p.destacado ? 'Quitar de destacados' : 'Destacar en el inicio'}">${icono('estrella')}</button>
        <button class="boton-icono ${p.visible ? '' : 'es-activo'}" type="button" data-accion="visible" aria-pressed="${!p.visible}" aria-label="${p.visible ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}">${icono(p.visible ? 'ojo' : 'ojoNo')}</button>
      </span>
    </li>`;
}

export async function montar({ vista, consulta, app }) {
  app.titulo('Perfumes');
  const nuevo = document.createElement('a');
  nuevo.className = 'boton boton--lleno boton--chico';
  nuevo.href = '#/perfumes/nuevo';
  nuevo.innerHTML = `${icono('mas')}<span>Nuevo</span>`;
  const descuento = document.createElement('button');
  descuento.className = 'boton-icono';
  descuento.type = 'button';
  descuento.setAttribute('aria-label', 'Precios y descuentos');
  descuento.innerHTML = icono('porcentaje');
  app.acciones([descuento, nuevo]);

  let perfumes = await api('/perfumes');
  const estado = {
    q: sessionStorage.getItem('admin-perfumes-q') || '',
    filtro: FILTROS[consulta.get('filtro')] ? consulta.get('filtro') : sessionStorage.getItem('admin-perfumes-filtro') || 'todos',
    tipo: sessionStorage.getItem('admin-perfumes-tipo') || '',
    mostrar: POR_PAGINA,
  };

  if (!perfumes.length) {
    vista.innerHTML = `
      <div class="vacio-admin">
        ${icono('frasco')}
        <p>Todavía no hay perfumes cargados.</p>
        <p class="vacio-admin__detalle">Importá el Excel del catálogo y se cargan todos con sus fotos, o creá uno a mano.</p>
        <a class="boton boton--lleno" href="#/importar">${icono('tabla')} Importar Excel</a>
        <a class="boton boton--contorno" href="#/perfumes/nuevo">Crear un perfume</a>
      </div>`;
    return undefined;
  }

  vista.innerHTML = `
    <div class="herramientas-admin">
      <label class="buscador-admin">
        ${icono('buscar')}
        <input class="entrada" type="search" placeholder="Buscar marca, nombre o nota" value="${escapar(estado.q)}" data-q enterkeyhint="search" aria-label="Buscar perfumes">
      </label>
      <select class="entrada" data-tipo aria-label="Tipo">
        <option value="">Todos los tipos</option>
        ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${estado.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <div class="chips-admin" data-filtros role="group" aria-label="Filtros"></div>
    </div>
    <p class="contador-resultados" data-contador aria-live="polite"></p>
    <ul class="lista-perfumes" data-lista></ul>
    <div class="ver-mas" data-ver-mas hidden><button class="boton boton--suave" type="button">Ver más</button></div>`;

  const lista = vista.querySelector('[data-lista]');
  const textos = new Map();
  const texto = (p) => {
    if (!textos.has(p.id)) textos.set(p.id, norm(`${p.marca} ${p.nombre} ${p.concentracion} ${p.familia} ${p.notas?.destacadas?.join(' ') || ''} ${p.id}`));
    return textos.get(p.id);
  };

  function filtrados() {
    const palabras = norm(estado.q).split(/\s+/).filter(Boolean);
    return perfumes.filter((p) => (!estado.tipo || p.tipo === estado.tipo)
      && FILTROS[estado.filtro].prueba(p)
      && palabras.every((w) => texto(p).includes(w)));
  }

  function pintarFiltros() {
    const base = perfumes.filter((p) => !estado.tipo || p.tipo === estado.tipo);
    vista.querySelector('[data-filtros]').innerHTML = Object.entries(FILTROS).map(([k, f]) => {
      const n = base.filter(f.prueba).length;
      if (!n && k !== 'todos' && k !== estado.filtro) return '';
      return `<button class="chip-admin" type="button" data-filtro="${k}" aria-pressed="${estado.filtro === k}">${f.texto}<span>${n}</span></button>`;
    }).join('');
  }

  function pintar() {
    sessionStorage.setItem('admin-perfumes-q', estado.q);
    sessionStorage.setItem('admin-perfumes-filtro', estado.filtro);
    sessionStorage.setItem('admin-perfumes-tipo', estado.tipo);
    const r = filtrados();
    vista.querySelector('[data-contador]').textContent = `${r.length} ${r.length === 1 ? 'perfume' : 'perfumes'}`;
    lista.innerHTML = r.slice(0, estado.mostrar).map(fila).join('') || '<li class="vacio-admin"><p>No hay perfumes con esa búsqueda.</p></li>';
    vista.querySelector('[data-ver-mas]').hidden = r.length <= estado.mostrar;
    pintarFiltros();
  }

  vista.querySelector('[data-q]').addEventListener('input', demorar((e) => {
    estado.q = e.target.value;
    estado.mostrar = POR_PAGINA;
    pintar();
  }, 160));
  vista.querySelector('[data-tipo]').addEventListener('change', (e) => {
    estado.tipo = e.target.value;
    estado.mostrar = POR_PAGINA;
    pintar();
  });
  vista.querySelector('[data-filtros]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    estado.mostrar = POR_PAGINA;
    pintar();
  });
  vista.querySelector('[data-ver-mas] button').addEventListener('click', () => {
    estado.mostrar += POR_PAGINA;
    pintar();
  });

  lista.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const li = b.closest('[data-id]');
    const p = perfumes.find((x) => x.id === li.dataset.id);
    const campo = b.dataset.accion;
    const valor = !p[campo];
    b.disabled = true;
    try {
      await api(`/perfumes/${encodeURIComponent(p.id)}`, { metodo: 'PATCH', datos: { [campo]: valor } });
      p[campo] = valor;
      li.outerHTML = fila(p);
      aviso(campo === 'visible' ? (valor ? 'Visible en la tienda' : 'Oculto de la tienda') : valor ? 'Destacado en el inicio' : 'Quitado de destacados');
      pintarFiltros();
    } catch (err) {
      avisoError(err);
      b.disabled = false;
    }
  });

  descuento.addEventListener('click', async () => {
    const r = filtrados();
    const hecho = await dialogoDescuento({ perfumes, seleccion: estado.q || estado.tipo || estado.filtro !== 'todos' ? r : null });
    if (hecho) {
      perfumes = await api('/perfumes');
      textos.clear();
      pintar();
    }
  });

  pintar();
  return undefined;
}
