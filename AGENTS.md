# Konnexa — guía para agentes de código (OpenCode, Claude Code…)

Lee esto antes de tocar el código. Resume cómo está hecho Konnexa y cómo trabajamos con el dueño.

## Cómo trabajar con el dueño (Willington)

- **Responde siempre en español**, en palabras simples: es el dueño del negocio, no un programador. Primero el resultado, después los detalles.
- **Nunca le pidas que pegue tokens, llaves o contraseñas en el chat.** Los secretos van solo en Vercel → Settings → Environment Variables (o en el formulario de Integraciones del panel). Si hace falta uno, dile dónde ponerlo.
- **Pregunta antes de fusionar un PR.** Cuando responde "si" o "fusione" a un PR, ya puedes fusionarlo.
- No inventes resultados: si no pudiste probar algo con el servicio real (WhatsApp, Dropi, Meta, Claude), dilo.
- Cada cambio: rama → commit → PR con descripción en español → preguntar → fusionar.
- No pongas nombres de modelos de IA en commits, PRs ni comentarios.

## Qué es

SaaS multi-tienda para tiendas de **pago contraentrega** (Colombia principalmente): landings con IA, pedidos, bandeja de WhatsApp / Messenger / Instagram con asistente IA, llamadas IA (Vapi), Meta Ads (Creativos), Dropi, agenda de citas, flujos, equipo y cobro de planes con Wompi. Dominio: konnexa.lat.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind. Desplegado en **Vercel**.
- **Supabase** (Postgres + Storage, bucket público `landing-images`). Esquema en `supabase/schema.sql` y `supabase/migrations/`.
- IA: **Anthropic** (`@anthropic-ai/sdk`) para el asistente y las landings; **Whisper en Groq** (`GROQ_API_KEY`, `lib/server/transcribe.ts`) para transcribir notas de voz, con **Gemini** de respaldo; Gemini también para imágenes.
- `ffmpeg-static` convierte audios a nota de voz de WhatsApp (OGG/Opus). `next.config.js` incluye el binario en las rutas que lo usan (`outputFileTracingIncludes`).

## Cómo está organizado

- `app/` páginas del panel y `app/api/` rutas del servidor. `middleware.ts` protege todo salvo las rutas públicas.
- `lib/` código compartido (tipos en `lib/types.ts`, reglas de negocio puras). `lib/server/` solo servidor.
- `components/` interfaz por sección (`crm/` = Mensajes, `orders/`, `ads/` = Creativos, `products/`, `integrations/`, `automations/`, `stores/` = Mis tiendas, `account/`, `layout/`).

### Multi-tienda (importante)

- Cada tienda es una `organization`; las personas entran por `memberships` con rol `owner` | `admin` | `member`.
- `db()` (en `lib/server/db.ts`) ya filtra por la tienda de la sesión. `rawDb()` ve todo: úsalo solo cuando de verdad necesites otra tienda.
- `currentOrgId()`, `currentRole()`, `runWithOrg()` en `lib/server/tenant.ts`. `requireManager()` (owner/admin) en `lib/server/integrations-api.ts`.
- Mucha configuración se guarda como JSON en la tabla `settings` (una fila por tienda e `id`), por ejemplo: `integrations` (llaves cifradas), `wa_bot` (asistente), `wa_bot_state` (estado por chat), `wa_agents` (asesores), `wa_conv_assign`, `wa_products` (productos de WhatsApp), `wa_product_media` (fotos y nota de voz por producto), `store_logo`.

### Piezas principales

