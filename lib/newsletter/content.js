// The Casa-Libre weekly newsletter: issues, success stories and the "Personalize your profile"
// emails. ONE source for the email templates (migrations/023_newsletter.sql is generated from
// this file by scripts/gen-newsletter-sql.mjs), the /newsletter page and the tests. Pure: no
// imports, no env.
//
// Copy rules (Roland's Marketing Formula, Desktop/airosofts/casa-libre-marketing-formula.md):
// hook → claim → offer → proof → action; Paraguayan voseo; brand "Casa-Libre"; never "la mejor",
// "de mayor crecimiento", "gratis para siempre"; no opt-out line. Numbers are never written
// into the copy: every {{nl_*}} is measured that week (lib/newsletter/insights.js) and an issue
// whose number could not be measured is skipped (lib/automations/newsletter.js missingVars).
//
// Success stories: the user decided (2026-11-22) to publish ILLUSTRATIVE stories as Roland
// described (first names only, no real people / companies / photos). They carry the one line
// below; delete it here (ILLUSTRATIVE_NOTE = '') to remove it from the website in one edit.
// The emails that tell a story have the same line in their template text (Email templates).

export const ILLUSTRATIVE_NOTE = {
  es: 'Historias ilustrativas basadas en casos típicos de la plataforma.',
  en: 'Illustrative stories based on typical cases on the platform.',
};

// The mock listing ("without your photo / with your photo"), rendered from HTML with Playwright
// and stored in the shared B2 bucket under email-assets/ — served by the website's /api/media
// proxy, so it shows in Gmail for every country.
export const PROFILE_MOCK_IMAGE = 'https://casa-libre.com.py/api/media/email-assets/profile-mock-v1.jpg';

export const POSITIONING = {
  es: 'Casa-Libre es tecnología y experiencia inmobiliaria de Estados Unidos, hecha para {{country_name}}.',
  en: 'Casa-Libre brings US real-estate technology and experience, built for {{country_name}}.',
};

