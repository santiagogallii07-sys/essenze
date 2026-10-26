// Términos y privacidad: cabecera, bolsa y pie de siempre alrededor del texto.
import { iniciarPagina } from './interfaz.js';

iniciarPagina('', { pildora: false, conservarContenido: true }).catch(() => { /* sin catálogo el texto igual se lee */ });
