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
