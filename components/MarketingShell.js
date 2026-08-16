import SiteNav from './SiteNav';
import Footer from './Footer';

// Wrapper for the SEO/marketing content pages: nav + content + footer.
export default function MarketingShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
