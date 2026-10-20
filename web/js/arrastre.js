// Hojas que se cierran arrastrando hacia abajo (celular). Se usa en la tienda y en el panel.
// El gesto vive en el "asa" (la barrita de arriba y el encabezado), así el contenido sigue scrolleando normal.

const CURVA = 'cubic-bezier(0.32, 0.72, 0, 1)';

export function arrastrarParaCerrar(panel, asa, alCerrar, { soloCelular = true } = {}) {
  let id = null;
  let y0 = 0;
  let t0 = 0;
  let dy = 0;

  asa.addEventListener('pointerdown', (e) => {
    if (id !== null || e.button > 0) return;
    if (soloCelular && !window.matchMedia('(max-width: 860px)').matches) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    id = e.pointerId;
    y0 = e.clientY;
    t0 = performance.now();
    dy = 0;
    asa.setPointerCapture(id);
    panel.style.transition = 'none';
  });

  asa.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    dy = e.clientY - y0;
    // Hacia arriba se resiste: se mueve cada vez menos.
    const y = dy < 0 ? -Math.sqrt(-dy) * 2 : dy;
    panel.style.transform = `translateY(${y}px)`;
  });

  const soltar = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    const velocidad = dy / Math.max(1, performance.now() - t0);
    panel.style.transition = `transform 360ms ${CURVA}`;
    if (dy > 110 || (dy > 24 && velocidad > 0.45)) {
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => {
        panel.style.transition = '';
        panel.style.transform = '';
        alCerrar();
      }, 300);
    } else {
      panel.style.transform = '';
      setTimeout(() => { panel.style.transition = ''; }, 380);
    }
  };
  asa.addEventListener('pointerup', soltar);
  asa.addEventListener('pointercancel', soltar);
}
