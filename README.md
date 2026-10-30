# LogiPages AI — Plataforma Inteligente de Ventas & Landings de Alta Conversión

![LogiPages AI](public/brand/logipages-logo.png)

LogiPages AI es una plataforma SaaS diseñada para sellers de e-commerce, dropshipping, tiendas con pago contraentrega (Cash On Delivery - COD) y agencias de marketing en Latinoamérica y España.

---

## 🚀 Módulos Principales de la Plataforma

### 1. Generador de Landing Pages con IA & Editor Visual Ultra-Impactante
- **Asistente Inteligente Paso a Paso (`LandingWizardModal`)**: Convierte una fotografía o URL de producto en una landing page completa en 30 segundos.
- **Renderizador de Ultra Alto Impacto (`HighImpactLandingRenderer`)**:
  - Banner sticky superior de urgencia con cuenta regresiva en vivo y contador de stock.
  - Galería visual interactiva con zoom y selector de miniaturas.
  - Selector dinámico de combos (1 unidad básica, 2 unidades con 40% OFF *"MÁS VENDIDO / RECOMENDADO"*, 3 unidades pack familiar).
  - Testimonios con avatares reales, puntuación 4.9/5 estrellas y ciudades verificadas (Bogotá, Medellín, Cali, etc.).
  - **Formulario de Pedido 1-Click Contraentrega (COD)**: Selector de departamentos y municipios de Colombia, cálculo de envío gratis y botón pulsante *"PEDIR AHORA Y PAGAR AL RECIBIR"*.
  - Efecto de celebración con confeti y modal de confirmación con enlace directo a WhatsApp.
  - Notificaciones flotantes de prueba social en vivo (*"Andrés de Medellín acaba de pedir hace 3 minutos"*).
  - Barra sticky de compra inferior en versión móvil y botón flotante de WhatsApp.
- **Editor Visual en Tiempo Real (`LandingEditor`)**:
  - Vista adaptable: Desktop, Tablet y Móvil (marco simulado de smartphone).
  - Edición en tiempo real de titulares, textos, precios y variantes de combo.
  - **Copilot de IA**: Modifica el copy, estilo o urgencia mediante instrucciones en lenguaje natural.
- **Publicación Real Fuera del Editor**: Rutas públicas directas `/p/[slug]` con metadatos OpenGraph, SEO y captura funcional de pedidos.

- **Oferta seleccionada por defecto:** en el editor (pestaña *Ofertas*), marca *Seleccionada al abrir* en la oferta que quieres que aparezca elegida. Es independiente de *Destacada* (la etiqueta resaltada); si no marcas ninguna, se selecciona la destacada.
- **Contador de oferta:** en *Ofertas → Contador de oferta*, con dos modos: *termina cada día a medianoche* (hora del país de la landing) o *dura unas horas por visitante* (se guarda en su navegador; recargar no lo reinicia y al terminar empieza otra vez). Texto editable; aparece junto a las ofertas y en el formulario de pedido.