- **Asistente IA**: `lib/bot.ts` (ajustes y tipos) y `lib/server/bot.ts` (instrucciones, herramientas, `runBot`). Lo dispara `lib/server/bot-inbound.ts` al llegar un mensaje. Herramientas: `consultar_pedidos`, `crear_pedido`, `pasar_a_humano`, `enviar_medios` (fotos y nota de voz del producto, una vez por cliente). Las instrucciones están escritas para que converse corto y paso a paso: no las vuelvas "vendedoras".
- **WhatsApp Cloud API**: `lib/server/whatsapp.ts` (envío de texto, plantillas, `sendMedia`), webhook en `app/api/whatsapp/webhook`, guardado en `lib/server/wa-store.ts`. Ventana de 24 h: fuera de ella solo plantillas.
- **Mensajes (bandeja)**: `components/crm/OmnichannelInbox.tsx`; adjuntos en `components/crm/ChatAttach.tsx` (subida directa a Storage con enlace firmado, porque Vercel no acepta peticiones de más de 4,5 MB).
- **Equipo y reparto**: `lib/server/crm-store.ts` (asesores, asignaciones, `ensureAgentFor` crea el asesor al aceptar la invitación). Invitaciones por correo con Resend: `lib/server/invite-email.ts`.
- **Productos de WhatsApp** (sin landing): `lib/products.ts`, `lib/server/products.ts` (ids `prd-…`, no tienen fila en `landings`; por eso el pedido guarda `landing_id` vacío). `sellables()` = landings publicadas + productos activos.
- **Pedidos a mano**: `lib/server/manual-order.ts` y `components/orders/NewOrderModal.tsx`.
- **Dropi**: `lib/server/dropi.ts` (API, igual que el plugin oficial de WooCommerce) y Excel de carga masiva `lib/dropi-bulk.ts`.
- **Rentabilidad** (`/rentabilidad`, solo dueño y administradores): cálculo puro en `lib/profit.ts` (`computeProfit`: utilidad proyectada = confirmados × % de entrega; real = entregados vs devueltos), datos en `lib/server/profit.ts` (settings `profit_config` y `profit_ledger`), pauta de Meta por día con `adDailySpend` (`lib/server/meta-ads.ts`), comprobantes por `app/api/profit/receipt` (nunca se muestra el enlace público). Pedidos tienen estado `returned` (Devuelto).
- **Avisos push** (con Konnexa cerrado): `lib/server/push.ts` (`pushToStore`; llaves VAPID creadas solas y dispositivos por persona en `platform_settings`), `lib/push-client.ts`, `components/layout/PushAlerts.tsx`, evento `push` en `public/sw.js`. Se avisa cuando la IA pasa un chat y cuando un mensaje solo lo puede contestar una persona; va al asesor asignado o, si no hay, a todos.
- **Landings con IA**: el asistente (`components/landings/LandingWizardModal.tsx`) solo ofrece la plantilla Impacto (`template: 'impact'`, contenido en `config.impact`) en 5 estilos, definidos en `lib/landing-styles.ts`: Impacto Premium, Explosivo, Lujo Noir, Clínico Limpio y Neón Futurista (`config.impact.style`). Todos se ven con `components/landings/ImpactSections.tsx` dentro de `SalesPageRenderer`, que conserva el formulario de pedido. Cada estilo tiene una muestra en `/muestra/[style]` (producto de ejemplo en `lib/landing-demo.ts`) y una miniatura en `public/landing-styles/` (regenérala con capturas de esa ruta si cambias el diseño). Claude escribe con `app/api/landing/generate` (modo `impact` + `impactStyle`, con voz, paleta y fotos por estilo y reglas de publicidad); las fotos salen de `app/api/landing/image` (modos `pack` e `ingredient`). Precios siempre de las ofertas; reseñas solo las del vendedor. Los modos antiguos (Secciones de imagen y Página de marca) siguen en el código para las páginas viejas, pero el asistente ya no los ofrece.
- **Cobros**: `lib/plans.ts`, `lib/server/billing.ts`, Wompi. Las tiendas del administrador de la plataforma (`PLATFORM_ADMIN_EMAILS`) no pagan.

## Cómo probar

- `npx tsc --noEmit -p .` (tipos) y `npx next build` antes de cada PR.
- **No hay pruebas automáticas en el repositorio todavía.** Hasta ahora se probó con servicios falsos locales (Supabase, WhatsApp/Graph, Claude, Gemini, Resend, Dropi simulados) y Playwright para la interfaz. Pasar esas pruebas al repo con CI es una tarea pendiente.
- Lo que no se puede probar fuera de producción (WhatsApp real, Dropi real, la IA real): pídele al dueño que lo pruebe y te mande captura.
- `next build` / `next dev` pueden modificar `tsconfig.json`: no lo subas en el commit (`git checkout tsconfig.json`).

## Pendientes conocidos

1. **Dropi API**: la cuenta responde "Access denied". Se escribió a Dropi (marcos.amado@dropi.co, cc juan.caicedo@dropi.co) para que habiliten la API. Mientras tanto se usa el Excel "Para Dropi". Falta confirmar si Dropi acepta `SI` en la columna CON RECAUDO.
2. **Notas de voz y archivos en WhatsApp real**: confirmar que el audio llega como nota de voz y que videos y documentos se envían bien desde Mensajes.
3. **Permisos del rol Equipo (`member`)**: todavía puede cambiar el asistente, la configuración general, borrar pedidos y landings, y editar etiquetas. Cerrar esos permisos con `requireManager()` en esas rutas.
4. **Pruebas en el repo + CI** (ver arriba).
5. Fotos y nota de voz del asistente: solo WhatsApp; falta Messenger e Instagram.
6. Opciones que se le ofrecieron al dueño y no se hicieron: dominio propio por tienda (necesita `VERCEL_TOKEN`), "invitar a todas mis tiendas", que un administrador cree tiendas a nombre del dueño, pausar anuncios desde Creativos (necesita permisos de gestión de Meta).
7. Revisión de Meta (Tech Provider): incluir los permisos de comentarios y mensajería.

## Costos (para no sorprender al dueño)

- La llave de Anthropic de la app (en Vercel) paga el asistente de WhatsApp. Si usas la misma cuenta para programar, comparten saldo: recomienda una llave aparte con límite de gasto.
- Preferir el modelo más barato que sirva; avisar antes de cambios que suban el consumo de IA.
