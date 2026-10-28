// Partes compartidas por todas las páginas: cabecera, pie, bolsa de compras,
// pedido por WhatsApp, buscador, avisos y tarjetas de producto.
import { CONFIG, TIPOS } from './config.js';
import { icono, iconoWhatsapp } from './iconos.js';
import { frascoSVG } from './frasco.js';
import { arrastrarParaCerrar } from './arrastre.js';
import { videoPersonaje, fotoPersonaje, reproducir, reproducirAlVer } from './personaje.js';
import * as carrito from './carrito.js';
import { obtenerFavoritos, esFavorito, alternarFavorito, depurarFavoritos } from './favoritos.js';
import {
  obtenerCatalogo, precio, precioArs, precioDesde, hayInmediata, inmediata, enOferta, descuentoMaximo,
  presentacionesOrdenadas, enlacePerfume, MAXIMO_POR_LINEA, textoMl, normalizar, textoBuscable,
} from './datos.js';

const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
const esCelular = () => window.matchMedia('(max-width: 860px)').matches;

export function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Las fotos subidas en lote ("h-…") tienen una copia chica "<id>-m" para tarjetas, bolsa y muestras.
export function urlFoto(id, { grande = false } = {}) {
  return `/foto/${escapar(id)}${!grande && /^h-/.test(id) ? '-m' : ''}`;
}

