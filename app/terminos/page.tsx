import type { Metadata } from 'next';
import Link from 'next/link';
import { GRACE_DAYS, TRIAL_DAYS } from '@/lib/plans';

export const metadata: Metadata = { title: 'Términos del servicio · Konnexa', robots: { index: true, follow: true } };

// Terms of service of the Konnexa platform (for the stores that use it). Operator data comes from env.
export default function TermsPage() {
  const company = process.env.PLATFORM_COMPANY_NAME?.trim() || 'Konnexa';
  const email = process.env.PLATFORM_SUPPORT_EMAIL?.trim();
  const contact = email ? `al correo ${email}` : 'por los canales de atención publicados en el sitio';
  const h2 = 'text-lg font-semibold text-slate-900 mt-8 mb-2';
  const p = 'text-[15px] leading-relaxed text-slate-700';
  const li = 'text-[15px] leading-relaxed text-slate-700';

  return (
    <main className="min-h-screen bg-white">
      <article className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/">
          <img src="/brand/konnexa-logo.png" alt="Konnexa" className="h-8 w-auto mb-10" />
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Términos del servicio</h1>
        <p className="text-sm text-slate-500 mt-2">{company} · Última actualización: octubre de 2026</p>

        <p className={`${p} mt-6`}>
          Estos términos regulan el uso de Konnexa, la plataforma de {company} para crear landing pages, recibir y confirmar pedidos contraentrega y atender clientes por
          WhatsApp (&quot;el Servicio&quot;). Al crear una cuenta o usar el Servicio aceptas estos términos en nombre propio y de la tienda que registras.
        </p>

        <h2 className={h2}>1. Cuenta y tienda</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>Debes dar datos reales y mantener segura tu contraseña. Eres responsable de lo que hagan las personas que invites a tu tienda.</li>
          <li className={li}>Cada tienda tiene sus datos separados. Puedes invitar personas según el límite de tu plan.</li>
        </ul>

        <h2 className={h2}>2. Prueba gratis, planes y pagos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>Las tiendas nuevas tienen {TRIAL_DAYS} días de prueba gratis sin tarjeta. Al terminar, para seguir usando el panel debes elegir un plan.</li>
          <li className={li}>Los planes se cobran por mes y por adelantado, en pesos colombianos, con los precios publicados en el sitio al momento del cobro.</li>
          <li className={li}>
            Los pagos se procesan con Wompi (Bancolombia). Si guardas una tarjeta, autorizas el cobro automático de cada mes en la misma fecha hasta que lo canceles. Si un
            cobro falla, lo reintentamos hasta 3 veces.
          </li>
          <li className={li}>Puedes cancelar la renovación cuando quieras desde Plan y pagos; conservas el servicio hasta el final del periodo pagado. No hacemos reembolsos por periodos parciales.</li>
          <li className={li}>Podemos cambiar los precios avisando con al menos 30 días de anticipación; el cambio aplica desde el siguiente cobro.</li>
        </ul>

        <h2 className={h2}>3. Si el plan vence</h2>
        <p className={p}>
          Si tu plan vence o no se puede cobrar, el panel queda limitado a Plan y pagos y tus landings siguen recibiendo pedidos durante {GRACE_DAYS} días; después se pausan.
          Tus datos no se borran: al pagar, todo vuelve a funcionar.
        </p>

        <h2 className={h2}>4. Límites de uso</h2>
        <p className={p}>
          Cada plan incluye un número de landings, personas, pedidos al mes y respuestas del asistente con IA. Los pedidos por encima del límite no se rechazan. Las respuestas
          incluidas del asistente se renuevan cada mes y no se acumulan.
        </p>

        <h2 className={h2}>5. Uso aceptable</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>
            Debes cumplir la ley colombiana, incluidas las normas de protección al consumidor y de datos personales, y las políticas de Meta (WhatsApp Business) y de los demás
            servicios que conectes.
          </li>
          <li className={li}>No puedes vender productos ilegales o falsificados, enviar mensajes no solicitados (spam), suplantar a otros ni publicar contenido engañoso.</li>
          <li className={li}>Podemos suspender una tienda que incumpla estos puntos o que ponga en riesgo el Servicio o a otros usuarios.</li>
        </ul>

        <h2 className={h2}>6. Datos de tus clientes</h2>
        <p className={p}>
          Tu tienda es la responsable de los datos de sus clientes (nombre, teléfono, dirección y mensajes) y debe tener su propia política de privacidad. {company} actúa como
          encargado: los guarda y procesa solo para prestarte el Servicio, con medidas de seguridad razonables, y no los vende ni los usa para otros fines. Las claves que
          conectas (WhatsApp, Vapi, Claude, Meta) se guardan cifradas.
        </p>

        <h2 className={h2}>7. Servicios de terceros e inteligencia artificial</h2>
        <p className={p}>
          El Servicio usa proveedores externos (por ejemplo Meta, Wompi, Vapi, Anthropic y los proveedores de alojamiento). Su disponibilidad y costos no dependen de nosotros;
          los cargos de Meta por mensajes de WhatsApp y de Vapi por llamadas los paga cada tienda en su propia cuenta. Los textos, imágenes, llamadas y respuestas generados con
          IA pueden tener errores: revísalos antes de publicarlos y supervisa las conversaciones con tus clientes.
        </p>

        <h2 className={h2}>8. Disponibilidad y responsabilidad</h2>
        <p className={p}>
          Hacemos lo posible por mantener el Servicio disponible y seguro, pero puede tener interrupciones o fallas. En la medida permitida por la ley, nuestra responsabilidad
          total frente a ti se limita al valor que pagaste por el Servicio en los últimos 3 meses, y no respondemos por ventas, pedidos o ganancias dejadas de percibir.
        </p>

        <h2 className={h2}>9. Terminación</h2>
        <p className={p}>
          Puedes dejar de usar el Servicio en cualquier momento. Si quieres que eliminemos tu tienda y sus datos, escríbenos {contact}. Podemos conservar la información que la
          ley nos obligue a guardar.
        </p>

        <h2 className={h2}>10. Cambios y ley aplicable</h2>
        <p className={p}>
          Podemos actualizar estos términos; te avisaremos de los cambios importantes en el panel o por correo. Se rigen por las leyes de la República de Colombia.
        </p>

        <h2 className={h2}>Contacto</h2>
        <p className={p}>Para cualquier duda sobre estos términos, escríbenos {contact}.</p>
      </article>
    </main>
  );
}
