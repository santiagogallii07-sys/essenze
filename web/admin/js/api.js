// Llamadas a la API del panel. Toda respuesta 401 dispara el aviso de sesión vencida.

// Momento del último cambio hecho desde este panel: así un cambio propio no hace repintar la pantalla dos veces.
let ultimoCambioPropio = 0;
export const cambioPropioReciente = () => Date.now() - ultimoCambioPropio < 8000;

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

export async function api(ruta, { metodo = 'GET', datos, cuerpo, encabezados = {}, señal } = {}) {
  const opciones = { method: metodo, headers: { 'X-Essenze': '1', ...encabezados }, credentials: 'same-origin', signal: señal };
  if (datos !== undefined) {
    opciones.body = JSON.stringify(datos);
    opciones.headers['Content-Type'] = 'application/json';
  } else if (cuerpo !== undefined) {
    opciones.body = cuerpo;
  }
  let res;
  try {
    res = await fetch(`/api/admin${ruta}`, opciones);
  } catch {
    throw new ErrorApi('Sin conexión. Revisá internet y probá de nuevo.', 0);
  }
  if (res.status === 401 && ruta !== '/login') {
    document.dispatchEvent(new CustomEvent('sesion:vencida'));
  }
  const tipo = res.headers.get('Content-Type') || '';
  const respuesta = tipo.includes('json') ? await res.json().catch(() => ({})) : await res.blob();
  if (!res.ok) throw new ErrorApi(respuesta?.error || `Error ${res.status}`, res.status);
  if (metodo !== 'GET') ultimoCambioPropio = Date.now();
  return respuesta;
}

// huella (opcional): sha-256 del archivo original; la misma foto subida dos veces no se duplica.
// mini: copia chica de esa misma foto (para tarjetas y bolsa).
export async function subirImagen(procesada, huella = '', { mini = false } = {}) {
  return api('/imagenes', {
    metodo: 'POST',
    cuerpo: procesada.blob,
    encabezados: {
      'Content-Type': procesada.tipo,
      'X-Fondo': procesada.fondo,
      'X-Ancho': String(procesada.ancho),
      'X-Alto': String(procesada.alto),
      ...(huella ? { 'X-Huella': huella } : {}),
      ...(huella && mini ? { 'X-Variante': 'mini' } : {}),
    },
  });
}
