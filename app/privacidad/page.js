import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';

export const metadata = {
  title: 'Política de privacidad — Casa Libre',
  description: `Cómo Casa Libre recopila, usa y comparte tus datos en ${COUNTRY.name}.`,
  alternates: { canonical: '/privacidad' },
};

// Keep in sync with section 6 of /terminos.
const UPDATED_ES = '6 de octubre de 2026';
const UPDATED_EN = 'October 6, 2026';
const C = COUNTRY.name;

const content = {
  es: {
    hero: { title: 'Política de privacidad' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `<em>Última actualización: ${UPDATED_ES}</em>`],
        ['p', 'Esta política explica qué datos recopila Casa Libre, para qué los usa y con quién los comparte. Forma parte de los <a href="/terminos">Términos y Condiciones</a>; al aceptarlos das tu consentimiento a lo que se describe aquí. <strong>Casa Libre no vende tus datos personales.</strong>'],
        ['h2', 'Qué datos recopilamos'],
        ['p', '<strong>Los que nos das:</strong> nombre, email, teléfono / WhatsApp, contraseña (cifrada), tipo de usuario (propietario o agente) y los datos, fotos y ubicación de tus publicaciones.<br/><strong>Los que se generan al usar la Plataforma:</strong> búsquedas, filtros, propiedades vistas y guardadas, contactos con publicadores, pagos (procesados por terceros), ubicación si la autorizás, datos del dispositivo y navegador, dirección IP, cookies y tecnologías similares.<br/><strong>Los de terceros:</strong> datos que recibimos al iniciar sesión con Google y datos de fuentes públicas.'],
        ['h2', 'Para qué los usamos'],
        ['p', 'Operar la Plataforma y mostrar tus publicaciones; permitir que te contacten; verificar cuentas y prevenir fraude; enviarte mensajes sobre tu cuenta; enviarte novedades y ofertas por email, WhatsApp, SMS o notificaciones; personalizar tu experiencia; medir y mejorar nuestros servicios y campañas con herramientas de analítica y publicidad (por ejemplo PostHog, Google Analytics, Google Tag Manager y Google Ads); y elaborar estadísticas e informes del mercado inmobiliario con datos agregados que no identifican a nadie.'],
        ['h2', 'Con quién los compartimos'],
        ['p', '<strong>No vendemos ni alquilamos tus datos personales, ni los entregamos a terceros a cambio de dinero o de cualquier otra contraprestación.</strong> Solo los compartimos en estos casos:'],
        ['p', 'Con proveedores que nos prestan servicios (alojamiento en la nube, email, pagos, analítica, mapas, publicidad). Estos proveedores solo usan los datos para prestarnos ese servicio. Con otros usuarios, cuando los contactás o te contactan (por ejemplo, la inmobiliaria o el dueño de una propiedad recibe tu mensaje). También compartimos información agregada o anonimizada, que no te identifica, y compartimos datos cuando lo exija la ley o una autoridad. Si Casa Libre se fusiona, se reorganiza o es adquirida, tus datos pasarán a la nueva empresa, que deberá respetar esta política, incluido el compromiso de no venderlos.'],
        ['h2', 'Dónde y cuánto tiempo'],
        ['p', `Tus datos pueden almacenarse en servidores fuera de ${C} con medidas de seguridad razonables. Los conservamos mientras tengas una cuenta. Si la eliminás, borramos tus datos personales y solo conservamos el registro de tus pagos, porque la ley nos obliga a guardarlo, y estadísticas anónimas que no te identifican.`],
        ['h2', 'Eliminar tu cuenta'],
        ['p', 'Podés eliminar tu cuenta en cualquier momento desde la app (Cuenta → Eliminar cuenta) o en <a href="/eliminar-cuenta">esta página</a>. Se eliminan tu nombre, email, teléfono, contraseña e inicio de sesión con Google, tu tarjeta guardada, tus propiedades guardadas y borradores, las notificaciones de tus dispositivos y tus datos de analítica. A tus publicaciones les quitamos tu nombre y tu teléfono y dejan de mostrarse. Solo conservamos el registro de tus pagos, como exige la ley. No se puede deshacer, y no afecta los datos que ya se hubieran compartido con terceros antes de tu solicitud.'],
        ['h2', 'Tus derechos y opciones'],
        ['p', 'Podés editar tu perfil y eliminar tus publicaciones desde tu panel. Para pedir acceso, rectificación o eliminación de tus datos, escribinos desde nuestra <a href="/contacto">página de contacto</a>. Podés darte de baja de los mensajes de marketing con el enlace del email o escribiéndonos. Podés bloquear cookies desde tu navegador, aunque algunas funciones pueden dejar de funcionar.'],
        ['h2', 'Menores'],
        ['p', 'La Plataforma no está dirigida a menores de 18 años y no recopilamos sus datos a sabiendas.'],
        ['h2', 'Cambios'],
        ['p', 'Podemos actualizar esta política; publicaremos la versión nueva con su fecha y te avisaremos si el cambio es relevante.'],
      ] },
    ],
  },
  en: {
    hero: { title: 'Privacy policy' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `<em>Last updated: ${UPDATED_EN}</em>`],
        ['p', 'This policy explains what data Casa Libre collects, what we use it for and who we share it with. It forms part of the <a href="/terminos">Terms of Service</a>; by accepting them you consent to what is described here. <strong>Casa Libre does not sell your personal data.</strong>'],
        ['h2', 'What we collect'],
        ['p', '<strong>What you give us:</strong> name, email, phone / WhatsApp, password (encrypted), user type (owner or agent) and the details, photos and location of your listings.<br/><strong>What is generated when you use the Platform:</strong> searches, filters, properties viewed and saved, contacts with listers, payments (processed by third parties), location if you allow it, device and browser data, IP address, cookies and similar technologies.<br/><strong>From third parties:</strong> data we receive when you sign in with Google, and data from public sources.'],
        ['h2', 'What we use it for'],
        ['p', 'Running the Platform and showing your listings; letting people contact you; verifying accounts and preventing fraud; messages about your account; news and offers by email, WhatsApp, SMS or notifications; personalising your experience; measuring and improving our services and campaigns with analytics and advertising tools (e.g. PostHog, Google Analytics, Google Tag Manager and Google Ads); and producing real-estate market statistics and reports from aggregated data that does not identify anyone.'],
        ['h2', 'Who we share it with'],
        ['p', '<strong>We do not sell or rent your personal data, or give it to anyone in exchange for money or anything else of value.</strong> We only share it in these cases:'],
        ['p', 'Service providers working for us (cloud hosting, email, payments, analytics, maps, advertising). These providers only use the data to provide that service to us. Other users, when you contact them or they contact you (for example, the agency or owner of a property receives your message). We also share aggregated or anonymised information, which does not identify you, and we share data when required by law or an authority. If Casa Libre merges, reorganises or is acquired, your data will pass to the new company, which must follow this policy, including the commitment not to sell it.'],
        ['h2', 'Where and for how long'],
        ['p', `Your data may be stored on servers outside ${C} with reasonable security measures. We keep it while you have an account. If you delete it, we erase your personal data and keep only the record of your payments, because the law requires it, and anonymous statistics that do not identify you.`],
        ['h2', 'Deleting your account'],
        ['p', 'You can delete your account at any time in the app (Account → Delete account) or on <a href="/eliminar-cuenta">this page</a>. Your name, email, phone, password and Google sign-in, your saved card, saved properties and drafts, your devices’ notifications and your analytics data are deleted. Your listings lose your name and phone and stop showing. We keep only the record of your payments, as the law requires. It cannot be undone, and it does not affect data already shared with third parties before your request.'],
        ['h2', 'Your rights and choices'],
        ['p', 'You can edit your profile and delete your listings from your dashboard. To request access to, correction or deletion of your data, write to us via our <a href="/contacto">contact page</a>. You can unsubscribe from marketing messages via the email link or by writing to us. You can block cookies in your browser, though some features may stop working.'],
        ['h2', 'Minors'],
        ['p', 'The Platform is not aimed at people under 18 and we do not knowingly collect their data.'],
        ['h2', 'Changes'],
        ['p', 'We may update this policy; we will publish the new version with its date and let you know if the change is material.'],
      ] },
    ],
  },
};

export default function Page() {
  return (
    <MarketingShell>
      <Article content={content} />
    </MarketingShell>
  );
}
