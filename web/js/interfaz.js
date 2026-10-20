// Partes compartidas por todas las páginas: cabecera, pie, bolsa de compras,
// pedido por WhatsApp, buscador, avisos y tarjetas de producto.
import { CONFIG, TIPOS } from './config.js';
import { icono, iconoWhatsapp } from './iconos.js';
import { frascoSVG } from './frasco.js';
import { arrastrarParaCerrar } from './arrastre.js';
import * as carrito from './carrito.js';
import {
  obtenerCatalogo, precio, precioArs, precioDesde, hayStock, enOferta, descuentoMaximo,
  presentacionesOrdenadas, enlacePerfume, disponible, maximoDe, textoMl,
} from './datos.js';

const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
const esCelular = () => window.matchMedia('(max-width: 860px)').matches;

export function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Foto del perfume (recortada o completa) o, si no tiene, la ilustración del frasco.
export function imagenPerfume(p, { clase = '', perezosa = true } = {}) {
  if (p.imagen) {
    const tipo = p.fondo === 'recorte' || p.imagen_fondo === 'recorte' ? 'foto--recorte' : 'foto--completa';
    return `<img class="foto ${tipo} ${clase}" src="/foto/${escapar(p.imagen)}" alt="${escapar(`${p.marca} ${p.nombre}`)}" ${perezosa ? 'loading="lazy"' : ''} decoding="async" draggable="false">`;
  }
  return frascoSVG(p, { clase });
}

/* ---------- Cabecera y pie ---------- */

const NAV = [
  { id: 'inicio', texto: 'Inicio', href: '/' },
  { id: 'catalogo', texto: 'Catálogo', href: '/catalogo' },
  { id: 'ofertas', texto: 'Ofertas', href: '/catalogo?oferta=1' },
  { id: 'contacto', texto: 'Contacto', href: '#contacto' },
];

function cabecera(pagina) {
  const enlaces = NAV.map((n) => `<li><a href="${n.href}" ${n.id === pagina ? 'aria-current="page"' : ''}>${n.texto}</a></li>`).join('');
  return `
  <div class="cabecera__barra contenedor">
    <button class="boton-icono cabecera__menu" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="menu-movil">${icono('menu')}</button>
    <a class="marca" href="/" aria-label="Essenze, inicio">
      <img class="marca__simbolo" src="/img/logo-marca.png" alt="" width="46" height="44">
      <span class="marca__texto"><span class="marca__nombre">Essenze</span><span class="marca__sub">Parfum &amp; Decants</span></span>
    </a>
    <nav class="cabecera__nav" aria-label="Principal"><ul>${enlaces}</ul></nav>
    <div class="cabecera__acciones">
      <button class="boton-icono" type="button" data-abrir-busqueda aria-label="Buscar perfumes">${icono('buscar')}</button>
      <button class="boton-icono boton-bolsa" type="button" data-abrir-bolsa aria-label="Abrir bolsa de compras">
        ${icono('bolsa')}<span class="boton-bolsa__cantidad" data-cantidad-bolsa hidden>0</span>
      </button>
    </div>
  </div>
  <nav class="menu-movil" id="menu-movil" aria-label="Menú" hidden><ul>${enlaces}</ul></nav>`;
}

function formatoTelefono(n) {
  return `+${n.replace(/^(\d{2})(\d)(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4-$5')}`;
}

