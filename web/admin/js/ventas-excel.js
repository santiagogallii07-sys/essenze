// Importa la planilla "control ventas" (Fecha, Nombre del perfume, Costo, Precio de venta, Comisión) a la caja.
import { api } from './api.js';
import { hoja, aviso, avisoError, conCarga, escapar, ars, fecha as fechaCorta } from './ui.js';

const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisá la conexión.'));
    document.head.append(s);
  });
}

const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// "$155,000.00", "$4.800", 155000 → número
function aNumero(v) {
  if (typeof v === 'number') return v;
  let t = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!t) return 0;
  const coma = t.lastIndexOf(',');
  const punto = t.lastIndexOf('.');
  if (coma > -1 && punto > -1) {
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (coma > -1) {
    t = /,\d{3}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (punto > -1 && /\.\d{3}$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  return Number(t) || 0;
}

function aFecha(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 30000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m = String(v ?? '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function leerPlanilla(XLSX, datos) {
  const libro = XLSX.read(datos, { cellDates: true });
  const nombreHoja = libro.SheetNames.find((n) => /venta/i.test(n)) || libro.SheetNames[0];
  const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, raw: true, defval: '' });
  const i = filas.findIndex((f) => f.some((c) => norm(c) === 'fecha') && f.some((c) => /venta/.test(norm(c))));
  if (i < 0) throw new Error('No encontramos las columnas "Fecha" y "Precio de venta" en la planilla.');
  const enc = filas[i].map(norm);
  const col = (re) => enc.findIndex((c) => re.test(c));
  const c = { fecha: col(/^fecha/), nombre: col(/nombre|perfume|producto/), costo: col(/^costo/), precio: col(/precio de venta|^venta|precio/), comision: col(/comisi/) };
  const ventas = [];
  for (const f of filas.slice(i + 1)) {
    const fecha = aFecha(f[c.fecha]);
    const nombre = String(f[c.nombre] ?? '').trim();
    const precio = aNumero(f[c.precio]);
    if (!fecha || !nombre || !precio) continue;
    ventas.push({ fecha, nombre, precio, costo: c.costo >= 0 ? aNumero(f[c.costo]) : 0, comision: c.comision >= 0 ? aNumero(f[c.comision]) : 0 });
  }
  return ventas;
}

export async function importarVentas() {
  const h = hoja({
    titulo: 'Importar ventas (Excel)',
    ancho: 620,
    html: `
      <p class="campo__ayuda">Elegí tu planilla de control de ventas (columnas Fecha, Nombre del perfume, Costo, Precio de venta y Comisión, en pesos). Cada venta suma a la caja con su costo y su comisión. Si la importás de nuevo, no se duplican.</p>
      <label class="boton boton--contorno">Elegir planilla<input type="file" accept=".xlsx,.xls" hidden data-archivo></label>
      <div data-previa></div>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-importar disabled>Importar</button>',
  });
  const d = h.dialogo;
  let ventas = [];
  d.querySelector('[data-archivo]').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const previa = d.querySelector('[data-previa]');
    previa.innerHTML = '<div class="cargando"><span></span><span></span><span></span></div>';
    try {
      const XLSX = await cargarSheetJS();
      ventas = leerPlanilla(XLSX, await archivo.arrayBuffer());
      if (!ventas.length) throw new Error('La planilla no tiene ventas con fecha, nombre y precio.');
      const total = ventas.reduce((n, v) => n + v.precio, 0);
      const costos = ventas.reduce((n, v) => n + v.costo, 0);
      const comisiones = ventas.reduce((n, v) => n + v.comision, 0);
      const fechas = ventas.map((v) => v.fecha).sort();
      previa.innerHTML = `
        <div class="cifras" style="margin-top:6px">
          <div class="cifra"><span class="cifra__rotulo">Ventas</span><span class="cifra__valor num">${ventas.length}</span><span class="cifra__nota">${fechaCorta(fechas[0])} al ${fechaCorta(fechas.at(-1))}</span></div>
          <div class="cifra cifra--positiva"><span class="cifra__rotulo">Cobrado</span><span class="cifra__valor">${ars(total)}</span></div>
          <div class="cifra"><span class="cifra__rotulo">Costos</span><span class="cifra__valor">${ars(costos)}</span></div>
          <div class="cifra"><span class="cifra__rotulo">Ganancia</span><span class="cifra__valor">${ars(total - costos - comisiones)}</span><span class="cifra__nota">Comisiones ${ars(comisiones)}</span></div>
        </div>
        <ul class="lista-admin" style="margin-top:10px;max-height:220px;overflow:auto">${ventas.slice(0, 50).map((v) => `
          <li class="fila-admin"><span class="fila-admin__texto"><span class="fila-admin__titulo">${escapar(v.nombre)}</span><span class="fila-admin__sub">${fechaCorta(v.fecha)} · costo ${ars(v.costo)}</span></span><span class="fila-admin__valor">${ars(v.precio)}</span></li>`).join('')}</ul>`;
      d.querySelector('[data-importar]').disabled = false;
    } catch (err) {
      previa.innerHTML = `<p class="campo__error">${escapar(err.message)}</p>`;
    }
  });
  d.querySelector('[data-importar]').addEventListener('click', (e) => conCarga(e.currentTarget, async () => {
    try {
      let nuevas = 0;
      for (let i = 0; i < ventas.length; i += 150) {
        const r = await api('/ventas-excel', { metodo: 'POST', datos: { filas: ventas.slice(i, i + 150) } });
        nuevas += r.nuevas;
      }
      aviso(nuevas ? `${nuevas} ventas cargadas en la caja` : 'Esas ventas ya estaban cargadas');
      h.cerrar(true);
    } catch (err) {
      avisoError(err);
    }
  }));
  return h.cerrada.then((v) => v === true);
}
