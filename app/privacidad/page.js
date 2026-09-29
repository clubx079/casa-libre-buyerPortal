import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';

export const metadata = {
  title: 'Política de privacidad — Casa Libre',
  description: `Cómo Casa Libre recopila, usa y comparte tus datos en ${COUNTRY.name}.`,
  alternates: { canonical: '/privacidad' },
};

// Keep in sync with section 6 of /terminos.
const UPDATED_ES = '30 de septiembre de 2026';
const UPDATED_EN = 'September 30, 2026';
const C = COUNTRY.name;

const content = {
  es: {
    hero: { title: 'Política de privacidad' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `<em>Última actualización: ${UPDATED_ES}</em>`],
        ['p', 'Esta política explica qué datos recopila Casa Libre, para qué los usa y con quién los comparte. Forma parte de los <a href="/terminos">Términos y Condiciones</a>; al aceptarlos das tu consentimiento a lo que se describe aquí.'],
        ['h2', 'Qué datos recopilamos'],
        ['p', '<strong>Los que nos das:</strong> nombre, email, teléfono / WhatsApp, contraseña (cifrada), tipo de usuario (propietario o agente) y los datos, fotos y ubicación de tus publicaciones.<br/><strong>Los que se generan al usar la Plataforma:</strong> búsquedas, filtros, propiedades vistas y guardadas, contactos con publicadores, pagos (procesados por terceros), ubicación si la autorizás, datos del dispositivo y navegador, dirección IP, cookies y tecnologías similares.<br/><strong>Los de terceros:</strong> datos que recibimos al iniciar sesión con Google y datos de fuentes públicas.'],
        ['h2', 'Para qué los usamos'],
        ['p', 'Operar la Plataforma y mostrar tus publicaciones; permitir que te contacten; verificar cuentas y prevenir fraude; enviarte mensajes sobre tu cuenta; enviarte novedades y ofertas por email, WhatsApp, SMS o notificaciones; personalizar tu experiencia; medir y mejorar nuestros servicios y campañas con herramientas de analítica y publicidad (por ejemplo PostHog, Google Analytics, Google Tag Manager y Google Ads); y elaborar estadísticas e informes del mercado inmobiliario.'],
        ['h2', 'Con quién los compartimos'],
        ['p', 'Con proveedores que nos prestan servicios (alojamiento en la nube, email, pagos, analítica, mapas, publicidad). Con otros usuarios, cuando los contactás o te contactan. Y, según lo aceptado en los Términos, podemos <strong>compartir, ceder, licenciar o vender</strong> datos personales y de publicaciones a terceros como inmobiliarias, agentes, desarrolladoras, entidades financieras, aseguradoras, socios comerciales y de marketing, y empresas de datos o investigación de mercado. También compartimos información agregada o anonimizada, y los datos pueden transferirse en caso de fusión, venta o reorganización de Casa Libre, o cuando lo exija la ley o una autoridad.'],
        ['h2', 'Dónde y cuánto tiempo'],
        ['p', `Tus datos pueden almacenarse en servidores fuera de ${C} con medidas de seguridad razonables. Los conservamos mientras tengas una cuenta y el tiempo adicional necesario para fines legales, de seguridad, estadísticos o comerciales legítimos.`],
        ['h2', 'Tus derechos y opciones'],
        ['p', 'Podés editar tu perfil y eliminar tus publicaciones desde tu panel. Podés pedir acceso, rectificación o eliminación de tus datos, darte de baja de los mensajes de marketing (con el enlace del email o escribiéndonos) y retirar tu consentimiento para nuevas cesiones a terceros, escribiéndonos desde nuestra <a href="/contacto">página de contacto</a>. El retiro no afecta lo realizado antes de tu solicitud. Podés bloquear cookies desde tu navegador, aunque algunas funciones pueden dejar de funcionar.'],
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
        ['p', 'This policy explains what data Casa Libre collects, what we use it for and who we share it with. It forms part of the <a href="/terminos">Terms of Service</a>; by accepting them you consent to what is described here.'],
        ['h2', 'What we collect'],
        ['p', '<strong>What you give us:</strong> name, email, phone / WhatsApp, password (encrypted), user type (owner or agent) and the details, photos and location of your listings.<br/><strong>What is generated when you use the Platform:</strong> searches, filters, properties viewed and saved, contacts with listers, payments (processed by third parties), location if you allow it, device and browser data, IP address, cookies and similar technologies.<br/><strong>From third parties:</strong> data we receive when you sign in with Google, and data from public sources.'],
        ['h2', 'What we use it for'],
        ['p', 'Running the Platform and showing your listings; letting people contact you; verifying accounts and preventing fraud; messages about your account; news and offers by email, WhatsApp, SMS or notifications; personalising your experience; measuring and improving our services and campaigns with analytics and advertising tools (e.g. PostHog, Google Analytics, Google Tag Manager and Google Ads); and producing real-estate market statistics and reports.'],
        ['h2', 'Who we share it with'],
        ['p', 'Service providers working for us (cloud hosting, email, payments, analytics, maps, advertising). Other users, when you contact them or they contact you. And, as accepted in the Terms, we may <strong>share, assign, license or sell</strong> personal and listing data to third parties such as real-estate agencies, agents, developers, financial institutions, insurers, commercial and marketing partners, and data or market-research companies. We also share aggregated or anonymised information, and data may be transferred in a merger, sale or reorganisation of Casa Libre, or when required by law or an authority.'],
        ['h2', 'Where and for how long'],
        ['p', `Your data may be stored on servers outside ${C} with reasonable security measures. We keep it while you have an account and for any further time needed for legal, security, statistical or legitimate business purposes.`],
        ['h2', 'Your rights and choices'],
        ['p', 'You can edit your profile and delete your listings from your dashboard. You can request access to, correction or deletion of your data, unsubscribe from marketing messages (via the email link or by writing to us) and withdraw consent to new transfers to third parties, by writing to us via our <a href="/contacto">contact page</a>. Withdrawal does not affect what was done before your request. You can block cookies in your browser, though some features may stop working.'],
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
