// Ilustración de frasco en SVG para perfumes que todavía no tienen fotos.
// `angulo` (radianes) simula el giro: la etiqueta y las aristas se desplazan sobre el vidrio.

const FORMAS = {
  cuadrado: { tope: 108, mitad: 56, cuerpo: 'M46 114 Q46 108 52 108 H148 Q154 108 154 114 V274 Q154 280 148 280 H52 Q46 280 46 274 Z', aristas: true, etiquetaY: 196 },
  alto: { tope: 84, mitad: 42, cuerpo: 'M58 88 Q58 84 62 84 H138 Q142 84 142 88 V276 Q142 280 138 280 H62 Q58 280 58 276 Z', aristas: true, etiquetaY: 186 },
  redondo: { tope: 116, mitad: 74, cuerpo: 'M100 116 C146 116 176 150 176 196 C176 248 146 282 100 282 C54 282 24 248 24 196 C24 150 54 116 100 116 Z', aristas: false, etiquetaY: 202 },
  facetado: { tope: 108, mitad: 58, cuerpo: 'M62 108 H138 L158 128 V260 L138 280 H62 L42 260 V128 Z', aristas: true, etiquetaY: 196 },
  joya: { tope: 100, mitad: 58, cuerpo: 'M100 100 L158 142 V238 L100 282 L42 238 V142 Z', aristas: true, etiquetaY: 194 },
};

const TAPAS = {
  oro: ['#6b4e1f', '#e9cd8e', '#b8904a', '#5e4419'],
  negro: ['#050505', '#3a3835', '#1a1918', '#020202'],
  plata: ['#6d6d6d', '#f1f1f1', '#a9a9a9', '#555555'],
  madera: ['#3b2414', '#8a5a34', '#5a3a20', '#2a190d'],
};

function aclarar(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)),
  );
  return `rgb(${c.join(',')})`;
}

function dividirNombre(nombre) {
  if (nombre.length <= 11) return [nombre];
  const palabras = nombre.split(' ');
  let mejor = [nombre];
  let menorDif = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(' ');
    const b = palabras.slice(i).join(' ');
    const dif = Math.abs(a.length - b.length);
    if (dif < menorDif) {
      menorDif = dif;
      mejor = [a, b];
    }
  }
  return mejor;
}

