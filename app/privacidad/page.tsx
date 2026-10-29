import type { Metadata } from 'next';
import { cloudEnabled, getSettings } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

interface StoreInfo {
  storeName?: string;
  supportEmail?: string;
  supportPhone?: string;
}

async function storeInfo(): Promise<StoreInfo> {
  if (!cloudEnabled()) return {};
  try {
    return (await getSettings<StoreInfo>()) || {};
  } catch {
    return {};
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await storeInfo();
  return { title: `Política de privacidad${s.storeName ? ` · ${s.storeName}` : ''}`, robots: { index: true, follow: true } };
}

// Public privacy policy (required by Meta to publish the WhatsApp app). Uses the store data from Configuración.
export default async function PrivacyPage() {
  const s = await storeInfo();
  const store = s.storeName?.trim() || 'nuestra tienda';
  const contact = [s.supportEmail?.trim() && `el correo ${s.supportEmail.trim()}`, s.supportPhone?.trim() && `el WhatsApp ${s.supportPhone.trim()}`].filter(Boolean).join(' o ') || 'nuestros canales de atención';
  const h2 = 'text-lg font-semibold text-slate-900 mt-8 mb-2';
  const p = 'text-[15px] leading-relaxed text-slate-700';
  const li = 'text-[15px] leading-relaxed text-slate-700';

  return (
    <main className="min-h-screen bg-white">
      <article className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Política de privacidad</h1>
        <p className="text-sm text-slate-500 mt-2">{store} · Última actualización: octubre de 2026</p>

        <p className={`${p} mt-6`}>
          En {store} respetamos tus datos personales. Esta política explica qué datos recogemos cuando haces un pedido en nuestras páginas, para qué los usamos y cómo
          puedes consultarlos, corregirlos o pedir que los eliminemos, de acuerdo con la Ley 1581 de 2012 de Colombia y demás normas aplicables.
        </p>

        <h2 className={h2}>Qué datos recogemos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>Los datos que escribes al hacer un pedido: nombre, número de celular, departamento, ciudad, dirección, barrio e indicaciones de entrega.</li>
          <li className={li}>Los detalles del pedido: producto, cantidad, valor y fecha.</li>
          <li className={li}>Los mensajes que intercambias con nosotros por WhatsApp.</li>
          <li className={li}>Si confirmamos tu pedido por teléfono, la llamada puede grabarse y transcribirse para verificar tu confirmación.</li>
          <li className={li}>Datos técnicos de tu visita (como el navegador o la campaña publicitaria de la que llegaste), que usamos para medir nuestros anuncios.</li>
        </ul>

        <h2 className={h2}>Para qué los usamos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li className={li}>Procesar, confirmar y entregar tu pedido con pago contraentrega.</li>
          <li className={li}>Comunicarnos contigo por WhatsApp o llamada sobre tu pedido (confirmación, envío y entrega).</li>
          <li className={li}>Atender tus preguntas, cambios, garantías y reclamos.</li>
          <li className={li}>Medir y mejorar nuestros anuncios.</li>
        </ul>
        <p className={`${p} mt-2`}>No vendemos tus datos personales.</p>

        <h2 className={h2}>Con quién los compartimos</h2>
        <p className={p}>Solo con quienes nos ayudan a cumplir tu pedido o a operar la tienda, y únicamente con los datos necesarios:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li className={li}>Empresas de transporte y mensajería, para entregar tu pedido.</li>
          <li className={li}>Meta Platforms (WhatsApp y herramientas de medición de anuncios de Facebook e Instagram).</li>
          <li className={li}>Proveedores de tecnología que alojan nuestra página y nuestra base de datos, y servicios de llamadas automatizadas cuando confirmamos pedidos por teléfono.</li>
          <li className={li}>Autoridades, cuando la ley lo exija.</li>
        </ul>

        <h2 className={h2}>Cuánto tiempo los guardamos</h2>
        <p className={p}>
          Guardamos los datos del pedido mientras sean necesarios para entregarlo, atender garantías y cumplir obligaciones legales y contables. Después los eliminamos o
          los anonimizamos.
        </p>

        <h2 className={h2}>Tus derechos</h2>
        <p className={p}>
          Puedes conocer, actualizar y corregir tus datos, pedir prueba de tu autorización, saber cómo los hemos usado, revocar tu autorización y pedir que los
          eliminemos, salvo cuando debamos conservarlos por ley.
        </p>

        <h2 id="eliminar-datos" className={h2}>Cómo pedir que eliminemos tus datos</h2>
        <p className={p}>
          Escríbenos a {contact} con el asunto &quot;Eliminar mis datos&quot;, indicando tu nombre y el número de celular que usaste en el pedido. Confirmaremos tu
          solicitud y eliminaremos tus datos (incluidas las conversaciones de WhatsApp asociadas) en un plazo máximo de 15 días hábiles, salvo los que debamos conservar
          por obligación legal.
        </p>

        <h2 className={h2}>Contacto</h2>
        <p className={p}>
          Para cualquier consulta sobre tus datos personales, comunícate con {store} a través de {contact}.
        </p>
      </article>
    </main>
  );
}
