// Service-partner preview pages (casa-libre.com.py/<slug>). Each entry is a REAL company we are
// pitching: its name, services, prices, areas and contact come from the company's own website.
// The page shows how the company would look on Casa-Libre and lets them pay to go live.
// Paraguay only: the pages 404 on every other country site.

export const PARTNER_COUNTRIES = ['py'];

export const PARTNERS = {
  'casa-limpia': {
    // Everything below is CasaLimpia's own content from casa-limpia.com.py (home, service
    // pages, /empresas, /nosotros, /preguntas-frecuentes, /precios), read 2026-11-26.
    // English lines are our translation for the EN switch.
    slug: 'casa-limpia',
    name: 'CasaLimpia',
    category: { es: 'Limpieza', en: 'Cleaning' },
    area: { es: 'Limpieza a domicilio · Gran Asunción', en: 'Home cleaning · Greater Asunción' },
    headline: { es: 'Limpieza profesional en Gran Asunción', en: 'Professional cleaning in Greater Asunción' },
    tagline: {
      es: 'Tu casa o tu oficina, impecable. Sin que tengas que ocuparte de nada.',
      en: 'Your home or office, spotless. Without you having to deal with anything.',
    },
    aboutTitle: { es: ['No vendemos horas. ', 'Vendemos el resultado.'], en: ["We don't sell hours. ", 'We sell the result.'] },
    about: {
      es: 'CasaLimpia es una empresa de limpieza de Asunción. Limpiamos departamentos, lavamos tapizados y colchones y armamos equipos de limpieza para oficinas, obras y edificios, en todo Gran Asunción. Trabajamos con la misma regla en cada servicio: precio claro, trabajo bien hecho y factura legal. Atendemos en español, inglés, polaco, alemán y portugués.',
      en: 'CasaLimpia is a cleaning company from Asunción. We clean apartments, wash upholstery and mattresses, and put together cleaning teams for offices, construction sites and buildings, across Greater Asunción. We follow the same rule on every job: a clear price, work done right and an official invoice. We speak Spanish, English, Polish, German and Portuguese.',
    },
    logo: '/casa-limpia/logo-full.svg',
    cover: '/casa-limpia/hero-home.jpg',
    // Business WhatsApp from casa-limpia.com.py (0972 993 999).
    whatsapp: '595972993999',
    whatsappLabel: '0972 993 999',
    waText: {
      es: 'Hola CasaLimpia, los encontré en Casa-Libre. Quisiera un presupuesto de limpieza para una propiedad.',
      en: 'Hi CasaLimpia, I found you on Casa-Libre. I would like a cleaning quote for a property.',
    },
    chips: [
      { es: 'Precio fijo', en: 'Fixed price' },
      { es: 'Factura legal', en: 'Official invoice' },
      { es: 'Productos y equipo incluidos', en: 'Supplies and equipment included' },
      { es: 'Primero limpiamos, después pagás', en: 'We clean first, you pay after' },
      { es: 'Reporte con fotos por WhatsApp', en: 'Photo report on WhatsApp' },
    ],
    stats: [
      { k: { es: 'Google', en: 'Google' }, v: { es: '5,0 ★ · 6 reseñas', en: '5.0 ★ · 6 reviews' } },
      { k: { es: 'Atiende', en: 'Open' }, v: { es: 'Lun a sáb · 8 a 18 h', en: 'Mon to Sat · 8 am–6 pm' } },
      { k: { es: 'Idiomas', en: 'Languages' }, v: { es: '5 idiomas', en: '5 languages' } },
      { k: { es: 'Garantía', en: 'Guarantee' }, v: { es: 'Impecable o volvemos', en: 'Spotless or we come back' } },
    ],
    servicesTitle: { es: ['Nuestros ', 'servicios'], en: ['Our ', 'services'] },
    servicesSub: { es: 'Todo lo que tu casa necesita para estar limpia.', en: 'Everything your home needs to be clean.' },
    services: [
      { icon: 'key', t: { es: 'Limpieza de departamentos', en: 'Apartment cleaning' }, d: { es: 'Tu depto limpio con precio fijo según el tipo de departamento. Sin pagar horas. 1 dormitorio 209.000 Gs · 2 dormitorios 239.000 Gs · 3 dormitorios 299.000 Gs. Traslado incluido en todo Gran Asunción.', en: 'Your apartment cleaned at a fixed price by apartment type. No hourly billing. 1 bedroom Gs 209,000 · 2 bedrooms Gs 239,000 · 3 bedrooms Gs 299,000. Travel included across Greater Asunción.' }, from: { es: 'desde', en: 'from' }, price: '209.000 Gs' },
      { icon: 'sofa', t: { es: 'Lavado de sofás y sillas', en: 'Sofa and chair washing' }, d: { es: 'Sofás, sillones y sillas lavados en tu casa con máquina de inyección y extracción.', en: 'Sofas, armchairs and chairs washed at your home with an injection-extraction machine.' }, from: { es: 'sofá 3 cuerpos', en: '3-seat sofa' }, price: '299.000 Gs' },
      { icon: 'bed', t: { es: 'Lavado de colchones', en: 'Mattress washing' }, d: { es: 'Sacamos manchas, ácaros y olores del colchón sin moverlo de tu casa.', en: 'We remove stains, mites and odours from the mattress without taking it out of your home.' }, from: { es: 'desde', en: 'from' }, price: '189.000 Gs' },
      { icon: 'rug', t: { es: 'Lavado de alfombras', en: 'Rug washing' }, d: { es: 'Alfombras de living y dormitorio lavadas a fondo en tu casa.', en: 'Living room and bedroom rugs deep-washed at your home.' }, from: { es: 'desde', en: 'from' }, price: '158.000 Gs' },
      { icon: 'home', t: { es: 'Limpieza de casas', en: 'House cleaning' }, d: { es: 'Cada casa es distinta: contanos cómo es la tuya y te armamos un presupuesto a medida.', en: 'Every house is different: tell us about yours and we put together a custom quote.' }, from: { es: 'precio', en: 'price' }, price: { es: 'A medida', en: 'Custom quote' } },
      { icon: 'door', t: { es: 'Limpieza de mudanza', en: 'Move-in / move-out cleaning' }, d: { es: 'Antes de mudarte o al entregar el depto: limpieza profunda y, si los necesitás, tapizados y colchones.', en: 'Before you move in or when you hand over the apartment: a deep clean and, if you need them, upholstery and mattresses.' }, from: { es: 'precio', en: 'price' }, price: { es: 'A medida', en: 'Custom quote' } },
    ],
    whyTitle: { es: ['Por qué ', 'CasaLimpia'], en: ['Why ', 'CasaLimpia'] },
    why: [
      { t: { es: 'Precio antes de empezar', en: 'Price before we start' }, d: { es: 'Sabés cuánto vas a pagar antes de que lleguemos.', en: 'You know what you will pay before we arrive.' } },
      { t: { es: 'Factura legal en cada servicio', en: 'Official invoice on every job' }, d: { es: 'Para tu empresa, tu contador o simplemente para tu tranquilidad.', en: 'For your company, your accountant or simply your peace of mind.' } },
      { t: { es: 'Llevamos todo', en: 'We bring everything' }, d: { es: 'Productos, aspiradora y equipo. Vos no comprás nada.', en: "Supplies, vacuum and equipment. You don't buy anything." } },
      { t: { es: 'Primero limpiamos. Después pagás.', en: 'We clean first. You pay after.' }, d: { es: 'Sin seña, sin adelantos.', en: 'No deposit, no prepayment.' } },
      { t: { es: 'Reporte con fotos', en: 'Photo report' }, d: { es: 'Al terminar te enviamos por WhatsApp cómo quedó todo.', en: 'When we finish we send you on WhatsApp how everything turned out.' } },
    ],
    gallery: ['/casa-limpia/living-3.jpg', '/casa-limpia/why-kitchen.jpg', '/casa-limpia/why-bath.jpg', '/casa-limpia/why-bedroom.jpg', '/casa-limpia/svc-upholstery.jpg'],
    stepsTitle: { es: ['Tres pasos ', 'y listo.'], en: ['Three steps ', 'and done.'] },
    steps: [
      { t: { es: 'Escribinos', en: 'Message us' }, d: { es: 'Por WhatsApp o con el formulario. Contanos qué necesitás limpiar.', en: 'On WhatsApp or with the form. Tell us what you need cleaned.' } },
      { t: { es: 'Te confirmamos precio y fecha', en: 'We confirm price and date' }, d: { es: 'Precio fijo según tu depto, tus muebles o tu empresa. Sin sorpresas.', en: 'A fixed price for your apartment, furniture or company. No surprises.' } },
      { t: { es: 'Limpiamos y recién ahí pagás', en: 'We clean, and only then you pay' }, d: { es: 'Revisás el resultado, recibís el reporte con fotos y la factura legal.', en: 'You check the result and get the photo report and the official invoice.' } },
    ],
    guarantee: {
      t: { es: 'Impecable o volvemos', en: 'Spotless or we come back' },
      d: { es: 'Avisanos dentro de las 24 horas con una foto y volvemos dentro de las 48 horas, sin costo.', en: 'Let us know within 24 hours with a photo and we come back within 48 hours, at no cost.' },
    },
    reviews: [
      { name: 'Mauricio Coronel', text: 'Servicio impecable y 100% recomendado. Quedé encantado con la limpieza de mi apartamento.' },
      { name: 'Angel Pallas', text: 'Limpieza profunda y eficiente. Muy contento con el resultado.' },
      { name: 'Gina Jimenez', text: 'Great customer service! Friendly, helpful and speak English and Spanish!' },
      { name: 'Maria José Tineo', text: 'Excelente servicio muy recomendado' },
    ],
    sectorsTitle: { es: ['Limpieza para ', 'tu empresa.'], en: ['Cleaning for ', 'your company.'] },
    sectorsSub: { es: 'Oficinas, edificios, inmobiliarias, comercios y más sectores. Un solo proveedor. Un solo contacto.', en: 'Offices, buildings, real estate agencies, shops and more. One provider. One contact.' },
    sectors: [
      { es: 'Inmobiliarias', en: 'Real estate agencies' }, { es: 'Desarrolladoras y constructoras', en: 'Developers and builders' },
      { es: 'Edificios y consorcios', en: 'Buildings and condos' }, { es: 'Oficinas', en: 'Offices' },
      { es: 'Colegios e institutos', en: 'Schools' }, { es: 'Consultorios', en: 'Medical and dental offices' },
      { es: 'Gimnasios', en: 'Gyms' }, { es: 'Salones de belleza', en: 'Beauty salons' },
      { es: 'Hoteles y hospedajes', en: 'Hotels and guesthouses' }, { es: 'Restaurantes y cafeterías', en: 'Restaurants and cafés' },
      { es: 'Salones de eventos', en: 'Event venues' }, { es: 'Showrooms y comercios', en: 'Showrooms and shops' },
      { es: 'Embajadas y ONG', en: 'Embassies and NGOs' },
    ],
    faq: [
      { q: { es: '¿Tengo que comprar productos?', en: 'Do I need to buy supplies?' }, a: { es: 'No. Llevamos productos, aspiradora y todo el equipo.', en: 'No. We bring supplies, a vacuum and all the equipment.' } },
      { q: { es: '¿Cuándo pago?', en: 'When do I pay?' }, a: { es: 'Al terminar, después de revisar el trabajo. No pedimos seña ni adelantos.', en: 'When we finish, after you check the work. We ask for no deposit or prepayment.' } },
      { q: { es: '¿Dan factura?', en: 'Do you give an invoice?' }, a: { es: 'Sí, factura legal en todos los servicios. Solo necesitamos tu RUC o cédula, razón social o nombre, y dirección.', en: 'Yes, an official invoice on every job. We only need your RUC or ID, company or personal name, and address.' } },
      { q: { es: '¿Tengo que estar en casa?', en: 'Do I need to be home?' }, a: { es: 'No es necesario. Podemos coordinar la entrega de llaves con vos o con la administración del edificio.', en: 'No. We can arrange the keys with you or with the building management.' } },
      { q: { es: '¿Firman contrato?', en: 'Do you sign a contract?' }, a: { es: 'No para hogares: una visita es una visita. Para empresas acordamos las condiciones en el presupuesto.', en: 'Not for homes: one visit is one visit. For companies we agree the terms in the quote.' } },
    ],
    team: [
      { img: '/casa-limpia/tomas.jpg', name: 'Tomas Lukasiak', role: { es: 'Cofundador · Clientes y operaciones', en: 'Co-founder · Clients and operations' } },
      { img: '/casa-limpia/mikolaj.jpg', name: 'Mikołaj Koput', role: { es: 'Cofundador · Marketing y ventas', en: 'Co-founder · Marketing and sales' } },
      { img: '/casa-limpia/mirian.jpg', name: 'Mirian', role: { es: 'Jefa del equipo de limpieza', en: 'Cleaning team lead' } },
    ],
    zonesNote: { es: 'Atendemos en todo Gran Asunción. Base en Asunción.', en: 'We cover all of Greater Asunción. Based in Asunción.' },
    zones: ['Asunción', 'Capiatá', 'Fernando de la Mora', 'Lambaré', 'Limpio', 'Luque', 'Mariano Roque Alonso', 'Ñemby', 'San Antonio', 'San Lorenzo', 'Villa Elisa'],
    details: [
      { icon: 'clock', k: { es: 'Horario', en: 'Hours' }, v: { es: 'Lun a sáb · 8:00–18:00', en: 'Mon to Sat · 8:00–18:00' } },
      { icon: 'clock', k: { es: 'Turnos', en: 'Shifts' }, v: { es: '8–12 h y 12–16 h', en: '8–12 and 12–16' } },
      { icon: 'receipt', k: { es: 'Factura', en: 'Invoice' }, v: { es: 'Factura legal en cada servicio', en: 'Official invoice on every job' } },
      { icon: 'card', k: { es: 'Pago', en: 'Payment' }, v: { es: 'Al terminar · sin seña', en: 'After the job · no deposit' } },
      { icon: 'camera', k: { es: 'Reporte', en: 'Report' }, v: { es: 'Fotos por WhatsApp', en: 'Photos on WhatsApp' } },
      { icon: 'pin', k: { es: 'Dirección', en: 'Address' }, v: { es: 'Edificio Habitalis Mburucuyá, Av. Dr. Felipe Molas López 986, Asunción', en: 'Edificio Habitalis Mburucuyá, Av. Dr. Felipe Molas López 986, Asunción' } },
    ],
    contactTitle: { es: ['¿Listo para pedir ', 'tu presupuesto?'], en: ['Ready to ask for ', 'your quote?'] },
    contactSub: { es: 'Contanos qué necesitás y te respondemos por WhatsApp.', en: "Tell us what you need and we'll reply on WhatsApp." },
    // The ad on a rental listing uses their own "Cambio de inquilino" pitch (/limpieza-de-mudanza/).
    ad: {
      es: 'Un solo proveedor para dejar el depto listo entre un inquilino y otro. Reporte con fotos para adjuntar al acta de entrega.',
      en: 'One provider to get the apartment ready between tenants. Photo report to attach to the handover record.',
    },
    // Founding-partner plan, charged as a monthly Stripe subscription in USD.
    plan: { usd: 49, cents: 4900, listUsd: 99, interval: 'month' },
    // Short tracked links, one random code per person: casa-libre.com.py/casa-limpia/<code>
    // (and /<code>/pagar). The code becomes utm_content, so the client's visits never mix
    // with our own tests. Who owns each code stays on the server (never sent to the page).
    campaign: 'socios_casa_limpia',
    links: {
      '4bmex': { who: 'Tomas Lukasiak (CasaLimpia)', client: true },
      'p54wp': { who: 'Roland (prueba)', client: false },
      'p4bs3': { who: 'Omar (prueba)', client: false },
    },
  },
};

// UTM tags for a person's short link.
export const linkUtm = (p, code) => ({
  utm_source: 'email', utm_medium: 'email', utm_campaign: p.campaign, utm_content: code,
});

export const getPartner = (slug) => PARTNERS[slug] || null;
export const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.es : v);
export const waLink = (p, lang = 'es') => `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(pick(p.waText, lang))}`;
