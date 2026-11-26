// Service-partner preview pages (casa-libre.com.py/<slug>). Each entry is a REAL company we are
// pitching: its name, services, prices, areas and contact come from the company's own website.
// The page shows how the company would look on Casa-Libre and lets them pay to go live.
// Paraguay only: the pages 404 on every other country site.

export const PARTNER_COUNTRIES = ['py'];

export const PARTNERS = {
  'casa-limpia': {
    slug: 'casa-limpia',
    name: 'CasaLimpia',
    category: { es: 'Limpieza', en: 'Cleaning' },
    area: { es: 'Limpieza · Gran Asunción', en: 'Cleaning · Greater Asunción' },
    tagline: {
      es: 'Tu casa o tu oficina, impecable. Sin que tengas que ocuparte de nada.',
      en: 'Your home or office, spotless. Without you having to deal with anything.',
    },
    about: {
      es: 'CasaLimpia es una empresa de limpieza de Asunción. Limpian departamentos, lavan tapizados y colchones en todo Gran Asunción y arman equipos de limpieza para oficinas, obras y edificios. La misma regla en cada servicio: precio claro, trabajo bien hecho y factura legal.',
      en: 'CasaLimpia is a cleaning company from Asunción. They clean apartments, wash upholstery and mattresses across Greater Asunción, and put together cleaning teams for offices, construction sites and buildings. The same rule on every job: a clear price, work done right and an official invoice.',
    },
    logo: '/casa-limpia/logo-full.svg',
    cover: '/casa-limpia/svc-apartments.jpg',
    website: 'https://casa-limpia.com.py',
    websiteLabel: 'casa-limpia.com.py',
    // Business WhatsApp from casa-limpia.com.py/contacto (0972 993 999).
    whatsapp: '595972993999',
    whatsappLabel: '0972 993 999',
    waText: {
      es: 'Hola CasaLimpia, los encontré en Casa-Libre. Quisiera un presupuesto de limpieza para una propiedad.',
      en: 'Hi CasaLimpia, I found you on Casa-Libre. I would like a cleaning quote for a property.',
    },
    email: 'hola@casa-limpia.com.py',
    chips: [
      { es: 'Factura legal', en: 'Official invoice' },
      { es: 'Precio fijo', en: 'Fixed price' },
      { es: 'Primero limpiamos, después pagás', en: 'Clean first, pay after' },
      { es: '5,0 en Google', en: '5.0 on Google' },
    ],
    stats: [
      { k: { es: 'Reseñas en Google', en: 'Google reviews' }, v: { es: '5,0 ★', en: '5.0 ★' } },
      { k: { es: 'Atiende', en: 'Open' }, v: { es: 'Lun a sáb', en: 'Mon to Sat' } },
      { k: { es: 'Idiomas', en: 'Languages' }, v: { es: '5', en: '5' } },
      { k: { es: 'Garantía', en: 'Guarantee' }, v: { es: 'Impecable o volvemos', en: 'Spotless or we return' } },
    ],
    services: [
      { icon: 'key', t: { es: 'Limpieza de departamentos', en: 'Apartment cleaning' }, d: { es: 'Precio final por visita, con traslado incluido en todo Gran Asunción. 2 dormitorios: 239.000 Gs · 3 dormitorios: 299.000 Gs.', en: 'Final price per visit, travel included across Greater Asunción. 2 bedrooms: Gs 239,000 · 3 bedrooms: Gs 299,000.' }, from: { es: 'desde', en: 'from' }, price: 'Gs. 209.000' },
      { icon: 'door', t: { es: 'Limpieza de mudanza', en: 'Move-in / move-out cleaning' }, d: { es: 'Para dejar la propiedad lista cuando entra o sale un inquilino.', en: 'Gets the property ready when a tenant moves in or out.' }, from: { es: 'precio', en: 'price' }, price: { es: 'A medida', en: 'Custom quote' } },
      { icon: 'sofa', t: { es: 'Lavado de tapizados y colchones', en: 'Upholstery and mattress washing' }, d: { es: 'Sofá de 3 cuerpos: 299.000 Gs · Colchón 2 plazas: 229.000 Gs. Precio menor para clientes CasaLimpia.', en: '3-seat sofa: Gs 299,000 · Double mattress: Gs 229,000. Lower price for CasaLimpia clients.' }, from: { es: 'desde', en: 'from' }, price: 'Gs. 150.000' },
      { icon: 'building', t: { es: 'Inmobiliarias, obras y edificios', en: 'Agencies, construction and buildings' }, d: { es: 'Fin de obra, edificios y consorcios, oficinas y comercios.', en: 'Post-construction, buildings and condos, offices and shops.' }, from: { es: 'precio', en: 'price' }, price: { es: 'A medida', en: 'Custom quote' } },
    ],
    gallery: ['/casa-limpia/svc-apartments.jpg', '/casa-limpia/svc-upholstery.jpg', '/casa-limpia/why-kitchen.jpg', '/casa-limpia/g2.jpg', '/casa-limpia/g4.jpg'],
    steps: [
      { t: { es: 'Le escribís', en: 'You message them' }, d: { es: 'Por WhatsApp, con la dirección y el tamaño de la propiedad.', en: 'On WhatsApp, with the address and size of the property.' } },
      { t: { es: 'Precio fijo', en: 'Fixed price' }, d: { es: 'Te pasan el precio antes del trabajo. Sin pagar horas.', en: 'You get the price before the job. No hourly billing.' } },
      { t: { es: 'Reporte con fotos', en: 'Photo report' }, d: { es: 'Limpian y te mandan fotos por WhatsApp. Pagás después.', en: 'They clean and send photos on WhatsApp. You pay after.' } },
    ],
    team: [
      { img: '/casa-limpia/tomas.jpg', name: 'Tomas Lukasiak', role: { es: 'Clientes y operaciones', en: 'Clients and operations' } },
      { img: '/casa-limpia/mikolaj.jpg', name: 'Mikołaj Koput', role: { es: 'Marketing y ventas', en: 'Marketing and sales' } },
      { img: '/casa-limpia/mirian.jpg', name: 'Mirian', role: { es: 'Jefa del equipo de limpieza', en: 'Cleaning team lead' } },
    ],
    zones: ['Asunción', 'Fernando de la Mora', 'Lambaré', 'Luque', 'San Lorenzo', 'Mariano Roque Alonso', 'Capiatá', 'Ñemby', 'Villa Elisa', 'Limpio'],
    details: [
      { icon: 'clock', k: { es: 'Horario', en: 'Hours' }, v: { es: 'Lun a sáb · 8 a 18 h', en: 'Mon to Sat · 8 am to 6 pm' } },
      { icon: 'receipt', k: { es: 'Factura', en: 'Invoice' }, v: { es: 'Factura legal en cada servicio', en: 'Official invoice on every job' } },
      { icon: 'card', k: { es: 'Pago', en: 'Payment' }, v: { es: 'Sin seña, sin adelantos', en: 'No deposit, no prepayment' } },
      { icon: 'camera', k: { es: 'Reporte', en: 'Report' }, v: { es: 'Fotos por WhatsApp', en: 'Photos on WhatsApp' } },
      { icon: 'pin', k: { es: 'Base', en: 'Based in' }, v: { es: 'Asunción', en: 'Asunción' } },
    ],
    // Founding-partner plan, charged as a monthly Stripe subscription in USD.
    plan: { usd: 49, cents: 4900, listUsd: 99, interval: 'month' },
  },
};

export const getPartner = (slug) => PARTNERS[slug] || null;
export const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.es : v);
export const waLink = (p, lang = 'es') => `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(pick(p.waText, lang))}`;
