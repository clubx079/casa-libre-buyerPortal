import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';

export const metadata = {
  title: `Administración de propiedades — Gestión de alquileres en ${COUNTRY.name}`,
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
        ['p', `Somos la plataforma inmobiliaria más amigable de ${COUNTRY.name}. Conocemos el mercado local, hablamos claro y trabajamos para que ser propietario sea simple.`],
        ['p', 'Ya tengas una propiedad o varias, adaptamos el servicio a lo que necesitás — sin letra chica ni sorpresas. Vos decidís cuánto querés delegar; nosotros nos encargamos de que funcione.'],
      ] },
      { type: 'cta', title: 'Hablemos de tu propiedad', sub: 'Contanos qué necesitás y te ayudamos a gestionarla.', primary: ['Contactar', '/contacto'], secondary: ['Para inversores', '/empresas'] },
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
        ['p', `We’re ${COUNTRY.name}’s friendliest real-estate platform. We know the local market, we speak plainly, and we work to make being a landlord simple.`],
        ['p', 'Whether you own one property or several, we tailor the service to what you need — no fine print, no surprises. You decide how much to delegate; we make sure it works.'],
      ] },
      { type: 'cta', title: 'Let’s talk about your property', sub: 'Tell us what you need and we’ll help you manage it.', primary: ['Contact us', '/contacto'], secondary: ['For Investors', '/empresas'] },
    ],
  },
  pt: {
    hero: {
      eyebrow: 'Gestão de imóveis',
      title: 'Seu aluguel,',
      titleSerif: 'cuidado.',
      sub: 'Nós administramos seu imóvel de aluguel do início ao fim. Você recebe o aluguel; nós cuidamos do resto.',
    },
    blocks: [
      { type: 'heading', text: 'O que fazemos por você' },
      { type: 'features', items: [
        { t: 'Busca e triagem de inquilinos', d: 'Divulgamos seu imóvel, agendamos as visitas e avaliamos cada candidato para que você alugue com tranquilidade.' },
        { t: 'Cobrança de aluguel', d: 'Gerenciamos a cobrança mensal e transferimos o valor para você pontualmente, com registro claro de cada pagamento.' },
        { t: 'Manutenção e reparos', d: 'Atendemos às solicitações dos inquilinos e coordenamos profissionais de confiança sempre que algo precisar de conserto.' },
        { t: 'Contratos e documentação', d: 'Preparamos, renovamos e arquivamos os contratos, mantendo tudo em ordem.' },
        { t: 'Relatórios ao proprietário', d: 'Você recebe um resumo do status do seu imóvel, pagamentos e despesas sempre que precisar.' },
        { t: 'Um único ponto de contato', d: 'Um time cuida de tudo. Você tem uma pessoa única para recorrer — sem rodeios.' },
      ] },
      { type: 'heading', text: 'Por que Casa Libre' },
      { type: 'prose', nodes: [
        ['p', `Somos a plataforma imobiliária mais amigável do ${COUNTRY.name}. Conhecemos o mercado local, falamos de forma clara e trabalhamos para tornar ser proprietário simples.`],
        ['p', 'Seja você dono de um imóvel ou de vários, adaptamos o serviço ao que você precisa — sem letra miúda, sem surpresas. Você decide quanto delegar; nós garantimos que tudo funcione.'],
      ] },
      { type: 'cta', title: 'Vamos conversar sobre seu imóvel', sub: 'Conte o que você precisa e ajudaremos a gerenciá-lo.', primary: ['Fale conosco', '/contacto'], secondary: ['Para investidores', '/empresas'] },
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