function pie() {
  const wa = `https://wa.me/${CONFIG.whatsapp}`;
  const tipos = Object.entries(TIPOS).map(([k, v]) => `<li><a href="/catalogo?tipo=${k}">${v}</a></li>`).join('');
  return `
  <div class="contenedor pie__grilla">
    <div class="pie__marca">
      <img src="/img/logo-completo.png" alt="Essenze Parfum &amp; Decants" width="220" height="267" loading="lazy">
    </div>
    <div>
      <h2 class="pie__titulo">Catálogo</h2>
      <ul class="pie__lista">${tipos}<li><a href="/catalogo?oferta=1">Ofertas</a></li></ul>
    </div>
    <div>
      <h2 class="pie__titulo">Contacto</h2>
      <ul class="pie__lista">
        <li><a class="pie__wa" href="${wa}" target="_blank" rel="noopener">${iconoWhatsapp()}<span>${formatoTelefono(CONFIG.whatsapp)}</span></a></li>
        <li class="pie__lugar">${icono('ubicacion')}<span>${escapar(CONFIG.ciudad)}</span></li>
        ${CONFIG.instagram ? `<li><a class="pie__wa" href="https://instagram.com/${escapar(CONFIG.instagram)}" target="_blank" rel="noopener">${icono('instagram')}<span>@${escapar(CONFIG.instagram)}</span></a></li>` : ''}
      </ul>
      <p class="pie__nota">Pedidos y consultas por WhatsApp. El pago y la entrega se coordinan con vos.</p>
    </div>
  </div>
  <div class="contenedor pie__legal">
    <p>© ${new Date().getFullYear()} Essenze Parfum &amp; Decants · Precios en dólares estadounidenses (USD)${CONFIG.mostrarArs && CONFIG.cotizacion ? '. Los precios en pesos son de referencia' : ''}.</p>
  </div>`;
}

/* ---------- Avisos ---------- */

let zonaAvisos;
export function aviso(texto, accion) {
  if (!zonaAvisos) {
    zonaAvisos = document.createElement('div');
    zonaAvisos.className = 'avisos';
    zonaAvisos.setAttribute('role', 'status');
    zonaAvisos.setAttribute('aria-live', 'polite');
  }
  // Si hay un diálogo abierto (bolsa), el aviso va adentro para quedar por encima del fondo.
  const destino = document.querySelector('dialog[open]') || document.body;
  if (zonaAvisos.parentElement !== destino) destino.append(zonaAvisos);
  const el = document.createElement('div');
  el.className = 'aviso';
  el.innerHTML = `${icono('check')}<span>${escapar(texto)}</span>`;
  if (accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aviso__accion';
    b.textContent = accion.texto;
    b.addEventListener('click', () => { accion.alHacer(); el.remove(); });
    el.append(b);
  }
  zonaAvisos.append(el);
  setTimeout(() => el.classList.add('es-saliente'), 3400);
  setTimeout(() => el.remove(), 3800);
}

/* ---------- Bolsa de compras y pedido ---------- */

let bolsa;
let perfumesPorId = new Map();

function abrirBolsa(paso = 'items') {
  mostrarPaso(paso);
  if (!bolsa.open) bolsa.showModal();
  requestAnimationFrame(() => bolsa.classList.add('es-visible'));
}

function cerrarBolsa() {
  bolsa.classList.remove('es-visible');
  setTimeout(() => bolsa.open && bolsa.close(), 300);
}

function mostrarPaso(paso) {
  bolsa.dataset.paso = paso;
  bolsa.querySelectorAll('[data-paso]').forEach((el) => { el.hidden = el.dataset.paso !== paso; });
  const titulos = { items: 'Tu bolsa', datos: 'Tus datos', enviado: 'Pedido listo' };
  bolsa.querySelector('.bolsa__titulo').textContent = titulos[paso];
  const foco = bolsa.querySelector(`[data-paso="${paso}"] [data-foco]`);
  if (foco && !esCelular()) setTimeout(() => foco.focus(), 30);
}

function lineasBolsa() {
  return carrito.obtenerItems()
    .map((i) => {
      const p = perfumesPorId.get(i.id);
      const pres = p?.presentaciones.find((x) => x.ml === i.ml);
      return p && pres ? { ...i, p, pres, subtotal: pres.precio * i.cantidad } : null;
    })
    .filter(Boolean);
}

