// Íconos de trazo fino (24×24, trazo 1.4) para todo el sitio.
const trazos = {
  buscar: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/>',
  bolsa: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  flecha: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  flechaIzq: '<path d="M20 12H5M10 7l-5 5 5 5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  filtros: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  menu: '<path d="M4 8h16M4 16h16"/>',
  basura: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  girar: '<path d="M4 12a8 8 0 0 1 14-5.3L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-14 5.3L4 16"/><path d="M4 20v-4h4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  primavera: '<path d="M12 21v-7"/><path d="M12 14c-4 0-6-3-6-7 3.5 0 6 2 6 7Z"/><path d="M12 14c4 0 6-3 6-7-3.5 0-6 2-6 7Z"/>',
  verano: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  otono: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14Z"/><path d="M5 19 13 11"/>',
  invierno: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  dia: '<circle cx="12" cy="12" r="4.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
  noche: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>',
  ubicacion: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  paquete: '<path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M4 7.5 12 11l8-3.5M12 11v9"/>',
  corazon:'<path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10Z"/>',
  original: '<path d="M12 3 5 6v5.5c0 4.3 3 7.8 7 9.5 4-1.7 7-5.2 7-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/>',
  envio: '<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h4l3 3.2v3.3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  tarjeta: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3 10h18"/><path d="M6.5 14.5h4"/>',
  usuario: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5"/>',
  chat: '<path d="M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>',
  regalo: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.5-3.5-5-4-5-1.6C7 9 12 9 12 9Zm0 0c1.5-3.5 5-4 5-1.6C17 9 12 9 12 9Z"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r=".6" fill="currentColor"/>',
  // Panel
  inicio: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  frasco: '<path d="M10 3h4v3h-4z"/><path d="M8.5 6h7l1.5 3v10.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5V9z"/><path d="M7 12h10"/>',
  recibo: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  caja: '<rect x="3" y="6" width="18" height="13" rx="1.5"/><path d="M3 10h18"/><path d="M15 14.5h2.5"/>',
  puntos: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  ojoNo: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.3 6.8A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  estrella: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  subir: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3.5h16V16"/>',
  bajar: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3.5h16V16"/>',
  salir: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  tienda: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0z"/><path d="M5.5 13.5V20h13v-6.5"/>',
  tabla: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  etiqueta: '<path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"/><circle cx="8" cy="8.5" r="1.3"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  imagen: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  arriba: '<path d="m6 15 6-6 6 6"/>',
  alerta: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  dolar: '<path d="M12 3v18"/><path d="M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3.2-2 3-4.5 3-4.5-1.3-4.5-3"/>',
  porcentaje: '<path d="M18 6 6 18"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
};

export function icono(nombre, clase = '') {
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trazos[nombre] || ''}</svg>`;
}

// Logo de WhatsApp (relleno), usado solo en las acciones que abren WhatsApp.
export function iconoWhatsapp(clase = '') {
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12.04 2.5a9.43 9.43 0 0 0-8.1 14.27L2.5 21.5l4.86-1.4A9.43 9.43 0 1 0 12.04 2.5Zm0 17.2a7.77 7.77 0 0 1-3.96-1.08l-.28-.17-2.88.83.85-2.8-.19-.29a7.78 7.78 0 1 1 6.46 3.51Zm4.27-5.82c-.23-.12-1.38-.68-1.6-.76-.21-.08-.37-.12-.53.12-.15.23-.6.76-.74.92-.14.15-.27.17-.5.06-.24-.12-1-.37-1.9-1.17a7.1 7.1 0 0 1-1.32-1.64c-.14-.23 0-.36.1-.48.11-.1.24-.27.36-.4.11-.14.15-.24.23-.4.08-.15.04-.29-.02-.4-.06-.12-.53-1.28-.73-1.75-.19-.46-.38-.4-.53-.4h-.45a.87.87 0 0 0-.63.29 2.64 2.64 0 0 0-.82 1.96c0 1.16.84 2.27.96 2.43.12.15 1.65 2.52 4 3.53.56.24 1 .39 1.34.5.56.18 1.07.15 1.48.09.45-.07 1.38-.56 1.57-1.11.2-.55.2-1.02.14-1.12-.06-.1-.21-.16-.45-.27Z"/></svg>`;
}
