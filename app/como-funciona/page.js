import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';

export const metadata = {
  title: 'Cómo funciona Casa Libre — Comprar, alquilar y publicar propiedades',
  description: 'Buscá propiedades en el mapa, guardá tus favoritas y contactá al dueño. ¿Vendés o alquilás? Publicá gratis en minutos. Así funciona Casa Libre.',
  alternates: { canonical: '/como-funciona' },
};

const content = {
  es: {
    hero: { eyebrow: 'Cómo funciona', title: 'Simple para todos,', titleSerif: 'gratis.', sub: 'Buscar o publicar en Casa Libre toma minutos. Sin comisiones, sin planes.' },
    blocks: [
      { type: 'heading', text: 'Si buscás una propiedad' },
      { type: 'features', items: [
        { t: '1 · Explorá el mapa', d: 'Filtrá por ciudad, barrio, tipo, precio y dormitorios. Mirá cada propiedad en el mapa con fotos reales y precio en ₲ y US$.' },
        { t: '2 · Guardá tus favoritas', d: 'Creá tu cuenta y guardá las propiedades que te interesan para volver a verlas desde tu panel.' },
        { t: '3 · Contactá al dueño', d: 'Cada aviso tiene el contacto del publicador. Coordiná una visita directamente, sin intermediarios.' },
      ] },
      { type: 'heading', text: 'Si vendés o alquilás' },
      { type: 'features', items: [
        { t: '1 · Ingresá', d: 'Creá tu cuenta con email o Google. Toda publicación queda vinculada a tu cuenta.' },
        { t: '2 · Cargá tu propiedad', d: 'Completá los datos, subí tus fotos y ubicación. Todo en un solo paso.' },
        { t: '3 · Publicá gratis', d: 'Tu propiedad aparece al instante en el marketplace y en el mapa. Sin costo, sin comisión.' },
      ] },
      { type: 'cta', title: 'Empezá hoy', sub: 'Buscar es gratis. Publicar también.', primary: ['Ver propiedades', '/propiedades'], secondary: ['Publicar gratis', '/publicar'] },
    ],
  },
  en: {
    hero: { eyebrow: 'How it works', title: 'Simple for everyone,', titleSerif: 'free.', sub: 'Searching or listing on Casa Libre takes minutes. No commissions, no plans.' },
    blocks: [
      { type: 'heading', text: 'If you’re looking for a property' },
      { type: 'features', items: [
        { t: '1 · Explore the map', d: 'Filter by city, neighborhood, type, price and bedrooms. See each property on the map with real photos and prices in ₲ and US$.' },
        { t: '2 · Save your favorites', d: 'Create your account and save the properties you like to revisit them from your dashboard.' },
        { t: '3 · Contact the owner', d: 'Every listing has the lister’s contact. Arrange a visit directly, with no middlemen.' },
      ] },
      { type: 'heading', text: 'If you’re selling or renting' },
      { type: 'features', items: [
        { t: '1 · Sign in', d: 'Create your account with email or Google. Every listing is tied to your account.' },
        { t: '2 · Add your property', d: 'Fill in the details, upload your photos and location. All in one step.' },
        { t: '3 · List for free', d: 'Your property appears instantly on the marketplace and the map. No cost, no commission.' },
      ] },
      { type: 'cta', title: 'Start today', sub: 'Searching is free. Listing is too.', primary: ['Browse listings', '/propiedades'], secondary: ['List for free', '/publicar'] },
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