function pintarBolsa() {
  const lineas = lineasBolsa();
  const lista = bolsa.querySelector('.bolsa__lista');
  const vacia = bolsa.querySelector('.bolsa__vacia');
  const pieItems = bolsa.querySelector('.bolsa__pie');
  const total = lineas.reduce((n, l) => n + l.subtotal, 0);

  vacia.hidden = lineas.length > 0;
  pieItems.hidden = lineas.length === 0;
  lista.innerHTML = lineas.map((l) => `
    <li class="linea" data-id="${escapar(l.p.id)}" data-ml="${l.ml}">
      <a class="linea__imagen" href="${enlacePerfume(l.p)}" tabindex="-1" aria-hidden="true">${imagenPerfume(l.p)}</a>
      <div class="linea__info">
        <p class="linea__marca">${escapar(l.p.marca)}</p>
        <a class="linea__nombre" href="${enlacePerfume(l.p)}">${escapar(l.p.nombre)}</a>
        <p class="linea__detalle">${textoMl(l.ml)} · ${precio(l.pres.precio)}</p>
        <div class="linea__controles">
          <div class="cantidad" role="group" aria-label="Cantidad de ${escapar(l.p.nombre)}">
            <button type="button" data-accion="menos" aria-label="Quitar uno">${icono('menos')}</button>
            <output aria-live="polite">${l.cantidad}</output>
            <button type="button" data-accion="mas" aria-label="Agregar uno" ${l.cantidad >= maximoDe(l.pres) ? 'disabled' : ''}>${icono('mas')}</button>
          </div>
          <button type="button" class="linea__quitar" data-accion="quitar">Quitar</button>
        </div>
      </div>
      <p class="linea__subtotal">${precio(l.subtotal)}</p>
    </li>`).join('');

  const ars = precioArs(total);
  bolsa.querySelectorAll('[data-total]').forEach((el) => { el.textContent = precio(total); });
  bolsa.querySelectorAll('[data-total-ars]').forEach((el) => { el.textContent = ars ? `≈ ${ars}` : ''; });
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0);
  bolsa.querySelector('[data-resumen]').textContent = `${unidades} ${unidades === 1 ? 'perfume' : 'perfumes'}`;
}

function pintarContador() {
  const lineas = lineasBolsa();
  const n = lineas.reduce((a, l) => a + l.cantidad, 0);
  const total = lineas.reduce((a, l) => a + l.subtotal, 0);
  document.querySelectorAll('[data-cantidad-bolsa]').forEach((el) => {
    el.textContent = n;
    el.hidden = n === 0;
  });
  document.querySelectorAll('[data-abrir-bolsa]').forEach((b) => {
    if (b.classList.contains('boton-bolsa')) b.setAttribute('aria-label', n ? `Abrir bolsa de compras, ${n} ${n === 1 ? 'perfume' : 'perfumes'}` : 'Abrir bolsa de compras');
  });
  const pildora = document.querySelector('[data-pildora-bolsa]');
  if (pildora) {
    pildora.querySelector('[data-pildora-texto]').textContent = `${n} ${n === 1 ? 'perfume' : 'perfumes'} · ${precio(total)}`;
    pildora.classList.toggle('es-visible', n > 0);
  }
}

function numeroPedido() {
  const d = new Date(Date.now() - 3 * 3600_000).toISOString().slice(2, 10).replace(/-/g, '');
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => abc[b % abc.length]).join('');
  return `E-${d}-${azar}`;
}

export function mensajePedido(datos, lineas, numero) {
  const total = lineas.reduce((n, l) => n + l.subtotal, 0);
  const ars = precioArs(total);
  const renglones = lineas.map((l) => `• ${l.cantidad} × ${l.p.marca} ${l.p.nombre}${l.p.concentracion ? ` (${l.p.concentracion})` : ''} – ${textoMl(l.ml)} – ${precio(l.subtotal)}${l.cantidad > 1 ? ` (${precio(l.pres.precio)} c/u)` : ''}`);
  return [
    `Hola Essenze! Quiero hacer este pedido:`,
    ``,
    `*Pedido ${numero}*`,
    ...renglones,
    ``,
    `*Total: ${precio(total)}*${ars ? ` (≈ ${ars})` : ''}`,
    ``,
    `*Mis datos*`,
    `Nombre: ${datos.nombre}`,
    `Email: ${datos.email}`,
    `Teléfono: ${datos.telefono}`,
    ...(datos.comentario ? [`Comentario: ${datos.comentario}`] : []),
  ].join('\n');
}

