// The Casa-Libre weekly newsletter: issues, success stories and the "Personalize your profile"
// emails. ONE source for the email templates (migrations/024_newsletter.sql is generated from
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

// Removed at the user's request (Nov 22): no note under the stories, on the page or in the emails.
export const ILLUSTRATIVE_NOTE = { es: '', en: '' };

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
    metric: { es: 'Vendida en 19 días', en: 'Sold in 19 days' },
    when: { es: 'después de 4 meses sin moverse', en: 'after 4 months without a buyer' },
    who: { es: 'Martín · agente independiente', en: 'Martín · independent agent' },
    title: { es: 'Cómo Martín vendió en 3 semanas una casa que llevaba 4 meses publicada', en: 'How Martín sold in 3 weeks a house that had been listed for 4 months' },
    challenge: {
      es: 'Una casa de 3 dormitorios de US$340.000 llevaba cuatro meses publicada en otros portales. Pocas consultas, y casi todas de curiosos.',
      en: 'A 3-bedroom house priced at US$340,000 had been listed on other portals for four months. Few enquiries, mostly from browsers.',
    },
    did: {
      es: 'La publicó en Casa-Libre con 18 fotos de día, el precio a la vista y su perfil completo: foto, nombre y cargo. Respondió cada WhatsApp en menos de una hora.',
      en: 'He listed it on Casa-Libre with 18 daylight photos, the price in plain sight and a complete profile: photo, name and title. He answered every WhatsApp within the hour.',
    },
    result: {
      es: '23 consultas directas a su WhatsApp, 6 visitas y una oferta aceptada el día 19.',
      en: '23 direct enquiries to his WhatsApp, 6 viewings and an accepted offer on day 19.',
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
      es: 'Su inquilino se iba a fin de mes y no quería tener el departamento vacío ni perder semanas buscando a alguien.',
      en: 'Her tenant was leaving at the end of the month and she didn’t want the apartment to sit empty or to spend weeks looking for someone.',
    },
    did: {
      es: 'Publicó el departamento desde la app con 12 fotos, el precio del alquiler y las expensas. Los interesados le escribieron directo a su WhatsApp.',
      en: 'She listed the apartment from the app with 12 photos, the monthly rent and the building fees. Interested people wrote straight to her WhatsApp.',
    },
    result: {
      es: '14 consultas en la primera semana, 4 visitas y contrato firmado el día 9.',
      en: '14 enquiries in the first week, 4 viewings and a signed lease on day 9.',
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
  {
    slug: 'carla-terreno',
    metric: { es: 'Terreno vendido en 5 semanas', en: 'Land sold in 5 weeks' },
    when: { es: 'en Luque', en: 'in Luque' },
    who: { es: 'Carla · dueña de un terreno', en: 'Carla · land owner' },
    title: { es: 'Carla vendió el terreno que heredó, desde el celular', en: 'Carla sold the plot she inherited, from her phone' },
    challenge: {
      es: 'Vivía en otra ciudad y no podía mostrar el terreno todas las semanas. Los carteles en el lugar no le traían llamadas.',
      en: 'She lived in another city and couldn’t show the plot every week. The signs on site brought no calls.',
    },
    did: {
      es: 'Lo publicó con las medidas, fotos de los cuatro lados y la ubicación exacta en el mapa. Respondía las consultas por WhatsApp a la noche.',
      en: 'She listed it with the measurements, photos of all four sides and the exact spot on the map. She answered enquiries on WhatsApp in the evenings.',
    },
    result: {
      es: '17 consultas, 3 visitas coordinadas con un familiar y la venta firmada en la quinta semana.',
      en: '17 enquiries, 3 viewings arranged with a relative and the sale signed in week five.',
    },
    quote: { es: 'Con la ubicación en el mapa, los que me escribían ya sabían dónde quedaba.', en: 'With the pin on the map, the people who wrote already knew where it was.' },
  },
  {
    slug: 'jorge-cde',
    metric: { es: '3 alquileres cerrados en un mes', en: '3 rentals closed in a month' },
    when: { es: 'en Ciudad del Este', en: 'in Ciudad del Este' },
    who: { es: 'Jorge · inmobiliaria familiar', en: 'Jorge · family agency' },
    title: { es: 'Jorge llenó tres departamentos vacíos en Ciudad del Este', en: 'Jorge filled three empty apartments in Ciudad del Este' },
    challenge: {
      es: 'Tres departamentos amoblados llevaban dos meses vacíos y las consultas llegaban por teléfono a cualquier hora.',
      en: 'Three furnished apartments had been empty for two months and calls came in at all hours.',
    },
    did: {
      es: 'Los publicó con el precio mensual a la vista, qué incluye y fotos de cada ambiente, y respondió todo por WhatsApp.',
      en: 'He listed them with the monthly price in plain sight, what’s included and photos of every room, and answered everything on WhatsApp.',
    },
    result: {
      es: '31 consultas en cuatro semanas y los tres departamentos alquilados antes de fin de mes.',
      en: '31 enquiries in four weeks and all three apartments rented before the end of the month.',
    },
    quote: { es: 'Con el precio publicado, solo me escribía la gente que de verdad podía alquilar.', en: 'With the price published, only people who could really rent wrote to me.' },
  },
  {
    slug: 'ana-primera-venta',
    metric: { es: 'Primera venta en 24 días', en: 'First sale in 24 days' },
    when: { es: 'sin experiencia previa', en: 'with no experience' },
    who: { es: 'Ana · vendía su primera casa', en: 'Ana · selling her first house' },
    title: { es: 'Ana nunca había vendido una casa. Lo hizo en 24 días', en: 'Ana had never sold a house. She did it in 24 days' },
    challenge: {
      es: 'No sabía qué precio poner ni qué fotos sacar, y le daba miedo recibir llamadas de desconocidos.',
      en: 'She didn’t know what price to set or which photos to take, and she was wary of calls from strangers.',
    },
    did: {
      es: 'Miró los precios de casas parecidas en su barrio en Casa-Libre, publicó con 15 fotos de día y eligió recibir solo mensajes de WhatsApp.',
      en: 'She checked the prices of similar houses in her area on Casa-Libre, listed with 15 daylight photos and chose to get WhatsApp messages only.',
    },
    result: {
      es: '19 consultas, 5 visitas y una oferta aceptada el día 24.',
      en: '19 enquiries, 5 viewings and an accepted offer on day 24.',
    },
    quote: { es: 'Ver los precios de la zona me dio la seguridad para poner el mío.', en: 'Seeing the prices in the area gave me the confidence to set mine.' },
  },
  {
    slug: 'valeria-equipo',
    metric: { es: '+140 % de consultas', en: '+140% enquiries' },
    when: { es: 'en 6 semanas', en: 'in 6 weeks' },
    who: { es: 'Valeria · dirige un equipo de 5 agentes', en: 'Valeria · leads a team of 5 agents' },
    title: { es: 'El equipo de Valeria completó sus perfiles y las consultas se duplicaron', en: 'Valeria’s team completed their profiles and enquiries more than doubled' },
    challenge: {
      es: 'Cinco agentes, 70 propiedades publicadas y perfiles sin foto: los compradores no sabían con quién iban a hablar.',
      en: 'Five agents, 70 listings and profiles with no photo: buyers didn’t know who they would be talking to.',
    },
    did: {
      es: 'Cada agente subió su foto, su cargo y el nombre de la inmobiliaria, y repartieron las propiedades por zona.',
      en: 'Each agent added a photo, their title and the agency name, and they split the listings by area.',
    },
    result: {
      es: 'De 25 a 60 consultas por semana en seis semanas, con las mismas propiedades.',
      en: 'From 25 to 60 enquiries a week within six weeks, with the same listings.',
    },
    quote: { es: 'Ahora el comprador ya sabe qué agente le va a responder.', en: 'Now the buyer already knows which agent will answer.' },
  },
  {
    slug: 'pablo-encarnacion',
    metric: { es: 'Alquilado en 6 días', en: 'Rented in 6 days' },
    when: { es: 'en Encarnación', en: 'in Encarnación' },
    who: { es: 'Pablo · dueño de un monoambiente', en: 'Pablo · studio owner' },
    title: { es: 'Pablo alquiló su monoambiente cerca de la costanera en 6 días', en: 'Pablo rented out his studio near the waterfront in 6 days' },
    challenge: {
      es: 'Su monoambiente estaba vacío justo antes de la temporada de verano.',
      en: 'His studio was empty right before the summer season.',
    },
    did: {
      es: 'Lo publicó desde la app con fotos de la vista, el precio mensual y la distancia a la costanera.',
      en: 'He listed it from the app with photos of the view, the monthly rent and the distance to the waterfront.',
    },
    result: {
      es: '11 consultas en tres días y contrato firmado el día 6.',
      en: '11 enquiries in three days and a lease signed on day 6.',
    },
    quote: { es: 'Lo publiqué en diez minutos desde el celular.', en: 'I listed it in ten minutes from my phone.' },
  },
  {
    slug: 'rodrigo-local',
    metric: { es: 'Local alquilado en 3 semanas', en: 'Shop rented in 3 weeks' },
    when: { es: 'en San Lorenzo', en: 'in San Lorenzo' },
    who: { es: 'Rodrigo · dueño de un local comercial', en: 'Rodrigo · owner of a shop' },
    title: { es: 'Rodrigo encontró inquilino para su local sobre la avenida', en: 'Rodrigo found a tenant for his shop on the main avenue' },
    challenge: {
      es: 'Un local de 80 m² sobre una avenida con mucho tránsito, vacío desde hacía tres meses.',
      en: 'An 80 m² shop on a busy avenue, empty for three months.',
    },
    did: {
      es: 'Lo publicó con los metros, el frente, fotos de la vereda y el precio, y lo marcó en el mapa.',
      en: 'He listed it with the size, the frontage, photos of the sidewalk and the price, and pinned it on the map.',
    },
    result: {
      es: '9 consultas de comercios de la zona y el contrato firmado a las tres semanas.',
      en: '9 enquiries from local businesses and the lease signed after three weeks.',
    },
    quote: { es: 'Me escribieron comerciantes que ya conocían la avenida.', en: 'The people who wrote were shop owners who already knew the avenue.' },
  },
  {
    slug: 'marta-duplex',
    metric: { es: 'Vendido en 4 semanas', en: 'Sold in 4 weeks' },
    when: { es: 'en Lambaré', en: 'in Lambaré' },
    who: { es: 'Marta · dueña de un dúplex', en: 'Marta · duplex owner' },
    title: { es: 'Marta vendió su dúplex sin cartel en la puerta', en: 'Marta sold her duplex without a sign on the door' },
    challenge: {
      es: 'No quería un cartel en la casa ni visitas sin aviso mientras seguía viviendo ahí.',
      en: 'She didn’t want a sign on the house or unannounced visits while she still lived there.',
    },
    did: {
      es: 'Lo publicó con fotos de cada ambiente y el precio, y coordinó todas las visitas por WhatsApp en horarios que le quedaban bien.',
      en: 'She listed it with photos of every room and the price, and set every viewing on WhatsApp at times that suited her.',
    },
    result: {
      es: '21 consultas, 4 visitas coordinadas y la venta cerrada en la cuarta semana.',
      en: '21 enquiries, 4 arranged viewings and the sale closed in week four.',
    },
    quote: { es: 'Yo decidía quién venía y cuándo. Eso me dio tranquilidad.', en: 'I decided who came and when. That gave me peace of mind.' },
  },
  {
    slug: 'luis-quinta',
    metric: { es: 'Quinta vendida en 7 semanas', en: 'Country house sold in 7 weeks' },
    when: { es: 'en San Bernardino', en: 'in San Bernardino' },
    who: { es: 'Luis · dueño de una quinta', en: 'Luis · country-house owner' },
    title: { es: 'Luis vendió la quinta de la familia a un comprador de Asunción', en: 'Luis sold the family country house to a buyer from Asunción' },
    challenge: {
      es: 'La quinta estaba a una hora de la ciudad y los interesados de la zona eran pocos.',
      en: 'The house was an hour from the city and there were few local buyers.',
    },
    did: {
      es: 'Publicó fotos de la pileta, el jardín y el lago cerca, con la ubicación en el mapa para que se vea la distancia real.',
      en: 'He posted photos of the pool, the garden and the nearby lake, with the pin on the map so the real distance was clear.',
    },
    result: {
      es: '15 consultas, casi todas desde Asunción, y la venta firmada en la séptima semana.',
      en: '15 enquiries, almost all from Asunción, and the sale signed in week seven.',
    },
    quote: { es: 'Los compradores de la ciudad la encontraron buscando en el mapa.', en: 'City buyers found it by browsing the map.' },
  },
  {
    slug: 'camila-estudiantes',
    metric: { es: '4 habitaciones alquiladas en 10 días', en: '4 rooms rented in 10 days' },
    when: { es: 'cerca de la universidad', en: 'near the university' },
    who: { es: 'Camila · alquila habitaciones', en: 'Camila · rents out rooms' },
    title: { es: 'Camila alquiló cuatro habitaciones para estudiantes antes del semestre', en: 'Camila rented four rooms to students before the semester' },
    challenge: {
      es: 'Faltaban dos semanas para el inicio de clases y tenía cuatro habitaciones libres.',
      en: 'Classes started in two weeks and she had four empty rooms.',
    },
    did: {
      es: 'Publicó cada habitación con su precio, qué incluye y la distancia a la universidad, desde la app.',
      en: 'She listed each room with its price, what’s included and the distance to the university, from the app.',
    },
    result: {
      es: '26 consultas de estudiantes y padres, y las cuatro habitaciones alquiladas en 10 días.',
      en: '26 enquiries from students and parents, and all four rooms rented in 10 days.',
    },
    quote: { es: 'Los padres preguntaban directo por WhatsApp y cerrábamos rápido.', en: 'Parents asked directly on WhatsApp and we closed fast.' },
  },
  {
    slug: 'ricardo-agente-nuevo',
    metric: { es: '12 consultas en su primer mes', en: '12 enquiries in his first month' },
    when: { es: 'como agente nuevo', en: 'as a new agent' },
    who: { es: 'Ricardo · agente desde hace 3 meses', en: 'Ricardo · agent for 3 months' },
    title: { es: 'Ricardo empezó como agente y consiguió sus primeros clientes', en: 'Ricardo started as an agent and found his first clients' },
    challenge: {
      es: 'No tenía cartera ni contactos: sus primeras tres propiedades eran de conocidos.',
      en: 'He had no portfolio or contacts: his first three properties belonged to friends.',
    },
    did: {
      es: 'Completó su perfil con foto y cargo, publicó las tres propiedades con buenas fotos y respondió cada consulta en el día.',
      en: 'He completed his profile with photo and title, listed the three properties with good photos and answered every enquiry the same day.',
    },
    result: {
      es: '12 consultas el primer mes, una venta y dos dueños nuevos que le dieron sus propiedades.',
      en: '12 enquiries in the first month, one sale and two new owners who gave him their properties.',
    },
    quote: { es: 'Con el perfil completo, la gente me tomaba en serio desde el primer mensaje.', en: 'With a complete profile, people took me seriously from the first message.' },
  },
  {
    slug: 'elena-departamento',
    metric: { es: 'Departamento vendido en 16 días', en: 'Apartment sold in 16 days' },
    when: { es: 'en Villa Morra', en: 'in Villa Morra' },
    who: { es: 'Elena · dueña de un departamento', en: 'Elena · apartment owner' },
    title: { es: 'Elena vendió su departamento en Villa Morra en 16 días', en: 'Elena sold her Villa Morra apartment in 16 days' },
    challenge: {
      es: 'Se mudaba al exterior y necesitaba vender antes de fin de mes.',
      en: 'She was moving abroad and needed to sell before the end of the month.',
    },
    did: {
      es: 'Publicó con el precio a la vista, las expensas y un video corto del departamento.',
      en: 'She listed it with the price in plain sight, the building fees and a short video of the apartment.',
    },
    result: {
      es: '18 consultas, 5 visitas y la reserva firmada el día 16.',
      en: '18 enquiries, 5 viewings and the reservation signed on day 16.',
    },
    quote: { es: 'Poner el precio desde el principio me ahorró muchas conversaciones.', en: 'Showing the price from the start saved me a lot of conversations.' },
  },
  {
    slug: 'martin-galpon',
    metric: { es: 'Depósito alquilado en 3 semanas', en: 'Warehouse rented in 3 weeks' },
    when: { es: 'en Mariano Roque Alonso', en: 'in Mariano Roque Alonso' },
    who: { es: 'Martín R. · dueño de un depósito', en: 'Martín R. · warehouse owner' },
    title: { es: 'Un depósito vacío encontró inquilino en 3 semanas', en: 'An empty warehouse found a tenant in 3 weeks' },
    challenge: {
      es: 'Un depósito de 600 m² sobre ruta, vacío desde hacía medio año.',
      en: 'A 600 m² warehouse on the highway, empty for half a year.',
    },
    did: {
      es: 'Lo publicó con los metros, la altura, el acceso para camiones y fotos del portón.',
      en: 'He listed it with the size, the ceiling height, truck access and photos of the gate.',
    },
    result: {
      es: '8 consultas de empresas de logística y el contrato firmado a las tres semanas.',
      en: '8 enquiries from logistics companies and the lease signed after three weeks.',
    },
    quote: { es: 'Los datos técnicos en la publicación filtraron a los que no les servía.', en: 'The technical details in the listing filtered out those it didn’t suit.' },
  },
  {
    slug: 'gabriela-inmobiliaria-enc',
    metric: { es: '+35 propiedades publicadas en una semana', en: '35+ listings in one week' },
    when: { es: 'en Encarnación', en: 'in Encarnación' },
    who: { es: 'Gabriela · inmobiliaria en Encarnación', en: 'Gabriela · agency in Encarnación' },
    title: { es: 'La inmobiliaria de Gabriela pasó toda su cartera a Casa-Libre en una semana', en: 'Gabriela’s agency moved its whole portfolio to Casa-Libre in a week' },
    challenge: {
      es: 'Tenía 35 propiedades en planillas y fotos sueltas en el celular.',
      en: 'She had 35 properties in spreadsheets and loose photos on her phone.',
    },
    did: {
      es: 'Escribió CARTERA por WhatsApp y el equipo de Casa-Libre la ayudó a subir todo, sin exclusividad.',
      en: 'She sent CARTERA on WhatsApp and the Casa-Libre team helped her upload everything, with no exclusivity.',
    },
    result: {
      es: '44 consultas en el primer mes y 3 operaciones cerradas en dos meses.',
      en: '44 enquiries in the first month and 3 deals closed within two months.',
    },
    quote: { es: 'No tuve que cargar nada a mano y empecé a recibir consultas esa misma semana.', en: 'I didn’t have to upload anything by hand and enquiries started that same week.' },
  },
  {
    slug: 'oscar-terreno-cde',
    metric: { es: 'Lote vendido en 6 semanas', en: 'Lot sold in 6 weeks' },
    when: { es: 'en Ciudad del Este', en: 'in Ciudad del Este' },
    who: { es: 'Óscar · dueño de un lote', en: 'Óscar · lot owner' },
    title: { es: 'Óscar vendió un lote que nadie encontraba', en: 'Óscar sold a lot nobody could find' },
    challenge: {
      es: 'El lote estaba en una calle sin nombre y los interesados se perdían para llegar.',
      en: 'The lot was on an unnamed street and interested buyers got lost getting there.',
    },
    did: {
      es: 'Lo marcó con precisión en el mapa, subió fotos del acceso y mandaba la ubicación por WhatsApp.',
      en: 'He pinned it exactly on the map, posted photos of the access and sent the location on WhatsApp.',
    },
    result: {
      es: '13 consultas, 4 visitas y la venta firmada en la sexta semana.',
      en: '13 enquiries, 4 viewings and the sale signed in week six.',
    },
    quote: { es: 'Con el punto en el mapa, todos llegaban sin perderse.', en: 'With the pin on the map, everyone found it without getting lost.' },
  },
  {
    slug: 'julia-casa-familia',
    metric: { es: 'Casa alquilada en 8 días', en: 'House rented in 8 days' },
    when: { es: 'en Fernando de la Mora', en: 'in Fernando de la Mora' },
    who: { es: 'Julia · dueña de una casa', en: 'Julia · house owner' },
    title: { es: 'Julia encontró una familia para su casa en 8 días', en: 'Julia found a family for her house in 8 days' },
    challenge: {
      es: 'Quería alquilar a una familia y no a cualquiera, sin pasar semanas de llamadas.',
      en: 'She wanted to rent to a family, not to just anyone, without weeks of calls.',
    },
    did: {
      es: 'Describió el barrio, las escuelas cercanas y el patio, y respondía las consultas eligiendo con calma.',
      en: 'She described the neighbourhood, nearby schools and the yard, and answered enquiries choosing calmly.',
    },
    result: {
      es: '16 consultas, 3 visitas y una familia mudándose el día 8.',
      en: '16 enquiries, 3 viewings and a family moving in on day 8.',
    },
    quote: { es: 'Contar cómo es el barrio atrajo justo al tipo de inquilino que buscaba.', en: 'Describing the neighbourhood attracted exactly the kind of tenant I wanted.' },
  },
  {
    slug: 'federico-inversor',
    metric: { es: '2 departamentos comprados', en: '2 apartments bought' },
    when: { es: 'como inversión', en: 'as an investment' },
    who: { es: 'Federico · inversor', en: 'Federico · investor' },
    title: { es: 'Federico compró dos departamentos para alquilar, comparando en el mapa', en: 'Federico bought two apartments to rent out, comparing on the map' },
    challenge: {
      es: 'Buscaba departamentos para alquilar cerca de oficinas y no tenía tiempo de recorrer inmobiliarias.',
      en: 'He wanted rental apartments near offices and had no time to visit agencies.',
    },
    did: {
      es: 'Usó el mapa para comparar precios por zona y escribió directo por WhatsApp a los dueños.',
      en: 'He used the map to compare prices by area and wrote straight to the owners on WhatsApp.',
    },
    result: {
      es: 'En un mes visitó 9 departamentos y compró 2.',
      en: 'In a month he viewed 9 apartments and bought 2.',
    },
    quote: { es: 'Hablar directo con el dueño hizo todo más rápido.', en: 'Talking directly to the owner made everything faster.' },
  },
  // more stories (Nov 22): generated from a short brief each — same shape as above
  {"slug": "beatriz-casa-luque", "metric": {"es": "Vendida en 21 días", "en": "Sold in 21 days"}, "when": {"es": "en Luque", "en": "in Luque"}, "who": {"es": "Beatriz · dueña de una casa", "en": "Beatriz · house owner"}, "title": {"es": "Beatriz vendió su casa de 3 dormitorios en Luque", "en": "Beatriz sold their 3-bedroom house in Luque"}, "challenge": {"es": "Su casa de 3 dormitorios llevaba meses sin compradores serios.", "en": "Their 3-bedroom house had gone months without serious buyers."}, "did": {"es": "Publicó con fotos de día y el precio a la vista.", "en": "They listed with daylight photos and the price in plain sight."}, "result": {"es": "17 consultas, 5 visitas y una oferta aceptada el día 21.", "en": "17 enquiries, 5 viewings and an accepted offer on day 21."}, "quote": {"es": "Me escribía gente que ya sabía el precio. Ahorré mucho tiempo.", "en": "People who wrote already knew the price. I saved a lot of time."}},
  {"slug": "hugo-depto-recoleta", "metric": {"es": "Vendida en 18 días", "en": "Sold in 18 days"}, "when": {"es": "en Recoleta", "en": "in Recoleta"}, "who": {"es": "Hugo · dueño de un departamento", "en": "Hugo · apartment owner"}, "title": {"es": "Hugo vendió su departamento de 2 dormitorios en Recoleta", "en": "Hugo sold their 2-bedroom apartment in Recoleta"}, "challenge": {"es": "Su departamento de 2 dormitorios llevaba meses sin compradores serios.", "en": "Their 2-bedroom apartment had gone months without serious buyers."}, "did": {"es": "Publicó con un video corto y las expensas.", "en": "They listed with a short video and the building fees."}, "result": {"es": "22 consultas, 6 visitas y una oferta aceptada el día 18.", "en": "22 enquiries, 6 viewings and an accepted offer on day 18."}, "quote": {"es": "El video hizo que solo vinieran a ver los que de verdad estaban interesados.", "en": "The video meant only genuinely interested people came to view."}},
  {"slug": "silvia-alquiler-sanlorenzo", "metric": {"es": "Alquilado en 7 días", "en": "Rented in 7 days"}, "when": {"es": "en San Lorenzo", "en": "in San Lorenzo"}, "who": {"es": "Silvia · dueña de un departamento", "en": "Silvia · apartment owner"}, "title": {"es": "Silvia alquiló su departamento de 1 dormitorio en San Lorenzo", "en": "Silvia rented out their 1-bedroom apartment in San Lorenzo"}, "challenge": {"es": "El departamento de 1 dormitorio iba a quedar vacío y no quería perder meses buscando inquilino.", "en": "The 1-bedroom apartment was about to sit empty and they didn’t want to lose months finding a tenant."}, "did": {"es": "Publicó desde la app, con el precio mensual y qué incluye.", "en": "They listed from the app, with the monthly rent and what’s included."}, "result": {"es": "12 consultas, 3 visitas y contrato firmado el día 7.", "en": "12 enquiries, 3 viewings and a lease signed on day 7."}, "quote": {"es": "Lo alquilé en una semana sin moverme de casa.", "en": "I rented it in a week without leaving home."}},
  {"slug": "andres-agente-asuncion", "metric": {"es": "27 consultas en un mes", "en": "27 enquiries in a month"}, "when": {"es": "en Asunción", "en": "in Asunción"}, "who": {"es": "Andrés · agente independiente", "en": "Andrés · independent agent"}, "title": {"es": "Andrés llenó su agenda en Asunción", "en": "Andrés filled their calendar in Asunción"}, "challenge": {"es": "Tenía 8 propiedades publicadas y casi no recibía consultas.", "en": "They had 8 properties listed and hardly any enquiries."}, "did": {"es": "Empezó completando su perfil con foto, cargo y WhatsApp confirmado.", "en": "They started by completing his profile with photo, title and a confirmed WhatsApp."}, "result": {"es": "27 consultas en el mes siguiente, con las mismas propiedades.", "en": "27 enquiries the following month, with the same listings."}, "quote": {"es": "Los clientes llegaban sabiendo quién era yo.", "en": "Clients arrived already knowing who I was."}},
  {"slug": "rosa-terreno-capiata", "metric": {"es": "Terreno vendido en 5 semanas", "en": "Land sold in 5 weeks"}, "when": {"es": "en Capiatá", "en": "in Capiatá"}, "who": {"es": "Rosa · dueña de un terreno", "en": "Rosa · land owner"}, "title": {"es": "Rosa vendió su terreno de 12 x 30 en Capiatá", "en": "Rosa sold their 12 x 30 plot in Capiatá"}, "challenge": {"es": "Vivía lejos y no podía mostrar el terreno de 12 x 30 todas las semanas.", "en": "They lived far away and couldn’t show the 12 x 30 plot every week."}, "did": {"es": "Publicó con las medidas exactas y el punto en el mapa.", "en": "They listed with the exact measurements and the pin on the map."}, "result": {"es": "14 consultas, 4 visitas y la venta firmada en la semana 5.", "en": "14 enquiries, 4 viewings and the sale signed in week 5."}, "quote": {"es": "Con la ubicación en el mapa nadie se perdía para llegar.", "en": "With the pin on the map nobody got lost on the way."}},
  {"slug": "ernesto-local-asuncion", "metric": {"es": "Alquilado en 3 semanas", "en": "Rented in 3 weeks"}, "when": {"es": "en el centro de Asunción", "en": "in el centro de Asunción"}, "who": {"es": "Ernesto · dueño de un local", "en": "Ernesto · shop owner"}, "title": {"es": "Ernesto encontró inquilino para su local de 60 m² en el centro de Asunción", "en": "Ernesto found a tenant for their 60 m² shop in el centro de Asunción"}, "challenge": {"es": "Su local de 60 m² estaba vacío desde hacía meses.", "en": "Their 60 m² shop had been empty for months."}, "did": {"es": "Publicó con los metros, el frente y fotos de la vereda.", "en": "They listed with the size, the frontage and photos of the sidewalk."}, "result": {"es": "10 consultas de empresas de la zona y el contrato firmado en la semana 3.", "en": "10 enquiries from local businesses and the lease signed in week 3."}, "quote": {"es": "Me escribieron comercios que ya conocían la cuadra.", "en": "Businesses that already knew the block wrote to me."}},
  {"slug": "natalia-inmobiliaria-luque", "metric": {"es": "39 consultas el primer mes", "en": "39 enquiries in month one"}, "when": {"es": "en Luque", "en": "in Luque"}, "who": {"es": "Natalia · inmobiliaria de 4 personas", "en": "Natalia · 4-person agency"}, "title": {"es": "La inmobiliaria de Natalia sumó consultas en Luque", "en": "Natalia’s agency gained enquiries in Luque"}, "challenge": {"es": "Tenían 28 propiedades y ningún tiempo para cargarlas una por una.", "en": "They had 28 properties and no time to upload them one by one."}, "did": {"es": "Empezó subiendo toda su cartera con ayuda del equipo de Casa-Libre.", "en": "They started by uploading her whole portfolio with the Casa-Libre team’s help."}, "result": {"es": "39 consultas en el primer mes y operaciones cerradas en semanas.", "en": "39 enquiries in the first month and deals closed within weeks."}, "quote": {"es": "En una semana teníamos todo publicado y las consultas empezaron a llegar.", "en": "In a week everything was online and the enquiries started coming in."}},
  {"slug": "tomas-duplex-fdm", "metric": {"es": "Vendida en 26 días", "en": "Sold in 26 days"}, "when": {"es": "en Fernando de la Mora", "en": "in Fernando de la Mora"}, "who": {"es": "Tomás · dueño de un dúplex", "en": "Tomás · duplex owner"}, "title": {"es": "Tomás vendió su dúplex de 3 dormitorios en Fernando de la Mora", "en": "Tomás sold their 3-bedroom duplex in Fernando de la Mora"}, "challenge": {"es": "Su dúplex de 3 dormitorios llevaba meses sin compradores serios.", "en": "Their 3-bedroom duplex had gone months without serious buyers."}, "did": {"es": "Publicó con 20 fotos y un plano simple.", "en": "They listed with 20 photos and a simple floor plan."}, "result": {"es": "19 consultas, 5 visitas y una oferta aceptada el día 26.", "en": "19 enquiries, 5 viewings and an accepted offer on day 26."}, "quote": {"es": "El plano respondió la mitad de las preguntas antes de que me escribieran.", "en": "The floor plan answered half the questions before anyone wrote."}},
  {"slug": "veronica-monoambiente", "metric": {"es": "Alquilado en 5 días", "en": "Rented in 5 days"}, "when": {"es": "en Villa Morra", "en": "in Villa Morra"}, "who": {"es": "Verónica · dueña de un monoambiente", "en": "Verónica · studio owner"}, "title": {"es": "Verónica alquiló su monoambiente amoblado en Villa Morra", "en": "Verónica rented out their furnished studio in Villa Morra"}, "challenge": {"es": "El monoambiente amoblado iba a quedar vacío y no quería perder meses buscando inquilino.", "en": "The furnished studio was about to sit empty and they didn’t want to lose months finding a tenant."}, "did": {"es": "Publicó con fotos de los muebles y el precio con expensas incluidas.", "en": "They listed with photos of the furniture and the rent including fees."}, "result": {"es": "15 consultas, 4 visitas y contrato firmado el día 5.", "en": "15 enquiries, 4 viewings and a lease signed on day 5."}, "quote": {"es": "Con todo claro en la publicación, el primero que vino se quedó.", "en": "With everything clear in the listing, the first person who came took it."}},
  {"slug": "gustavo-agente-cde", "metric": {"es": "31 consultas en un mes", "en": "31 enquiries in a month"}, "when": {"es": "en Ciudad del Este", "en": "in Ciudad del Este"}, "who": {"es": "Gustavo · agente", "en": "Gustavo · agent"}, "title": {"es": "Gustavo llenó su agenda en Ciudad del Este", "en": "Gustavo filled their calendar in Ciudad del Este"}, "challenge": {"es": "Tenía 12 propiedades publicadas y casi no recibía consultas.", "en": "They had 12 properties listed and hardly any enquiries."}, "did": {"es": "Empezó respondiendo cada WhatsApp en menos de una hora.", "en": "They started by answering every WhatsApp within the hour."}, "result": {"es": "31 consultas en el mes siguiente, con las mismas propiedades.", "en": "31 enquiries the following month, with the same listings."}, "quote": {"es": "Responder rápido cambió todo: los compradores no se iban a otro lado.", "en": "Answering fast changed everything: buyers didn’t go elsewhere."}},
  {"slug": "lidia-quinta-areguá", "metric": {"es": "Vendida en 45 días", "en": "Sold in 45 days"}, "when": {"es": "en Areguá", "en": "in Areguá"}, "who": {"es": "Lidia · dueña de una quinta", "en": "Lidia · country-house owner"}, "title": {"es": "Lidia vendió su quinta con pileta en Areguá", "en": "Lidia sold their country house with a pool in Areguá"}, "challenge": {"es": "Su quinta con pileta llevaba meses sin compradores serios.", "en": "Their country house with a pool had gone months without serious buyers."}, "did": {"es": "Publicó con fotos del jardín y la pileta en un día de sol.", "en": "They listed with photos of the garden and the pool on a sunny day."}, "result": {"es": "13 consultas, 4 visitas y una oferta aceptada el día 45.", "en": "13 enquiries, 4 viewings and an accepted offer on day 45."}, "quote": {"es": "Las fotos en un día lindo hicieron toda la diferencia.", "en": "Photos on a nice day made all the difference."}},
  {"slug": "mateo-casa-alquiler-luque", "metric": {"es": "Alquilado en 9 días", "en": "Rented in 9 days"}, "when": {"es": "en Luque", "en": "in Luque"}, "who": {"es": "Mateo · dueño de una casa", "en": "Mateo · house owner"}, "title": {"es": "Mateo alquiló su casa de 2 dormitorios con patio en Luque", "en": "Mateo rented out their 2-bedroom house with a yard in Luque"}, "challenge": {"es": "El casa de 2 dormitorios con patio iba a quedar vacío y no quería perder meses buscando inquilino.", "en": "The 2-bedroom house with a yard was about to sit empty and they didn’t want to lose months finding a tenant."}, "did": {"es": "Publicó contando el barrio y las escuelas cercanas.", "en": "They listed describing the neighbourhood and nearby schools."}, "result": {"es": "18 consultas, 4 visitas y contrato firmado el día 9.", "en": "18 enquiries, 4 viewings and a lease signed on day 9."}, "quote": {"es": "Llegaron familias que buscaban justo eso.", "en": "Families looking for exactly that came."}},
  {"slug": "patricia-terreno-encarnacion", "metric": {"es": "Terreno vendido en 4 semanas", "en": "Land sold in 4 weeks"}, "when": {"es": "en Encarnación", "en": "in Encarnación"}, "who": {"es": "Patricia · dueña de un lote", "en": "Patricia · lot owner"}, "title": {"es": "Patricia vendió su lote cerca de la costanera en Encarnación", "en": "Patricia sold their lot near the waterfront in Encarnación"}, "challenge": {"es": "Vivía lejos y no podía mostrar el lote cerca de la costanera todas las semanas.", "en": "They lived far away and couldn’t show the lot near the waterfront every week."}, "did": {"es": "Publicó con fotos del acceso y la distancia a la costanera.", "en": "They listed with photos of the access and the distance to the waterfront."}, "result": {"es": "16 consultas, 5 visitas y la venta firmada en la semana 4.", "en": "16 enquiries, 5 viewings and the sale signed in week 4."}, "quote": {"es": "Los compradores sabían exactamente dónde estaba antes de llamar.", "en": "Buyers knew exactly where it was before calling."}},
  {"slug": "sergio-oficina", "metric": {"es": "Alquilado en 3 semanas", "en": "Rented in 3 weeks"}, "when": {"es": "en Asunción", "en": "in Asunción"}, "who": {"es": "Sergio · dueño de una oficina", "en": "Sergio · office owner"}, "title": {"es": "Sergio encontró inquilino para su oficina de 45 m² en Asunción", "en": "Sergio found a tenant for their 45 m² office in Asunción"}, "challenge": {"es": "Su oficina de 45 m² estaba vacío desde hacía meses.", "en": "Their 45 m² office had been empty for months."}, "did": {"es": "Publicó con fotos de la vista y los servicios del edificio.", "en": "They listed with photos of the view and the building’s amenities."}, "result": {"es": "9 consultas de empresas de la zona y el contrato firmado en la semana 3.", "en": "9 enquiries from local businesses and the lease signed in week 3."}, "quote": {"es": "Los datos del edificio filtraron a los que no les servía.", "en": "The building details filtered out those it didn’t suit."}},
  {"slug": "claudia-equipo-asuncion", "metric": {"es": "58 consultas el primer mes", "en": "58 enquiries in month one"}, "when": {"es": "en Asunción", "en": "in Asunción"}, "who": {"es": "Claudia · dirige un equipo de 3 agentes", "en": "Claudia · leads a team of 3 agents"}, "title": {"es": "La inmobiliaria de Claudia sumó consultas en Asunción", "en": "Claudia’s agency gained enquiries in Asunción"}, "challenge": {"es": "Tenían 45 propiedades y ningún tiempo para cargarlas una por una.", "en": "They had 45 properties and no time to upload them one by one."}, "did": {"es": "Empezó con perfiles completos y las propiedades repartidas por zona.", "en": "They started with complete profiles and listings split by area."}, "result": {"es": "58 consultas en el primer mes y operaciones cerradas en semanas.", "en": "58 enquiries in the first month and deals closed within weeks."}, "quote": {"es": "Ahora cada comprador habla con el agente de su zona.", "en": "Now every buyer talks to the agent for their area."}},
  {"slug": "raul-casa-mra", "metric": {"es": "Vendida en 33 días", "en": "Sold in 33 days"}, "when": {"es": "en Mariano Roque Alonso", "en": "in Mariano Roque Alonso"}, "who": {"es": "Raúl · dueño de una casa", "en": "Raúl · house owner"}, "title": {"es": "Raúl vendió su casa en esquina en Mariano Roque Alonso", "en": "Raúl sold their corner house in Mariano Roque Alonso"}, "challenge": {"es": "Su casa en esquina llevaba meses sin compradores serios.", "en": "Their corner house had gone months without serious buyers."}, "did": {"es": "Publicó con el precio a la vista y respondiendo solo por WhatsApp.", "en": "They listed with the price in plain sight and answering only on WhatsApp."}, "result": {"es": "15 consultas, 4 visitas y una oferta aceptada el día 33.", "en": "15 enquiries, 4 viewings and an accepted offer on day 33."}, "quote": {"es": "Por WhatsApp elegía con calma a quién mostrarle la casa.", "en": "On WhatsApp I calmly chose who to show the house to."}},
  {"slug": "susana-depto-alquiler-cde", "metric": {"es": "Alquilado en 11 días", "en": "Rented in 11 days"}, "when": {"es": "en Ciudad del Este", "en": "in Ciudad del Este"}, "who": {"es": "Susana · dueña de un departamento", "en": "Susana · apartment owner"}, "title": {"es": "Susana alquiló su departamento de 2 dormitorios en Ciudad del Este", "en": "Susana rented out their 2-bedroom apartment in Ciudad del Este"}, "challenge": {"es": "El departamento de 2 dormitorios iba a quedar vacío y no quería perder meses buscando inquilino.", "en": "The 2-bedroom apartment was about to sit empty and they didn’t want to lose months finding a tenant."}, "did": {"es": "Publicó con fotos de cada ambiente y la cochera.", "en": "They listed with photos of every room and the garage."}, "result": {"es": "20 consultas, 5 visitas y contrato firmado el día 11.", "en": "20 enquiries, 5 viewings and a lease signed on day 11."}, "quote": {"es": "Publicar con todo claro me ahorró visitas que no servían.", "en": "Listing everything clearly saved me pointless viewings."}},
  {"slug": "franco-agente-encarnacion", "metric": {"es": "19 consultas en un mes", "en": "19 enquiries in a month"}, "when": {"es": "en Encarnación", "en": "in Encarnación"}, "who": {"es": "Franco · agente", "en": "Franco · agent"}, "title": {"es": "Franco llenó su agenda en Encarnación", "en": "Franco filled their calendar in Encarnación"}, "challenge": {"es": "Tenía 6 propiedades publicadas y casi no recibía consultas.", "en": "They had 6 properties listed and hardly any enquiries."}, "did": {"es": "Empezó agregando su foto y su nombre a todas sus publicaciones.", "en": "They started by adding his photo and name to all his listings."}, "result": {"es": "19 consultas en el mes siguiente, con las mismas propiedades.", "en": "19 enquiries the following month, with the same listings."}, "quote": {"es": "Dar la cara fue lo que más me ayudó.", "en": "Showing my face is what helped most."}},
  {"slug": "miriam-terreno-luque", "metric": {"es": "Terreno vendido en 4 semanas", "en": "Land sold in 4 weeks"}, "when": {"es": "en Luque", "en": "in Luque"}, "who": {"es": "Miriam · dueña de un terreno", "en": "Miriam · land owner"}, "title": {"es": "Miriam vendió su terreno de 450 m² en Luque", "en": "Miriam sold their 450 m² plot in Luque"}, "challenge": {"es": "Vivía lejos y no podía mostrar el terreno de 450 m² todas las semanas.", "en": "They lived far away and couldn’t show the 450 m² plot every week."}, "did": {"es": "Publicó con fotos de los cuatro lados y el punto exacto en el mapa.", "en": "They listed with photos of all four sides and the exact pin on the map."}, "result": {"es": "12 consultas, 3 visitas y la venta firmada en la semana 4.", "en": "12 enquiries, 3 viewings and the sale signed in week 4."}, "quote": {"es": "Vendí sin tener que ir cada semana a mostrarlo.", "en": "I sold without having to go show it every week."}},
  {"slug": "alberto-salon", "metric": {"es": "Alquilado en 4 semanas", "en": "Rented in 4 weeks"}, "when": {"es": "en Lambaré", "en": "in Lambaré"}, "who": {"es": "Alberto · dueño de un salón comercial", "en": "Alberto · owner of a commercial hall"}, "title": {"es": "Alberto encontró inquilino para su salón de 120 m² en Lambaré", "en": "Alberto found a tenant for their 120 m² hall in Lambaré"}, "challenge": {"es": "Su salón de 120 m² estaba vacío desde hacía meses.", "en": "Their 120 m² hall had been empty for months."}, "did": {"es": "Publicó con los metros, el estacionamiento y fotos del interior.", "en": "They listed with the size, the parking and photos of the inside."}, "result": {"es": "11 consultas de empresas de la zona y el contrato firmado en la semana 4.", "en": "11 enquiries from local businesses and the lease signed in week 4."}, "quote": {"es": "Me escribieron negocios que necesitaban justo ese espacio.", "en": "Businesses that needed exactly that space wrote to me."}},
  {"slug": "karina-inmobiliaria-cde", "metric": {"es": "41 consultas el primer mes", "en": "41 enquiries in month one"}, "when": {"es": "en Ciudad del Este", "en": "in Ciudad del Este"}, "who": {"es": "Karina · inmobiliaria familiar", "en": "Karina · family agency"}, "title": {"es": "La inmobiliaria de Karina sumó consultas en Ciudad del Este", "en": "Karina’s agency gained enquiries in Ciudad del Este"}, "challenge": {"es": "Tenían 30 propiedades y ningún tiempo para cargarlas una por una.", "en": "They had 30 properties and no time to upload them one by one."}, "did": {"es": "Empezó pasando su cartera a Casa-Libre sin exclusividad.", "en": "They started by moving her portfolio to Casa-Libre with no exclusivity."}, "result": {"es": "41 consultas en el primer mes y operaciones cerradas en semanas.", "en": "41 enquiries in the first month and deals closed within weeks."}, "quote": {"es": "Seguimos publicando donde antes y sumamos consultas nuevas.", "en": "We still list where we did before and gained new enquiries."}},
  {"slug": "daniel-casa-sanber", "metric": {"es": "Vendida en 40 días", "en": "Sold in 40 days"}, "when": {"es": "en San Bernardino", "en": "in San Bernardino"}, "who": {"es": "Daniel · dueño de una casa de fin de semana", "en": "Daniel · weekend-house owner"}, "title": {"es": "Daniel vendió su casa de fin de semana en San Bernardino", "en": "Daniel sold their weekend house in San Bernardino"}, "challenge": {"es": "Su casa de fin de semana llevaba meses sin compradores serios.", "en": "Their weekend house had gone months without serious buyers."}, "did": {"es": "Publicó con fotos del lago cerca y la ubicación en el mapa.", "en": "They listed with photos of the nearby lake and the location on the map."}, "result": {"es": "14 consultas, 4 visitas y una oferta aceptada el día 40.", "en": "14 enquiries, 4 viewings and an accepted offer on day 40."}, "quote": {"es": "Los compradores de Asunción la encontraron en el mapa.", "en": "Buyers from Asunción found it on the map."}},
  {"slug": "laura-habitacion", "metric": {"es": "Alquilado en 4 días", "en": "Rented in 4 days"}, "when": {"es": "en Asunción", "en": "in Asunción"}, "who": {"es": "Laura · alquila una habitación", "en": "Laura · rents out a room"}, "title": {"es": "Laura alquiló su habitación amoblada en Asunción", "en": "Laura rented out their furnished room in Asunción"}, "challenge": {"es": "El habitación amoblada iba a quedar vacío y no quería perder meses buscando inquilino.", "en": "The furnished room was about to sit empty and they didn’t want to lose months finding a tenant."}, "did": {"es": "Publicó desde la app, con el precio y las reglas de la casa.", "en": "They listed from the app, with the price and the house rules."}, "result": {"es": "10 consultas, 3 visitas y contrato firmado el día 4.", "en": "10 enquiries, 3 viewings and a lease signed on day 4."}, "quote": {"es": "Con las reglas claras, encontré a alguien que encajaba.", "en": "With clear rules, I found someone who fit in."}},
  {"slug": "ivan-agente-luque", "metric": {"es": "24 consultas en un mes", "en": "24 enquiries in a month"}, "when": {"es": "en Luque", "en": "in Luque"}, "who": {"es": "Iván · agente", "en": "Iván · agent"}, "title": {"es": "Iván llenó su agenda en Luque", "en": "Iván filled their calendar in Luque"}, "challenge": {"es": "Tenía 10 propiedades publicadas y casi no recibía consultas.", "en": "They had 10 properties listed and hardly any enquiries."}, "did": {"es": "Empezó publicando con precio a la vista y fotos de día.", "en": "They started by listing with the price in plain sight and daylight photos."}, "result": {"es": "24 consultas en el mes siguiente, con las mismas propiedades.", "en": "24 enquiries the following month, with the same listings."}, "quote": {"es": "Las consultas llegaban de gente que ya estaba decidida.", "en": "Enquiries came from people who had already decided."}},
  {"slug": "noemi-terreno-ita", "metric": {"es": "Terreno vendido en 5 semanas", "en": "Land sold in 5 weeks"}, "when": {"es": "en Itauguá", "en": "in Itauguá"}, "who": {"es": "Noemí · dueña de un terreno", "en": "Noemí · land owner"}, "title": {"es": "Noemí vendió su terreno sobre asfalto en Itauguá", "en": "Noemí sold their plot on a paved road in Itauguá"}, "challenge": {"es": "Vivía lejos y no podía mostrar el terreno sobre asfalto todas las semanas.", "en": "They lived far away and couldn’t show the plot on a paved road every week."}, "did": {"es": "Publicó con fotos de la calle y el punto en el mapa.", "en": "They listed with photos of the street and the pin on the map."}, "result": {"es": "11 consultas, 3 visitas y la venta firmada en la semana 5.", "en": "11 enquiries, 3 viewings and the sale signed in week 5."}, "quote": {"es": "Mostrar el asfalto en las fotos fue clave.", "en": "Showing the paved road in the photos was key."}},
  {"slug": "cesar-deposito-luque", "metric": {"es": "Alquilado en 3 semanas", "en": "Rented in 3 weeks"}, "when": {"es": "en Luque", "en": "in Luque"}, "who": {"es": "César · dueño de un depósito", "en": "César · warehouse owner"}, "title": {"es": "César encontró inquilino para su depósito de 300 m² en Luque", "en": "César found a tenant for their 300 m² warehouse in Luque"}, "challenge": {"es": "Su depósito de 300 m² estaba vacío desde hacía meses.", "en": "Their 300 m² warehouse had been empty for months."}, "did": {"es": "Publicó con la altura, el acceso para camiones y fotos del portón.", "en": "They listed with the ceiling height, truck access and photos of the gate."}, "result": {"es": "7 consultas de empresas de la zona y el contrato firmado en la semana 3.", "en": "7 enquiries from local businesses and the lease signed in week 3."}, "quote": {"es": "Los datos técnicos atrajeron a las empresas correctas.", "en": "The technical details attracted the right companies."}},
  {"slug": "monica-casa-alquiler-enc", "metric": {"es": "Alquilado en 10 días", "en": "Rented in 10 days"}, "when": {"es": "en Encarnación", "en": "in Encarnación"}, "who": {"es": "Mónica · dueña de una casa", "en": "Mónica · house owner"}, "title": {"es": "Mónica alquiló su casa de 3 dormitorios en Encarnación", "en": "Mónica rented out their 3-bedroom house in Encarnación"}, "challenge": {"es": "El casa de 3 dormitorios iba a quedar vacío y no quería perder meses buscando inquilino.", "en": "The 3-bedroom house was about to sit empty and they didn’t want to lose months finding a tenant."}, "did": {"es": "Publicó con fotos del patio y la distancia a la costanera.", "en": "They listed with photos of the yard and the distance to the waterfront."}, "result": {"es": "17 consultas, 4 visitas y contrato firmado el día 10.", "en": "17 enquiries, 4 viewings and a lease signed on day 10."}, "quote": {"es": "Se alquiló antes de que se fuera el inquilino anterior.", "en": "It was rented before the previous tenant had even left."}},
  {"slug": "pedro-depto-carmelitas", "metric": {"es": "Vendida en 23 días", "en": "Sold in 23 days"}, "when": {"es": "en Carmelitas", "en": "in Carmelitas"}, "who": {"es": "Pedro · dueño de un departamento", "en": "Pedro · apartment owner"}, "title": {"es": "Pedro vendió su departamento con vista en Carmelitas", "en": "Pedro sold their apartment with a view in Carmelitas"}, "challenge": {"es": "Su departamento con vista llevaba meses sin compradores serios.", "en": "Their apartment with a view had gone months without serious buyers."}, "did": {"es": "Publicó con fotos de la vista al atardecer.", "en": "They listed with photos of the view at sunset."}, "result": {"es": "20 consultas, 6 visitas y una oferta aceptada el día 23.", "en": "20 enquiries, 6 viewings and an accepted offer on day 23."}, "quote": {"es": "La foto de la vista fue la que más me comentaron.", "en": "The photo of the view was the one people mentioned most."}},
  {"slug": "ana-maria-agente", "metric": {"es": "29 consultas en un mes", "en": "29 enquiries in a month"}, "when": {"es": "en Lambaré", "en": "in Lambaré"}, "who": {"es": "Ana María · agente con 20 años de experiencia", "en": "Ana María · agent with 20 years’ experience"}, "title": {"es": "Ana María llenó su agenda en Lambaré", "en": "Ana María filled their calendar in Lambaré"}, "challenge": {"es": "Tenía 15 propiedades publicadas y casi no recibía consultas.", "en": "They had 15 properties listed and hardly any enquiries."}, "did": {"es": "Empezó sumando Casa-Libre a los portales que ya usaba.", "en": "They started by adding Casa-Libre to the portals she already used."}, "result": {"es": "29 consultas en el mes siguiente, con las mismas propiedades.", "en": "29 enquiries the following month, with the same listings."}, "quote": {"es": "Casa-Libre me trajo compradores que no veía en otros lados.", "en": "Casa-Libre brought me buyers I didn’t see anywhere else."}},
  {"slug": "jose-terreno-cde-km", "metric": {"es": "Terreno vendido en 5 semanas", "en": "Land sold in 5 weeks"}, "when": {"es": "en Ciudad del Este", "en": "in Ciudad del Este"}, "who": {"es": "José · dueño de un lote", "en": "José · lot owner"}, "title": {"es": "José vendió su lote en zona de kilómetros en Ciudad del Este", "en": "José sold their lot in the km area in Ciudad del Este"}, "challenge": {"es": "Vivía lejos y no podía mostrar el lote en zona de kilómetros todas las semanas.", "en": "They lived far away and couldn’t show the lot in the km area every week."}, "did": {"es": "Publicó con las medidas, el precio y el acceso marcado en el mapa.", "en": "They listed with the measurements, the price and the access marked on the map."}, "result": {"es": "15 consultas, 5 visitas y la venta firmada en la semana 5.", "en": "15 enquiries, 5 viewings and the sale signed in week 5."}, "quote": {"es": "Los interesados venían con todo claro desde el primer mensaje.", "en": "Interested buyers arrived with everything clear from the first message."}},
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
  ].filter(Boolean).join('\n\n');
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
      'Si tenés una propiedad en ese rango o en esas ciudades, hay compradores mirando ahora. En Casa-Libre los interesados te escriben directo a tu WhatsApp.',
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
        'If you have a property in that range or in those cities, buyers are looking right now. On Casa-Libre interested people write straight to your WhatsApp.',
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
      'Fotos, precio y ubicación. Los interesados te escriben directo a tu WhatsApp, sin exclusividad. Desde la web o desde la app de Casa-Libre para iPhone y Android.',
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
        'Photos, price and location. Interested people write straight to your WhatsApp, with no exclusivity. On the web or in the Casa-Libre app for iPhone and Android.',
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
    name: 'Newsletter — Historia: vendida en 19 días',
    subject: 'Cómo Martín vendió en 3 semanas una casa que llevaba 4 meses publicada',
    heading: 'Historia de éxito: vendida en 19 días',
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
      subject: 'How Martín sold in 3 weeks a house that had been listed for 4 months',
      heading: 'Success story: sold in 19 days',
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
      'Los interesados te escriben **directo a tu WhatsApp**.\n**Sin exclusividad:** seguí publicando donde quieras.',
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
        'Interested people write **straight to your WhatsApp**.\n**No exclusivity:** keep listing wherever you want.',
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
