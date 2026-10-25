import { TIPOS } from './config.js';
import { iniciarPagina, tarjeta, activarTarjetas, escapar, imagenPerfume, urlFoto, observarRevelado } from './interfaz.js';
import { enOferta, hayStock, normalizar } from './datos.js';
import { icono } from './iconos.js';
import { videoPersonaje, reproducir, puedeAnimar } from './personaje.js';

const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');

const BIENVENIDA = {
  id: 'bienvenida',
  etiqueta: '',
  titulo: 'El lujo en cada nota',
  texto: 'Perfumes árabes, de diseñador y de nicho en Córdoba. Elegí por marca o por cómo huelen y mandanos tu pedido por WhatsApp.',
  boton: 'Ver catálogo',
  enlace: '/catalogo',
};

function escenaOferta(o, p, i) {
  if (o.imagen) return `<img class="foto foto--recorte" src="/foto/${escapar(o.imagen)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} draggable="false">`;
  if (p) return imagenPerfume(p, { perezosa: i > 0, grande: true });
  return '';
}

function montarCartelera(raiz, ofertas, porId) {
  // Primera diapositiva: la bienvenida con el cocodrilo de la marca dibujando el logo; después, las ofertas del panel.
  const lista = [{ ...BIENVENIDA, personaje: true }, ...ofertas];
  const diapositivas = lista.map((o, i) => {
    const p = porId.get(o.perfume);
    const Titulo = i === 0 ? 'h1' : 'h2';
    if (o.personaje) {
      return `
    <article class="cartel cartel--personaje ${i === 0 ? 'es-activo' : ''}" aria-roledescription="diapositiva" aria-label="${i + 1} de ${lista.length}" ${i === 0 ? '' : 'aria-hidden="true" inert'}>
      <div class="cartel__texto">
        <${Titulo} class="cartel__titulo">${escapar(o.titulo)}</${Titulo}>
        <span class="filete" aria-hidden="true"></span>
        <p class="cartel__bajada">${escapar(o.texto)}</p>
        <a class="boton boton--contorno" href="${escapar(o.enlace)}">${escapar(o.boton)} ${icono('flecha')}</a>
      </div>
      <div class="cartel__escena cartel__escena--personaje" aria-hidden="true">
        <div class="cartel__haz"></div>
        ${videoPersonaje({ clase: 'cartel__personaje' })}
      </div>
    </article>`;
    }
    // Banner hecho con IA: la imagen completa es la diapositiva y todo el banner es un enlace.
    if (o.formato === 'banner' && o.imagen) {
      return `
    <article class="cartel cartel--banner ${o.imagen_movil ? 'cartel--con-movil' : ''} ${i === 0 ? 'es-activo' : ''}" aria-roledescription="diapositiva" aria-label="${i + 1} de ${lista.length}" ${i === 0 ? '' : 'aria-hidden="true" inert'}>
      <${Titulo} class="solo-lector">${escapar(o.titulo)}</${Titulo}>
      <a class="cartel__banner" href="${escapar(o.enlace)}">
        <picture>
          ${o.imagen_movil ? `<source media="(max-width: 860px)" srcset="/foto/${escapar(o.imagen_movil)}">` : ''}
          <img src="/foto/${escapar(o.imagen)}" alt="${escapar([o.titulo, o.texto].filter(Boolean).join('. '))}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} draggable="false">
        </picture>
      </a>
    </article>`;
    }
    return `
    <article class="cartel ${i === 0 ? 'es-activo' : ''}" aria-roledescription="diapositiva" aria-label="${i + 1} de ${lista.length}" ${i === 0 ? '' : 'aria-hidden="true" inert'}>
      <div class="cartel__texto">
        <${Titulo} class="cartel__titulo">${escapar(o.titulo)}</${Titulo}>
        <span class="filete" aria-hidden="true"></span>
        ${o.texto ? `<p class="cartel__bajada">${escapar(o.texto)}</p>` : ''}
        <a class="boton boton--contorno" href="${escapar(o.enlace)}">${escapar(o.boton || 'Ver más')} ${icono('flecha')}</a>
      </div>
      ${o.etiqueta ? `<p class="cartel__sello"><span>${escapar(o.etiqueta)}</span></p>` : ''}
      <div class="cartel__escena" aria-hidden="true">
        <div class="cartel__haz"></div>
        <div class="cartel__pedestal"></div>
        <div class="cartel__frasco ${o.imagen || p?.imagen ? 'cartel__frasco--foto' : ''}">${escenaOferta(o, p, i)}</div>
      </div>
    </article>`;
  }).join('');

  const puntos = lista.map((o, i) => `<button type="button" class="cartelera__punto" aria-label="Ver ${escapar(o.titulo)}" ${i === 0 ? 'aria-current="true"' : ''}><span></span></button>`).join('');

  raiz.innerHTML = `
    <div class="cartelera__luz" aria-hidden="true"></div>
    <div class="cartelera__pista">${diapositivas}</div>
    <div class="cartelera__barrido" aria-hidden="true"></div>
    ${lista.length > 1 ? `
    <div class="cartelera__controles contenedor">
      <div class="cartelera__puntos">${puntos}</div>
      <div class="cartelera__flechas">
        <button type="button" class="boton-icono" data-ir="-1" aria-label="Anterior">${icono('flechaIzq')}</button>
        <button type="button" class="boton-icono" data-ir="1" aria-label="Siguiente">${icono('flecha')}</button>
      </div>
    </div>` : ''}`;

  // Luz dorada que sigue al mouse (solo con mouse; en el celular queda fija).
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducido.matches) {
    const luz = raiz.querySelector('.cartelera__luz');
    let raf = 0;
    raiz.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = raiz.getBoundingClientRect();
        luz.style.setProperty('--x', `${((e.clientX - r.left) / r.width) * 100}%`);
        luz.style.setProperty('--y', `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    });
  }

  // El cocodrilo dibuja el logo al abrir la página y cada vez que vuelve su diapositiva.
  const videoCartel = raiz.querySelector('.cartel__personaje');
  const conPersonaje = (cartel) => cartel.classList.contains('cartel--personaje');
  if (conPersonaje(raiz.querySelector('.cartel.es-activo'))) reproducir(videoCartel);

  if (lista.length < 2) return;

  const carteles = [...raiz.querySelectorAll('.cartel')];
  const botones = [...raiz.querySelectorAll('.cartelera__punto')];
  const barrido = raiz.querySelector('.cartelera__barrido');
  let actual = 0;
  let temporizador = 0;
  const DURACION = 7000;
  const DURACION_PERSONAJE = 8500; // el video (6 s) y un rato con el logo ya dibujado

  function ir(n) {
    const sig = (n + carteles.length) % carteles.length;
    if (sig === actual) return;
    carteles[actual].classList.remove('es-activo');
    carteles[actual].setAttribute('aria-hidden', 'true');
    carteles[actual].inert = true;
    botones[actual].removeAttribute('aria-current');
    if (conPersonaje(carteles[actual])) videoCartel.pause();
    actual = sig;
    if (conPersonaje(carteles[actual])) reproducir(videoCartel);
    carteles[actual].classList.add('es-activo');
    carteles[actual].removeAttribute('aria-hidden');
    carteles[actual].inert = false;
    botones[actual].setAttribute('aria-current', 'true');
    if (!reducido.matches) {
      barrido.classList.remove('es-barriendo');
      void barrido.offsetWidth;
      barrido.classList.add('es-barriendo');
    }
    reiniciar();
  }

  function reiniciar() {
    clearTimeout(temporizador);
    const duracion = conPersonaje(carteles[actual]) && puedeAnimar() ? DURACION_PERSONAJE : DURACION;
    raiz.style.setProperty('--duracion', `${duracion}ms`);
    botones.forEach((b) => b.classList.remove('es-corriendo'));
    if (reducido.matches || raiz.dataset.pausa) return;
    void botones[actual].offsetWidth;
    botones[actual].classList.add('es-corriendo');
    temporizador = setTimeout(() => ir(actual + 1), duracion);
  }

  botones.forEach((b, i) => b.addEventListener('click', () => ir(i)));
  raiz.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => ir(actual + Number(b.dataset.ir))));

  const pausar = () => { raiz.dataset.pausa = '1'; clearTimeout(temporizador); botones.forEach((b) => b.classList.remove('es-corriendo')); };
  const seguir = () => { delete raiz.dataset.pausa; reiniciar(); };
  raiz.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && pausar());
  raiz.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && seguir());
  raiz.addEventListener('focusin', pausar);
  raiz.addEventListener('focusout', (e) => { if (!raiz.contains(e.relatedTarget)) seguir(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? pausar() : seguir()));

  // Deslizar con el dedo
  let x0 = null;
  let y0 = null;
  raiz.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  raiz.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(actual + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  reiniciar();
}

// Revisa una foto recortada: sirve para el abanico si las esquinas son transparentes
// (no es un rectángulo con fondo) y si es un frasco solo (más alto que ancho, sin caja al lado).
function analizarRecorte(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 24;
        c.height = 24;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        const alfa = (x, y) => d[(y * 24 + x) * 4 + 3];
        const esquinas = [alfa(0, 0), alfa(23, 0), alfa(0, 23), alfa(23, 23), alfa(0, 12), alfa(23, 12)];
        let transparentes = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 20) transparentes++;
        const limpio = esquinas.every((a) => a < 25) && transparentes / 576 > 0.2;
        resolve({ limpio, alto: img.naturalHeight / img.naturalWidth });
      } catch {
        resolve({ limpio: false, alto: 0 });
      }
    };
    img.onerror = () => resolve({ limpio: false, alto: 0 });
    img.src = src;
  });
}

async function elegirMuestras(lista) {
  // Se prueban hasta 12 candidatos (destacados primero) y se quedan los 3 mejores: limpios y altos.
  const candidatos = lista
    .filter((p) => p.imagen && p.fondo === 'recorte')
    .sort((a, b) => Number(!!b.destacado) - Number(!!a.destacado))
    .slice(0, 12);
  const analizados = await Promise.all(candidatos.map(async (p) => ({ p, ...(await analizarRecorte(urlFoto(p.imagen))) })));
  const limpios = analizados.filter((x) => x.limpio);
  const solos = limpios.filter((x) => x.alto >= 1.15);
  const elegidos = [...solos, ...limpios.filter((x) => !solos.includes(x))].slice(0, 3);
  return elegidos.map((x) => x.p);
}

function montarTipos(raiz, perfumes) {
  const entradas = Object.entries(TIPOS);
  raiz.innerHTML = entradas.map(([clave, nombre]) => {
    const lista = perfumes.filter((p) => p.tipo === clave);
    return `
    <li class="revelar">
      <a class="tipo" href="/catalogo?tipo=${clave}">
        <span class="tipo__nombre">${nombre}</span>
        <span class="tipo__cuenta">${lista.length} ${lista.length === 1 ? 'perfume' : 'perfumes'}</span>
        <span class="tipo__frascos" aria-hidden="true" data-frascos="${clave}"></span>
        ${icono('flecha', 'tipo__flecha')}
      </a>
    </li>`;
  }).join('');
  // Las muestras solo se ven al pasar el mouse: se eligen cuando la lista se acerca a la pantalla.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const observador = new IntersectionObserver((vistos) => {
    if (!vistos.some((v) => v.isIntersecting)) return;
    observador.disconnect();
    for (const [clave] of entradas) {
      elegirMuestras(perfumes.filter((p) => p.tipo === clave)).then((muestras) => {
        raiz.querySelector(`[data-frascos="${clave}"]`).innerHTML = muestras.map((p) => imagenPerfume(p)).join('');
      });
    }
  }, { rootMargin: '400px 0px' });
  observador.observe(raiz);
}

// Cinta de marcas que se desplaza sola; se duplica para que el giro no tenga corte.
function montarMarcas(raiz, perfumes) {
  const cuenta = new Map();
  perfumes.forEach((p) => cuenta.set(p.marca, (cuenta.get(p.marca) || 0) + 1));
  const marcas = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28).map(([m]) => m);
  if (marcas.length < 4) {
    raiz.hidden = true;
    return;
  }
  const items = marcas.map((m) => `<li><a href="/catalogo?marca=${encodeURIComponent(m)}">${escapar(m)}</a></li>`).join('');
  raiz.innerHTML = `
    <ul class="cinta__pista">${items}</ul>
    <ul class="cinta__pista" aria-hidden="true">${marcas.map((m) => `<li><a href="/catalogo?marca=${encodeURIComponent(m)}" tabindex="-1">${escapar(m)}</a></li>`).join('')}</ul>`;
  raiz.style.setProperty('--duracion-cinta', `${marcas.length * 3.2}s`);
}

function montarAcordes(raiz, perfumes) {
  const conteo = new Map();
  perfumes.forEach((p) => p.acordes.filter((a) => a.intensidad >= 60).forEach((a) => {
    const k = normalizar(a.nombre);
    const actual = conteo.get(k) || { nombre: a.nombre, n: 0 };
    actual.n++;
    conteo.set(k, actual);
  }));
  const top = [...conteo.values()].sort((a, b) => b.n - a.n).slice(0, 12);
  raiz.innerHTML = top.map(({ nombre, n }) => `<li class="revelar"><a class="acorde-enlace" href="/catalogo?acorde=${encodeURIComponent(nombre)}">${escapar(nombre)}<span>${n}</span></a></li>`).join('');
}

// Si no hay destacados elegidos en el panel, se arma una vidriera variada con foto.
function elegirDestacados(perfumes) {
  const elegidos = perfumes.filter((p) => p.destacado && hayStock(p));
  if (elegidos.length >= 4) return elegidos.slice(0, 8);
  const porTipo = Object.keys(TIPOS).map((t) => perfumes.filter((p) => p.tipo === t && p.imagen && hayStock(p) && p.acordes.length));
  const mezcla = [...elegidos];
  for (let ronda = 0; mezcla.length < 8 && ronda < 4; ronda++) {
    for (const lista of porTipo) {
      const p = lista[ronda * 7];
      if (p && !mezcla.includes(p) && mezcla.length < 8) mezcla.push(p);
    }
  }
  return mezcla;
}

const { perfumes, ofertas } = await iniciarPagina('inicio');
const porId = new Map(perfumes.map((p) => [p.id, p]));

montarCartelera(document.querySelector('[data-cartelera]'), ofertas, porId);
montarTipos(document.querySelector('[data-tipos]'), perfumes);
montarMarcas(document.querySelector('[data-marcas]'), perfumes);
montarAcordes(document.querySelector('[data-acordes]'), perfumes);

const gDest = document.querySelector('[data-destacados]');
gDest.innerHTML = elegirDestacados(perfumes).map((p) => tarjeta(p, { revelar: true })).join('');
activarTarjetas(gDest);

const enPromo = perfumes.filter((p) => enOferta(p) && hayStock(p));
const secOfertas = document.querySelector('[data-seccion-ofertas]');
if (enPromo.length) {
  const gOf = document.querySelector('[data-ofertas]');
  gOf.innerHTML = enPromo.slice(0, 8).map((p) => tarjeta(p, { revelar: true })).join('');
  activarTarjetas(gOf);
} else {
  secOfertas.hidden = true;
}
document.querySelector('[data-total-perfumes]').textContent = perfumes.length;
observarRevelado();