export function enlaceWhatsapp(texto) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`;
}

function validar(form) {
  const reglas = {
    nombre: (v) => (v.trim().length >= 2 ? '' : 'Escribí tu nombre y apellido.'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Revisá el email: falta algo (ej. nombre@gmail.com).'),
    telefono: (v) => (v.replace(/\D/g, '').length >= 8 ? '' : 'Escribí tu número con código de área (ej. 351 555 1234).'),
  };
  let primero = null;
  for (const [campo, regla] of Object.entries(reglas)) {
    const input = form.elements[campo];
    const error = regla(input.value);
    const msj = form.querySelector(`[data-error="${campo}"]`);
    msj.textContent = error;
    input.setAttribute('aria-invalid', error ? 'true' : 'false');
    if (error && !primero) primero = input;
  }
  if (primero) primero.focus();
  return !primero;
}

// Guarda el pedido en el panel sin demorar la apertura de WhatsApp.
function guardarPedido(numero, datos, lineas) {
  try {
    fetch('/api/pedidos', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, ...datos, sitio: datos.sitio || '', items: lineas.map((l) => ({ id: l.p.id, ml: l.ml, cantidad: l.cantidad })) }),
    }).catch(() => {});
  } catch { /* sin conexión: el pedido igual llega por WhatsApp */ }
}

function montarBolsa() {
  bolsa = document.createElement('dialog');
  bolsa.className = 'bolsa';
  bolsa.setAttribute('aria-labelledby', 'bolsa-titulo');
  const cliente = carrito.datosCliente();
  bolsa.innerHTML = `
    <div class="bolsa__panel" tabindex="-1" autofocus>
      <header class="bolsa__cabecera">
        <span class="bolsa__asa" aria-hidden="true"></span>
        <button class="boton-icono bolsa__volver" type="button" data-volver aria-label="Volver a la bolsa">${icono('flechaIzq')}</button>
        <h2 class="bolsa__titulo" id="bolsa-titulo">Tu bolsa</h2>
        <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button>
      </header>

      <section class="bolsa__cuerpo" data-paso="items">
        <div class="bolsa__vacia">
          <p class="bolsa__vacia-titulo">Tu bolsa está vacía</p>
          <p>Mirá el catálogo y agregá los perfumes que te gusten.</p>
          <a class="boton boton--contorno" href="/catalogo" data-foco>Ver catálogo</a>
        </div>
        <ul class="bolsa__lista"></ul>
        <footer class="bolsa__pie">
          <div class="bolsa__total"><span>Total · <span data-resumen></span></span><strong data-total></strong></div>
          <p class="bolsa__ars" data-total-ars></p>
          <p class="bolsa__nota">No pagás nada ahora: el pago y la entrega se coordinan por WhatsApp.</p>
          <button class="boton boton--lleno boton--ancho" type="button" data-continuar data-foco>Continuar pedido ${icono('flecha')}</button>
        </footer>
      </section>

      <section class="bolsa__cuerpo" data-paso="datos" hidden>
        <form class="formulario" novalidate>
          <p class="formulario__intro">Con estos datos armamos tu pedido y te respondemos por WhatsApp.</p>
          <div class="campo">
            <label for="f-nombre">Nombre y apellido</label>
            <input id="f-nombre" name="nombre" autocomplete="name" autocapitalize="words" enterkeyhint="next" required value="${escapar(cliente.nombre)}" data-foco aria-describedby="e-nombre">
            <p class="campo__error" id="e-nombre" data-error="nombre"></p>
          </div>
          <div class="campo">
            <label for="f-email">Email</label>
            <input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" enterkeyhint="next" required value="${escapar(cliente.email)}" aria-describedby="e-email">
            <p class="campo__error" id="e-email" data-error="email"></p>
          </div>
          <div class="campo">
            <label for="f-telefono">Teléfono</label>
            <input id="f-telefono" name="telefono" type="tel" autocomplete="tel" inputmode="tel" enterkeyhint="next" required placeholder="Ej: 351 555 1234" value="${escapar(cliente.telefono)}" aria-describedby="e-telefono">
            <p class="campo__error" id="e-telefono" data-error="telefono"></p>
          </div>
          <div class="campo">
            <label for="f-comentario">Comentario <span class="campo__opcional">(opcional)</span></label>
            <textarea id="f-comentario" name="comentario" rows="3" enterkeyhint="send" placeholder="¿Retirás o preferís envío? ¿Es para regalo?"></textarea>
          </div>
          <input class="trampa" name="sitio" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="bolsa__total"><span>Total</span><strong data-total></strong></div>
          <p class="bolsa__ars" data-total-ars></p>
          <button class="boton boton--whatsapp boton--ancho" type="submit">${iconoWhatsapp()} Enviar pedido por WhatsApp</button>
        </form>
      </section>

      <section class="bolsa__cuerpo bolsa__enviado" data-paso="enviado" hidden>
        <div class="enviado__sello">${iconoWhatsapp()}</div>
        <p class="enviado__titulo">Abrimos WhatsApp con tu pedido</p>
        <p>Solo falta que toques <strong>enviar</strong> en WhatsApp. Te respondemos para coordinar el pago y la entrega.</p>
        <p class="enviado__numero">Pedido <span data-numero></span></p>
        <a class="enlace-dorado" data-reabrir target="_blank" rel="noopener">¿No se abrió? Tocá acá</a>
        <div class="enviado__acciones">
          <button class="boton boton--lleno boton--ancho" type="button" data-vaciar data-foco>Ya lo envié · vaciar bolsa</button>
          <button class="boton boton--contorno boton--ancho" type="button" data-cerrar>Seguir mirando</button>
        </div>
      </section>
    </div>`;
  document.body.append(bolsa);
  arrastrarParaCerrar(bolsa.querySelector('.bolsa__panel'), bolsa.querySelector('.bolsa__cabecera'), () => {
    bolsa.classList.remove('es-visible');
    bolsa.close();
  });

  bolsa.addEventListener('click', (e) => {
    if (e.target === bolsa) return cerrarBolsa();
    if (e.target.closest('[data-cerrar]')) return cerrarBolsa();
    if (e.target.closest('[data-volver]')) return mostrarPaso('items');
    if (e.target.closest('[data-continuar]')) return mostrarPaso('datos');
    if (e.target.closest('[data-vaciar]')) {
      carrito.vaciar();
      cerrarBolsa();
      aviso('¡Gracias! Tu bolsa quedó vacía.');
      return undefined;
    }
    const boton = e.target.closest('[data-accion]');
    if (!boton) return undefined;
    const li = boton.closest('.linea');
    const id = li.dataset.id;
    const ml = Number(li.dataset.ml);
    const actual = carrito.cantidadDe(id, ml);
    const pres = perfumesPorId.get(id)?.presentaciones.find((x) => x.ml === ml);
    const max = pres ? maximoDe(pres) : actual + 1;
    if (boton.dataset.accion === 'mas') carrito.cambiarCantidad(id, ml, Math.min(actual + 1, max));
    if (boton.dataset.accion === 'menos') carrito.cambiarCantidad(id, ml, actual - 1);
    if (boton.dataset.accion === 'quitar') {
      carrito.quitar(id, ml);
      aviso('Quitaste un perfume', { texto: 'Deshacer', alHacer: () => carrito.agregar(id, ml, actual, max) });
    }
    return undefined;
  });

  bolsa.addEventListener('cancel', (e) => {
    e.preventDefault();
    cerrarBolsa();
  });

  bolsa.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validar(form)) return;
    const lineas = lineasBolsa();
    if (!lineas.length) {
      mostrarPaso('items');
      return;
    }
    const datos = Object.fromEntries(['nombre', 'email', 'telefono', 'comentario', 'sitio'].map((k) => [k, form.elements[k].value.trim()]));
    carrito.recordarCliente(datos);
    const numero = numeroPedido();
    const url = enlaceWhatsapp(mensajePedido(datos, lineas, numero));
    bolsa.querySelector('[data-numero]').textContent = numero;
    bolsa.querySelector('[data-reabrir]').href = url;
    // WhatsApp se abre en el mismo toque (si no, el navegador lo bloquea); el guardado va en paralelo.
    window.open(url, '_blank', 'noopener');
    guardarPedido(numero, datos, lineas);
    mostrarPaso('enviado');
  });

  bolsa.querySelector('form').addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') {
      e.target.setAttribute('aria-invalid', 'false');
      bolsa.querySelector(`[data-error="${e.target.name}"]`).textContent = '';
    }
  });
}

function montarPildora() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pildora-bolsa';
  b.dataset.pildoraBolsa = '';
  b.dataset.abrirBolsa = '';
  b.innerHTML = `${icono('bolsa')}<span data-pildora-texto></span><span class="pildora-bolsa__ver">Ver</span>`;
  document.body.append(b);
}

/* ---------- Agregar a la bolsa ---------- */

// El frasco "vuela" desde donde se tocó hasta la bolsa de la cabecera.
function volarALaBolsa(origen) {
  if (reducido.matches || !origen) return;
  const destino = document.querySelector('.cabecera .boton-bolsa');
  const img = origen.querySelector('img.foto, svg.frasco') || origen;
  if (!destino || !img) return;
  const a = img.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  if (!a.width || a.bottom < 0 || a.top > innerHeight) return;
  const clon = img.cloneNode(true);
  clon.removeAttribute('loading');
  clon.classList.add('vuelo');
  Object.assign(clon.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.append(clon);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const escala = Math.max(0.08, 28 / Math.max(a.width, a.height));
  clon.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 60}px) scale(${(1 + escala) / 2})`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${escala})`, opacity: 0.2 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
  ).finished.then(() => clon.remove(), () => clon.remove());
}

export function agregarABolsa(p, ml, cantidad = 1, origen = null) {
  const pres = p.presentaciones.find((x) => x.ml === ml);
  if (!pres || !disponible(pres)) return false;
  const max = maximoDe(pres);
  const yaHay = carrito.cantidadDe(p.id, ml);
  if (yaHay >= max) {
    aviso(`No hay más stock de ${p.nombre} ${textoMl(ml)}`);
    return false;
  }
  carrito.agregar(p.id, ml, cantidad, max);
  volarALaBolsa(origen);
  if (navigator.userActivation?.isActive) navigator.vibrate?.(12);
  aviso(`${p.nombre} · ${textoMl(ml)} en tu bolsa`, { texto: 'Ver bolsa', alHacer: () => abrirBolsa() });
  setTimeout(() => {
    document.querySelectorAll('.boton-bolsa').forEach((b) => {
      b.classList.remove('es-latido');
      void b.offsetWidth;
      b.classList.add('es-latido');
    });
  }, reducido.matches ? 0 : 560);
  return true;
}

/* ---------- Tarjeta de producto ---------- */

export function tarjeta(p, { revelar = false } = {}) {
  const pres = presentacionesOrdenadas(p);
  const conStock = hayStock(p);
  const oferta = enOferta(p);
  const desc = descuentoMaximo(p);
  const disponibles = pres.filter(disponible);
  const masBarato = (disponibles.length ? disponibles : pres).reduce((a, b) => (b.precio < a.precio ? b : a));
  const unico = pres.length === 1;
  const sello = !conStock ? '<span class="sello sello--apagado">Sin stock</span>' : oferta ? `<span class="sello">−${desc}%</span>` : '';
  const tamanos = pres.map((x) => `<button type="button" class="tamano-rapido" data-ml="${x.ml}" ${disponible(x) ? '' : 'disabled'}><span>${textoMl(x.ml)}</span><span>${disponible(x) ? precio(x.precio) : 'Sin stock'}</span></button>`).join('');
  const ars = precioArs(precioDesde(p));

  return `
  <article class="tarjeta ${conStock ? '' : 'tarjeta--sin-stock'} ${revelar ? 'revelar' : ''}" data-id="${escapar(p.id)}">
    <a class="tarjeta__enlace" href="${enlacePerfume(p)}">
      <div class="tarjeta__imagen ${p.imagen && p.fondo !== 'recorte' ? 'tarjeta__imagen--foto' : ''}">${sello}${imagenPerfume(p)}<span class="tarjeta__destello" aria-hidden="true"></span></div>
      <div class="tarjeta__cuerpo">
        <p class="tarjeta__marca">${escapar(p.marca)}</p>
        <h3 class="tarjeta__nombre">${escapar(p.nombre)}</h3>
        <p class="tarjeta__detalle">${[p.concentracion, pres.some((x) => x.ml) ? `${pres.map((x) => x.ml || '—').join(' / ')} ml` : ''].filter(Boolean).map(escapar).join(' · ')}</p>
      </div>
    </a>
    <div class="tarjeta__pie">
      <p class="tarjeta__precio">${unico ? '' : '<span class="tarjeta__desde">desde</span>'}${precio(precioDesde(p))}${masBarato.precioAnterior && masBarato.precioAnterior > masBarato.precio ? ` <s>${precio(masBarato.precioAnterior)}</s>` : ''}${ars ? `<span class="tarjeta__ars">≈ ${ars}</span>` : ''}</p>
      ${conStock
        ? `<button type="button" class="boton-circular" data-agregar aria-label="Agregar ${escapar(p.nombre)} a la bolsa" ${unico ? '' : 'aria-expanded="false"'}>${icono('mas')}</button>`
        : `<a class="boton-circular" href="${enlaceWhatsapp(`Hola! ¿Va a volver a entrar ${p.marca} ${p.nombre}?`)}" target="_blank" rel="noopener" aria-label="Consultar por ${escapar(p.nombre)} por WhatsApp">${iconoWhatsapp()}</a>`}
    </div>
    ${unico ? '' : `<div class="tarjeta__tamanos" hidden><p>Elegí el tamaño</p>${tamanos}</div>`}
  </article>`;
}

// Al tocar una tarjeta, su foto se transforma en la de la ficha (View Transitions entre páginas).
function prepararTransicion(enlace) {
  const art = enlace.closest('.tarjeta');
  const img = art?.querySelector('.tarjeta__imagen img.foto');
  document.querySelectorAll('[style*="view-transition-name"]').forEach((el) => { el.style.viewTransitionName = ''; });
  if (!img) {
    sessionStorage.removeItem('essenze-transicion');
    return;
  }
  img.style.viewTransitionName = 'foto-perfume';
  try {
    sessionStorage.setItem('essenze-transicion', JSON.stringify({ id: art.dataset.id, src: img.getAttribute('src'), recorte: img.classList.contains('foto--recorte') }));
  } catch { /* almacenamiento bloqueado */ }
}

// Delegación de eventos para las tarjetas dentro de `raiz`.
export function activarTarjetas(raiz) {
  raiz.addEventListener('click', (e) => {
    const enlace = e.target.closest('.tarjeta__enlace');
    if (enlace) prepararTransicion(enlace);
    const art = e.target.closest('.tarjeta');
    if (!art) return;
    const p = perfumesPorId.get(art.dataset.id);
    if (!p) return;
    const boton = e.target.closest('[data-agregar]');
    const tam = e.target.closest('.tamano-rapido');
    const imagen = art.querySelector('.tarjeta__imagen');
    if (boton) {
      e.preventDefault();
      if (p.presentaciones.length === 1) {
        agregarABolsa(p, p.presentaciones[0].ml, 1, imagen);
        return;
      }
      const panel = art.querySelector('.tarjeta__tamanos');
      const abrir = panel.hidden;
      raiz.querySelectorAll('.tarjeta__tamanos').forEach((x) => { x.hidden = true; });
      raiz.querySelectorAll('[data-agregar][aria-expanded]').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      panel.hidden = !abrir;
      boton.setAttribute('aria-expanded', String(abrir));
      if (abrir && !esCelular()) panel.querySelector('.tamano-rapido:not([disabled])')?.focus();
    } else if (tam) {
      if (agregarABolsa(p, Number(tam.dataset.ml), 1, imagen)) {
        art.querySelector('.tarjeta__tamanos').hidden = true;
        art.querySelector('[data-agregar]')?.setAttribute('aria-expanded', 'false');
      }
    }
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const panel = e.target.closest('.tarjeta')?.querySelector('.tarjeta__tamanos:not([hidden])');
    if (!panel) return;
    panel.hidden = true;
    const b = panel.closest('.tarjeta').querySelector('[data-agregar]');
    b.setAttribute('aria-expanded', 'false');
    b.focus();
  });
}

/* ---------- Aparición al hacer scroll (solo inicio) ---------- */

let observador;
const vigilados = new Map();
export function observarRevelado(raiz = document) {
  const elementos = raiz.querySelectorAll('.revelar:not(.es-visible)');
  if (reducido.matches || !('IntersectionObserver' in window)) {
    elementos.forEach((el) => el.classList.add('es-visible'));
    return;
  }
  if (!observador) {
    observador = new IntersectionObserver((entradas) => {
      for (const en of entradas) {
        if (!en.isIntersecting) continue;
        (vigilados.get(en.target) || [en.target]).forEach((el) => el.classList.add('es-visible'));
        vigilados.delete(en.target);
        observador.unobserve(en.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  }
  elementos.forEach((el, i) => {
    el.style.setProperty('--orden', String(i % 4));
    // Un elemento recortado del todo (títulos que se "dibujan") no cuenta como visible: se vigila a su contenedor.
    const objetivo = el.classList.contains('revelar--linea') ? el.parentElement : el;
    vigilados.set(objetivo, [...(vigilados.get(objetivo) || []), el]);
    observador.observe(objetivo);
  });
}

/* ---------- Buscador ---------- */

function montarBusqueda() {
  const d = document.createElement('dialog');
  d.className = 'busqueda';
  d.setAttribute('aria-label', 'Buscar perfumes');
  d.innerHTML = `
    <form class="busqueda__form contenedor" action="/catalogo" method="get" role="search">
      ${icono('buscar')}
      <input name="q" type="search" placeholder="Perfume, marca o nota (ej. vainilla)" aria-label="Buscar" autocomplete="off" enterkeyhint="search">
      <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar búsqueda">${icono('cerrar')}</button>
    </form>`;
  document.body.append(d);
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-cerrar]')) d.close();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-abrir-busqueda]')) return;
    d.showModal();
    d.querySelector('input').focus();
  });
}

/* ---------- Arranque común ---------- */

// Una transición entre páginas que el navegador saltea (pestaña en segundo plano) no es un error.
for (const evento of ['pageswap', 'pagereveal']) {
  window.addEventListener(evento, (e) => {
    e.viewTransition?.ready?.catch(() => {});
    e.viewTransition?.finished?.catch(() => {});
  });
}

export async function iniciarPagina(pagina, { pildora = true } = {}) {
  const cab = document.querySelector('[data-cabecera]');
  const pieEl = document.querySelector('[data-pie]');
  cab.innerHTML = cabecera(pagina);
  pieEl.id = 'contacto';

  const botonMenu = cab.querySelector('.cabecera__menu');
  const menu = cab.querySelector('.menu-movil');
  botonMenu.addEventListener('click', () => {
    const abrir = menu.hidden;
    menu.hidden = !abrir;
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.innerHTML = icono(abrir ? 'cerrar' : 'menu');
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      menu.hidden = true;
      botonMenu.setAttribute('aria-expanded', 'false');
      botonMenu.innerHTML = icono('menu');
    }
  });

  const alScroll = () => cab.classList.toggle('es-compacta', window.scrollY > 24);
  window.addEventListener('scroll', alScroll, { passive: true });
  alScroll();

  montarBolsa();
  montarBusqueda();
  if (pildora) montarPildora();
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-abrir-bolsa]')) abrirBolsa();
  });

  let datos;
  try {
    datos = await obtenerCatalogo();
  } catch {
    document.querySelector('main').innerHTML = `
      <div class="contenedor no-encontrado">
        <h1 class="titulo-seccion">No pudimos cargar el catálogo</h1>
        <p>Revisá tu conexión y volvé a intentar. Si sigue pasando, escribinos por WhatsApp.</p>
        <button class="boton boton--contorno" type="button" onclick="location.reload()">Reintentar</button>
      </div>`;
    throw new Error('catálogo no disponible');
  }
  pieEl.innerHTML = pie();
  perfumesPorId = new Map(datos.perfumes.map((p) => [p.id, p]));
  document.addEventListener('carrito:cambio', () => {
    pintarContador();
    pintarBolsa();
  });
  pintarContador();
  pintarBolsa();
  return datos;
}
