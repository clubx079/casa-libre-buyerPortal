import './globals.css';

export const metadata = {
  title: 'Casa Libre — Propiedades en Paraguay',
  description: 'Marketplace de propiedades en Paraguay. Casas, departamentos y más — comprá y alquilá con Casa Libre.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
