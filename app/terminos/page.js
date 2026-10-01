import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';

export const metadata = {
  title: 'Términos y condiciones — Casa Libre',
  description: `Términos y condiciones de uso de Casa Libre, el marketplace de propiedades de ${COUNTRY.name}.`,
  alternates: { canonical: '/terminos' },
};

// Bump when the terms change materially (shown on the page; users accept the
// version current at sign-up via the checkbox in the sell wizard / sign-up form).
const UPDATED_ES = '1 de octubre de 2026';
const UPDATED_EN = 'October 1, 2026';

const C = COUNTRY.name;
const contactEs = '<a href="/contacto">página de contacto</a>';
const contactEn = '<a href="/contacto">contact page</a>';

const content = {
  es: {
    hero: { title: 'Términos y condiciones' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `<em>Última actualización: ${UPDATED_ES}</em>`],
        ['p', `Estos Términos y Condiciones (los "Términos") regulan el uso de Casa Libre (el "Sitio", la aplicación móvil y los servicios relacionados, en conjunto la "Plataforma") en ${C}. "Casa Libre", "nosotros" y "nuestro" se refieren al operador de la Plataforma. "Vos" o "Usuario" se refiere a cualquier persona que visite, se registre o publique en la Plataforma.`],

        ['h2', '1. Aceptación'],
        ['p', 'Al crear una cuenta, marcar la casilla "Acepto los Términos y Condiciones", iniciar sesión con Google u otro proveedor, publicar una propiedad o de cualquier otra forma usar la Plataforma, declarás que leíste, entendiste y aceptás estos Términos y nuestra <a href="/privacidad">Política de Privacidad</a>, que forma parte de ellos. Si no estás de acuerdo, no uses la Plataforma.'],

        ['h2', '2. Qué es Casa Libre'],
        ['p', `Casa Libre es un marketplace en línea que permite a propietarios, inmobiliarias, agentes y desarrolladoras publicar propiedades en venta o alquiler, y a los interesados buscarlas y contactar al publicador. Casa Libre no es una inmobiliaria, no es parte de las operaciones entre usuarios, no actúa como intermediario, agente, ${COUNTRY.notary || 'escribano'} ni garante, y no cobra comisiones sobre las operaciones. Algunas publicaciones pueden provenir de fuentes públicas de terceros; en ese caso la información es la publicada por esas fuentes.`],

        ['h2', '3. Cuentas'],
        ['p', 'Para publicar necesitás una cuenta. Tenés que ser mayor de 18 años y tener capacidad legal para contratar. Te comprometés a brindar información verdadera, completa y actualizada, a mantener la confidencialidad de tu acceso y a avisarnos ante cualquier uso no autorizado. Sos responsable de toda la actividad que ocurra en tu cuenta. Podemos verificar tu identidad o tu relación con la propiedad y suspender cuentas cuando la información no pueda verificarse.'],

        ['h2', '4. Publicaciones'],
        ['p', 'Sos el único responsable del contenido que publicás (datos, precio, fotos, descripción y datos de contacto) y garantizás que: (a) tenés derecho a ofrecer la propiedad o estás autorizado por su titular; (b) la información es veraz y no induce a error; (c) las fotos y textos son tuyos o tenés permiso para usarlos; y (d) la publicación cumple la ley aplicable. No se permiten avisos falsos, duplicados, de propiedades inexistentes o ya no disponibles, ni contenido ofensivo, discriminatorio o que infrinja derechos de terceros.'],
        ['p', 'Al publicar, nos otorgás una licencia mundial, no exclusiva, gratuita, transferible y sublicenciable para alojar, reproducir, adaptar (por ejemplo recortar, traducir o mejorar fotos), mostrar y distribuir ese contenido en la Plataforma, en nuestras redes y campañas, en buscadores y asistentes de inteligencia artificial, y a través de socios y portales con los que colaboremos. La licencia se mantiene mientras el contenido esté publicado y por el tiempo razonable necesario para retirarlo de copias de respaldo, cachés y materiales ya distribuidos.'],
        ['p', 'Podemos revisar, editar el formato, destacar, ocultar o eliminar cualquier publicación, a nuestro criterio y sin obligación de aviso previo, incluyendo las que no cumplan estos Términos o nuestros criterios de calidad.'],

        ['h2', '5. Servicios pagos'],
        ['p', 'Publicar es gratis. Ofrecemos servicios opcionales pagos, como el plan "Verificado" y el plan de exhibición en la página principal, con el precio, la duración y los beneficios indicados al momento de la compra. Los pagos se procesan por proveedores externos (por ejemplo Stripe) y no almacenamos los datos completos de tu tarjeta. Salvo que la ley disponga otra cosa, los servicios ya activados no son reembolsables. La renovación no es automática salvo que se indique; te avisaremos antes del vencimiento. Podemos modificar precios y planes para compras futuras.'],

        ['h2', '6. Datos personales y consentimiento'],
        ['p', 'Al aceptar estos Términos otorgás tu consentimiento libre, expreso e informado para que Casa Libre recolecte, almacene, procese y utilice los datos que nos brindás o que se generan al usar la Plataforma, incluyendo: nombre, email, teléfono y WhatsApp; datos de tus publicaciones y de las propiedades; ubicación aproximada o precisa si la autorizás; búsquedas, favoritos, contactos y otras interacciones; datos del dispositivo, navegador, dirección IP y cookies o tecnologías similares.'],
        ['p', 'Usamos esos datos para: operar la Plataforma y mostrar tus publicaciones; permitir que los interesados te contacten; verificar cuentas y prevenir fraude; enviarte comunicaciones sobre tu cuenta y tus publicaciones; enviarte novedades y ofertas por email, WhatsApp, SMS o notificaciones; personalizar la experiencia; medir y mejorar nuestros servicios y campañas (incluyendo herramientas de analítica y publicidad de terceros); y elaborar estadísticas, estudios de mercado e índices del mercado inmobiliario.'],
        ['p', 'Aceptás además que Casa Libre puede <strong>compartir, ceder, licenciar o vender</strong> datos personales y datos de publicaciones, a título gratuito u oneroso, a terceros como inmobiliarias, agentes, desarrolladoras, entidades financieras, aseguradoras, proveedores de servicios para el hogar, socios comerciales y de marketing, y empresas de datos o investigación de mercado, para que te ofrezcan productos o servicios, o para fines estadísticos y comerciales. También podemos compartir información agregada o anonimizada, que no te identifica, sin limitación.'],
        ['p', 'Tus datos pueden almacenarse y procesarse en servidores ubicados fuera de ' + C + ', incluyendo servicios en la nube de terceros, con medidas de seguridad razonables. Si Casa Libre o sus activos se transfieren, fusionan o reorganizan, los datos podrán transferirse como parte de esa operación. Conservamos los datos mientras tengas una cuenta y el tiempo adicional necesario para fines legales, de seguridad, estadísticos o comerciales legítimos.'],
        ['p', `Podés solicitar acceso, rectificación o eliminación de tus datos, y retirar tu consentimiento para comunicaciones de marketing o para nuevas cesiones a terceros, escribiéndonos desde nuestra ${contactEs}. El retiro del consentimiento no afecta los tratamientos o cesiones realizados antes de tu solicitud, y puede impedir que sigas usando algunas funciones. Podés eliminar tu cuenta en cualquier momento desde la app (Cuenta → Eliminar cuenta) o en <a href="/eliminar-cuenta">esta página</a>. Los detalles están en la <a href="/privacidad">Política de Privacidad</a>.`],

        ['h2', '7. Contactos entre usuarios'],
        ['p', 'Cuando contactás a un publicador (por ejemplo por WhatsApp o teléfono), compartís con él tus datos de contacto y podemos registrar ese contacto. Los datos de contacto de otros usuarios solo pueden usarse para consultar por la propiedad publicada. Está prohibido usarlos para spam, marketing no solicitado, reventa de bases de datos o cualquier otro fin. Toda negociación, visita, pago o contrato es exclusivamente entre los usuarios: verificá la propiedad, la documentación y la identidad de la otra parte antes de pagar o firmar.'],

        ['h2', '8. Usos prohibidos'],
        ['p', 'No podés: extraer datos de la Plataforma en forma automatizada (scraping, bots, crawlers) sin nuestra autorización escrita; copiar o reutilizar publicaciones, fotos o bases de datos; eludir medidas técnicas o de seguridad; publicar malware; suplantar a otra persona; usar la Plataforma para actividades ilegales, fraudes o lavado de dinero; ni interferir con su funcionamiento.'],

        ['h2', '9. Propiedad intelectual'],
        ['p', 'La marca Casa Libre, el diseño, el software, las bases de datos, los textos propios y demás elementos de la Plataforma nos pertenecen o están licenciados a nosotros y están protegidos por la ley. No adquirís ningún derecho sobre ellos por usar la Plataforma.'],

        ['h2', '10. Sin garantías'],
        ['p', 'La Plataforma se ofrece "tal cual" y "según disponibilidad". No garantizamos que las publicaciones sean exactas, que las propiedades estén disponibles o en las condiciones descritas, ni que la Plataforma funcione sin interrupciones o errores. La información de zonificación, precios de referencia, cotizaciones y cualquier otro dato informativo es orientativa y no reemplaza la consulta a la autoridad competente o a un profesional.'],

        ['h2', '11. Limitación de responsabilidad'],
        ['p', 'En la máxima medida permitida por la ley, Casa Libre no será responsable por daños indirectos, lucro cesante, pérdida de datos u oportunidades, ni por los actos, publicaciones u omisiones de los usuarios o de terceros, ni por las operaciones que realicen entre ellos. Nuestra responsabilidad total frente a vos no superará el monto que nos hayas pagado en los doce (12) meses anteriores al hecho que la origina.'],

        ['h2', '12. Indemnidad'],
        ['p', 'Te comprometés a mantener indemne a Casa Libre, sus titulares, empleados y colaboradores frente a reclamos, daños y gastos (incluidos honorarios legales) que resulten de tu contenido, de tu uso de la Plataforma o del incumplimiento de estos Términos o de la ley.'],

        ['h2', '13. Suspensión y baja'],
        ['p', 'Podemos suspender o cancelar tu cuenta y tus publicaciones si incumplís estos Términos, si hay indicios de fraude o si lo exige la ley. Podés cerrar tu cuenta cuando quieras desde tu panel o desde nuestra ' + contactEs + '. Las secciones sobre licencia de contenido, datos, propiedad intelectual, limitación de responsabilidad e indemnidad siguen vigentes después de la baja.'],

        ['h2', '14. Cambios'],
        ['p', 'Podemos modificar estos Términos. Publicaremos la versión nueva con su fecha y, si el cambio es relevante, te avisaremos por email o en la Plataforma. Si seguís usando la Plataforma después de la entrada en vigencia, aceptás la versión nueva.'],

        ['h2', '15. Ley aplicable'],
        ['p', `Estos Términos se rigen por las leyes de ${C}. Cualquier controversia se someterá a los tribunales competentes de ${COUNTRY.capital || C}, salvo que la ley aplicable disponga otra jurisdicción obligatoria. Si alguna cláusula fuera inválida, las demás seguirán vigentes.`],

        ['h2', '16. Contacto'],
        ['p', `Para consultas sobre estos Términos o tus datos, escribinos desde nuestra ${contactEs}.`],
      ] },
    ],
  },
  en: {
    hero: { title: 'Terms of Service' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `<em>Last updated: ${UPDATED_EN}</em>`],
        ['p', `These Terms of Service (the "Terms") govern the use of Casa Libre (the website, the mobile app and related services, together the "Platform") in ${C}. "Casa Libre", "we" and "our" refer to the operator of the Platform. "You" or "User" means anyone who visits, registers on or lists on the Platform. The Spanish version prevails in case of discrepancy.`],

        ['h2', '1. Acceptance'],
        ['p', 'By creating an account, ticking the "I agree to the Terms of Service" box, signing in with Google or another provider, listing a property or otherwise using the Platform, you confirm that you have read, understood and accept these Terms and our <a href="/privacidad">Privacy Policy</a>, which forms part of them. If you do not agree, do not use the Platform.'],

        ['h2', '2. What Casa Libre is'],
        ['p', 'Casa Libre is an online marketplace where owners, agencies, agents and developers list properties for sale or rent, and people search for them and contact the lister. Casa Libre is not a real-estate agency, is not a party to transactions between users, does not act as intermediary, agent, notary or guarantor, and charges no commission on transactions. Some listings may come from third-party public sources; in that case the information is as published by those sources.'],

        ['h2', '3. Accounts'],
        ['p', 'You need an account to list. You must be at least 18 and legally able to contract. You agree to provide true, complete and current information, to keep your access confidential and to tell us about any unauthorised use. You are responsible for all activity on your account. We may verify your identity or your relationship to a property and suspend accounts whose information cannot be verified.'],

        ['h2', '4. Listings'],
        ['p', 'You alone are responsible for the content you post (details, price, photos, description and contact details) and you warrant that: (a) you are entitled to offer the property or are authorised by its owner; (b) the information is true and not misleading; (c) the photos and texts are yours or you have permission to use them; and (d) the listing complies with applicable law. False, duplicate, non-existent or no-longer-available listings, and offensive, discriminatory or rights-infringing content, are not allowed.'],
        ['p', 'By listing, you grant us a worldwide, non-exclusive, royalty-free, transferable and sublicensable licence to host, reproduce, adapt (e.g. crop, translate or enhance photos), display and distribute that content on the Platform, in our social channels and campaigns, in search engines and AI assistants, and through partners and portals we work with. The licence lasts while the content is published and for the reasonable time needed to remove it from backups, caches and material already distributed.'],
        ['p', 'We may review, reformat, feature, hide or remove any listing at our discretion and without prior notice, including listings that breach these Terms or our quality criteria.'],

        ['h2', '5. Paid services'],
        ['p', 'Listing is free. We offer optional paid services, such as the "Verified" plan and the home-page display plan, with the price, duration and benefits shown at purchase. Payments are processed by third-party providers (e.g. Stripe); we do not store your full card details. Unless the law requires otherwise, services already activated are non-refundable. Renewal is not automatic unless stated; we will remind you before expiry. We may change prices and plans for future purchases.'],

        ['h2', '6. Personal data and consent'],
        ['p', 'By accepting these Terms you give your free, express and informed consent for Casa Libre to collect, store, process and use the data you provide or that is generated when you use the Platform, including: name, email, phone and WhatsApp; your listings and property details; approximate or precise location if you allow it; searches, favourites, contacts and other interactions; device, browser, IP address and cookies or similar technologies.'],
        ['p', 'We use that data to: operate the Platform and show your listings; let interested people contact you; verify accounts and prevent fraud; send you messages about your account and listings; send you news and offers by email, WhatsApp, SMS or notifications; personalise your experience; measure and improve our services and campaigns (including third-party analytics and advertising tools); and produce statistics, market research and real-estate market indices.'],
        ['p', 'You further agree that Casa Libre may <strong>share, assign, license or sell</strong> personal data and listing data, with or without payment, to third parties such as real-estate agencies, agents, developers, financial institutions, insurers, home-service providers, commercial and marketing partners, and data or market-research companies, so they can offer you products or services, or for statistical and commercial purposes. We may also share aggregated or anonymised information, which does not identify you, without limitation.'],
        ['p', `Your data may be stored and processed on servers located outside ${C}, including third-party cloud services, with reasonable security measures. If Casa Libre or its assets are transferred, merged or reorganised, data may be transferred as part of that transaction. We keep data while you have an account and for any further time needed for legal, security, statistical or legitimate business purposes.`],
        ['p', `You can request access to, correction or deletion of your data, and withdraw your consent to marketing messages or to new transfers to third parties, by writing to us via our ${contactEn}. Withdrawing consent does not affect processing or transfers made before your request and may prevent you from using some features. You can delete your account at any time in the app (Account → Delete account) or on <a href="/eliminar-cuenta">this page</a>. Details are in the <a href="/privacidad">Privacy Policy</a>.`],

        ['h2', '7. Contacts between users'],
        ['p', 'When you contact a lister (e.g. by WhatsApp or phone) you share your contact details with them and we may record that contact. Other users\' contact details may only be used to ask about the listed property. Using them for spam, unsolicited marketing, database resale or any other purpose is prohibited. Any negotiation, viewing, payment or contract is solely between the users: check the property, the documents and the other party\'s identity before paying or signing.'],

        ['h2', '8. Prohibited uses'],
        ['p', 'You may not: extract data from the Platform by automated means (scraping, bots, crawlers) without our written permission; copy or reuse listings, photos or databases; circumvent technical or security measures; upload malware; impersonate anyone; use the Platform for illegal activity, fraud or money laundering; or interfere with its operation.'],

        ['h2', '9. Intellectual property'],
        ['p', 'The Casa Libre brand, design, software, databases, our own texts and other Platform elements belong to or are licensed to us and are protected by law. Using the Platform gives you no rights in them.'],

        ['h2', '10. No warranties'],
        ['p', 'The Platform is provided "as is" and "as available". We do not guarantee that listings are accurate, that properties are available or in the condition described, or that the Platform will run without interruption or errors. Zoning information, reference prices, exchange rates and any other informational data are indicative only and do not replace checking with the competent authority or a professional.'],

        ['h2', '11. Limitation of liability'],
        ['p', 'To the maximum extent permitted by law, Casa Libre is not liable for indirect damages, lost profits, loss of data or opportunities, for the acts, listings or omissions of users or third parties, or for transactions between them. Our total liability to you will not exceed the amount you paid us in the twelve (12) months before the event giving rise to it.'],

        ['h2', '12. Indemnity'],
        ['p', 'You agree to hold Casa Libre, its owners, staff and collaborators harmless from claims, damages and costs (including legal fees) arising from your content, your use of the Platform or your breach of these Terms or the law.'],

        ['h2', '13. Suspension and closure'],
        ['p', `We may suspend or close your account and listings if you breach these Terms, if there are signs of fraud or if the law requires it. You can close your account at any time from your dashboard or via our ${contactEn}. The sections on content licence, data, intellectual property, limitation of liability and indemnity survive closure.`],

        ['h2', '14. Changes'],
        ['p', 'We may change these Terms. We will publish the new version with its date and, if the change is material, notify you by email or on the Platform. If you keep using the Platform after it takes effect, you accept the new version.'],

        ['h2', '15. Governing law'],
        ['p', `These Terms are governed by the laws of ${C}. Any dispute will be submitted to the competent courts of ${COUNTRY.capital || C}, unless applicable law mandates another jurisdiction. If any clause is invalid, the rest remain in force.`],

        ['h2', '16. Contact'],
        ['p', `For questions about these Terms or your data, write to us via our ${contactEn}.`],
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
