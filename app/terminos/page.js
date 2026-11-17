import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY, COUNTRY_PT } from '@/lib/country';

export const metadata = {
  title: 'Términos y condiciones — Casa Libre',
  description: `Términos y condiciones de uso de Casa Libre, el marketplace de propiedades de ${COUNTRY.name}.`,
  alternates: { canonical: '/terminos' },
};

// Bump when the terms change materially (shown on the page; users accept the
// version current at sign-up via the checkbox in the sell wizard / sign-up form).
const UPDATED_ES = '6 de octubre de 2026';
const UPDATED_EN = 'October 6, 2026';
const UPDATED_PT = '6 de outubro de 2026';

const C = COUNTRY.name;
const contactEs = '<a href="/contacto">página de contacto</a>';
const contactEn = '<a href="/contacto">contact page</a>';
const contactPt = '<a href="/contacto">página de contato</a>';

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
        ['p', 'Al publicar, nos otorgás una licencia mundial, no exclusiva, gratuita, transferible y sublicenciable para alojar, reproducir, adaptar (por ejemplo recortar, traducir o mejorar fotos), mostrar y distribuir ese contenido en la Plataforma, en nuestras redes y campañas, en buscadores y asistentes de inteligencia artificial, y a través de socios y portales con los que colaboremos. La licencia se mantiene mientras el contenido esté publicado y por el tiempo razonable necesario para retirarlo de copias de respaldo, cachés y materiales ya distribuidos. Esta licencia no nos autoriza a vender tus datos personales (ver sección 5).'],
        ['p', 'Podemos revisar, editar el formato, destacar, ocultar o eliminar cualquier publicación, a nuestro criterio y sin obligación de aviso previo, incluyendo las que no cumplan estos Términos o nuestros criterios de calidad.'],
        ['h3', 'Acuerdo de publicación', { id: 'acuerdo-de-publicacion' }],
        ['p', 'Cuando publicás o renovás una propiedad, autorizás a Casa-Libre a publicarla, compartirla y volver a publicarla, incluidas sus fotos, precio, descripción y ubicación, en los sitios web y apps de Casa-Libre, en las páginas de Casa-Libre en redes sociales y en grupos (como Facebook e Instagram), en otras plataformas inmobiliarias y en publicidad paga. Casa-Libre puede redimensionar, recortar, traducir o editar las fotos y el texto para estas publicaciones. Tus datos de contacto se muestran solo tal como los cargaste en la publicación. Podés pedirnos que retiremos una publicación compartida en cualquier momento escribiéndonos, y la retiraremos en un plazo razonable.'],


        ['h2', '5. Datos personales y consentimiento'],
        ['p', 'Al aceptar estos Términos otorgás tu consentimiento libre, expreso e informado para que Casa Libre recolecte, almacene, procese y utilice los datos que nos brindás o que se generan al usar la Plataforma, incluyendo: nombre, email, teléfono y WhatsApp; datos de tus publicaciones y de las propiedades; ubicación aproximada o precisa si la autorizás; búsquedas, favoritos, contactos y otras interacciones; datos del dispositivo, navegador, dirección IP y cookies o tecnologías similares.'],
        ['p', 'Usamos esos datos para: operar la Plataforma y mostrar tus publicaciones; permitir que los interesados te contacten; verificar cuentas y prevenir fraude; enviarte comunicaciones sobre tu cuenta y tus publicaciones; enviarte novedades y ofertas por email, WhatsApp, SMS o notificaciones; personalizar la experiencia; medir y mejorar nuestros servicios y campañas (incluyendo herramientas de analítica y publicidad de terceros); y elaborar estadísticas, estudios de mercado e índices del mercado inmobiliario a partir de datos agregados o anonimizados que no identifican a nadie.'],
        ['p', '<strong>Casa Libre no vende tus datos personales.</strong> No los vendemos ni alquilamos, ni los entregamos a terceros a cambio de dinero o de cualquier otra contraprestación.'],
        ['p', 'Compartimos datos personales solo con los proveedores que nos prestan servicios (alojamiento en la nube, email, analítica, mapas y publicidad), que los usan únicamente para prestarnos ese servicio; con otros usuarios, cuando los contactás o te contactan; y cuando lo exija la ley o una autoridad. También podemos compartir información agregada o anonimizada, que no te identifica.'],
        ['p', 'Tus datos pueden almacenarse y procesarse en servidores ubicados fuera de ' + C + ', incluyendo servicios en la nube de terceros, con medidas de seguridad razonables. Si Casa Libre se fusiona, se reorganiza o es adquirida, los datos pasarán a la nueva entidad como parte de esa operación, y esa entidad deberá respetar estos Términos y la Política de Privacidad, incluido el compromiso de no vender datos personales. Conservamos los datos mientras tengas una cuenta. Si la eliminás, borramos tus datos personales y solo conservamos estadísticas anónimas.'],
        ['p', `Podés solicitar acceso, rectificación o eliminación de tus datos, y retirar tu consentimiento para comunicaciones de marketing, escribiéndonos desde nuestra ${contactEs}. El retiro del consentimiento no afecta los tratamientos realizados antes de tu solicitud, y puede impedir que sigas usando algunas funciones. Podés eliminar tu cuenta en cualquier momento desde la app (Cuenta → Eliminar cuenta) o en <a href="/eliminar-cuenta">esta página</a>. Los detalles están en la <a href="/privacidad">Política de Privacidad</a>.`],

        ['h2', '6. Contactos entre usuarios'],
        ['p', 'Cuando contactás a un publicador (por ejemplo por WhatsApp o teléfono), compartís con él tus datos de contacto y podemos registrar ese contacto. Los datos de contacto de otros usuarios solo pueden usarse para consultar por la propiedad publicada. Está prohibido usarlos para spam, marketing no solicitado, reventa de bases de datos o cualquier otro fin. Toda negociación, visita, pago o contrato es exclusivamente entre los usuarios: verificá la propiedad, la documentación y la identidad de la otra parte antes de pagar o firmar.'],

        ['h2', '7. Usos prohibidos'],
        ['p', 'No podés: extraer datos de la Plataforma en forma automatizada (scraping, bots, crawlers) sin nuestra autorización escrita; copiar o reutilizar publicaciones, fotos o bases de datos; eludir medidas técnicas o de seguridad; publicar malware; suplantar a otra persona; usar la Plataforma para actividades ilegales, fraudes o lavado de dinero; ni interferir con su funcionamiento.'],

        ['h2', '8. Propiedad intelectual'],
        ['p', 'La marca Casa Libre, el diseño, el software, las bases de datos, los textos propios y demás elementos de la Plataforma nos pertenecen o están licenciados a nosotros y están protegidos por la ley. No adquirís ningún derecho sobre ellos por usar la Plataforma.'],

        ['h2', '9. Sin garantías'],
        ['p', 'La Plataforma se ofrece "tal cual" y "según disponibilidad". No garantizamos que las publicaciones sean exactas, que las propiedades estén disponibles o en las condiciones descritas, ni que la Plataforma funcione sin interrupciones o errores. La información de zonificación, precios de referencia, cotizaciones y cualquier otro dato informativo es orientativa y no reemplaza la consulta a la autoridad competente o a un profesional.'],

        ['h2', '10. Limitación de responsabilidad'],
        ['p', 'En la máxima medida permitida por la ley, Casa Libre no será responsable por daños indirectos, lucro cesante, pérdida de datos u oportunidades, ni por los actos, publicaciones u omisiones de los usuarios o de terceros, ni por las operaciones que realicen entre ellos. Nuestra responsabilidad total frente a vos se limita al mínimo permitido por la ley aplicable.'],

        ['h2', '11. Indemnidad'],
        ['p', 'Te comprometés a mantener indemne a Casa Libre, sus titulares, empleados y colaboradores frente a reclamos, daños y gastos (incluidos honorarios legales) que resulten de tu contenido, de tu uso de la Plataforma o del incumplimiento de estos Términos o de la ley.'],

        ['h2', '12. Suspensión y baja'],
        ['p', 'Podemos suspender o cancelar tu cuenta y tus publicaciones si incumplís estos Términos, si hay indicios de fraude o si lo exige la ley. Podés cerrar tu cuenta cuando quieras desde tu panel o desde nuestra ' + contactEs + '. Las secciones sobre licencia de contenido, datos, propiedad intelectual, limitación de responsabilidad e indemnidad siguen vigentes después de la baja.'],

        ['h2', '13. Cambios'],
        ['p', 'Podemos modificar estos Términos. Publicaremos la versión nueva con su fecha y, si el cambio es relevante, te avisaremos por email o en la Plataforma. Si seguís usando la Plataforma después de la entrada en vigencia, aceptás la versión nueva.'],

        ['h2', '14. Ley aplicable'],
        ['p', `Estos Términos se rigen por las leyes de ${C}. Cualquier controversia se someterá a los tribunales competentes de ${COUNTRY.capital || C}, salvo que la ley aplicable disponga otra jurisdicción obligatoria. Si alguna cláusula fuera inválida, las demás seguirán vigentes.`],

        ['h2', '15. Contacto'],
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
        ['p', 'By listing, you grant us a worldwide, non-exclusive, royalty-free, transferable and sublicensable licence to host, reproduce, adapt (e.g. crop, translate or enhance photos), display and distribute that content on the Platform, in our social channels and campaigns, in search engines and AI assistants, and through partners and portals we work with. The licence lasts while the content is published and for the reasonable time needed to remove it from backups, caches and material already distributed. This licence does not allow us to sell your personal data (see section 5).'],
        ['p', 'We may review, reformat, feature, hide or remove any listing at our discretion and without prior notice, including listings that breach these Terms or our quality criteria.'],
        ['h3', 'Listing Agreement', { id: 'acuerdo-de-publicacion' }],
        ['p', "When you publish or renew a listing, you authorize Casa-Libre to publish, share and republish it, including its photos, price, description and location, on Casa-Libre's websites and apps, on Casa-Libre's social media pages and in groups (such as Facebook and Instagram), on other property platforms, and in paid advertising. Casa-Libre may resize, crop, translate or edit the photos and text for these posts. Your contact details are only shown as you entered them in the listing. You can ask us to remove a shared post at any time by writing to us, and we will remove it within a reasonable time."],


        ['h2', '5. Personal data and consent'],
        ['p', 'By accepting these Terms you give your free, express and informed consent for Casa Libre to collect, store, process and use the data you provide or that is generated when you use the Platform, including: name, email, phone and WhatsApp; your listings and property details; approximate or precise location if you allow it; searches, favourites, contacts and other interactions; device, browser, IP address and cookies or similar technologies.'],
        ['p', 'We use that data to: operate the Platform and show your listings; let interested people contact you; verify accounts and prevent fraud; send you messages about your account and listings; send you news and offers by email, WhatsApp, SMS or notifications; personalise your experience; measure and improve our services and campaigns (including third-party analytics and advertising tools); and produce statistics, market research and real-estate market indices from aggregated or anonymised data that does not identify anyone.'],
        ['p', '<strong>Casa Libre does not sell your personal data.</strong> We do not sell or rent it, or give it to anyone in exchange for money or anything else of value.'],
        ['p', 'We share personal data only with the providers that work for us (cloud hosting, email, analytics, maps and advertising), who use it solely to provide that service to us; with other users, when you contact them or they contact you; and when required by law or an authority. We may also share aggregated or anonymised information, which does not identify you.'],
        ['p', `Your data may be stored and processed on servers located outside ${C}, including third-party cloud services, with reasonable security measures. If Casa Libre merges, reorganises or is acquired, data will pass to the new entity as part of that transaction, and that entity must follow these Terms and the Privacy Policy, including the commitment not to sell personal data. We keep data while you have an account. If you delete it, we erase your personal data and keep only anonymous statistics.`],
        ['p', `You can request access to, correction or deletion of your data, and withdraw your consent to marketing messages, by writing to us via our ${contactEn}. Withdrawing consent does not affect processing done before your request and may prevent you from using some features. You can delete your account at any time in the app (Account → Delete account) or on <a href="/eliminar-cuenta">this page</a>. Details are in the <a href="/privacidad">Privacy Policy</a>.`],

        ['h2', '6. Contacts between users'],
        ['p', 'When you contact a lister (e.g. by WhatsApp or phone) you share your contact details with them and we may record that contact. Other users\' contact details may only be used to ask about the listed property. Using them for spam, unsolicited marketing, database resale or any other purpose is prohibited. Any negotiation, viewing, payment or contract is solely between the users: check the property, the documents and the other party\'s identity before paying or signing.'],

        ['h2', '7. Prohibited uses'],
        ['p', 'You may not: extract data from the Platform by automated means (scraping, bots, crawlers) without our written permission; copy or reuse listings, photos or databases; circumvent technical or security measures; upload malware; impersonate anyone; use the Platform for illegal activity, fraud or money laundering; or interfere with its operation.'],

        ['h2', '8. Intellectual property'],
        ['p', 'The Casa Libre brand, design, software, databases, our own texts and other Platform elements belong to or are licensed to us and are protected by law. Using the Platform gives you no rights in them.'],

        ['h2', '9. No warranties'],
        ['p', 'The Platform is provided "as is" and "as available". We do not guarantee that listings are accurate, that properties are available or in the condition described, or that the Platform will run without interruption or errors. Zoning information, reference prices, exchange rates and any other informational data are indicative only and do not replace checking with the competent authority or a professional.'],

        ['h2', '10. Limitation of liability'],
        ['p', 'To the maximum extent permitted by law, Casa Libre is not liable for indirect damages, lost profits, loss of data or opportunities, for the acts, listings or omissions of users or third parties, or for transactions between them. Our total liability to you is limited to the minimum permitted by applicable law.'],

        ['h2', '11. Indemnity'],
        ['p', 'You agree to hold Casa Libre, its owners, staff and collaborators harmless from claims, damages and costs (including legal fees) arising from your content, your use of the Platform or your breach of these Terms or the law.'],

        ['h2', '12. Suspension and closure'],
        ['p', `We may suspend or close your account and listings if you breach these Terms, if there are signs of fraud or if the law requires it. You can close your account at any time from your dashboard or via our ${contactEn}. The sections on content licence, data, intellectual property, limitation of liability and indemnity survive closure.`],

        ['h2', '13. Changes'],
        ['p', 'We may change these Terms. We will publish the new version with its date and, if the change is material, notify you by email or on the Platform. If you keep using the Platform after it takes effect, you accept the new version.'],

        ['h2', '14. Governing law'],
        ['p', `These Terms are governed by the laws of ${C}. Any dispute will be submitted to the competent courts of ${COUNTRY.capital || C}, unless applicable law mandates another jurisdiction. If any clause is invalid, the rest remain in force.`],

        ['h2', '15. Contact'],
        ['p', `For questions about these Terms or your data, write to us via our ${contactEn}.`],
      ] },
    ],
  },
  pt: {
    hero: { title: 'Termos de Uso' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `<em>Última atualização: ${UPDATED_PT}</em>`],
        ['p', `Estes Termos de Uso (os "Termos") regulam o uso da Casa Libre (o site, o aplicativo móvel e os serviços relacionados, juntos a "Plataforma") ${COUNTRY_PT.in}. "Casa Libre", "nós" e "nosso" referem-se ao operador da Plataforma. "Você" ou "Usuário" significa qualquer pessoa que visite, se registre ou publique na Plataforma. A versão em espanhol prevalece em caso de divergência.`],

        ['h2', '1. Aceitação'],
        ['p', 'Ao criar uma conta, marcar a caixa "Concordo com os Termos de Uso", entrar com o Google ou outro provedor, anunciar um imóvel ou usar a Plataforma de outra forma, você confirma que leu, entendeu e aceita estes Termos e nossa <a href="/privacidad">Política de Privacidade</a>, que faz parte deles. Se não concordar, não use a Plataforma.'],

        ['h2', '2. O que é a Casa Libre'],
        ['p', 'Casa Libre é um marketplace online onde proprietários, imobiliárias, corretores e incorporadoras anunciam imóveis para venda ou aluguel, e as pessoas os buscam e entram em contato com o anunciante. Casa Libre não é uma imobiliária, não participa das transações entre usuários, não atua como intermediário, agente, notário ou garantidor, e não cobra comissão nas transações. Alguns anúncios podem provir de fontes públicas de terceiros; nesse caso as informações são as publicadas por essas fontes.'],

        ['h2', '3. Contas'],
        ['p', 'Você precisa de uma conta para anunciar. Deve ter pelo menos 18 anos e capacidade legal para contratar. Você concorda em fornecer informações verdadeiras, completas e atualizadas, manter seu acesso confidencial e nos informar sobre qualquer uso não autorizado. Você é responsável por toda a atividade na sua conta. Podemos verificar sua identidade ou sua relação com o imóvel e suspender contas cujas informações não possam ser verificadas.'],

        ['h2', '4. Anúncios'],
        ['p', 'Você é o único responsável pelo conteúdo que publica (detalhes, preço, fotos, descrição e dados de contato) e garante que: (a) tem direito de oferecer o imóvel ou está autorizado pelo proprietário; (b) as informações são verdadeiras e não enganosas; (c) as fotos e textos são seus ou você tem permissão para usá‑los; e (d) o anúncio cumpre a legislação aplicável. Anúncios falsos, duplicados, inexistentes ou que não estejam mais disponíveis, bem como conteúdo ofensivo, discriminatório ou que viole direitos, não são permitidos.'],
        ['p', 'Ao anunciar, você nos concede uma licença mundial, não exclusiva, livre de royalties, transferível e sublicenciável para hospedar, reproduzir, adaptar (ex.: recortar, traduzir ou melhorar fotos), exibir e distribuir esse conteúdo na Plataforma, em nossos canais sociais e campanhas, em mecanismos de busca e assistentes de IA, e através de parceiros e portais com os quais trabalhamos. A licença permanece enquanto o conteúdo estiver publicado e pelo tempo razoável necessário para removê‑lo de backups, caches e materiais já distribuídos. Esta licença não nos permite vender seus dados pessoais (veja a seção 5).'],
        ['p', 'Podemos revisar, reformatar, destacar, ocultar ou remover qualquer anúncio a nosso critério e sem aviso prévio, inclusive anúncios que violem estes Termos ou nossos critérios de qualidade.'],
        ['h3', 'Acordo de publicação', { id: 'acuerdo-de-publicacion' }],
        ['p', 'Quando você publica ou renova um anúncio, autoriza a Casa-Libre a publicá‑lo, compartilhá‑lo e republicá‑lo, incluindo fotos, preço, descrição e localização, nos sites e apps da Casa-Libre, nas páginas da Casa-Libre nas redes sociais e em grupos (como Facebook e Instagram), em outras plataformas de imóveis e em anúncios pagos. A Casa-Libre pode redimensionar, recortar, traduzir ou editar as fotos e o texto dessas publicações. Seus dados de contato são exibidos apenas como você os informou no anúncio. Você pode nos pedir para remover uma publicação compartilhada a qualquer momento, entrando em contato conosco, e nós a removeremos em um prazo razoável.'],

        ['h2', '5. Dados pessoais e consentimento'],
        ['p', 'Ao aceitar estes Termos, você concede seu consentimento livre, expresso e informado para que a Casa Libre colete, armazene, processe e utilize os dados que você fornece ou que são gerados ao usar a Plataforma, incluindo: nome, e‑mail, telefone e WhatsApp; seus anúncios e detalhes dos imóveis; localização aproximada ou precisa, se você permitir; buscas, favoritos, contatos e outras interações; dispositivo, navegador, endereço IP e cookies ou tecnologias semelhantes.'],
        ['p', 'Usamos esses dados para: operar a Plataforma e exibir seus anúncios; permitir que pessoas interessadas entrem em contato com você; verificar contas e prevenir fraudes; enviar mensagens sobre sua conta e anúncios; enviar novidades e ofertas por e‑mail, WhatsApp, SMS ou notificações; personalizar sua experiência; medir e melhorar nossos serviços e campanhas (incluindo ferramentas de análise e publicidade de terceiros); e gerar estatísticas, pesquisas de mercado e índices do mercado imobiliário a partir de dados agregados ou anonimados que não identifiquem ninguém.'],
        ['p', '<strong>A Casa Libre não vende seus dados pessoais.</strong> Não os vendemos nem alugamos, nem os entregamos a ninguém em troca de dinheiro ou qualquer outra contrapartida.'],
        ['p', 'Compartilhamos dados pessoais apenas com os provedores que trabalham para nós (hospedagem em nuvem, e‑mail, análise, mapas e publicidade), que os utilizam exclusivamente para nos prestar esse serviço; com outros usuários, quando você os contata ou eles o contatam; e quando exigido por lei ou autoridade. Também podemos compartilhar informações agregadas ou anonimadas, que não o identificam.'],
        ['p', `Seus dados podem ser armazenados e processados em servidores localizados fora ${COUNTRY_PT.of}, incluindo serviços de nuvem de terceiros, com medidas de segurança razoáveis. Se a Casa Libre se fundir, reorganizar ou for adquirida, os dados passarão para a nova entidade como parte dessa transação, e essa entidade deverá seguir estes Termos e a Política de Privacidade, incluindo o compromisso de não vender dados pessoais. Mantemos os dados enquanto você tiver uma conta. Se você a excluir, apagamos seus dados pessoais e mantemos apenas estatísticas anônimas.`],
        ['p', `Você pode solicitar acesso, correção ou exclusão dos seus dados, e retirar seu consentimento para mensagens de marketing, escrevendo para nós via nosso ${contactPt}. A retirada do consentimento não afeta o tratamento realizado antes da sua solicitação e pode impedir o uso de alguns recursos. Você pode excluir sua conta a qualquer momento no app (Conta → Excluir conta) ou na <a href="/eliminar-cuenta">esta página</a>. Os detalhes estão na <a href="/privacidad">Política de Privacidade</a>.`],

        ['h2', '6. Contatos entre usuários'],
        ["p", "Quando você entra em contato com um anunciante (ex.: por WhatsApp ou telefone) compartilha seus dados de contato com ele e podemos registrar esse contato. Os dados de contato de outros usuários só podem ser usados para consultar o imóvel anunciado. É proibido utilizá‑los para spam, marketing não solicitado, revenda de bases de dados ou qualquer outro fim. Qualquer negociação, visita, pagamento ou contrato é exclusivamente entre os usuários: verifique o imóvel, a documentação e a identidade da outra parte antes de pagar ou assinar."],

        ['h2', '7. Usos proibidos'],
        ['p', 'Você não pode: extrair dados da Plataforma por meios automatizados (scraping, bots, crawlers) sem nossa permissão por escrito; copiar ou reutilizar anúncios, fotos ou bancos de dados; contornar medidas técnicas ou de segurança; enviar malware; se passar por outra pessoa; usar a Plataforma para atividades ilegais, fraude ou lavagem de dinheiro; ou interferir em seu funcionamento.'],

        ['h2', '8. Propriedade intelectual'],
        ['p', 'A marca Casa Libre, o design, o software, os bancos de dados, nossos próprios textos e outros elementos da Plataforma pertencem a nós ou são licenciados a nós e são protegidos por lei. O uso da Plataforma não lhe confere direitos sobre eles.'],

        ['h2', '9. Sem garantias'],
        ['p', 'A Plataforma é fornecida "como está" e "conforme disponibilidade". Não garantimos que os anúncios sejam precisos, que os imóveis estejam disponíveis ou nas condições descritas, nem que a Plataforma funcione sem interrupções ou erros. Informações de zoneamento, preços de referência, taxas de câmbio e quaisquer outros dados informativos são apenas indicativos e não substituem a consulta à autoridade competente ou a um profissional.'],

        ['h2', '10. Limitação de responsabilidade'],
        ['p', 'Na máxima extensão permitida por lei, a Casa Libre não se responsabiliza por danos indiretos, lucros cessantes, perda de dados ou oportunidades, pelos atos, anúncios ou omissões de usuários ou terceiros, ou por transações entre eles. Nossa responsabilidade total para você é limitada ao mínimo permitido pela legislação aplicável.'],

        ['h2', '11. Indenização'],
        ['p', 'Você concorda em manter a Casa Libre, seus proprietários, equipe e colaboradores isentos de reivindicações, danos e custos (incluindo honorários advocatícios) decorrentes do seu conteúdo, do uso da Plataforma ou do descumprimento destes Termos ou da lei.'],

        ['h2', '12. Suspensão e encerramento'],
        ['p', `Podemos suspender ou encerrar sua conta e anúncios se você violar estes Termos, houver indícios de fraude ou se a lei exigir. Você pode encerrar sua conta a qualquer momento pelo seu painel ou via nosso ${contactPt}. As seções sobre licença de conteúdo, dados, propriedade intelectual, limitação de responsabilidade e indenização permanecem vigentes após o encerramento.`],

        ['h2', '13. Alterações'],
        ['p', 'Podemos alterar estes Termos. Publicaremos a nova versão com a data e, se a mudança for relevante, notificaremos você por e‑mail ou na Plataforma. Se continuar usando a Plataforma após sua entrada em vigor, você aceita a nova versão.'],

        ['h2', '14. Lei aplicável'],
        ['p', `Estes Termos são regidos pelas leis ${COUNTRY_PT.of}. Qualquer disputa será submetida aos tribunais competentes de ${COUNTRY.capital || C}, salvo se a legislação aplicável determinar outra jurisdição. Se alguma cláusula for inválida, o restante permanecerá em vigor.`],

        ['h2', '15. Contato'],
        ['p', `Para dúvidas sobre estes Termos ou seus dados, escreva para nós via nosso ${contactPt}.`],
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
