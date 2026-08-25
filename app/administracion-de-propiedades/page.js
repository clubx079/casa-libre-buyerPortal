import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';

export const metadata = {
  title: 'Administración de propiedades — Gestión de alquileres en Paraguay',
  description: 'Casa Libre administra tu propiedad en alquiler de principio a fin: selección de inquilinos, cobro, mantenimiento, contratos y reportes. Vos cobrás, nosotros nos ocupamos del resto.',
  alternates: { canonical: '/administracion-de-propiedades' },
};

const content = {
  es: {
    hero: {
      eyebrow: 'Administración de propiedades',
      title: 'Tu alquiler,',
      titleSerif: 'sin complicaciones.',
      sub: 'Administramos tu propiedad en alquiler de principio a fin. Vos cobrás; nosotros nos ocupamos del resto.',
    },
    blocks: [
      { type: 'heading', text: 'Qué hacemos por vos' },
      { type: 'features', items: [
        { t: 'Búsqueda y selección de inquilinos', d: 'Publicamos tu propiedad, coordinamos las visitas y verificamos a cada candidato para que alquiles con tranquilidad.' },
        { t: 'Cobro del alquiler', d: 'Gestionamos el cobro mensual y te transferimos el importe a tiempo, con un registro claro de cada pago.' },
        { t: 'Mantenimiento y reparaciones', d: 'Atendemos los pedidos del inquilino y coordinamos técnicos de confianza cuando algo necesita arreglo.' },
        { t: 'Contratos y documentación', d: 'Preparamos, renovamos y archivamos los contratos, y mantenemos todo en regla.' },
        { t: 'Reportes para el propietario', d: 'Recibís un resumen del estado de tu propiedad, los pagos y los gastos cuando lo necesites.' },
        { t: 'Un solo punto de contacto', d: 'Un equipo se ocupa de todo. Vos tenés una sola persona a quien acudir, sin vueltas.' },
      ] },
      { type: 'heading', text: 'Por qué Casa Libre' },
      { type: 'prose', nodes: [
        ['p', 'Somos la plataforma inmobiliaria más amigable de Paraguay. Conocemos el mercado local, hablamos claro y trabajamos para que ser propietario sea simple.'],
        ['p', 'Ya tengas una propiedad o varias, adaptamos el servicio a lo que necesitás — sin letra chica ni sorpresas. Vos decidís cuánto querés delegar; nosotros nos encargamos de que funcione.'],
      ] },
      { type: 'cta', title: 'Hablemos de tu propiedad', sub: 'Contanos qué necesitás y te ayudamos a gestionarla.', primary: ['Contactar', '/contacto'], secondary: ['Para empresas', '/empresas'] },
    ],
  },
  en: {
    hero: {
      eyebrow: 'Property management',
      title: 'Your rental,',
      titleSerif: 'handled.',
      sub: 'We manage your rental property from start to finish. You collect the rent; we take care of the rest.',
    },
    blocks: [
      { type: 'heading', text: 'What we do for you' },
      { type: 'features', items: [
        { t: 'Tenant search & screening', d: 'We list your property, arrange the viewings and vet every applicant so you can rent with peace of mind.' },
        { t: 'Rent collection', d: 'We handle the monthly collection and transfer the funds to you on time, with a clear record of every payment.' },
        { t: 'Maintenance & repairs', d: 'We respond to tenant requests and coordinate trusted contractors whenever something needs fixing.' },
        { t: 'Contracts & paperwork', d: 'We prepare, renew and file the contracts, and keep everything in order.' },
        { t: 'Owner reporting', d: 'You get a summary of your property’s status, payments and expenses whenever you need it.' },
        { t: 'A single point of contact', d: 'One team handles everything. You have one person to turn to — no runaround.' },
      ] },
      { type: 'heading', text: 'Why Casa Libre' },
      { type: 'prose', nodes: [
        ['p', 'We’re Paraguay’s friendliest real-estate platform. We know the local market, we speak plainly, and we work to make being a landlord simple.'],
        ['p', 'Whether you own one property or several, we tailor the service to what you need — no fine print, no surprises. You decide how much to delegate; we make sure it works.'],
      ] },
      { type: 'cta', title: 'Let’s talk about your property', sub: 'Tell us what you need and we’ll help you manage it.', primary: ['Contact us', '/contacto'], secondary: ['For businesses', '/empresas'] },
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
