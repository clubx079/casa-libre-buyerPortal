import FeedbackClient from '@/components/FeedbackClient';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Tu opinión — Casa Libre',
  description: 'Contanos qué te parece Casa Libre. Tu opinión nos ayuda a mejorar.',
  alternates: { canonical: '/feedback' },
  robots: { index: false, follow: true },
};

export default function FeedbackPage() {
  return (
    <>
      <FeedbackClient />
      <Footer />
    </>
  );
}
