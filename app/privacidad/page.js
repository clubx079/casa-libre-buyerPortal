import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';

export const metadata = {
  title: 'Política de privacidad — Casa Libre',
  description: 'Cómo Casa Libre recopila, usa y protege tus datos en el marketplace de propiedades de Paraguay.',
  alternates: { canonical: '/privacidad' },
};

const content = {
  es: {
    hero: { title: 'Política de privacidad' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', 'En Casa Libre cuidamos tus datos. Esta política explica qué información recopilamos y cómo la usamos.'],
        ['h2', 'Qué recopilamos'],
        ['p', 'Para crear tu cuenta guardamos tu nombre, email y teléfono. Si publicás una propiedad, guardamos los datos y fotos del aviso. También registramos las propiedades que guardás como favoritas.'],
        ['h2', 'Cómo lo usamos'],
        ['p', 'Usamos tus datos para mostrar tus publicaciones, permitir que los interesados te contacten, y mejorar la plataforma. No vendemos tus datos a terceros.'],
        ['h2', 'Tus derechos'],
        ['p', 'Podés editar tu perfil, cambiar tu email o contraseña y eliminar tus publicaciones en cualquier momento desde tu panel.'],
      ] },
    ],
  },
  en: {
    hero: { title: 'Privacy policy' },
    blocks: [
      { type: 'prose', nodes: [
        ['p', 'At Casa Libre we take care of your data. This policy explains what information we collect and how we use it.'],
        ['h2', 'What we collect'],
        ['p', 'To create your account we store your name, email and phone. If you list a property, we store the listing’s data and photos. We also record the properties you save as favorites.'],
        ['h2', 'How we use it'],
        ['p', 'We use your data to show your listings, let interested people contact you, and improve the platform. We do not sell your data to third parties.'],
        ['h2', 'Your rights'],
        ['p', 'You can edit your profile, change your email or password and delete your listings at any time from your dashboard.'],
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
