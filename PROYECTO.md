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

## Pendiente / ideas

- [ ] Publicar (GitHub + Cloudflare) y cargar el Excel en producción.
- [ ] Cargar costos y stock reales en el panel, para ver el margen y las alertas de stock.
- [ ] Reemplazar de a poco las fotos chicas del Excel (empezar por destacados y cartelera).
- [ ] Completar el aroma de los 389 perfumes que llegaron sin perfil ni notas (filtro "Sin aroma" en el panel).
- [ ] Revisar los 5 marcados "Para revisar" (duplicados o sin precio en el Excel).
- [ ] Dominio propio.
- [ ] Más adelante, si el tráfico crece: pasar las fotos a Cloudflare R2.