// ── Success stories (newsletter page "Historias de éxito" + story emails) ──
export const STORIES = [
  {
    slug: 'martin-comision',
    metric: { es: 'US$10.000 de comisión', en: 'US$10,000 commission' },
    when: { es: 'en 3 semanas', en: 'in 3 weeks' },
    who: { es: 'Martín · agente independiente', en: 'Martín · independent agent' },
    title: { es: 'Cómo Martín ganó US$10.000 de comisión en 3 semanas', en: 'How Martín earned a US$10,000 commission in 3 weeks' },
    challenge: {
      es: 'Una casa de 3 dormitorios de US$340.000 llevaba cuatro meses publicada en otros portales. Pocas consultas, y casi todas de curiosos.',
      en: 'A 3-bedroom house priced at US$340,000 had been listed on other portals for four months. Few enquiries, mostly from browsers.',
    },
    did: {
      es: 'La publicó en Casa-Libre con 18 fotos de día, el precio a la vista y su perfil completo: foto, nombre y cargo. Respondió cada WhatsApp en menos de una hora.',
      en: 'He listed it on Casa-Libre with 18 daylight photos, the price in plain sight and a complete profile: photo, name and title. He answered every WhatsApp within the hour.',
    },
    result: {
      es: '23 consultas directas a su WhatsApp, 6 visitas y una oferta aceptada el día 19. Su comisión del 3 %: más de US$10.000.',
      en: '23 direct enquiries to his WhatsApp, 6 viewings and an accepted offer on day 19. His 3% commission: over US$10,000.',
    },
    quote: { es: 'Los compradores me escribían sabiendo quién era. La primera conversación ya empezaba con confianza.', en: 'Buyers wrote to me already knowing who I was. The first conversation started with trust.' },
  },
  {
    slug: 'lorena-alquiler',
    metric: { es: 'Alquilado en 9 días', en: 'Rented in 9 days' },
    when: { es: 'sin intermediarios', en: 'with no middleman' },
    who: { es: 'Lorena · dueña de un departamento', en: 'Lorena · apartment owner' },
    title: { es: 'Lorena alquiló su departamento en 9 días, sin intermediarios', en: 'Lorena rented out her apartment in 9 days, with no middleman' },
    challenge: {
      es: 'Su inquilino se iba a fin de mes y no quería pagar un mes de comisión ni tener el departamento vacío.',
      en: 'Her tenant was leaving at the end of the month and she didn’t want to pay a month’s commission or leave the apartment empty.',
    },
    did: {
      es: 'Publicó el departamento desde la app con 12 fotos, el precio del alquiler y las expensas. Los interesados le escribieron directo a su WhatsApp.',
      en: 'She listed the apartment from the app with 12 photos, the monthly rent and the building fees. Interested people wrote straight to her WhatsApp.',
    },
    result: {
      es: '14 consultas en la primera semana, 4 visitas y contrato firmado el día 9. 0 % de comisión para Casa-Libre.',
      en: '14 enquiries in the first week, 4 viewings and a signed lease on day 9. 0% commission to Casa-Libre.',
    },
    quote: { es: 'Contesté desde el celular, elegí a quién mostrarle y listo.', en: 'I answered from my phone, chose who to show it to, and that was it.' },
  },
  {
    slug: 'diego-cartera',
    metric: { es: '60 consultas el primer mes', en: '60 enquiries in month one' },
    when: { es: 'con 42 propiedades', en: 'with 42 properties' },
    who: { es: 'Diego · inmobiliaria de 3 personas', en: 'Diego · 3-person agency' },
    title: { es: 'De 0 a 60 consultas: cómo una inmobiliaria de 3 personas llenó su agenda', en: 'From 0 to 60 enquiries: how a 3-person agency filled its calendar' },
    challenge: {
      es: 'Diego tenía 42 propiedades y ningún tiempo para cargarlas una por una en otro portal.',
      en: 'Diego had 42 properties and no time to upload them one by one to another portal.',
    },
    did: {
      es: 'Respondió CARTERA por WhatsApp y el equipo de Casa-Libre lo ayudó a subir toda su cartera en una semana, sin exclusividad.',
      en: 'He replied CARTERA on WhatsApp and the Casa-Libre team helped him move his whole portfolio in a week, with no exclusivity.',
    },
    result: {
      es: '60 consultas en el primer mes y 2 ventas cerradas en 45 días. Sigue publicando también donde publicaba antes.',
      en: '60 enquiries in the first month and 2 sales closed within 45 days. He still lists where he listed before, too.',
    },
    quote: { es: 'Lo que más me sirvió fue no tener que cargar nada a mano.', en: 'What helped most was not having to upload anything by hand.' },
  },
  {
    slug: 'sofia-proyecto',
    metric: { es: '6 de 12 unidades reservadas', en: '6 of 12 units reserved' },
    when: { es: 'en 2 meses', en: 'in 2 months' },
    who: { es: 'Sofía · desarrolladora', en: 'Sofía · developer' },
    title: { es: 'Sofía reservó la mitad de su proyecto en 2 meses', en: 'Sofía reserved half her project in 2 months' },
    challenge: {
      es: 'Un edificio de 12 departamentos en pozo y un presupuesto de marketing chico.',
      en: 'A 12-apartment building off-plan and a small marketing budget.',
    },
    did: {
      es: 'Publicó el proyecto con planos, renders y precios por unidad, y dejó su WhatsApp para consultas directas.',
      en: 'She listed the project with floor plans, renders and per-unit prices, and left her WhatsApp for direct questions.',
    },
    result: {
      es: '38 consultas de compradores e inversores, 6 unidades reservadas en 8 semanas.',
      en: '38 enquiries from buyers and investors, 6 units reserved in 8 weeks.',
    },
    quote: { es: 'Los inversores llegaban con preguntas concretas porque ya habían visto los planos.', en: 'Investors arrived with concrete questions because they had already seen the plans.' },
  },
  {
    slug: 'ramon-perfil',
    metric: { es: 'De 2 a 9 consultas por semana', en: 'From 2 to 9 enquiries a week' },
    when: { es: 'después de completar su perfil', en: 'after completing his profile' },
    who: { es: 'Ramón · agente', en: 'Ramón · agent' },
    title: { es: 'Ramón agregó su foto y su nombre. Esto pasó después', en: 'Ramón added his photo and name. Here’s what happened next' },
    challenge: {
      es: 'Tenía 8 propiedades publicadas con su perfil vacío: sin foto, sin cargo, sin empresa.',
      en: 'He had 8 listings with an empty profile: no photo, no title, no company.',
    },
    did: {
      es: 'En dos minutos subió una foto suya, completó nombre, cargo y empresa, y confirmó su WhatsApp.',
      en: 'In two minutes he uploaded a photo of himself, filled in his name, title and company, and confirmed his WhatsApp.',
    },
    result: {
      es: 'Pasó de 2 a 9 consultas por semana en el mes siguiente, con las mismas propiedades.',
      en: 'He went from 2 to 9 enquiries a week the following month, with the same listings.',
    },
    quote: { es: 'Es lo mismo que hacen los agentes en Estados Unidos: dar la cara.', en: 'It’s what agents in the US do: put your face on it.' },
  },
];