function escapar(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

let contador = 0;

// Sin datos de frasco, se elige uno estable a partir del id (siempre el mismo para cada perfume).
const LIQUIDOS = {
  'arabe-masculino': ['#3d2817', '#1b1712', '#6b3a1a', '#2a2622'],
  'arabe-femenino': ['#d9a7a0', '#c98a3c', '#b8442e', '#e3b9ad'],
  'disenador-masculino': ['#16243a', '#3b4d63', '#1a1a1d', '#1e2a3d'],
  'disenador-femenino': ['#e3b9ad', '#e8c98c', '#d9a7a0', '#101624'],
  nicho: ['#1d1d1f', '#3d2817', '#e0a63a', '#b8442e'],
};
function frascoPorDefecto(p) {
  let h = 0;
  for (const ch of String(p.id || p.nombre || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const formas = Object.keys(FORMAS);
  const liquidos = LIQUIDOS[p.tipo] || LIQUIDOS.nicho;
  const liquido = liquidos[h % liquidos.length];
  return {
    forma: formas[(h >>> 3) % formas.length],
    liquido,
    tapa: ['oro', 'negro', 'plata', 'oro'][(h >>> 6) % 4],
    vidrio: parseInt(liquido.slice(1, 3), 16) < 0x40 ? 'oscuro' : 'claro',
  };
}

export function frascoSVG(perfume, { angulo = 0, etiqueta = true, clase = '' } = {}) {
  const f = perfume.frasco || frascoPorDefecto(perfume);
  const forma = FORMAS[f.forma] || FORMAS.cuadrado;
  const tapa = TAPAS[f.tapa] || TAPAS.oro;
  const oscuro = f.vidrio === 'oscuro';
  const uid = `f${++contador}`;
  const s = Math.sin(angulo);
  const c = Math.cos(angulo);

  const cuelloAncho = f.forma === 'alto' ? 30 : 40;
  const tapaAncho = f.forma === 'alto' ? 30 : f.forma === 'redondo' ? 34 : 38;
  const tapaAlto = f.forma === 'alto' ? 58 : 50;
  const cuelloY = forma.tope - 10;
  const tapaY = cuelloY - tapaAlto;
  const nivel = oscuro ? forma.tope : forma.tope + (282 - forma.tope) * 0.12;

  const lineas = dividirNombre(perfume.nombre);
  const largo = Math.max(...lineas.map((l) => l.length));
  const etiquetaAncho = Math.min(forma.mitad * 1.5, 96);
  // Tamaño de letra para que la línea más larga entre en la etiqueta (Tenor Sans ≈ 0.7em por letra + espaciado).
  const tam = Math.min(15, Math.max(5, ((etiquetaAncho - 12) / Math.max(largo, 4) - 1.2) / 0.7));
  const etiquetaAlto = 30 + lineas.length * tam * 1.15;

  // Aristas verticales de un prisma de 4 caras girando.
  let aristas = '';
  if (forma.aristas) {
    for (let k = 0; k < 4; k++) {
      const a = angulo + Math.PI / 4 + (k * Math.PI) / 2;
      if (Math.cos(a) <= 0.02) continue;
      const x = 100 + Math.sin(a) * forma.mitad * 0.98;
      aristas += `<line x1="${x.toFixed(1)}" y1="${forma.tope}" x2="${x.toFixed(1)}" y2="282" stroke="rgba(255,240,210,${(0.05 + Math.cos(a) * 0.08).toFixed(3)})" stroke-width="1"/>`;
    }
  }

  let marcaEtiqueta = '';
  if (etiqueta && c > 0.08) {
    const cx = 100 + s * forma.mitad * 0.55;
    const y0 = forma.etiquetaY - etiquetaAlto / 2;
    const textos = lineas
      .map((l, i) => `<text x="0" y="${(y0 + 28 + i * tam * 1.15 + tam * 0.35).toFixed(1)}" text-anchor="middle" font-family="'Tenor Sans', serif" font-size="${tam.toFixed(1)}" letter-spacing="1.2" fill="#e3c27e">${escapar(l.toUpperCase())}</text>`)
      .join('');
    marcaEtiqueta = `
      <g transform="translate(${cx.toFixed(2)} 0) scale(${c.toFixed(3)} 1)" opacity="${Math.min(1, c * 1.4).toFixed(3)}">
        <rect x="${-etiquetaAncho / 2}" y="${y0.toFixed(1)}" width="${etiquetaAncho}" height="${etiquetaAlto.toFixed(1)}" fill="${oscuro ? 'rgba(0,0,0,0.35)' : 'rgba(8,7,6,0.82)'}" stroke="#c9a35c" stroke-opacity="0.55" stroke-width="0.8"/>
        <text x="0" y="${(y0 + 15).toFixed(1)}" text-anchor="middle" font-family="'Jost', sans-serif" font-size="6.4" letter-spacing="2.4" fill="#c9a35c">${escapar(perfume.marca.toUpperCase())}</text>
        ${textos}
      </g>`;
  }

  // El brillo de la tapa acompaña levemente el giro.
  const brilloTapa = 0.35 + s * 0.12;

  return `<svg class="frasco ${clase}" viewBox="0 0 200 320" role="img" aria-label="Ilustración de ${escapar(perfume.marca)} ${escapar(perfume.nombre)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="${uid}c"><path d="${forma.cuerpo}"/></clipPath>
    <linearGradient id="${uid}l" gradientUnits="userSpaceOnUse" x1="${100 - forma.mitad * 1.02}" x2="${100 + forma.mitad * 1.02}" y1="0" y2="0">
      <stop offset="0" stop-color="${aclarar(f.liquido, -0.55)}"/>
      <stop offset="0.38" stop-color="${f.liquido}"/>
      <stop offset="0.55" stop-color="${aclarar(f.liquido, 0.18)}"/>
      <stop offset="1" stop-color="${aclarar(f.liquido, -0.65)}"/>
    </linearGradient>
    <linearGradient id="${uid}t" x1="0" x2="1">
      <stop offset="0" stop-color="${tapa[0]}"/>
      <stop offset="${brilloTapa.toFixed(3)}" stop-color="${tapa[1]}"/>
      <stop offset="0.65" stop-color="${tapa[2]}"/>
      <stop offset="1" stop-color="${tapa[3]}"/>
    </linearGradient>
    <linearGradient id="${uid}v" gradientUnits="userSpaceOnUse" x1="${100 - forma.mitad * 1.02}" x2="${100 + forma.mitad * 1.02}" y1="0" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0.16"/>
      <stop offset="0.12" stop-color="#fff" stop-opacity="0.02"/>
      <stop offset="0.86" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.10"/>
    </linearGradient>
    <radialGradient id="${uid}p" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#c9a35c" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#c9a35c" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="100" cy="292" rx="${forma.mitad * 1.35}" ry="14" fill="url(#${uid}p)"/>
  <ellipse cx="100" cy="284" rx="${forma.mitad * 0.95}" ry="4" fill="#000" opacity="0.7"/>
  <rect x="${100 - cuelloAncho / 2}" y="${cuelloY}" width="${cuelloAncho}" height="12" fill="url(#${uid}t)"/>
  <rect x="${100 - tapaAncho / 2}" y="${tapaY}" width="${tapaAncho}" height="${tapaAlto}" rx="1.5" fill="url(#${uid}t)"/>
  <rect x="${100 - tapaAncho / 2}" y="${tapaY}" width="${tapaAncho}" height="2" fill="#fff" opacity="0.18"/>
  <g clip-path="url(#${uid}c)">
    <rect x="0" y="0" width="200" height="320" fill="${oscuro ? aclarar(f.liquido, -0.45) : 'rgba(20,18,16,0.55)'}"/>
    <rect x="0" y="${nivel.toFixed(1)}" width="200" height="320" fill="url(#${uid}l)" opacity="${oscuro ? 0.95 : 0.88}"/>
    ${oscuro ? '' : `<rect x="0" y="${nivel.toFixed(1)}" width="200" height="1.2" fill="#fff" opacity="0.25"/>`}
    ${aristas}
    <rect x="${100 - forma.mitad * 0.72}" y="0" width="${forma.mitad * 0.16}" height="320" fill="#fff" opacity="0.10"/>
    <rect x="${100 - forma.mitad * 0.5}" y="0" width="2" height="320" fill="#fff" opacity="0.10"/>
    <rect x="${100 + forma.mitad * 0.78}" y="0" width="${forma.mitad * 0.08}" height="320" fill="#fff" opacity="0.06"/>
    <rect x="0" y="0" width="200" height="320" fill="url(#${uid}v)"/>
    ${marcaEtiqueta}
  </g>
  <path d="${forma.cuerpo}" fill="none" stroke="rgba(255,236,200,0.28)" stroke-width="1"/>
</svg>`;
}