- **Formulario de pedido guiado:** celular con el número exacto de cifras del país (10 en Colombia, empezando por 3), con contador y formato automático; dirección por partes en Colombia (tipo de vía —calle, carrera, avenida, transversal, diagonal…—, número, # y placa, más apto/torre y barrio), con opción *Rural* para veredas y fincas. Nombre y apellido, celular, departamento, ciudad, dirección y barrio son obligatorios; el servidor también lo comprueba.

### 2. Llamadas IA (Vapi)
- Un agente de voz con IA llama a cada cliente, confirma producto, total y dirección, y marca el pedido como *Confirmado*, *Cancelado*, *Volver a llamar* o *Revisar*. Si el cliente corrige la dirección, se guarda la nueva.
- Horario de llamadas, espera tras el pedido, reintentos si no contesta, llamada de prueba a tu propio teléfono, e historial con resumen, transcripción y grabación.
- Se activa al configurar Vapi (ver sección [Llamadas IA (Vapi)](#llamadas-ia-vapi)).

### 3. Mensajes (WhatsApp)
- Confirmación automática de cada pedido por WhatsApp con una plantilla aprobada y dos botones: **Confirmar pedido** y **Cancelar**. La respuesta del cliente cambia el estado del pedido a *Confirmado* o *Cancelado*.
- Bandeja real guardada en Supabase: conversaciones, mensajes con su estado (enviado, entregado, leído, fallido) y el pedido vinculado. Respuestas de texto libre dentro de la ventana de 24 h de WhatsApp.
- Se activa solo cuando configuras las variables de WhatsApp (ver sección [WhatsApp](#whatsapp)).
- **Confirmación por WhatsApp al terminar el pedido:** si la landing tiene un número de WhatsApp, la pantalla final avisa que el pedido *no está confirmado* hasta que el cliente envíe el mensaje, explica los dos pasos (tocar el botón verde y luego **Enviar** en WhatsApp) y muestra un resumen de sus datos (producto, total, nombre, celular, dirección, ciudad, indicaciones) y abre WhatsApp tras una cuenta atrás de 7 s con el mensaje ya escrito (número de pedido, producto, total y sus datos). WhatsApp no permite que una página envíe el mensaje sola: el cliente siempre debe tocar **Enviar**. Se puede apagar en el editor de la landing. No necesita la API de WhatsApp.
- **Excel de pedidos:** en *Pedidos*, el botón **Descargar Excel** baja los pedidos que ves en la tabla (con los filtros aplicados) con todos sus datos.

### 4. Automatizaciones & Analíticas
- **Constructor de Flujos (`AutomationBuilder`)**: Nodos de disparadores (Nuevo Pedido, Llamada Confirmada, No Contesta), condiciones y acciones (Disparar llamada IA, Enviar WhatsApp oficial, Crear tarea humana, Webhook logístico).
- **Dashboard de Analíticas (`AnalyticsDashboard`)**: Embudo de conversión, tasa de confirmación por IA (84.6%), métricas de call center, mapa de calor y tabla de atribución por campañas UTM (Facebook Ads, TikTok Ads, Google).
- **Píxeles y CAPI**: Monitor de eventos para Meta Conversions API con deduplicación y respuesta Graph API 200 OK.

---

## 🛠️ Tecnologías Utilizadas

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS con paleta oficial LogiPages (`#FF252B`, `#FF5A16`, `#172C8A`, `#0D1B54`)
- **Iconos**: Lucide React
- **Micro-interacciones**: Canvas Confetti & animaciones CSS Keyframes
- **Persistencia**: LocalStorage reactivo (`lib/store.ts`) con sincronización en tiempo real

---

## 💻 Instrucciones para Ejecución Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Ejecutar servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. O compilar y ejecutar en modo producción:
   ```bash
   npm run build
   npm run start
   ```

4. Abrir en el navegador:
   `http://localhost:3000`

---

## 🌐 Publicar en internet (Supabase + Vercel)

Sin base de datos, las landings y los pedidos se guardan solo en tu navegador. Para que tus clientes vean las landings y sus pedidos te lleguen, hace falta Supabase.

### 1. Supabase (base de datos, gratis)
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
3. En **Project Settings → API Keys** copia la URL del proyecto y una **Secret key** (`sb_secret_…`, o la clave legacy **service_role**). Es secreta: nunca la compartas ni la subas al código. La clave *publishable* no sirve.

### 2. Variables de entorno
Ponlas en `.env.local` (en tu ordenador) y en Vercel (**Settings → Environment Variables**):

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de Supabase (`sb_secret_…`) |
| `ADMIN_PASSWORD` | Contraseña del panel (obligatoria al publicar) |
| `GEMINI_API_KEY` | Textos con IA |
| `REPLICATE_API_TOKEN` | Imágenes con nano-banana |
| `IMAGE_PROVIDER` | `replicate`, `gemini`, `cloudflare` o `auto` |
| `META_CAPI_ACCESS_TOKEN` | (Opcional) Conversions API de Meta: envía cada pedido desde el servidor |
| `WHATSAPP_*` | (Opcional) Confirmación de pedidos y bandeja de WhatsApp. Ver sección [WhatsApp](#whatsapp) |
| `VAPI_*`, `CRON_SECRET` | (Opcional) Llamadas de confirmación con IA. Ver sección [Llamadas IA (Vapi)](#llamadas-ia-vapi) |

### 3. GitHub y Vercel
1. Sube el proyecto a un repositorio **privado** de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
3. Añade las variables del paso 2 y pulsa **Deploy**.

La primera vez que abras el panel publicado, las landings que tenías en el navegador se suben solas a la base de datos.

> El plan gratuito de Vercel (Hobby) es para uso no comercial; para vender con anuncios usa el plan Pro.

## Cuentas (varias tiendas)
Cada persona entra con **su correo y contraseña**, y cada tienda (cuenta) tiene sus propias landings, pedidos, mensajes, equipo y configuración. Ninguna tienda ve los datos de otra.

### Activarlo (una sola vez)
1. **Supabase → SQL Editor:** ejecuta `supabase/migrations/004_accounts.sql`. Todo lo que ya tienes queda en tu tienda (`org_main`). La versión anterior sigue funcionando después de ejecutarlo, así que hazlo **antes** de publicar.
2. **Vercel:** agrega `AUTH_SECRET` (texto aleatorio largo) y deja `ADMIN_PASSWORD` como está. Redeploy.
3. Entra al panel: como aún no hay usuarios, te pide **crear la cuenta del dueño** con tu correo y la contraseña actual del panel (`ADMIN_PASSWORD`) para confirmar que eres tú.

### Equipo e invitaciones
En **Configuración → Equipo** creas un enlace de invitación (Equipo, Administrador o Dueño) y lo envías por WhatsApp. Vence en 7 días y sirve una vez. Si quitas a alguien, pierde el acceso en segundos. Cambiar la contraseña cierra las otras sesiones abiertas.

### Nuevas tiendas
- Con `SIGNUP_OPEN=true` cualquiera puede crear su tienda en `/registro` (por defecto está cerrado).
- Una misma persona puede estar en varias tiendas y cambiar entre ellas desde el menú (abajo a la izquierda).

### Conexiones de cada tienda (Integraciones)
Cada tienda conecta sus propias cuentas en **Integraciones**; las claves se comprueban con el proveedor y se guardan **cifradas** (`INTEGRATIONS_SECRET`, o `AUTH_SECRET` si falta).
- **WhatsApp:**
  - **Con su propia app de Meta:** pega token permanente, identificador del número, WABA ID y clave secreta de la app. El panel le da **su URL de webhook** (`/api/whatsapp/webhook/<tienda>`) y su token de verificación.
  - **"Conectar con Facebook"** (Embedded Signup): aparece cuando defines `META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID` y `META_VERIFY_TOKEN` (requiere que Meta te apruebe como Tech Provider). En Meta, la URL del webhook de la app de la plataforma es `/api/whatsapp/webhook`.
- **Plantillas:** se crean, se revisan y se eligen desde el panel (la de confirmación de pedidos con un clic).
- **Vapi**, **Claude (Anthropic)** y **Meta: API de conversiones**: cada tienda con su clave.
- Tu tienda (`INTEGRATIONS_ORG_ID`, por defecto `org_main`) sigue usando las claves de Vercel mientras no conecte otras en el panel. Para administrar las plantillas de ese número agrega `WHATSAPP_BUSINESS_ACCOUNT_ID`.
- La revisión automática (`/api/cron/run`) atiende a todas las tiendas con WhatsApp o Vapi conectados.

## Planes y pagos (Wompi)
Cada tienda nueva tiene **7 días de prueba gratis** del plan Pro, sin tarjeta. Después elige un plan en **Plan y pagos**:

| Plan | Precio/mes | Landings | Pedidos/mes | Personas | Respuestas IA incluidas |
|---|---|---|---|---|---|
| Básico | $99.000 | 3 | 300 | 2 | — (con su propia clave de Claude) |
| Pro | $199.000 | 15 | 2.000 | 5 | 1.000 |
| Escala | $399.000 | ilimitadas | ilimitados | 15 | 3.000 |

- **Formas de pago:** tarjeta con cobro automático cada mes, o un mes con PSE, Nequi, Bancolombia o tarjeta en la página de Wompi.
- **Si el plan vence:** el panel se bloquea (solo abre Plan y pagos) y las landings siguen recibiendo pedidos **3 días más**; luego se pausan. Nada se borra.
- **Cobro automático fallido:** se reintenta cada día; a la tercera falla se apaga el cobro automático.
- **Asistente IA:** usa la clave de Claude de la plataforma mientras queden respuestas del plan (la prueba trae 100); después, o en Básico, la tienda conecta su propia clave en Integraciones.
- Los pedidos por encima del límite **nunca se rechazan**; solo se avisa. Las landings y personas sí tienen tope.
- Tu tienda (`org_main`) no paga.

### Página de ventas
- Quien entra a tu dominio sin sesión ve la página de LogiPages (funciones, precios y preguntas). Quien ya inició sesión va directo al panel.
- Los precios salen de **Admin plataforma → Planes y precios**.
- Con `SIGNUP_OPEN=true` los botones llevan a crear la tienda; si no, a tu WhatsApp (`PLATFORM_WHATSAPP`) o al inicio de sesión.
- `/terminos` tiene los Términos del servicio. Pon tu nombre legal en `PLATFORM_COMPANY_NAME` y tu correo en `PLATFORM_SUPPORT_EMAIL`, y haz que un abogado los revise.

### Activarlo (una sola vez)
1. **Supabase → SQL Editor:** ejecuta `supabase/migrations/005_billing.sql` **antes** de publicar. Tu tienda queda sin costo y las otras tiendas que ya existan empiezan 7 días de prueba.
2. **Wompi** (comercios.wompi.co → Desarrolladores): copia las 4 llaves y agrégalas en Vercel: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`. Usa primero las de **pruebas** (`pub_test_…`): no cobran dinero real.
3. En Wompi → Desarrolladores → **URL de eventos**: `https://<tu-dominio>/api/billing/wompi/webhook`.
4. En Vercel agrega `PLATFORM_ADMIN_EMAILS` con tu correo: verás **Admin plataforma** en el menú (todas las tiendas, MRR, activar planes pagados por transferencia, dar días de prueba y editar precios).
5. Cuando quieras recibir tiendas nuevas, pon `SIGNUP_OPEN=true`.
6. Los cobros automáticos corren con la tarea programada (`/api/cron/run`), igual que los reintentos de llamadas.

## WhatsApp

Cada pedido nuevo recibe un WhatsApp con una plantilla aprobada y dos botones. Si el cliente toca **Confirmar pedido**, el pedido pasa a *Confirmado*; si toca **Cancelar**, a *Cancelado*, y se le responde con un mensaje corto. Las conversaciones aparecen en **Mensajes**. Sin las variables `WHATSAPP_*` todo funciona igual que antes, sin WhatsApp.

Necesitas Supabase configurado (sección anterior) y una cuenta de Meta Business.

### 1. Base de datos
En Supabase → **SQL Editor → New query**, pega [`supabase/migrations/002_whatsapp.sql`](supabase/migrations/002_whatsapp.sql) y pulsa **Run**. (Si instalas desde cero, `supabase/schema.sql` ya lo incluye.)

### 2. App y número en Meta
1. En [developers.facebook.com](https://developers.facebook.com/apps) crea una app de tipo **Business** (o usa la que ya tienes) y añádele el producto **WhatsApp**, vinculado a tu portafolio de Meta Business.
2. Registra tu número en **WhatsApp Manager → Herramientas de la cuenta → Números de teléfono** (no puede estar usándose en la app de WhatsApp normal).
3. En **WhatsApp → Configuración de la API** (o en WhatsApp Manager, al abrir el número) copia el **Identificador del número de teléfono** → `WHATSAPP_PHONE_NUMBER_ID`.
4. En **Configuración → Básica** de la app copia la **Clave secreta de la app** → `WHATSAPP_APP_SECRET`.

### 3. Token permanente
1. **Configuración del negocio (business.facebook.com/settings) → Usuarios → Usuarios del sistema → Agregar**, rol *Administrador*.
2. **Asignar activos**: tu app (control total) y tu cuenta de WhatsApp Business (control total).
3. **Generar token**: elige tu app, caducidad **Nunca** y los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Copia el token → `WHATSAPP_TOKEN`. Es secreto: solo en Vercel / `.env.local`.

### 4. Plantilla de confirmación
En **WhatsApp Manager → Plantillas de mensajes → Crear plantilla**:

- **Categoría:** Utilidad (*Utility*)
- **Nombre:** `confirmacion_pedido` → `WHATSAPP_CONFIRM_TEMPLATE`
- **Idioma:** Español (`es`) → `WHATSAPP_TEMPLATE_LANG` (si eliges *Español (COL)* pon `es_CO`)
- **Cuerpo** (variables numeradas):

  ```
  Hola {{1}}, recibimos tu pedido de {{2}} por {{3}}, con pago contraentrega en {{4}}. ¿Confirmas tu pedido para enviarlo?
  ```

  Ejemplos para la revisión de Meta: `{{1}}` Laura · `{{2}}` Faja moldeadora - 2 unidades · `{{3}}` $129.900 COP · `{{4}}` Medellín
- **Botones:** *Respuesta rápida* (Quick reply), en este orden:
  1. `Confirmar pedido`
  2. `Cancelar`

Espera a que el estado sea **Aprobada** (suele tardar minutos).

### 5. Variables en Vercel
En **Settings → Environment Variables** añade y vuelve a desplegar (**Deployments → Redeploy**):

| Variable | Valor |
|---|---|
| `WHATSAPP_TOKEN` | Token permanente del paso 3 |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador del número del paso 2 |
| `WHATSAPP_VERIFY_TOKEN` | Un texto aleatorio que inventes (lo usarás en el paso 6) |
| `WHATSAPP_APP_SECRET` | Clave secreta de la app del paso 2 |
| `WHATSAPP_CONFIRM_TEMPLATE` | `confirmacion_pedido` |
| `WHATSAPP_TEMPLATE_LANG` | `es` (o el código del idioma de tu plantilla) |

`META_GRAPH_VERSION` (opcional, por defecto `v26.0`) se comparte con la Conversions API.

### 6. Webhook
1. En la app de Meta → **WhatsApp → Configuración → Webhook → Editar**.
2. **URL de devolución de llamada:** `https://<tu-dominio>/api/whatsapp/webhook`
3. **Token de verificación:** el mismo valor de `WHATSAPP_VERIFY_TOKEN`. Pulsa **Verificar y guardar**.
4. En **Campos del webhook**, suscríbete a `messages`.

Comprueba el estado en **Integraciones** del panel: la tarjeta de WhatsApp debe decir *Configurado* y mostrar el número conectado, su nombre visible y su calidad (datos leídos de Meta).

### 7. Probar
En **Integraciones → WhatsApp**, escribe tu celular y:
1. **Probar conexión:** envía la plantilla `hello_world` de Meta. Si llega, el token y el número funcionan. Si falla, verás el error exacto de Meta.
2. **Probar mi plantilla:** envía tu plantilla de confirmación con datos de ejemplo. Toca un botón: si recibes "Mensaje de prueba recibido ✅", el webhook también funciona. No cambia ningún pedido.

Después haz un pedido de prueba real en una landing.

### Modo de confirmación
En **Integraciones → WhatsApp → Cómo se confirman los pedidos** eliges:
- **El cliente me escribe desde la landing (gratis):** no se envía ninguna plantilla. La landing lleva al cliente a WhatsApp con el mensaje ya escrito; cuando lo envía, el pedido se confirma y se le responde dentro de la conversación que él abrió (sin costo de plantilla). Pon el número de la API en el campo WhatsApp de cada landing.
- **Enviar la plantilla con botones a cada pedido:** tu número le escribe primero al cliente con *Confirmar pedido / Cancelar* (cada plantilla tiene un costo pequeño).

En el modo *El cliente me escribe desde la landing* puedes elegir **"Si el cliente no escribe en X minutos, le envío la plantilla"**: solo pagas plantilla por los clientes que no escribieron. Esto necesita la tarea programada (`CRON_SECRET` + un trabajo cada 5 min a `/api/cron/run`, ver la sección de Llamadas IA). En el detalle de cada pedido (**Pedidos**) también hay un botón **Enviar confirmación por WhatsApp** para mandarla a mano, y se ve si ya se envió, si falló o a qué hora está programada.

### Confirmación con el mensaje de la landing
Si el número de WhatsApp de la landing (editor → campo WhatsApp) es **el mismo número conectado a la API**, el mensaje que el cliente envía al terminar el pedido ("Quiero confirmar mi pedido… *Pedido:* LP-12345…") llega a **Mensajes**, el pedido pasa solo a *Confirmado* y el cliente recibe una respuesta automática. Si el cliente solo pregunta por su pedido (por ejemplo "¿cuándo llega el LP-12345?"), la conversación se vincula al pedido sin cambiar su estado.

> WhatsApp solo permite texto libre dentro de las 24 h siguientes al último mensaje del cliente. Fuera de esa ventana la bandeja lo indica y no envía nada.

### Asistente con IA
En **Automatizaciones → Asistente de WhatsApp con IA** activas un asistente (Claude, de Anthropic) que responde a los clientes: dudas de productos, precios, envío y pago (con la *Información del negocio* que escribes y tus landings publicadas) y el estado de sus pedidos y guías. Pasa el chat a una persona cuando hay reclamos, cambios, cancelaciones o algo que no sabe (queda en *Sin responder*, con nota y etiqueta).
1. Crea una clave en **console.anthropic.com → API Keys** y agrégala en Vercel como `ANTHROPIC_API_KEY`. Redeploy.
2. Escribe la información del negocio y pruébalo en el simulador de la misma tarjeta (no envía nada por WhatsApp).
3. Actívalo. Puede responder siempre o solo fuera de horario (el horario de *Respuestas automáticas*).
- **Cerrar la venta en el chat** (activado por defecto): recomienda la oferta, resuelve objeciones, pide los datos de envío (valida celular y dirección con tipo de vía, números y barrio, como el formulario de la landing), muestra el resumen y, cuando el cliente confirma, crea el pedido **ya confirmado** en Pedidos (origen *Asistente WhatsApp*, campaña `asistente-ia`). El precio sale siempre de la oferta de la landing. Si lo apagas, manda al cliente a comprar en la landing.
- Si una persona responde un chat desde **Mensajes**, el asistente se calla en ese chat; se devuelve con **Devolver al asistente**.
- Espera unos segundos antes de responder, para contestar varios mensajes seguidos juntos. Tiene un límite de respuestas por cliente al día.
- Se cobra por uso en tu cuenta de Anthropic (el simulador muestra el costo aproximado de cada prueba).

## Llamadas IA (Vapi)

Un agente de voz llama al cliente después del pedido, confirma producto, cantidad, total a pagar y dirección, y deja el pedido en *Confirmado*, *Cancelado*, *Reintento* (pidió que lo llamen después o no contestó) o *Revisar* (dudas, cambios o una situación poco clara). Todo se ve en **Llamadas IA**: resumen, transcripción, grabación y costo de cada llamada. Sin las variables `VAPI_*` no se hace ninguna llamada.

Necesitas Supabase configurado. Vapi cobra por minuto (agente + voz + transcripción) y tu proveedor de telefonía cobra la llamada.

### 1. Base de datos
En Supabase → **SQL Editor**, ejecuta [`supabase/migrations/003_vapi.sql`](supabase/migrations/003_vapi.sql).

### 2. Cuenta y número en Vapi
1. Crea una cuenta en [dashboard.vapi.ai](https://dashboard.vapi.ai) y añade saldo (**Billing**).
2. **Número de teléfono:** los números gratis de Vapi **no** pueden hacer llamadas salientes. Compra un número en [Twilio](https://www.twilio.com) (o Telnyx/Vonage) e impórtalo en Vapi → **Phone Numbers → Import** (Twilio: Account SID, Auth Token y el número).
   - Un número local de tu país (por ejemplo +57 en Colombia) tiene más respuesta que uno extranjero. Twilio pide documentos para números de algunos países.
   - En Twilio → **Voice → Settings → Geo permissions**, activa las llamadas al país de tus clientes.
3. Copia el **ID** del número importado → `VAPI_PHONE_NUMBER_ID`.
4. **API Keys** → copia la clave **privada** → `VAPI_API_KEY`.

No hace falta crear el asistente en Vapi: la app lo arma en cada llamada con los datos del pedido y la configuración de **Llamadas IA**, y le indica el webhook `https://<tu-dominio>/api/vapi/webhook`.

### 3. Variables en Vercel
**Settings → Environment Variables**, y después **Redeploy**:

| Variable | Valor |
|---|---|
| `VAPI_API_KEY` | Clave privada de Vapi |
| `VAPI_PHONE_NUMBER_ID` | ID del número importado |
| `VAPI_WEBHOOK_SECRET` | Texto aleatorio largo (protege el webhook) |
| `CRON_SECRET` | Otro texto aleatorio largo (protege la tarea programada) |
| `PUBLIC_BASE_URL` | (Opcional) `https://tu-dominio.com`. Si no la pones se usa el dominio de producción de Vercel |

Las llamadas deben hacerse desde el dominio de **producción**: las versiones de prueba de Vercel suelen estar protegidas y Vapi no podría avisar del resultado.

### 4. Tarea programada (reintentos y llamadas fuera de horario)
Las llamadas inmediatas no la necesitan. Para los reintentos, la espera antes de llamar y los pedidos que llegan fuera de horario, algo debe llamar cada 5–10 minutos a:

```
GET https://<tu-dominio>/api/cron/run
Authorization: Bearer <CRON_SECRET>
```

- **Gratis, dentro de Supabase (recomendado):** pon `CRON_SECRET` en Vercel y haz Redeploy. En el panel → **Integraciones → WhatsApp** (opción "si el cliente no escribe…") aparece **Revisión automática** con el botón **Copiar código SQL**, que ya trae tu dominio y tu clave. Pégalo en Supabase → SQL Editor → Run. Supabase (pg_cron + pg_net) llamará a la tarea cada 5 minutos; el panel muestra cuándo fue la última revisión.
- **Gratis, con un servicio externo:** en [cron-job.org](https://cron-job.org) crea un trabajo cada 5 minutos con esa URL y, en *Advanced → Headers*, la cabecera `Authorization: Bearer <CRON_SECRET>`. Si la herramienta no permite cabeceras, usa `https://<tu-dominio>/api/cron/run?secret=<CRON_SECRET>`.
- **Vercel Pro:** crea `vercel.json` con `{"crons":[{"path":"/api/cron/run","schedule":"*/5 * * * *"}]}`. Vercel envía la cabecera con `CRON_SECRET` solo. (El plan Hobby solo permite tareas diarias y el despliegue falla con esa frecuencia.)

La misma tarea cierra las llamadas cuyo aviso de Vapi no llegó y envía las plantillas de WhatsApp de respaldo.

Como respaldo, las visitas a las landings y el panel también ejecutan estas tareas (como máximo una vez cada 3 minutos), así que siguen funcionando aunque la tarea programada falle; pero si no hay movimiento (por ejemplo de noche) solo la tarea programada las ejecuta.

### 5. Configurar y probar
En el panel, **Llamadas IA**:
1. Elige nombre y voz del agente, la primera frase, el horario y los reintentos. En *Instrucciones adicionales* pon datos de tu tienda (tiempos de envío, garantía…). Pulsa **Guardar**.
2. **Llamada de prueba:** escribe tu número y pulsa **Llamarme ahora**. Responde como un cliente; el resultado aparece en el historial. No cambia ningún pedido.
3. Activa **Llamar automáticamente a cada pedido nuevo** cuando estés contento. También puedes llamar a mano con el botón **Llamar** en Pedidos.

> Si también usas la confirmación por WhatsApp, pon unos 15 minutos de espera antes de llamar: si el cliente confirma por WhatsApp antes, no se le llama.

