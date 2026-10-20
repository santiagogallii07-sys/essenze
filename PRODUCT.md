# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS without a build step on Cloudflare Pages, API in Pages Functions, data and product photos in D1 (images stored as BLOBs, served from /foto/:id with edge cache). Admin login is a password secret + HMAC-signed cookie. Supabase deliberately not used (free tier pauses after inactivity; one platform is simpler for the owner). Chosen with the user.

## Users

Local customers in Córdoba, Argentina (WhatsApp area code 351) browsing perfumes, mostly on their phones, who want to see what is available, what each fragrance smells like, and how much it costs before ordering through WhatsApp. Secondary user: the shop owner, who manages catalog, offers, orders and cash flow from the admin panel, often on the phone.

## Product Purpose

Online perfume catalog for Essenze Parfum & Decants. Visitors browse by brand, type, gender, olfactive family and season/occasion, read notes and accords, add bottles (each with its sizes and USD prices) to a cart, and send the order to the shop's WhatsApp with name, email and phone. Success: a customer finds a fragrance and sends a complete, unambiguous order in a few taps.

## Positioning

A curated local perfume shop whose catalog carries the olfactive detail of a fragrance database (notes, accords, season), so customers can choose by scent and order directly from the seller by WhatsApp.

## Operating Context

- Orders close on WhatsApp via a wa.me link opened by the customer (number 5493512484272); no online payment.
- Prices in USD. Decants exist in the business name but are rarely sold; catalog shows full bottles with their sizes.
- Fragrance info (notes, accords, family, season) is sourced from Fragrantica by the owner, reviewed before publishing.
- Home page has a billboard ("cartelera") for offers and discounts, managed later from the admin.

## Capabilities and Constraints

- Categories: brand; type (Árabe masculino, Árabe femenino, Diseñador masculino, Diseñador femenino, Nicho); gender; olfactive family; occasion/season.
- Product images: photo set with 360° drag rotation; must stay open to a future `.glb` 3D model viewer.
- Admin panel (built, mobile-first, installable): CRUD perfumes with photo cut-out, stock/hide, Excel import, Fragrantica helper (search link + paste-text parser; automatic fetching is blocked by Fragrantica), orders with states, manual sales, cash flow (sales from orders, expenses in USD/ARS, margin from per-size cost, monthly summary), offers billboard and bulk discounts. Login: password secret + signed cookie.
- Free hosting tier; domain undecided (starts on *.pages.dev).
- Catalog source: owner's Excel (5 sheets by type, ~1,215 rows, 240px photos, prices in USD, cotización in E2) imported from the admin panel; re-importing updates prices without overwriting manual edits.
- Undecided: real costs and stock per perfume, better product photos.

## Brand Commitments

- Name: ESSENZE — Parfum & Decants.
- Logo: gold perfume-bottle mark of interlocking rings on black, wide-tracked sans wordmark (`LOGO ESSENZE.png`). Colors gold and black are binding.
- Visual reference supplied by the user: `WEB DE REFERENCIA PROTOTIPO.png` (dark luxury minimal, gold accents, wide-tracked uppercase headings).
- Language: Spanish (Argentina, voseo: "Descubrí", "Elegí").

## Evidence on Hand

- `LOGO ESSENZE.png`, `WEB DE REFERENCIA PROTOTIPO.png`.
- No real product photos, prices, testimonials or catalog data yet. Sample perfumes in the site are placeholders and must be replaced by the owner's Excel; do not present invented reviews, ratings or claims.

## Product Principles

1. Ordering must be effortless on a phone: cart to WhatsApp in a few taps, message clear enough to fulfil without follow-up questions.
2. Scent information is the product: notes, accords and season are first-class, not hidden extras.
3. The owner must be able to run it alone: data and offers change without touching code.
4. Luxury through restraint: the catalog should feel like a boutique, never like a marketplace.
