import Link from 'next/link';

export function Hero({ eyebrow, title, titleSerif, sub }) {
  return (
    <section className="px-5 md:px-11 pt-16 pb-10 max-w-[900px] mx-auto text-center">
      {eyebrow && <div className="font-mono text-[12px] uppercase tracking-label text-ink/45 mb-4">{eyebrow}</div>}
      <h1 className="text-[clamp(34px,6vw,60px)] font-bold tracking-display leading-[1.03]">{title}{titleSerif && <> <span className="font-serif italic font-normal">{titleSerif}</span></>}</h1>
      {sub && <p className="text-[17px] text-ink/60 mt-5 max-w-[620px] mx-auto leading-relaxed">{sub}</p>}
    </section>
  );
}

export function Prose({ children }) {
  return <div className="px-5 md:px-11 py-6 max-w-[760px] mx-auto text-[16px] leading-relaxed text-ink/80 [&>h2]:text-[26px] [&>h2]:font-bold [&>h2]:tracking-head [&>h2]:text-ink [&>h2]:mt-10 [&>h2]:mb-3 [&>p]:mb-4 [&>ul]:mb-4 [&>ul]:pl-5 [&>ul]:list-disc [&_a]:font-semibold [&_a]:underline [&_a]:decoration-ink/30 hover:[&_a]:decoration-ink">{children}</div>;
}

export function CTABand({ title, sub, primary = ['Ver propiedades', '/propiedades'], secondary = ['Publicar gratis', '/publicar'] }) {
  return (
    <section className="px-5 md:px-11 py-16 mt-8">
      <div className="max-w-[900px] mx-auto bg-ink text-paper rounded-section p-10 md:p-14 text-center">
        <h2 className="text-[clamp(26px,4vw,40px)] font-bold tracking-display leading-tight">{title}</h2>
        {sub && <p className="text-[16px] text-paper/70 mt-3 max-w-[520px] mx-auto">{sub}</p>}
        <div className="flex flex-wrap gap-3 justify-center mt-7">
          <Link href={primary[1]} className="px-7 py-3.5 bg-paper text-ink rounded-pill font-bold text-[15px]">{primary[0]}</Link>
          {secondary && <Link href={secondary[1]} className="px-7 py-3.5 border-2 border-paper text-paper rounded-pill font-bold text-[15px]">{secondary[0]}</Link>}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({ items }) {
  return (
    <section className="px-5 md:px-11 py-8 max-w-[1000px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
      {items.map((it, i) => (
        <div key={i} className="bg-card border border-ink/15 rounded-card p-6">
          <div className="text-[15px] font-bold tracking-head mb-1.5">{it.t}</div>
          <div className="text-[14px] text-ink/60 leading-relaxed">{it.d}</div>
        </div>
      ))}
    </section>
  );
}
