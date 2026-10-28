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

### 2. Agente de Voz con IA & Simulador Interactivo
- **Configuración de Agente (`VoiceAgentSettings`)**:
  - Proveedores: LogiPages Simulator (Web Speech API nativo), Vapi AI (<500ms latencia), Retell AI y Twilio Voice.
  - Acentos y regionalismos: Colombia 🇨🇴, México 🇲🇽, España 🇪🇸, Argentina 🇦🇷 y Neutro 🌎.
  - Guion interactivo con chips dinámicos (`{{cliente}}`, `{{producto}}`, `{{direccion}}`, `{{total}}`).
  - Ventana de horarios permitidos (ej. 08:30 a 19:30) con estado en tiempo real.
- **Simulador Telefónico Interactivo (`VoiceCallSimulatorModal`)**:
  - Interfaz de smartphone con Dynamic Island y espectro de audio animado cuando el agente habla.
  - Síntesis auditiva con voz en español (`speechSynthesis`) y transcripción en vivo con marcas de tiempo.
  - Disparadores rápidos de respuesta del cliente: Confirmar afirmativamente, solicitar cambio de dirección o cancelar pedido cortésmente.
  - Entrada de voz por micrófono mediante Web Speech Recognition.

### 3. Mensajes (WhatsApp)
- Confirmación automática de cada pedido por WhatsApp con una plantilla aprobada y dos botones: **Confirmar pedido** y **Cancelar**. La respuesta del cliente cambia el estado del pedido a *Confirmado* o *Cancelado*.
- Bandeja real guardada en Supabase: conversaciones, mensajes con su estado (enviado, entregado, leído, fallido) y el pedido vinculado. Respuestas de texto libre dentro de la ventana de 24 h de WhatsApp.
- Se activa solo cuando configuras las variables de WhatsApp (ver sección [WhatsApp](#whatsapp)).
- **Redirección a WhatsApp al terminar el pedido:** si la landing tiene un número de WhatsApp, el cliente pasa automáticamente a un chat con ese número y con el mensaje del pedido ya escrito (número de pedido, producto, total y sus datos). Se puede apagar en el editor de la landing. No necesita la API de WhatsApp.
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

### 3. GitHub y Vercel
1. Sube el proyecto a un repositorio **privado** de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
3. Añade las variables del paso 2 y pulsa **Deploy**.

La primera vez que abras el panel publicado, las landings que tenías en el navegador se suben solas a la base de datos.

> El plan gratuito de Vercel (Hobby) es para uso no comercial; para vender con anuncios usa el plan Pro.

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

Comprueba el estado en **Integraciones** del panel: la tarjeta de WhatsApp debe decir *Configurado*. Haz un pedido de prueba con tu propio número.

> WhatsApp solo permite texto libre dentro de las 24 h siguientes al último mensaje del cliente. Fuera de esa ventana la bandeja lo indica y no envía nada.

