// Visor del frasco. Elige automáticamente según lo que tenga cargado el perfume:
//  - modelo3d (.glb): visor 3D interactivo con <model-viewer>
//  - imagenes (varios cuadros): giro 360° arrastrando (fotos tomadas alrededor del frasco)
//  - imagen (una foto): foto con relieve que se inclina siguiendo el dedo o el mouse
//  - sin fotos: ilustración que gira al arrastrar
import { frascoSVG } from './frasco.js';
import { icono } from './iconos.js';

const MODEL_VIEWER = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
const foto = (id) => `/foto/${id}`;
// Copia chica de las fotos subidas en lote: suele estar en caché (viene de la tarjeta) y cubre la espera de la grande.
const fotoChica = (id) => (/^h-/.test(id) ? `/foto/${id}-m` : '');

function cargarModelViewer() {
  if (customElements.get('model-viewer')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = MODEL_VIEWER;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

function pista(texto, nombreIcono = 'girar') {
  return `<p class="visor__pista">${icono(nombreIcono)}<span>${texto}</span></p>`;
}

// Foto única: se inclina en 3D hacia el puntero y un brillo dorado la recorre.
function montarFoto(contenedor, perfume, titulo) {
  const recorte = perfume.imagen_fondo === 'recorte' || perfume.fondo === 'recorte';
  const chica = fotoChica(perfume.imagen);
  contenedor.innerHTML = `
    <div class="visor__escena visor__escena--foto">
      <div class="visor__relieve ${recorte ? 'es-recorte' : 'es-completa'}">
        <img src="${chica || foto(perfume.imagen)}" alt="${titulo}" decoding="async" fetchpriority="high" draggable="false" data-foto-principal>
        <span class="visor__brillo" aria-hidden="true"></span>
      </div>
    </div>
    ${pista(window.matchMedia('(hover: hover)').matches ? 'Mové el mouse sobre el frasco' : 'Tocá y deslizá sobre el frasco', 'ojo')}`;
  if (chica) {
    // Se muestra la chica al instante y se cambia por la grande cuando ya está lista (sin parpadeo).
    const grande = new Image();
    grande.src = foto(perfume.imagen);
    grande.decode().then(() => { contenedor.querySelector('[data-foto-principal]')?.setAttribute('src', grande.src); }).catch(() => {});
  }
  if (reducido.matches) return;
  const escena = contenedor.querySelector('.visor__escena');
  const relieve = contenedor.querySelector('.visor__relieve');
  let raf = 0;
  let objetivo = { x: 0, y: 0 };
  let actual = { x: 0, y: 0 };
  const bucle = () => {
    actual.x += (objetivo.x - actual.x) * 0.12;
    actual.y += (objetivo.y - actual.y) * 0.12;
    relieve.style.transform = `rotateY(${actual.x * 14}deg) rotateX(${-actual.y * 10}deg)`;
    relieve.style.setProperty('--luz-x', `${50 + actual.x * 45}%`);
    relieve.style.setProperty('--luz-y', `${50 + actual.y * 45}%`);
    raf = Math.abs(objetivo.x - actual.x) + Math.abs(objetivo.y - actual.y) > 0.002 ? requestAnimationFrame(bucle) : 0;
  };
  const mover = (e) => {
    const r = escena.getBoundingClientRect();
    objetivo = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 };
    relieve.classList.add('es-activo');
    if (!raf) raf = requestAnimationFrame(bucle);
  };
  const soltar = () => {
    objetivo = { x: 0, y: 0 };
    relieve.classList.remove('es-activo');
    if (!raf) raf = requestAnimationFrame(bucle);
  };
  escena.addEventListener('pointermove', mover);
  escena.addEventListener('pointerdown', mover);
  escena.addEventListener('pointerleave', soltar);
  escena.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') soltar(); });
  escena.addEventListener('pointercancel', soltar);
}

export function montarVisor(contenedor, perfume) {
  const titulo = `${perfume.marca} ${perfume.nombre}`;

  if (perfume.modelo3d) {
    contenedor.innerHTML = `<div class="visor__escena">${perfume.imagen ? `<img src="${foto(perfume.imagen)}" alt="${titulo}">` : frascoSVG(perfume)}</div>${pista('Arrastrá para girar · pellizcá para acercar')}`;
    cargarModelViewer()
      .then(() => {
        contenedor.querySelector('.visor__escena').innerHTML = `<model-viewer src="${perfume.modelo3d}" alt="Modelo 3D de ${titulo}" camera-controls auto-rotate shadow-intensity="1" exposure="0.9" interaction-prompt="none" style="width:100%;height:100%;--poster-color:transparent"></model-viewer>`;
      })
      .catch(() => {});
    return;
  }

  const imagenes = (perfume.imagenes || []).map(foto);
  if (imagenes.length < 2 && perfume.imagen) {
    montarFoto(contenedor, perfume, titulo);
    return;
  }

  const escena = document.createElement('div');
  escena.className = 'visor__escena visor__escena--girable';
  escena.tabIndex = 0;
  escena.setAttribute('role', 'slider');
  escena.setAttribute('aria-label', `Girar ${titulo}`);
  escena.setAttribute('aria-valuemin', '0');
  escena.setAttribute('aria-valuemax', '359');
  contenedor.replaceChildren(escena);
  contenedor.insertAdjacentHTML('beforeend', pista('Arrastrá para girar el frasco'));

  let dibujar;
  let paso; // radianes por píxel arrastrado
  if (imagenes.length > 1) {
    const img = document.createElement('img');
    img.alt = titulo;
    img.draggable = false;
    escena.append(img);
    imagenes.forEach((src) => { new Image().src = src; });
    paso = (Math.PI * 2) / 360;
    dibujar = (a) => {
      const vuelta = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      img.src = imagenes[Math.round((vuelta / (Math.PI * 2)) * imagenes.length) % imagenes.length];
    };
  } else {
    paso = (Math.PI * 2) / 420;
    dibujar = (a) => { escena.innerHTML = frascoSVG(perfume, { angulo: a }); };
  }

  let angulo = 0;
  let objetivo = 0;
  let arrastrando = false;
  let tocado = false;
  let xPrevio = 0;
  let raf = 0;
  const t0 = performance.now();

  function pintar(a) {
    dibujar(a);
    const grados = Math.round((((a * 180) / Math.PI) % 360 + 360) % 360);
    escena.setAttribute('aria-valuenow', String(grados));
  }

  function bucle(t) {
    raf = 0;
    // Un balanceo corto al cargar, para insinuar que el frasco se puede girar.
    const balanceando = !tocado && !reducido.matches && t - t0 < 5000;
    if (balanceando) objetivo = Math.sin((t - t0) / 800) * 0.5;
    else if (!tocado) objetivo = 0;
    angulo += (objetivo - angulo) * (arrastrando ? 0.5 : 0.14);
    pintar(angulo);
    if (balanceando || Math.abs(objetivo - angulo) > 0.001) pedir();
  }

  function pedir() {
    if (!raf) raf = requestAnimationFrame(bucle);
  }

  escena.addEventListener('pointerdown', (e) => {
    arrastrando = true;
    tocado = true;
    xPrevio = e.clientX;
    escena.setPointerCapture(e.pointerId);
    escena.classList.add('es-arrastre');
  });
  escena.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    objetivo += (e.clientX - xPrevio) * paso;
    xPrevio = e.clientX;
    pedir();
  });
  const soltar = () => {
    arrastrando = false;
    escena.classList.remove('es-arrastre');
  };
  escena.addEventListener('pointerup', soltar);
  escena.addEventListener('pointercancel', soltar);
  escena.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    tocado = true;
    objetivo += (e.key === 'ArrowRight' ? 1 : -1) * (Math.PI / 12);
    pedir();
  });

  pintar(0);
  pedir();
}
