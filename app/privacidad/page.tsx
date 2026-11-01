import type { Metadata } from 'next';
import Link from 'next/link';
import { operatorLine, platformOperator } from '@/lib/platform';

export const metadata: Metadata = { title: 'Política de privacidad · Konnexa', robots: { index: true, follow: true } };

// Privacy policy of the Konnexa platform. It is the policy linked in the Meta app (WhatsApp, Facebook Login, ads),
// so it explains which Meta data we use and why. Operator data comes from env (lib/platform.ts).
export default function PrivacyPage() {
  const op = platformOperator();
  const company = op.name || 'Konnexa';
  const opLine = operatorLine(op);
  const channels = [op.email && `el correo ${op.email}`, op.whatsapp && `el WhatsApp +${op.whatsapp}`].filter(Boolean).join(' o ') || 'los canales de atención publicados en konnexa.lat';
  const h2 = 'text-lg font-semibold text-slate-900 mt-8 mb-2';
  const p = 'text-[15px] leading-relaxed text-slate-700';
  const li = 'text-[15px] leading-relaxed text-slate-700';

  return (
    <main className="min-h-screen bg-white">
      <article className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/">
          <img src="/brand/konnexa-logo.png" alt="Konnexa" className="h-8 w-auto mb-10" />
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Política de privacidad</h1>
        <p className="text-sm text-slate-500 mt-2">Konnexa · Última actualización: noviembre de 2026</p>

        <p className={`${p} mt-6`}>
          Konnexa es una plataforma para que tiendas en línea creen páginas de venta, reciban pedidos contraentrega, atiendan a sus clientes por WhatsApp y midan sus
          anuncios. {opLine ? `Konnexa es operada por ${opLine} ("${company}", "nosotros").` : `En esta política, "nosotros" es el operador de Konnexa.`} Esta política
          explica qué datos tratamos, para qué, con quién los compartimos y cómo puedes ejercer tus derechos, de acuerdo con la Ley 1581 de 2012 de Colombia y sus
          decretos reglamentarios.
        </p>

        <h2 className={h2}>1. Quién es responsable de cada dato</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>
            <strong>Datos de las tiendas y sus usuarios</strong> (quienes crean una cuenta en Konnexa): {company} es responsable de su tratamiento.
          </li>
          <li className={li}>
            <strong>Datos de los clientes de cada tienda</strong> (quienes hacen un pedido o escriben por WhatsApp a una tienda): la tienda es la responsable y {company}{' '}
            actúa como encargado, tratándolos solo para prestarle el servicio a esa tienda y según sus instrucciones. Cada tienda solo ve sus propios datos.
          </li>
        </ul>

        <h2 className={h2}>2. Qué datos tratamos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>De los usuarios de las tiendas: nombre, correo, contraseña (guardada cifrada), rol en la tienda y datos de facturación del plan.</li>
          <li className={li}>
            De los clientes de las tiendas: nombre, celular, dirección de entrega, detalles del pedido, mensajes de WhatsApp intercambiados con la tienda y, si la tienda
            confirma por teléfono, la grabación y transcripción de la llamada.
          </li>
          <li className={li}>Datos técnicos de visitas a las páginas de venta (navegador, dirección IP, anuncio o campaña de origen) para medir los anuncios de la tienda.</li>
          <li className={li}>Las claves y tokens de acceso que cada tienda conecta (WhatsApp, Meta, Claude, llamadas), guardados cifrados.</li>
        </ul>

        <h2 className={h2}>3. Datos de Meta (WhatsApp, Facebook e Instagram)</h2>
        <p className={p}>Cuando una tienda conecta sus cuentas de Meta a Konnexa, usamos los permisos que ella autoriza únicamente para lo siguiente:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li className={li}>
            <strong>WhatsApp Business</strong> (whatsapp_business_messaging y whatsapp_business_management): enviar y recibir los mensajes de la tienda con sus clientes,
            mostrar esas conversaciones en el panel de la tienda, gestionar sus plantillas de mensajes y conocer el estado y la calidad de su número.
          </li>
          <li className={li}>
            <strong>Eventos de WhatsApp</strong> (whatsapp_business_manage_events): avisarle a Meta, en nombre de la tienda, cuando una conversación que llegó desde un
            anuncio terminó en una venta confirmada, para que sus anuncios se optimicen.
          </li>
          <li className={li}>
            <strong>Anuncios</strong> (ads_read): leer el gasto, los resultados y las imágenes de los anuncios de la tienda para mostrarle cuáles venden y cuáles no. Es
            solo lectura: Konnexa no crea, cambia ni pausa anuncios.
          </li>
          <li className={li}>
            <strong>API de conversiones</strong>: enviar a Meta, con el píxel de la tienda, los pedidos y ventas confirmadas de sus páginas. El nombre, el teléfono y la
            ciudad se envían cifrados (hash).
          </li>
        </ul>
        <p className={`${p} mt-2`}>
          No vendemos datos de Meta ni de ninguna otra fuente, no los usamos para publicidad propia ni para crear perfiles, y no los compartimos con otras tiendas. Cada
          tienda solo accede a los datos de sus propias cuentas.
        </p>

        <h2 className={h2}>4. Para qué usamos los datos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>Prestar el servicio: páginas de venta, pedidos, mensajes, asistente con inteligencia artificial, llamadas de confirmación y reportes.</li>
          <li className={li}>Crear y administrar las cuentas, cobrar los planes y enviar avisos del servicio (bienvenida, pagos, recuperación de contraseña).</li>
          <li className={li}>Dar soporte, prevenir fraudes y abusos, y cumplir obligaciones legales.</li>
        </ul>

        <h2 className={h2}>5. Con quién los compartimos</h2>
        <p className={p}>Solo con proveedores que nos ayudan a prestar el servicio, con los datos necesarios y bajo obligaciones de confidencialidad:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li className={li}>Alojamiento y base de datos: Vercel y Supabase.</li>
          <li className={li}>Meta Platforms (WhatsApp Business, API de conversiones y anuncios), según lo descrito arriba.</li>
          <li className={li}>
            Inteligencia artificial: Anthropic (Claude) para el asistente de WhatsApp y la redacción de páginas, y Google (Gemini) para las imágenes. Solo les enviamos lo
            necesario para cada respuesta o imagen.
          </li>
          <li className={li}>Pagos de los planes: Wompi. Correos: Resend. Llamadas de confirmación, cuando la tienda las activa: Vapi y su operador telefónico.</li>
          <li className={li}>Autoridades, cuando la ley lo exija.</li>
        </ul>
        <p className={`${p} mt-2`}>Algunos de estos proveedores procesan los datos fuera de Colombia, con medidas de seguridad adecuadas.</p>

        <h2 className={h2}>6. Seguridad</h2>
        <p className={p}>
          Las conexiones usan HTTPS, las contraseñas se guardan cifradas y los tokens de acceso de las tiendas se guardan cifrados. Cada tienda está separada de las
          demás y el acceso del equipo de cada tienda depende de su rol.
        </p>

        <h2 className={h2}>7. Cuánto tiempo los guardamos</h2>
        <p className={p}>
          Mientras la tienda tenga su cuenta activa y luego el tiempo necesario para cumplir obligaciones legales y contables. Cuando una tienda desconecta una cuenta de
          Meta, dejamos de usar su token de inmediato y lo borramos.
        </p>

        <h2 className={h2}>8. Tus derechos</h2>
        <p className={p}>
          Puedes conocer, actualizar y corregir tus datos, pedir prueba de tu autorización, saber cómo los hemos usado, presentar quejas ante la Superintendencia de
          Industria y Comercio, revocar tu autorización y pedir que los eliminemos, salvo cuando debamos conservarlos por ley. Si eres cliente de una tienda, también
          puedes dirigirte directamente a esa tienda.
        </p>

        <h2 id="eliminar-datos" className={h2}>9. Cómo pedir que eliminemos tus datos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>
            <strong>Tiendas:</strong> desde Integraciones puedes desconectar en cualquier momento WhatsApp, Meta Ads y las demás cuentas. Para eliminar tu tienda y todos
            sus datos, escríbenos a {channels} desde el correo de la cuenta, con el asunto &quot;Eliminar mi tienda&quot;.
          </li>
          <li className={li}>
            <strong>Clientes de una tienda:</strong> escríbenos a {channels} con el asunto &quot;Eliminar mis datos&quot;, indicando tu nombre, tu número de celular y la
            tienda a la que le compraste o escribiste.
          </li>
        </ul>
        <p className={`${p} mt-2`}>
          Confirmaremos la solicitud y eliminaremos los datos (incluidas las conversaciones de WhatsApp asociadas) en un plazo máximo de 15 días hábiles, salvo los que
          debamos conservar por obligación legal.
        </p>

        <h2 className={h2}>10. Contacto</h2>
        <p className={p}>Para cualquier consulta sobre datos personales, escríbenos a {channels}.</p>
        {opLine && <p className={`${p} mt-2`}>Responsable: {opLine}.</p>}
      </article>
    </main>
  );
}
