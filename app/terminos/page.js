import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';

export const metadata = {
  title: 'Términos y condiciones — Casa Libre',
  description: 'Términos y condiciones de uso de Casa Libre, el marketplace de propiedades de Paraguay.',
  alternates: { canonical: '/terminos' },
};

const content = {
  es: {
    hero: { title: 'Términos y condiciones' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', 'Al usar Casa Libre aceptás estos términos. Casa Libre es una plataforma que conecta a quienes publican propiedades con quienes las buscan en Paraguay.'],
        ['h2', 'Uso de la plataforma'],
        ['p', 'Publicar propiedades es gratuito y requiere una cuenta. Sos responsable de la veracidad de la información y las fotos que publicás. Casa Libre no es parte de las operaciones entre usuarios ni cobra comisiones.'],
        ['h2', 'Contenido'],
        ['p', 'No se permiten avisos falsos, duplicados o que infrinjan derechos de terceros. Casa Libre puede remover contenido que incumpla estas reglas.'],
        ['h2', 'Responsabilidad'],
        ['p', 'Casa Libre no garantiza la disponibilidad ni las condiciones de las propiedades publicadas. Verificá siempre la información directamente con el publicador antes de cualquier operación.'],
      ] },
    ],
  },
  en: {
    hero: { title: 'Terms and conditions' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', 'By using Casa Libre you accept these terms. Casa Libre is a platform that connects those who list properties with those who search for them in Paraguay.'],
        ['h2', 'Use of the platform'],
        ['p', 'Listing properties is free and requires an account. You are responsible for the accuracy of the information and photos you post. Casa Libre is not a party to transactions between users and charges no commissions.'],
        ['h2', 'Content'],
        ['p', 'False, duplicate or rights-infringing listings are not allowed. Casa Libre may remove content that breaks these rules.'],
        ['h2', 'Liability'],
        ['p', 'Casa Libre does not guarantee the availability or condition of the properties listed. Always verify the information directly with the lister before any transaction.'],
      ] },
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
