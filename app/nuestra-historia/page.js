import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';

export const metadata = {
  title: 'Nuestra historia — Casa Libre, el marketplace de propiedades de Paraguay',
  description: 'Casa Libre nació para que comprar, alquilar y publicar propiedades en Paraguay sea simple, transparente y gratis. Conocé nuestra historia y misión.',
  alternates: { canonical: '/nuestra-historia' },
};

const content = {
  es: {
    hero: { eyebrow: 'Nuestra historia', title: 'Un lugar,', titleSerif: 'libremente.', sub: 'Casa Libre nació de una idea simple: encontrar y publicar propiedades en Paraguay no debería costar una fortuna ni ser complicado.' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', 'Durante años, comprar o alquilar una casa en Paraguay significó saltar entre portales pagos, clasificados desordenados y avisos duplicados. Publicar era peor: planes caros, comisiones y trámites. Creímos que había una forma mejor.'],
        ['h2', 'Nuestra misión'],
        ['p', '<strong>Casa Libre</strong> reúne miles de propiedades —casas, departamentos, dúplex y locales— de todo Paraguay en un solo lugar, con mapa, fotos reales y precios en guaraníes y dólares. Buscar es gratis. Y publicar tu propiedad también.'],
        ['h2', 'Por qué gratis'],
        ['p', 'Creemos que el mercado inmobiliario funciona mejor cuando cualquiera puede publicar sin barreras. Por eso publicar en Casa Libre no tiene costo: solo necesitás una cuenta. Así cada aviso tiene un dueño real y los compradores encuentran más y mejores opciones.'],
        ['h2', 'Para todo Paraguay'],
        ['p', 'Desde Asunción y el Gran Asunción hasta Ciudad del Este, Encarnación y San Bernardino, Casa Libre te muestra lo que hay disponible cerca tuyo, en un mapa fácil de usar.'],
      ] },
      { type: 'cta', title: 'Encontrá tu próximo lugar', sub: 'Explorá miles de propiedades en todo Paraguay, o publicá la tuya gratis.', primary: ['Ver propiedades', '/propiedades'], secondary: ['Publicar gratis', '/publicar'] },
    ],
  },
  en: {
    hero: { eyebrow: 'Our story', title: 'A place,', titleSerif: 'freely.', sub: 'Casa Libre started from a simple idea: finding and listing properties in Paraguay shouldn’t cost a fortune or be complicated.' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', 'For years, buying or renting a home in Paraguay meant jumping between paywalled portals, messy classifieds and duplicate listings. Listing was worse: expensive plans, commissions and paperwork. We believed there was a better way.'],
        ['h2', 'Our mission'],
        ['p', '<strong>Casa Libre</strong> brings together thousands of properties — houses, apartments, duplexes and commercial spaces — from all over Paraguay in one place, with a map, real photos and prices in guaraníes and dollars. Searching is free. And listing your property is too.'],
        ['h2', 'Why it’s free'],
        ['p', 'We believe the real-estate market works better when anyone can list without barriers. That’s why listing on Casa Libre has no cost: all you need is an account. That way every listing has a real owner and buyers find more and better options.'],
        ['h2', 'For all of Paraguay'],
        ['p', 'From Asunción and Greater Asunción to Ciudad del Este, Encarnación and San Bernardino, Casa Libre shows you what’s available near you, on an easy-to-use map.'],
      ] },
      { type: 'cta', title: 'Find your next place', sub: 'Browse thousands of properties across Paraguay, or list yours for free.', primary: ['Browse listings', '/propiedades'], secondary: ['List for free', '/publicar'] },
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