// A short story block for an email body (illustrative line included).
export const storyBlock = (slug) => {
  const s = STORIES.find((x) => x.slug === slug);
  return [
    `## ${s.title.es}`,
    `**El desafío:** ${s.challenge.es}`,
    `**Lo que hizo:** ${s.did.es}`,
    `!! ${s.metric.es} | ${s.result.es}`,
    `"${s.quote.es}" — ${s.who.es.split(' · ')[0]}`,
    ILLUSTRATIVE_NOTE.es,
  ].join('\n\n');
};

// ── Newsletter issues (email_templates rows, key = newsletter-<slug>) ──
// story: the success story told inside (the page shows it as a story card).
// audience: the default audience the rotation suggests (everyone | sellers | buyers | never_listed).
// en: the English version, for the website page (the emails are Spanish).
export const ISSUES = [
  {
    slug: 'que-buscan-los-compradores', audience: 'everyone',
    name: 'Newsletter — Qué buscan los compradores',
    subject: 'Qué buscan los compradores en {{country_name}} este mes',
    heading: 'Lo que buscan los compradores',
    body: [
      '>> Datos reales de Casa-Libre: precios, ciudades y tipos de propiedad más vistos en los últimos 30 días.',
      'Hola {{name}}, esto es lo que miraron los compradores en Casa-Libre en los últimos 30 días.',
      '!! Hasta {{nl_sale_median}} | La mitad de las visitas a propiedades en venta fue a precios de hasta ese valor.',
      '!! {{nl_sale_under_100k_pct}} % | de las visitas a propiedades en venta fue a precios menores a US$100.000.',
      '!! {{nl_top_cities}} | son las ciudades con más visitas.',
      '## Qué significa para vos',
      'Si tenés una propiedad en ese rango o en esas ciudades, hay compradores mirando ahora. En Casa-Libre los interesados te escriben directo a tu WhatsApp y no cobramos comisión sobre tu operación.',
      `${POSITIONING.es} Ya hay {{active_listings}} propiedades activas.`,
      '[[Leer el newsletter completo]]({{newsletter_url}}#que-buscan-los-compradores)',
    ].join('\n\n'),
    button_label: 'Publicar mi propiedad', button_url: '{{publish_url}}',
    en: {
      subject: 'What buyers in {{country_name}} are looking for this month',
      heading: 'What buyers are looking for',
      body: [
        '!! Up to {{nl_sale_median}} | Half of all views of properties for sale went to prices up to this amount.',
        '!! {{nl_sale_under_100k_pct}}% | of views of properties for sale were under US$100,000.',
        '!! {{nl_top_cities}} | are the cities with the most views.',
        '## What it means for you',
        'If you have a property in that range or in those cities, buyers are looking right now. On Casa-Libre interested people write straight to your WhatsApp and we take no commission on your deal.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'publicaciones-directas', audience: 'never_listed',
    name: 'Newsletter — Publicaciones directas reciben más visitas',
    subject: 'Las publicaciones directas reciben {{nl_direct_ratio}} veces más visitas',
    heading: 'Publicá directo y te ven más',
    body: [
      '>> Lo medimos en Casa-Libre con los datos de los últimos 30 días.',
      'Hola {{name}}, ya tenés tu cuenta en Casa-Libre. Te falta un paso: publicar tu propiedad.',
      '!! {{nl_direct_ratio}} veces más visitas | recibieron en promedio las propiedades publicadas directamente por sus dueños y agentes, comparadas con los avisos importados de otros sitios (últimos 30 días).',
      '!! {{nl_people_30d}} personas | miraron propiedades en Casa-Libre en los últimos 30 días.',
      '## Publicar te lleva unos minutos',
      'Fotos, precio y ubicación. Los interesados te escriben directo a tu WhatsApp, sin comisión sobre tu operación y sin exclusividad. Desde la web o desde la app de Casa-Libre para iPhone y Android.',
      '[[Leer el newsletter completo]]({{newsletter_url}}#publicaciones-directas)',
    ].join('\n\n'),
    button_label: 'Publicar mi primera propiedad', button_url: '{{publish_url}}',
    en: {
      subject: 'Listings published directly get {{nl_direct_ratio}}x the views',
      heading: 'List directly and get seen more',
      body: [
        '!! {{nl_direct_ratio}}x the views | on average for properties published directly by their owners and agents, compared with listings imported from other sites (last 30 days).',
        '!! {{nl_people_30d}} people | looked at properties on Casa-Libre in the last 30 days.',
        '## Listing takes a few minutes',
        'Photos, price and location. Interested people write straight to your WhatsApp, with no commission on your deal and no exclusivity. On the web or in the Casa-Libre app for iPhone and Android.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'alquileres', audience: 'everyone', story: 'lorena-alquiler',
    name: 'Newsletter — Alquileres: el precio que más miran',
    subject: 'Alquileres: el precio que más miran los inquilinos',
    heading: 'El alquiler se mueve',
    body: [
      '>> {{nl_rent_band_pct}} % de las visitas a alquileres fue al rango de {{nl_rent_band}} por mes.',
      'Hola {{name}}, en Casa-Libre se buscan más alquileres que propiedades en venta.',
      '!! {{nl_rent_searches}} búsquedas | de alquiler, frente a {{nl_sale_searches}} de compra, en los últimos 30 días.',
      '!! {{nl_rent_band}} | por mes es el rango de alquiler más visto: {{nl_rent_band_pct}} % de las visitas a alquileres.',
      '## ¿Tenés algo para alquilar?',
      'Publicalo con precio, fotos y ubicación: el inquilino sabe en segundos si es para él y te escribe a tu WhatsApp.',
      storyBlock('lorena-alquiler'),
      '[[Ver más historias]]({{stories_url}})',
      '[[Leer el newsletter completo]]({{newsletter_url}}#alquileres)',
    ].join('\n\n'),
    button_label: 'Publicar mi alquiler', button_url: '{{publish_url}}',
    en: {
      subject: 'Rentals: the price range tenants look at most',
      heading: 'Rentals are moving',
      body: [
        '!! {{nl_rent_searches}} searches | for rentals, against {{nl_sale_searches}} for buying, in the last 30 days.',
        '!! {{nl_rent_band}} | a month is the most viewed rent range: {{nl_rent_band_pct}}% of rental views.',
        '## Got something to rent out?',
        'List it with price, photos and location: tenants know in seconds whether it suits them and write to your WhatsApp.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'historia-comision', audience: 'everyone', story: 'martin-comision',
    name: 'Newsletter — Historia: US$10.000 en 3 semanas',
    subject: 'Cómo Martín ganó US$10.000 de comisión en 3 semanas',
    heading: 'Historia de éxito: US$10.000 en 3 semanas',
    body: [
      '>> Una casa que no se movía, fotos claras, su perfil completo y el WhatsApp a la vista.',
      'Hola {{name}}, esta semana te contamos cómo trabaja un agente en Casa-Libre.',
      storyBlock('martin-comision'),
      '## Lo que podés copiar hoy',
      'Fotos de día, precio a la vista, tu foto y tu nombre en el perfil, y respuesta rápida por WhatsApp. Es la forma de trabajar de los agentes en Estados Unidos, y Casa-Libre la trae a {{country_name}}.',
      '[[Ver más historias]]({{stories_url}})',
    ].join('\n\n'),
    button_label: 'Publicar mi propiedad', button_url: '{{publish_url}}',
    en: {
      subject: 'How Martín earned a US$10,000 commission in 3 weeks',
      heading: 'Success story: US$10,000 in 3 weeks',
      body: [
        '## What you can copy today',
        'Daylight photos, the price in plain sight, your photo and name on your profile, and quick answers on WhatsApp. It’s how agents work in the US, and Casa-Libre brings it to {{country_name}}.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'fotos', audience: 'sellers',
    name: 'Newsletter — Fotos: la diferencia',
    subject: 'Fotos: la diferencia entre que te miren o no',
    heading: 'Las fotos venden primero',
    body: [
      '>> Las publicaciones con fotos tuvieron {{nl_photo_ratio}} veces más visitas en Casa-Libre.',
      'Hola {{name}}, el comprador decide en segundos si abre tu publicación. Lo primero que mira son las fotos.',
      '!! {{nl_photo_ratio}} veces más visitas | recibieron en promedio las publicaciones con fotos frente a las que no tenían ninguna (últimos 30 días en Casa-Libre).',
      '## 3 fotos que no pueden faltar',
      '**1.** El frente, de día y con luz natural.\n**2.** El ambiente principal, ordenado y desde una esquina.\n**3.** La cocina o el baño, que es lo que más preguntan.',
      '## Y tu foto también',
      'En Estados Unidos ningún agente publica sin su foto: el comprador quiere saber con quién va a hablar. Agregá la tuya y tu nombre a tu perfil en 2 minutos.',
      '[[Publicar mi propiedad]]({{publish_url}})',
      '[[Leer el newsletter completo]]({{newsletter_url}}#fotos)',
    ].join('\n\n'),
    button_label: 'Completar mi perfil', button_url: '{{settings_url}}',
    en: {
      subject: 'Photos: the difference between being seen or not',
      heading: 'Photos sell first',
      body: [
        '!! {{nl_photo_ratio}}x the views | on average for listings with photos compared with listings with none (last 30 days on Casa-Libre).',
        '## 3 photos you can’t skip',
        '**1.** The front, in daylight.\n**2.** The main room, tidy, shot from a corner.\n**3.** The kitchen or bathroom — what people ask about most.',
        '## And your photo too',
        'In the US no agent lists without their photo: buyers want to know who they will talk to. Add yours and your name to your profile in 2 minutes.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'zonas-mas-buscadas', audience: 'everyone',
    name: 'Newsletter — Las zonas más buscadas',
    subject: 'Las zonas que más buscan los compradores ahora',
    heading: 'Dónde buscan los compradores',
    body: [
      '>> {{nl_top_searches}}: ahí está la demanda este mes.',
      'Hola {{name}}, esto es lo que más se escribió en el buscador de Casa-Libre en los últimos 30 días.',
      '!! {{nl_top_searches}} | son los lugares más buscados.',
      '!! {{nl_top_types}} | son los tipos de propiedad más vistos.',
      '## ¿Tenés algo en esas zonas?',
      'Es el momento de publicarlo: hay gente buscando ahí ahora mismo. Los interesados te escriben directo a tu WhatsApp.',
      '[[Publicar mi propiedad]]({{publish_url}})',
      '[[Leer el newsletter completo]]({{newsletter_url}}#zonas-mas-buscadas)',
    ].join('\n\n'),
    button_label: 'Ver lo que buscan los compradores', button_url: '{{search_url}}',
    en: {
      subject: 'The areas buyers are searching for right now',
      heading: 'Where buyers are searching',
      body: [
        '!! {{nl_top_searches}} | are the most searched places.',
        '!! {{nl_top_types}} | are the most viewed property types.',
        '## Have something in those areas?',
        'Now is the time to list it: people are searching there right now. Interested people write straight to your WhatsApp.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'tu-cuenta-esta-lista', audience: 'never_listed',
    name: 'Newsletter — Tu cuenta está lista (sin publicar)',
    subject: '{{name}}, tu cuenta está lista: falta tu primera propiedad',
    heading: 'Tu cuenta está lista',
    body: [
      '>> {{nl_people_30d}} personas miraron propiedades en Casa-Libre el último mes.',
      'Hola {{name}}, te registraste en Casa-Libre pero todavía no publicaste. Esto es lo que pasó en el último mes:',
      '!! {{nl_people_30d}} personas | miraron propiedades en Casa-Libre en los últimos 30 días, con {{nl_views_30d}} visitas a publicaciones.',
      '## Cómo funciona',
      '**0 % de comisión** sobre tu operación.\nLos interesados te escriben **directo a tu WhatsApp**.\n**Sin exclusividad:** seguí publicando donde quieras.',
      `${POSITIONING.es} Ya hay {{active_listings}} propiedades activas.`,
      '[[Leer el newsletter completo]]({{newsletter_url}}#tu-cuenta-esta-lista)',
    ].join('\n\n'),
    button_label: 'Publicar mi propiedad', button_url: '{{publish_url}}',
    en: {
      subject: 'Your account is ready: your first property is missing',
      heading: 'Your account is ready',
      body: [
        '!! {{nl_people_30d}} people | looked at properties on Casa-Libre in the last 30 days, with {{nl_views_30d}} listing views.',
        '## How it works',
        '**0% commission** on your deal.\nInterested people write **straight to your WhatsApp**.\n**No exclusivity:** keep listing wherever you want.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'historia-inmobiliaria', audience: 'sellers', story: 'diego-cartera',
    name: 'Newsletter — Historia: inmobiliaria de 3 personas',
    subject: 'De 0 a 60 consultas: cómo una inmobiliaria de 3 personas llenó su agenda',
    heading: 'Toda tu cartera, en una semana',
    body: [
      '>> Diego subió 42 propiedades a Casa-Libre sin cargar nada a mano. Esto pasó después.',
      'Hola {{name}}, si tenés muchas propiedades, esta historia es para vos.',
      storyBlock('diego-cartera'),
      '## ¿Tenés más de 10 propiedades?',
      'Escribinos **CARTERA** por WhatsApp y te ayudamos a subir toda tu cartera, sin exclusividad.',
      '[[Ver más historias]]({{stories_url}})',
    ].join('\n\n'),
    button_label: 'Publicar mis propiedades', button_url: '{{publish_url}}',
    en: {
      subject: 'From 0 to 60 enquiries: how a 3-person agency filled its calendar',
      heading: 'Your whole portfolio, in one week',
      body: [
        '## More than 10 properties?',
        'Send us **CARTERA** on WhatsApp and we’ll help you move your whole portfolio, with no exclusivity.',
      ].join('\n\n'),
    },
  },
  {
    slug: 'experiencia-estados-unidos', audience: 'everyone',
    name: 'Newsletter — Experiencia de Estados Unidos + app',
    subject: 'Cómo se venden casas en Estados Unidos, ahora en {{country_name}}',
    heading: 'Experiencia de Estados Unidos, hecha para {{country_name}}',
    body: [
      '>> Mapa, fotos, WhatsApp directo y la app de Casa-Libre para iPhone y Android.',
      'Hola {{name}}, en Estados Unidos, uno de los mercados inmobiliarios más grandes del mundo, la compra de una casa empieza en el celular: mapa, fotos y contacto directo con quien publica.',
      'Casa-Libre trae esa forma de trabajar a {{country_name}}.',
      '!! {{nl_views_30d}} visitas | a publicaciones en Casa-Libre en los últimos 30 días.',
      '## Llevalo en tu bolsillo',
      'Con la app de Casa-Libre para iPhone y Android publicás desde el celular, respondés a los interesados y te avisamos cuando tu propiedad recibe visitas.',
      '[[Publicar mi propiedad]]({{publish_url}})',
      '[[Leer el newsletter completo]]({{newsletter_url}}#experiencia-estados-unidos)',
    ].join('\n\n'),
    button_label: 'Descargar la app', button_url: '{{app_url}}',
    en: {
      subject: 'How homes are sold in the US, now in {{country_name}}',
      heading: 'US experience, built for {{country_name}}',
      body: [
        'In the US, one of the largest real-estate markets in the world, buying a home starts on the phone: a map, photos and direct contact with whoever lists it. Casa-Libre brings that way of working to {{country_name}}.',
        '!! {{nl_views_30d}} views | of listings on Casa-Libre in the last 30 days.',
        '## Take it in your pocket',
        'With the Casa-Libre app for iPhone and Android you list from your phone, answer interested people and get told when your property gets views.',
      ].join('\n\n'),
    },
  },
];

export const issueKey = (slug) => `newsletter-${slug}`;

// The email_templates rows for the newsletter (key, name, subject, heading, body, button).
export const NEWSLETTER_TEMPLATES = ISSUES.map((i) => ({
  key: issueKey(i.slug), name: i.name, subject: i.subject, heading: i.heading, body: i.body,
  button_label: i.button_label, button_url: i.button_url,
}));

// ── "Personalize your profile" (automation profile_personalization), rewritten per Roland
// (meeting 2026-11-21): one or two lines, the mock listing, one button. No number: Casa-Libre's
// data does NOT (yet) show more views for sellers with a photo (5 sellers with a photo, fewer
// views than the rest, 30 days to 2026-11-22), so the email says why, not "N times more".
export const PROFILE_TEMPLATES = [
  {
    key: 'profile-personalize', name: 'Personalizá tu perfil — primer email',
    subject: '{{name}}, así se ve tu publicación con tu foto',
    heading: 'Que los compradores sepan quién sos',
    body: [
      '>> Tu foto y tu nombre en 2 minutos: así trabajan los agentes en Estados Unidos.',
      'Hola {{name}}: en Estados Unidos ningún agente publica sin su foto, porque el comprador quiere ver con quién va a hablar antes de escribir. Casa-Libre trae esa experiencia a {{country_name}}: agregá tu foto y tu nombre en 2 minutos.',
      `![Tu publicación sin foto y con tu foto](${PROFILE_MOCK_IMAGE})`,
    ].join('\n\n'),
    button_label: 'Agregar mi foto', button_url: '{{settings_url}}',
    en: {
      subject: '{{name}}, this is how your listing looks with your photo',
      heading: 'Let buyers know who you are',
      body: 'Hi {{name}}: in the US no agent lists without their photo, because buyers want to see who they will talk to before they write. Casa-Libre brings that experience to {{country_name}}: add your photo and name in 2 minutes.',
      preheader: 'Your photo and name in 2 minutes: how agents work in the US.',
    },
  },
  {
    key: 'profile-personalize-reminder', name: 'Personalizá tu perfil — recordatorio',
    subject: 'Tu perfil de Casa-Libre está al {{progress_pct}} %',
    heading: 'Un perfil con tu cara genera confianza',
    body: [
      '>> Un paso más y los compradores ven quién está detrás de tu publicación.',
      'Hola {{name}}: {{progress_line}} Con tu foto y tu nombre, tu publicación deja de ser anónima, como la de cualquier agente en Estados Unidos.',
      `![Tu publicación sin foto y con tu foto](${PROFILE_MOCK_IMAGE})`,
    ].join('\n\n'),
    button_label: 'Completar mi perfil', button_url: '{{settings_url}}',
    en: {
      subject: 'Your Casa-Libre profile is {{progress_pct}}% complete',
      heading: 'A profile with your face builds trust',
      body: 'Hi {{name}}: {{progress_line}} With your photo and name your listing stops being anonymous, like any agent’s listing in the US.',
      preheader: 'One more step and buyers see who is behind your listing.',
    },
  },
];