// Foto del perfume (recortada o completa) o, si no tiene, la ilustración del frasco.
export function imagenPerfume(p, { clase = '', perezosa = true, grande = false } = {}) {
  if (p.imagen) {
    const tipo = p.fondo === 'recorte' || p.imagen_fondo === 'recorte' ? 'foto--recorte' : 'foto--completa';
    return `<img class="foto ${tipo} ${clase}" src="${urlFoto(p.imagen, { grande })}" alt="${escapar(`${p.marca} ${p.nombre}`)}" ${perezosa ? 'loading="lazy"' : ''} decoding="async" draggable="false">`;
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
  // En el celular no entra un tercer ícono en la cabecera: los favoritos van en el menú.
  const favoritosMenu = `<li><a class="menu-movil__favoritos" href="/favoritos" ${pagina === 'favoritos' ? 'aria-current="page"' : ''}>${icono('corazon')}Favoritos <span data-cantidad-favoritos></span></a></li>`;
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
      <a class="boton-icono boton-favoritos" href="/favoritos" data-boton-favoritos aria-label="Favoritos" ${pagina === 'favoritos' ? 'aria-current="page"' : ''}>
        ${icono('corazon')}<span class="boton-bolsa__cantidad" data-cantidad-favoritos hidden>0</span>
      </a>
      <button class="boton-icono boton-bolsa" type="button" data-abrir-bolsa aria-label="Abrir bolsa de compras">
        ${icono('bolsa')}<span class="boton-bolsa__cantidad" data-cantidad-bolsa hidden>0</span>
      </button>
    </div>
  </div>
  <nav class="menu-movil" id="menu-movil" aria-label="Menú" hidden><ul>${enlaces}${favoritosMenu}</ul></nav>`;
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
      <p class="solo-lector">Essenze Parfum &amp; Decants</p>
      ${videoPersonaje({ clase: 'pie__personaje' })}
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
    <p>© ${new Date().getFullYear()} Essenze Parfum &amp; Decants · ${notaPrecios()}.</p>
    <p class="pie__enlaces"><a href="/terminos">Términos y condiciones</a><a href="/privacidad">Política de privacidad</a></p>
  </div>`;
}

/* ---------- Garantías (originales, envíos, pagos) ---------- */

// Franja de confianza: bajo la cartelera en el inicio y, en versión corta, junto al botón de compra de la ficha.
export function garantias({ compacta = false } = {}) {
  const ciudad = escapar(String(CONFIG.ciudad || 'Córdoba').split(',')[0].trim());
  const items = [
    ['original', 'Perfumes 100% originales', 'Frascos y decants de perfumes originales.'],
    ['envio', 'Envíos a todo el país', `O retiralo en ${ciudad}, a coordinar por WhatsApp.`],
    ['tarjeta', 'Pagá como prefieras', 'Transferencia, efectivo o tarjeta con link de Mercado Pago.'],
  ];
  if (compacta) {
    return `<ul class="garantias-cortas">${items.map(([ic, titulo]) => `<li>${icono(ic)}<span>${titulo}</span></li>`).join('')}</ul>`;
  }
  return `<ul class="garantias__lista contenedor">${items.map(([ic, titulo, detalle]) => `
    <li class="garantia">${icono(ic, 'garantia__icono')}<div><p class="garantia__titulo">${titulo}</p><p class="garantia__detalle">${detalle}</p></div></li>`).join('')}
  </ul>`;
}

/* ---------- Favoritos ---------- */

export function botonFavorito(p, clase = '') {
  return `<button type="button" class="boton-favorito ${clase}" data-favorito="${escapar(p.id)}" aria-pressed="${esFavorito(p.id)}" aria-label="Guardar ${escapar(p.nombre)} en favoritos">${icono('corazon')}</button>`;
}

function pintarFavoritos() {
  const ids = obtenerFavoritos();
  const n = ids.length;
  document.querySelectorAll('[data-cantidad-favoritos]').forEach((el) => {
    el.textContent = n || '';
    el.hidden = n === 0;
  });
  document.querySelector('[data-boton-favoritos]')?.setAttribute('aria-label', n ? `Favoritos, ${n} ${n === 1 ? 'perfume' : 'perfumes'}` : 'Favoritos');
  document.querySelectorAll('[data-favorito]').forEach((b) => b.setAttribute('aria-pressed', String(ids.includes(b.dataset.favorito))));
}

function alTocarFavorito(boton) {
  const id = boton.dataset.favorito;
  const nombre = perfumesPorId.get(id)?.nombre || 'El perfume';
  if (alternarFavorito(id)) {
    if (navigator.userActivation?.isActive) navigator.vibrate?.(8);
    boton.classList.remove('es-latido');
    void boton.offsetWidth;
    boton.classList.add('es-latido');
    const enFavoritos = document.body.dataset.pagina === 'favoritos';
    aviso(`${nombre} en tus favoritos`, enFavoritos ? null : { texto: 'Ver favoritos', alHacer: () => { location.href = '/favoritos'; } });
  } else {
    aviso(`Quitaste ${nombre} de favoritos`, { texto: 'Deshacer', alHacer: () => alternarFavorito(id) });
  }
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
        <p class="linea__entrega ${inmediata(l.pres) ? 'es-inmediata' : ''}">${entregaDeLinea(l)}</p>
        <div class="linea__controles">
          <div class="cantidad" role="group" aria-label="Cantidad de ${escapar(l.p.nombre)}">
            <button type="button" data-accion="menos" aria-label="Quitar uno">${icono('menos')}</button>
            <output aria-live="polite">${l.cantidad}</output>
            <button type="button" data-accion="mas" aria-label="Agregar uno" ${l.cantidad >= MAXIMO_POR_LINEA ? 'disabled' : ''}>${icono('mas')}</button>
          </div>
          <button type="button" class="linea__quitar" data-accion="quitar">Quitar</button>
        </div>
      </div>
      <p class="linea__subtotal">${precio(l.subtotal)}</p>
    </li>`).join('');

  const ars = precioArs(total);
  bolsa.querySelectorAll('[data-total]').forEach((el) => { el.textContent = precio(total); });
  bolsa.querySelectorAll('[data-total-ars]').forEach((el) => { el.textContent = ars; });
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

// Si piden más unidades de las que tienen, el resto queda a pedido.
function notaPrecios() {
  if (!(CONFIG.mostrarArs && CONFIG.cotizacion > 0)) return 'Precios en dólares estadounidenses (USD)';
  return CONFIG.mostrarUsd ? 'Precios en dólares estadounidenses (USD). Los precios en pesos son de referencia' : 'Precios en pesos argentinos, calculados con el valor del dólar del día';
}

function entregaDeLinea(l) {
  const stock = Number(l.pres.stock) || 0;
  if (stock <= 0) return 'A pedido';
  if (l.cantidad <= stock) return 'Entrega inmediata';
  return `${stock} de entrega inmediata y ${l.cantidad - stock} a pedido`;
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
  const renglones = lineas.map((l) => `• ${l.cantidad} × ${l.p.marca} ${l.p.nombre}${l.p.concentracion ? ` (${l.p.concentracion})` : ''} – ${textoMl(l.ml)} – ${precio(l.subtotal)}${l.cantidad > 1 ? ` (${precio(l.pres.precio)} c/u)` : ''} – ${entregaDeLinea(l).toLowerCase()}`);
  return [
    `Hola Essenze! Quiero hacer este pedido:`,
    ``,
    `*Pedido ${numero}*`,
    ...renglones,
    ``,
    `*Total: ${precio(total)}*${ars ? ` (${ars})` : ''}`,
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
    acepto: (_, input) => (input.checked ? '' : 'Para enviar el pedido tenés que aceptar los términos y la política de privacidad.'),
  };
  let primero = null;
  for (const [campo, regla] of Object.entries(reglas)) {
    const input = form.elements[campo];
    const error = regla(input.value, input);
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
          ${fotoPersonaje('bolsas', 'bolsa__personaje')}
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
          <div class="campo campo--acepto">
            <label class="acepto">
              <input type="checkbox" name="acepto" required aria-describedby="e-acepto">
              <span>Leí y acepto los <a href="/terminos" target="_blank" rel="noopener">Términos y condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener">Política de privacidad</a>.</span>
            </label>
            <p class="campo__error" id="e-acepto" data-error="acepto"></p>
          </div>
          <input class="trampa" name="sitio" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="bolsa__total"><span>Total</span><strong data-total></strong></div>
          <p class="bolsa__ars" data-total-ars></p>
          <button class="boton boton--whatsapp boton--ancho" type="submit">${iconoWhatsapp()} Enviar pedido por WhatsApp</button>
        </form>
      </section>

      <section class="bolsa__cuerpo bolsa__enviado" data-paso="enviado" hidden>
        <div class="enviado__personaje">${videoPersonaje()}</div>
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
    const max = MAXIMO_POR_LINEA;
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
    // El cocodrilo festeja el pedido dibujando el logo.
    reproducir(bolsa.querySelector('.enviado__personaje video'));
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
  if (!pres) return false;
  const max = MAXIMO_POR_LINEA;
  const yaHay = carrito.cantidadDe(p.id, ml);
  if (yaHay >= max) {
    aviso(`Para más de ${max} unidades de ${p.nombre}, escribinos por WhatsApp`);
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
  const oferta = enOferta(p);
  const desc = descuentoMaximo(p);
  const masBarato = pres.reduce((a, b) => (b.precio < a.precio ? b : a));
  const unico = pres.length === 1;
  const sello = oferta ? `<span class="sello">−${desc}%</span>` : '';
  const tamanos = pres.map((x) => `<button type="button" class="tamano-rapido" data-ml="${x.ml}"><span>${textoMl(x.ml)}${inmediata(x) ? '<small class="tamano-rapido__entrega">Entrega inmediata</small>' : ''}</span><span>${precio(x.precio)}</span></button>`).join('');
  const ars = precioArs(precioDesde(p));

  return `
  <article class="tarjeta ${revelar ? 'revelar' : ''}" data-id="${escapar(p.id)}">
    <a class="tarjeta__enlace" href="${enlacePerfume(p)}">
      <div class="tarjeta__imagen ${p.imagen && p.fondo !== 'recorte' ? 'tarjeta__imagen--foto' : ''}">${sello}${imagenPerfume(p)}<span class="tarjeta__destello" aria-hidden="true"></span></div>
      <div class="tarjeta__cuerpo">
        <p class="tarjeta__marca">${escapar(p.marca)}</p>
        <h3 class="tarjeta__nombre">${escapar(p.nombre)}</h3>
        <p class="tarjeta__detalle">${[p.concentracion, pres.some((x) => x.ml) ? `${pres.map((x) => x.ml || '—').join(' / ')} ml` : ''].filter(Boolean).map(escapar).join(' · ')}</p>
        ${hayInmediata(p) ? '<p class="entrega-inmediata">Entrega inmediata</p>' : ''}
      </div>
    </a>
    ${botonFavorito(p, 'tarjeta__favorito')}
    <div class="tarjeta__pie">
      <p class="tarjeta__precio">${unico ? '' : '<span class="tarjeta__desde">desde</span>'}${precio(precioDesde(p))}${masBarato.precioAnterior && masBarato.precioAnterior > masBarato.precio ? ` <s>${precio(masBarato.precioAnterior)}</s>` : ''}${ars ? `<span class="tarjeta__ars">${ars}</span>` : ''}</p>
      <button type="button" class="boton-circular" data-agregar aria-label="Agregar ${escapar(p.nombre)} a la bolsa" ${unico ? '' : 'aria-expanded="false"'}>${icono('mas')}</button>
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

const SUGERENCIAS = 8;

// Ordena los perfumes que coinciden: primero los que tienen la búsqueda en la marca o el nombre
// (mejor si el nombre empieza así), después los que coinciden por notas o familia.
function buscarPerfumes(perfumes, consulta) {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const frase = palabras.join(' ');
  const encontrados = [];
  for (const p of perfumes) {
    p._busca ??= textoBuscable(p);
    if (!palabras.every((w) => p._busca.includes(w))) continue;
    const nombre = normalizar(`${p.marca} ${p.nombre}`);
    const soloNombre = normalizar(p.nombre);
    let puntos = 3;
    if (palabras.every((w) => nombre.includes(w))) puntos = 2;
    if (soloNombre.startsWith(frase) || nombre.startsWith(frase)) puntos = 1;
    if (soloNombre === frase) puntos = 0;
    encontrados.push({ p, puntos });
  }
  return encontrados
    .sort((a, b) => a.puntos - b.puntos || Number(!!b.p.destacado) - Number(!!a.p.destacado) || `${a.p.marca} ${a.p.nombre}`.localeCompare(`${b.p.marca} ${b.p.nombre}`, 'es'))
    .map((x) => x.p);
}

function montarBusqueda() {
  const d = document.createElement('dialog');
  d.className = 'busqueda';
  d.setAttribute('aria-label', 'Buscar perfumes');
  d.innerHTML = `
    <form class="busqueda__form contenedor" action="/catalogo" method="get" role="search">
      ${icono('buscar')}
      <input name="q" type="search" placeholder="Perfume, marca o nota (ej. vainilla)" aria-label="Buscar" autocomplete="off" enterkeyhint="search"
        role="combobox" aria-expanded="false" aria-controls="sugerencias-busqueda" aria-autocomplete="list">
      <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar búsqueda">${icono('cerrar')}</button>
    </form>
    <div class="busqueda__sugerencias" data-sugerencias hidden>
      <ul class="contenedor" id="sugerencias-busqueda" role="listbox" aria-label="Perfumes sugeridos"></ul>
    </div>`;
  document.body.append(d);
  const form = d.querySelector('form');
  const entrada = d.querySelector('input');
  const caja = d.querySelector('[data-sugerencias]');
  const listaEl = caja.querySelector('ul');
  let perfumes = null;
  let espera = 0;
  let activa = -1;

  const opciones = () => [...listaEl.querySelectorAll('[role="option"]')];
  // -1 = ninguna marcada: Enter busca el texto escrito. Solo las flechas marcan un perfume.
  function marcar(i) {
    const todas = opciones();
    activa = i < 0 || !todas.length ? -1 : i % todas.length;
    todas.forEach((o, n) => o.setAttribute('aria-selected', String(n === activa)));
    if (activa >= 0) {
      entrada.setAttribute('aria-activedescendant', todas[activa].id);
      todas[activa].scrollIntoView({ block: 'nearest' });
    } else {
      entrada.removeAttribute('aria-activedescendant');
    }
  }
  function cerrarSugerencias() {
    caja.hidden = true;
    entrada.setAttribute('aria-expanded', 'false');
    marcar(-1);
  }

  async function sugerir() {
    const q = entrada.value.trim();
    if (!q) return cerrarSugerencias();
    try {
      perfumes ??= (await obtenerCatalogo()).perfumes;
    } catch {
      return cerrarSugerencias(); // sin conexión: queda el buscar de siempre
    }
    if (entrada.value.trim() !== q) return undefined; // llegó otra letra mientras cargaba
    const encontrados = buscarPerfumes(perfumes, q);
    const todos = `/catalogo?q=${encodeURIComponent(q)}`;
    listaEl.innerHTML = encontrados.length
      ? `${encontrados.slice(0, SUGERENCIAS).map((p, i) => `
        <li><a class="sugerencia" id="sugerencia-${i}" role="option" aria-selected="false" href="${enlacePerfume(p)}">
          <span class="sugerencia__foto">${imagenPerfume(p)}</span>
          <span class="sugerencia__texto"><span class="sugerencia__marca">${escapar(p.marca)}</span><span class="sugerencia__nombre">${escapar(p.nombre)}</span>${p.concentracion ? `<span class="sugerencia__detalle">${escapar(p.concentracion)}</span>` : ''}</span>
          <span class="sugerencia__precio">${precio(precioDesde(p))}</span>
        </a></li>`).join('')}
        <li><a class="sugerencia-todos" href="${todos}">${encontrados.length > SUGERENCIAS ? `Ver los ${encontrados.length} resultados` : 'Ver en el catálogo'} ${icono('flecha')}</a></li>`
      : `<li class="sugerencia-vacia">${fotoPersonaje('bandeja', 'sugerencia-vacia__foto')}<span>No encontramos “${escapar(q)}”. Probá con la marca o una nota, como vainilla u oud.</span></li>`;
    caja.hidden = false;
    entrada.setAttribute('aria-expanded', 'true');
    marcar(-1);
    return undefined;
  }

  entrada.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(sugerir, 120);
  });
  entrada.addEventListener('keydown', (e) => {
    if (caja.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const ultima = opciones().length - 1;
      marcar(e.key === 'ArrowDown' ? activa + 1 : activa <= 0 ? ultima : activa - 1);
    } else if (e.key === 'Enter' && activa >= 0) {
      e.preventDefault();
      opciones()[activa].click();
    }
  });
  form.addEventListener('submit', (e) => {
    if (!entrada.value.trim()) e.preventDefault();
  });
  d.addEventListener('close', cerrarSugerencias);
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target === caja || e.target.closest('[data-cerrar]')) d.close();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-abrir-busqueda]')) return;
    d.showModal();
    entrada.focus();
    if (entrada.value.trim()) sugerir();
    // Se precarga el catálogo para que la primera letra ya muestre resultados.
    obtenerCatalogo().then((c) => { perfumes ??= c.perfumes; }).catch(() => {});
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

