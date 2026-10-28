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

### 3. CRM Omnicanal (Bandeja Compartida de 3 Columnas)
- **Columna Izquierda**: Bandeja unificada (WhatsApp oficial Meta Cloud, Instagram, Messenger, Webchat), filtros por estado y asignación de asesores.
- **Columna Central**: Línea de tiempo conversacional con diferenciación de burbujas (Cliente, Asesor Humano, Bot de IA) y **Notas Internas de Equipo** protegidas con candado 🔒. Selector de respuestas rápidas (`/`) y plantillas oficiales de WhatsApp Meta HSM.
- **Columna Derecha (Expediente 360°)**: Ficha de cliente, LTV acumulado, pedidos vinculados con estado de despacho, llamadas de IA realizadas y gestor de etiquetas.

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

### 3. GitHub y Vercel
1. Sube el proyecto a un repositorio **privado** de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
3. Añade las variables del paso 2 y pulsa **Deploy**.

La primera vez que abras el panel publicado, las landings que tenías en el navegador se suben solas a la base de datos.

> El plan gratuito de Vercel (Hobby) es para uso no comercial; para vender con anuncios usa el plan Pro.
