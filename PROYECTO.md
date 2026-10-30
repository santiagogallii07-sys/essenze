# Essenze Parfum & Decants — estado del proyecto

## Hecho (20/10/2026)

**Tienda**
- Catálogo con 1.210 perfumes leídos del Excel, cada uno con su foto recortada.
- Cartelera de ofertas, cinta de marcas, filtros, ficha con foto en relieve, 360° y 3D.
- Bolsa de compras con pedido por WhatsApp; el pedido además queda guardado en el panel.

**Panel**
- Inicio, perfumes (editor con fotos), pedidos, caja (cash flow), ofertas y descuentos, importar Excel y ajustes.

**Infraestructura**
- Cloudflare Pages + Functions + D1, plan gratis.
- Sin Supabase: no hace falta, ni hoy ni a largo plazo.

## Para publicar

Seguí [GUIA-PUBLICAR.md](GUIA-PUBLICAR.md): GitHub → base D1 → Pages → claves → importar Excel.

## Plan de cambios (29/10/2026) — hecho; pasado a GitHub el 30/10/2026

Todo está armado en la carpeta `demo/` (ver `demo/DEMO.md` para abrirla). Decidido: inicio B, sin franja en el inicio (solo en la ficha), dólar blue de los lunes, cuentas con ofertas exclusivas, puntos, favoritos e historial, y "Lo más vendido". La IA queda para más adelante.

**1. Arreglos rápidos**
- Venta que se traba: al tocar "Venta" el panel baja los 1.210 perfumes completos cada vez y no muestra nada mientras carga. Arreglo: abrir la ventana al instante, bajar una lista liviana y guardarla para las siguientes ventas.
- Error encontrado: una venta cargada con fecha pasada se guarda con la fecha de hoy.
- Ventas numeradas 1001, 1002, 1003… (web y panel, una sola numeración; el número lo da el servidor). Las que ya existen se numeran de la más vieja a la más nueva.
- Nombre obligatorio en las ventas del panel (la web ya lo pide).
- Pedidos: filtros en orden Todos / Nuevos / Confirmados / Cobrados / Entregados / Cancelados, abriendo en Todos.
- Inicio del panel: tarjeta "Costo" (lo que costaron los perfumes vendidos en el mes).
- Inicio de la tienda: borrar el texto chico de la sección "Aroma".
- Pie, en Contacto: "¿Compras mayoristas? Consultanos por WhatsApp", con el mensaje ya armado.
- "Elegí tu estilo": líneas más gruesas y visibles; en el celular, filas más altas y fáciles de tocar.
- Menú ☰ del celular: "Marcas ▾" desplegable con las marcas en una lista que se desliza (alto limitado) y "Ver todas".

**2. Panel en blanco y negro**
- Fondo claro, texto negro, tipografía más legible y más grande, botones más marcados. La tienda no cambia.
- Buscador en cada sección: Pedidos (también por perfume), Caja (nuevo), Inicio (buscador general de perfumes y pedidos), Ofertas. Perfumes ya tiene.

**3. Inicio nuevo de la tienda** (sin banners, los perfumes más arriba)
- Opciones: A) directo a los perfumes, B) vidriera por secciones (recomendada), C) portada chica + secciones.
- B: buscador grande arriba, tipos en botones de 2 columnas, fila de marcas con "Todas", filas de Destacados, En oferta, Entrega inmediata (si hay) y Lo más pedido; "Buscá por aroma"; al final, Cómo comprar.
- Franja de confianza: pasarla a una barrita fina arriba de todo que alterna los 3 mensajes, y dejar la versión corta en la ficha.

**4. Dólar semanal**
- Se toma de DolarApi (gratis, sin clave) una vez por semana y queda fijo hasta la semana siguiente. En Ajustes: qué dólar usar, cuándo se actualizó y la opción de cargarlo a mano.

