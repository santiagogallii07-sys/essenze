// Valores por defecto de la tienda. Los reales (WhatsApp, ciudad, dólar…) se cargan
// desde el panel de administración y llegan con el catálogo (/api/catalogo).
export const CONFIG = {
  tienda: 'Essenze',
  subtitulo: 'Parfum & Decants',
  ciudad: 'Córdoba, Argentina',
  whatsapp: '5493512484272',
  instagram: '',
  moneda: 'USD',
  cotizacion: 0,
  mostrarArs: false,
  mostrarUsd: false,
  filtroInmediata: true,
};

export const TIPOS = {
  'arabe-masculino': 'Árabes masculinos',
  'arabe-femenino': 'Árabes femeninos',
  'disenador-masculino': 'Diseñador masculino',
  'disenador-femenino': 'Diseñador femenino',
  'nicho': 'Nicho',
};

export const GENEROS = { hombre: 'Hombre', mujer: 'Mujer', unisex: 'Unisex' };

export const ESTACIONES = { primavera: 'Primavera', verano: 'Verano', otono: 'Otoño', invierno: 'Invierno' };

export const OCASIONES = { dia: 'Día', noche: 'Noche' };
