// Página 404: cabecera, bolsa y pie de siempre alrededor del aviso.
import { iniciarPagina } from './interfaz.js';

iniciarPagina('', { pildora: false }).catch(() => { /* sin catálogo igual se ven los enlaces */ });