**5. Cuentas de clientes con pop-up** (el chat con IA queda para más adelante)
- Pop-up a los pocos segundos de entrar la primera vez, con los beneficios, email y contraseña. Si lo cierran, vuelve recién a los 7 días; nunca a quien ya tiene cuenta.
- Ícono de cuenta en la cabecera: mis pedidos, favoritos guardados, cerrar sesión.
- Panel: sección Clientes, cambiar la contraseña de un cliente (si se la olvida, escribe por WhatsApp) y prender/apagar el pop-up.
- Actualizar la Política de privacidad.

**Falta decidir**
- Inicio: A, B o C. ¿Se sacan los banners del todo?
- Franja de confianza: barrita arriba o eliminarla.
- Dólar: blue, oficial, MEP o tarjeta; y qué día cambia (propuesta: lunes).
- Beneficios de la cuenta: descuento de bienvenida, ofertas solo para clientes con cuenta, historial de pedidos y datos completados solos, favoritos en cualquier dispositivo, enterarse primero de ingresos y ofertas.

## Ideas para charlar con los dueños (27/10/2026)

Nada de esto está hecho todavía. Se arma solo cuando lo confirmen.

1. **Sección "Entrega inmediata" en el inicio.** Una fila con los perfumes que tienen en stock, para vender primero lo que ya compraron.
2. **Sección "Lo más pedido".** Una fila con los perfumes más vendidos, tomados de las ventas que cargan en el panel.
3. **Ayuda para elegir perfume, en dos niveles:**
   - Para todos, sin cuenta: un quiz rápido de 4 preguntas (para quién es, día o noche, dulce o fresco, y presupuesto) que muestra 3 perfumes recomendados. Es gratis y no usa IA.
   - Para los que se crean una cuenta: el chat con el asistente de IA, que pregunta más a fondo y recomienda con más detalle. Tiene un límite de mensajes por día.
4. **Fotos de clientes y de los pedidos.** Una galería del estilo "así llegan nuestros pedidos", hacia el final de la página de inicio o en otro lugar a definir.
5. **Encargos a proveedores.** En el panel, una lista armada sola con los perfumes "a pedido" que ya encargaron los clientes y que hay que comprar, sumados por perfume. Falta que los dueños cuenten cómo trabajan con los proveedores.

## Pendiente / ideas

- [ ] Publicar (GitHub + Cloudflare) y cargar el Excel en producción.
- [ ] Cargar costos y stock reales en el panel, para ver el margen y las alertas de stock.
- [ ] Reemplazar de a poco las fotos chicas del Excel (empezar por destacados y cartelera).
- [ ] Completar el aroma de los 389 perfumes que llegaron sin perfil ni notas (filtro "Sin aroma" en el panel).
- [ ] Revisar los 5 marcados "Para revisar" (duplicados o sin precio en el Excel).
- [ ] Dominio propio.
- [ ] Más adelante, si el tráfico crece: pasar las fotos a Cloudflare R2.
- [ ] **Asistente con IA para elegir perfume** (aprobado el 27/10/2026, sin hacer). Solo para clientes con cuenta (nombre, email y contraseña; sesión de 30 días; si olvidan la contraseña, la cambian desde el panel). Límite de mensajes por persona y por día, lista de clientes y preguntas en el panel, botón para prender y apagar. Usaría el plan gratis de Cloudflare Workers AI: no necesita tarjeta y queda en la misma cuenta.
  - **En la tienda:** una burbuja con el cocodrilo ("¿Te ayudo a elegir?") abre un chat. El cliente cuenta qué le gusta y recibe 2 o 3 perfumes del catálogo (avisando cuáles son de entrega inmediata), en tarjetas con foto, precio y botón para agregar a la bolsa.
  - **Por dentro:**
    - Una Function `/api/asistente` busca en el catálogo unos 30 candidatos por notas, familia y precio.
    - Le pasa solo esos candidatos al modelo, así no puede inventar perfumes ni precios.
  - **Cuidados:**
    - Un límite de mensajes por persona y por día.
    - Solo habla de perfumes; no cobra ni confirma pedidos, que siguen por WhatsApp.
    - Lista de preguntas de los clientes en el panel.
  - **Si la calidad no alcanza:** cambiar el modelo por Claude (pago por uso). El resto queda igual. Revisar los límites y precios del momento antes de armarlo.
