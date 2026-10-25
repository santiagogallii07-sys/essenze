// El cocodrilo de Essenze: cruza tirando de una cinta dorada que dibuja el logo.
// Video corto para la cartelera, el pie, el pedido enviado y el ingreso al panel,
// y sus ilustraciones (fondo negro, enteras, sin recortar) para los estados vacíos. Los videos tienen fondo negro: con mix-blend-mode: screen
// el negro desaparece sobre los fondos oscuros de la tienda.
// Sin movimiento (preferencia del sistema o ahorro de datos) se ve el logo quieto, sin video.

export const VIDEO = '/video/cocodrilo-v1.mp4';
export const LOGO = '/video/cocodrilo-logo-v1.webp'; // último cuadro: el logo ya dibujado
// Una pose para cada lugar.
export const POSES = {
  bolsas: '/img/cocodrilo-bolsas.webp', // de compras con dos bolsas: bolsa vacía
  bandeja: '/img/cocodrilo-bandeja.webp', // mozo con bandeja de perfumes: búsqueda sin resultados
  frasco: '/img/cocodrilo-frasco.webp', // abrazado a un frasco: catálogo sin resultados
  sentado: '/img/cocodrilo-sentado.webp', // sentado sobre un frasco: páginas de error
};

const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
export const puedeAnimar = () => !reducido.matches && navigator.connection?.saveData !== true;

/** Video del personaje (todavía sin cargar). Hasta que se reproduce muestra el logo quieto. */
export function videoPersonaje({ clase = '' } = {}) {
  return `<video class="personaje ${clase}" muted playsinline disablepictureinpicture preload="none" poster="${LOGO}" data-src="${VIDEO}" aria-hidden="true" tabindex="-1"></video>`;
}

/** Ilustración quieta del cocodrilo (una de POSES), entera, para los estados vacíos. */
export function fotoPersonaje(pose, clase = '') {
  return `<img class="personaje-foto ${clase}" src="${POSES[pose]}" alt="" width="640" height="640" loading="lazy" decoding="async" draggable="false">`;
}

/** Reproduce el video desde el principio. Devuelve una promesa que se cumple cuando termina (o falla). */
export function reproducir(video, { velocidad = 1, desde = 0 } = {}) {
  if (!puedeAnimar()) return Promise.resolve(false);
  if (!video.src) video.src = video.dataset.src;
  video.playbackRate = velocidad;
  return new Promise((resolve) => {
    const fin = (ok) => {
      video.removeEventListener('ended', alTerminar);
      video.removeEventListener('error', alFallar);
      resolve(ok);
    };
    const alTerminar = () => fin(true);
    const alFallar = () => fin(false);
    video.addEventListener('ended', alTerminar);
    video.addEventListener('error', alFallar);
    try { video.currentTime = desde; } catch { /* todavía sin datos */ }
    video.play().catch(() => fin(false));
  });
}

/** Reproduce el video una vez cuando entra en pantalla (pie, ingreso al panel). */
export function reproducirAlVer(video, { umbral = 0.45 } = {}) {
  if (!puedeAnimar() || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((vistos) => {
    if (!vistos.some((v) => v.isIntersecting)) return;
    obs.disconnect();
    reproducir(video);
  }, { threshold: umbral });
  obs.observe(video);
}