export async function iniciarPagina(pagina, { pildora = true, conservarContenido = false } = {}) {
  const cab = document.querySelector('[data-cabecera]');
  const pieEl = document.querySelector('[data-pie]');
  cab.innerHTML = cabecera(pagina);
  pieEl.id = 'contacto';
  document.body.dataset.pagina = pagina;

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
    const fav = e.target.closest('[data-favorito]');
    if (fav) {
      e.preventDefault();
      alTocarFavorito(fav);
    }
  });
  document.addEventListener('favoritos:cambio', pintarFavoritos);
  pintarFavoritos();

  let datos;
  try {
    datos = await obtenerCatalogo();
  } catch {
    if (conservarContenido) throw new Error('catálogo no disponible');
    document.querySelector('main').innerHTML = `
      <div class="contenedor no-encontrado">
        <h1 class="titulo-seccion">No pudimos cargar el catálogo</h1>
        <p>Revisá tu conexión y volvé a intentar. Si sigue pasando, escribinos por WhatsApp.</p>
        <a class="boton boton--contorno" href="">Reintentar</a>
      </div>`;
    throw new Error('catálogo no disponible');
  }
  pieEl.innerHTML = pie();
  // Al llegar al final, el cocodrilo cruza el pie y dibuja el logo.
  reproducirAlVer(pieEl.querySelector('.pie__personaje'));
  perfumesPorId = new Map(datos.perfumes.map((p) => [p.id, p]));
  depurarFavoritos((id) => perfumesPorId.has(id));
  document.addEventListener('carrito:cambio', () => {
    pintarContador();
    pintarBolsa();
  });
  pintarContador();
  pintarBolsa();
  return datos;
}
