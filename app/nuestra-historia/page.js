import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY, COUNTRY_PT } from '@/lib/country';

export const metadata = {
  title: `Nuestra historia — Casa Libre, el marketplace de propiedades de ${COUNTRY.name}`,
  description: `Casa Libre nació para que comprar, alquilar y publicar propiedades en ${COUNTRY.name} sea simple, transparente y gratis. Conocé nuestra historia y misión.`,
  alternates: { canonical: '/nuestra-historia' },
};

const content = {
  es: {
    hero: { eyebrow: 'Nuestra historia', title: 'Un lugar,', titleSerif: 'libremente.', sub: `Casa Libre nació de una idea simple: encontrar y publicar propiedades en ${COUNTRY.name} no debería costar una fortuna ni ser complicado.` },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `Durante años, comprar o alquilar una casa en ${COUNTRY.name} significó saltar entre portales pagos, clasificados desordenados y avisos duplicados. Publicar era peor: planes caros, comisiones y trámites. Creímos que había una forma mejor.`],
        ['h2', 'Nuestra misión'],
        ['p', `<strong>Casa Libre</strong> es el marketplace inmobiliario de mayor crecimiento en ${COUNTRY.name}: casas, departamentos, dúplex y locales en venta y alquiler, con búsqueda en mapa, fotos reales, precios en ${COUNTRY.currencyName} y dólares, contacto directo por WhatsApp y app para iPhone y Android. Buscar es gratis. Y publicar tu propiedad también.`],
        ['h2', 'Por qué gratis'],
        ['p', 'Creemos que el mercado inmobiliario funciona mejor cuando cualquiera puede publicar sin barreras. Por eso publicar en Casa Libre no tiene costo: solo necesitás una cuenta. Así cada aviso tiene un dueño real y los compradores encuentran más y mejores opciones.'],
        ['h2', `Para todo ${COUNTRY.name}`],
        ['p', 'Desde Asunción y el Gran Asunción hasta Ciudad del Este, Encarnación y San Bernardino, Casa Libre te muestra lo que hay disponible cerca tuyo, en un mapa fácil de usar.'],
      ] },
      { type: 'cta', title: 'Encontrá tu próximo lugar', sub: `Explorá miles de propiedades en todo ${COUNTRY.name}, o publicá la tuya gratis.`, primary: ['Ver propiedades', '/propiedades'], secondary: ['Publicar gratis', '/publicar'] },
    ],
  },
  en: {
    hero: { eyebrow: 'Our story', title: 'A place,', titleSerif: 'freely.', sub: `Casa Libre started from a simple idea: finding and listing properties in ${COUNTRY.name} shouldn’t cost a fortune or be complicated.` },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `For years, buying or renting a home in ${COUNTRY.name} meant jumping between paywalled portals, messy classifieds and duplicate listings. Listing was worse: expensive plans, commissions and paperwork. We believed there was a better way.`],
        ['h2', 'Our mission'],
        ['p', `<strong>Casa Libre</strong> is the fastest-growing property marketplace in ${COUNTRY.name}: houses, apartments, duplexes and commercial spaces for sale and for rent, with map search, real photos, prices in ${COUNTRY.currencyName} and dollars, direct WhatsApp contact and an app for iPhone and Android. Searching is free. And listing your property is too.`],
        ['h2', 'Why it’s free'],
        ['p', 'We believe the real-estate market works better when anyone can list without barriers. That’s why listing on Casa Libre has no cost: all you need is an account. That way every listing has a real owner and buyers find more and better options.'],
        ['h2', `For all of ${COUNTRY.name}`],
        ['p', 'From Asunción and Greater Asunción to Ciudad del Este, Encarnación and San Bernardino, Casa Libre shows you what’s available near you, on an easy-to-use map.'],
      ] },
      { type: 'cta', title: 'Find your next place', sub: `Browse thousands of properties across ${COUNTRY.name}, or list yours for free.`, primary: ['Browse listings', '/propiedades'], secondary: ['List for free', '/publicar'] },
    ],
  },
  pt: {
    hero: { eyebrow: 'Nossa história', title: 'Um lugar,', titleSerif: 'livremente.', sub: `Casa Libre começou a partir de uma ideia simples: encontrar e anunciar imóveis ${COUNTRY_PT.in} não deveria custar uma fortuna nem ser complicado.` },
    blocks: [
      { type: 'prose', nodes: [
        ['p', `Durante anos, comprar ou alugar um imóvel ${COUNTRY_PT.in} significou pular entre portais pagos, classificados bagunçados e anúncios duplicados. Anunciar era pior: planos caros, comissões e burocracia. Acreditávamos que havia um jeito melhor.`],
        ['h2', 'Nossa missão'],
        ['p', `<strong>Casa Libre</strong> é o marketplace imobiliário que mais cresce ${COUNTRY_PT.in}: casas, apartamentos, dúplex e espaços comerciais para venda e aluguel, com busca no mapa, fotos reais, preços em ${COUNTRY.currencyName} e dólares, contato direto por WhatsApp e um app para iPhone e Android. Buscar é grátis. E anunciar seu imóvel também.`],
        ['h2', 'Por que é grátis'],
        ['p', 'Acreditamos que o mercado imobiliário funciona melhor quando qualquer pessoa pode anunciar sem barreiras. Por isso, anunciar no Casa Libre não tem custo: tudo que você precisa é uma conta. Assim, cada anúncio tem um dono real e os compradores encontram mais e melhores opções.'],
        ['h2', `Para ${COUNTRY_PT.all}`],
        ['p', 'De Asunción e Grande Asunción até Ciudad del Este, Encarnación e San Bernardino, Casa Libre mostra o que está disponível perto de você, em um mapa fácil de usar.'],
      ] },
      { type: 'cta', title: 'Encontre seu próximo lugar', sub: `Explore milhares de imóveis em ${COUNTRY_PT.all}, ou anuncie o seu gratuitamente.`, primary: ['Ver imóveis', '/propiedades'], secondary: ['Anunciar grátis', '/publicar'] },
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
