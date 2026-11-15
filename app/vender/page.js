import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY, COUNTRY_PT } from '@/lib/country';

export const metadata = {
  title: `Publicá tu propiedad gratis en ${COUNTRY.name} — Vender o alquilar`,
  description: 'Publicá tu casa, departamento o local gratis en Casa Libre. Sin comisiones, sin planes. Tu propiedad aparece al instante en el mapa y llega a miles de personas.',
  alternates: { canonical: '/vender' },
};

const content = {
  es: {
    hero: { eyebrow: 'Para quienes publican', title: 'Publicá tu propiedad', titleSerif: 'gratis.', sub: `Vendé o alquilá tu propiedad en ${COUNTRY.name} sin pagar comisiones ni planes. Se publica al instante.` },
    blocks: [
      { type: 'features', items: [
        { t: 'Sin costo', d: 'Publicar es 100% gratis. No cobramos por publicar ni comisión por la operación.' },
        { t: 'Al instante', d: 'Tu propiedad aparece en el marketplace y en el mapa apenas la publicás.' },
        { t: 'Llegá a más gente', d: 'Miles de personas buscan propiedades en Casa Libre cada mes, en todo el país.' },
        { t: 'Fotos y ubicación', d: 'Subí tus fotos reales y marcá la ubicación para que te encuentren fácil.' },
        { t: 'Tu contacto directo', d: 'Los interesados te escriben por WhatsApp o teléfono, sin comisiones de por medio.' },
        { t: 'Gestioná todo', d: 'Editá o eliminá tus publicaciones cuando quieras desde tu panel.' },
      ] },
      { type: 'cta', title: 'Publicá en minutos', sub: 'Creá tu cuenta y publicá tu propiedad gratis, hoy mismo.', primary: ['Publicar gratis', '/publicar'], secondary: ['Cómo funciona', '/como-funciona'] },
    ],
  },
  en: {
    hero: { eyebrow: 'For listers', title: 'List your property', titleSerif: 'free.', sub: `Sell or rent your property in ${COUNTRY.name} without paying commissions or plans. It goes live instantly.` },
    blocks: [
      { type: 'features', items: [
        { t: 'No cost', d: 'Listing is 100% free. We charge nothing to list and take no commission on the deal.' },
        { t: 'Instant', d: 'Your property appears on the marketplace and the map the moment you publish it.' },
        { t: 'Reach more people', d: 'Thousands search for properties on Casa Libre every month, across the country.' },
        { t: 'Photos and location', d: 'Upload your real photos and drop a pin so people find you easily.' },
        { t: 'Your direct contact', d: 'Interested buyers reach you by WhatsApp or phone, with no middlemen.' },
        { t: 'Manage everything', d: 'Edit or delete your listings anytime from your dashboard.' },
      ] },
      { type: 'cta', title: 'List in minutes', sub: 'Create your account and list your property for free, today.', primary: ['List for free', '/publicar'], secondary: ['How it works', '/como-funciona'] },
    ],
  },
  pt: {
    hero: { eyebrow: 'Para quem publica', title: 'Anuncie seu imóvel', titleSerif: 'grátis.', sub: `Venda ou alugue seu imóvel ${COUNTRY_PT.in} sem pagar comissões ou planos. Ele fica no ar imediatamente.` },
    blocks: [
      { type: 'features', items: [
        { t: 'Sem custo', d: 'Anunciar é 100% grátis. Não cobramos nada para publicar nem comissão na negociação.' },
        { t: 'Instantâneo', d: 'Seu imóvel aparece no marketplace e no mapa no momento em que você o publica.' },
        { t: 'Alcance mais pessoas', d: 'Milhares de pessoas buscam imóveis no Casa Libre todo mês, em todo o país.' },
        { t: 'Fotos e localização', d: 'Envie fotos reais e marque a localização para que as pessoas encontrem você facilmente.' },
        { t: 'Contato direto', d: 'Compradores interessados entram em contato via WhatsApp ou telefone, sem intermediários.' },
        { t: 'Gerencie tudo', d: 'Edite ou exclua seus anúncios a qualquer momento pelo seu painel.' },
      ] },
      { type: 'cta', title: 'Anuncie em minutos', sub: 'Crie sua conta e anuncie seu imóvel grátis, hoje mesmo.', primary: ['Anunciar grátis', '/publicar'], secondary: ['Como funciona', '/como-funciona'] },
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
