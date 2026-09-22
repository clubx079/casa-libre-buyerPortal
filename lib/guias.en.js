// English versions of the /guias answer pages, keyed by slug.
//
// The Spanish copy (lib/guias.js) is the SEO target — these queries are searched
// in Spanish, and the server renders Spanish for crawlers. This file exists so the
// site's EN toggle works on the guides like it does on every other page.
import { COUNTRY } from './country';

const c = COUNTRY.name;

export const GUIDES_EN = {
  'como-vender-mi-casa': {
    h1: `How to sell your house in ${c}: a step-by-step guide`,
    answer: `Selling a house in ${c} takes four things: a title deed in order, a reference price based on comparable properties in your area, a listing with real photos and a pin on the map, and a notary for the deed. Listing is free and you can do it yourself; the transfer is always signed before a public notary.`,
    sections: [
      { h2: 'Before you list: check the paperwork', paras: [
        'The thing that causes most delays is not the price, it is the documentation. Before listing, confirm the property is registered in your name, that the registry and cadastral details match reality, and that there are no outstanding property taxes or utility bills.',
        'If the property came through an inheritance, has more than one owner, or still carries a mortgage, resolve that first: those are the three usual reasons a sale collapses after the price is agreed.',
      ] },
      { h2: 'Setting the price', paras: [
        'The most honest reference is what comparable properties are asking today: same neighbourhood, similar size, same number of bedrooms, equivalent condition. You can see that range by filtering the map to your area.',
        'Two corrections are worth making: listings show asking prices, not closing prices, which tend to land somewhat lower; and actual condition — kitchen, bathrooms, roof, damp — moves the value more than square metres do.',
        'If you need a figure with formal backing, for an inheritance or a mortgage, get a valuation from a licensed appraiser.',
      ] },
      { h2: 'Publish the listing', paras: [
        'A listing that works has between eight and fifteen photos taken in daylight, the location pinned on the map, the real floor area, and a description that says what is there without embellishment. The first photo decides whether anyone opens the listing at all.',
        `On Casa Libre listing is free, with no commission and no plans: it appears on the marketplace and the map the moment you publish, alongside properties from agencies and other private owners across ${c}.`,
      ] },
      { h2: 'Showings and negotiation', paras: [
        'Group viewings into a few time slots, take the full name of everyone who visits, and show the house yourself if you can: nobody knows the details better than the owner.',
        'When an offer arrives, the usual step is a sale agreement with a deposit, which reserves the property and fixes the deadline, the payment terms and what happens if either party walks away. That document is best drafted by a notary or a lawyer, even though the final signing comes later.',
      ] },
      { h2: 'The deed', paras: [
        'The transfer is done by public deed before a notary, who verifies the title, requests the registry, cadastral and municipal certificates, drafts the deed, takes the signatures and registers the transfer.',
        'Thirty to sixty days typically pass between the deposit and the signing, depending on how long the certificates take. Costs and who pays what are covered in the taxes and costs guide.',
      ] },
    ],
    faq: [
      { q: 'Can I sell my house without an agency?', a: 'Yes. You can list it, show it and negotiate yourself. What you cannot skip is the notary: transferring a property is always done by public deed.' },
      { q: 'How long does it take to sell a house?', a: 'It depends on price and location. The final stretch is predictable: 30 to 60 days from agreement to signing, because of the certificates the notary requests.' },
      { q: 'What costs does the seller pay?', a: 'Usually a share of the deed and the taxes that apply to the sale. The percentages vary by case; confirm them with your notary before agreeing a final price.' },
      { q: 'Do I need a valuation to list?', a: 'No. A reference price based on comparable properties is enough to list. A formal valuation is for when a figure has to hold up to a third party, such as a bank.' },
    ],
  },
  'impuestos-y-gastos-al-vender': {
    h1: `What taxes and costs the seller pays in ${c}`,
    answer: `Selling a property in ${c} normally involves the notary's fees, the registry inscription fee, the municipal transfer tax and the taxes that apply to the transaction. In practice buyer and seller tend to split the deed, and the total comes to a low single-digit percentage of the sale price. Exact percentages depend on the amount and the case: confirm them with your notary.`,
    sections: [
      { h2: 'What gets paid on a sale', paras: [
        'It helps to separate three things: professional fees (the notary), state charges (registry inscription, municipal transfer tax) and the taxes that apply to the gain or the transaction.',
      ], table: {
        head: ['Item', 'Usually paid by', 'Order of magnitude'],
        rows: [
          ['Notary fees', 'Typically split between buyer and seller', 'A percentage of the value, decreasing with the amount'],
          ['Registry inscription', 'Buyer, unless agreed otherwise', 'Under 1% of the value'],
          ['Municipal transfer tax', 'Depends on the municipality and the agreement', 'A fraction of a percentage point'],
          ['Taxes on the sale', 'Seller', 'Depends on the regime and the case'],
          ['Certificates and prior paperwork', 'Seller', 'A smaller fixed amount'],
        ],
      } },
      { h2: 'Why there is no single number', paras: [
        'Notary fees are calculated on a sliding scale: the higher the value, the lower the percentage. Municipal charges vary by where the property sits. And the tax burden depends on whether the seller is an individual or a company, and how the transaction is treated.',
        'So the only reliable figure is a quote. Get one from two or three notaries before closing the price: fees are negotiable and the difference between quotes is real.',
      ] },
      { h2: 'What to agree in writing before signing', bullets: [
        'Who pays each item, especially the deed.',
        'What happens if a debt or an objection appears on the title.',
        'The deadline for signing and what happens if it passes.',
        'How and when possession is handed over.',
      ] },
    ],
    faq: [
      { q: 'Does the seller or the buyer pay for the deed?', a: 'It is negotiable and set in the sale agreement. Splitting it is most common, but put it in writing before the deposit.' },
      { q: 'How much does a notary charge?', a: 'On a sliding scale: the percentage falls as the property value rises, plus the applicable VAT. Get quotes from two or three and compare.' },
      { q: 'Can a property be sold with unpaid taxes?', a: 'The notary will require clean certificates before the deed, so in practice the debts get cleared during the process, usually deducted from the price.' },
    ],
  },
  'cuanto-vale-mi-propiedad': {
    h1: 'What is my property worth, and how to price it',
    answer: "A property's market value is what someone will pay today for one like yours. The practical way to estimate it is by comparison: find properties in your own neighbourhood with similar size, bedrooms and condition, look at the range of asking prices, and place yours within it based on real condition. For a figure with formal backing, get a valuation from a licensed appraiser.",
    sections: [
      { h2: 'Compare properly: what has to match', bullets: [
        'Area: the same neighbourhood, not the same city. Two neighbouring districts can differ enormously.',
        'Built area and land area, separately.',
        'Bedrooms and bathrooms.',
        'Condition and age: recent work, damp, roof, wiring.',
        'Extras the market actually pays for: parking, garden, pool, security, a lift.',
      ] },
      { h2: 'Adjust for two biases', paras: [
        'First: listings show asking prices, not closing prices. Closings land lower, and the longer a listing has been up, the bigger the gap.',
        'Second: your own property always looks better to you than it does to the market. Look at your house the way someone seeing it for the first time would, and compare it against the photos in listings in your area.',
      ] },
      { h2: 'When you need a formal valuation', paras: [
        'Not for listing. It matters when there is a mortgage involved, an inheritance, a division of assets, or any situation where the value has to hold up to a third party.',
      ] },
      { h2: 'What happens if you list above the market', paras: [
        'A high price does not correct itself: the listing ages, stops appearing as new, and anyone who sees it repeatedly assumes something is wrong. Cutting the price later works worse than pricing it right in the first place.',
      ] },
    ],
    faq: [
      { q: 'How many properties should I compare?', a: 'Five to ten real comparables in your area show you the range. Fewer is anecdote; many more, from different areas, mixes separate markets.' },
      { q: 'Is the municipal assessment the market value?', a: 'No. The fiscal value is used for taxes and usually sits well below the market price.' },
      { q: 'Should I list with a price or "on request"?', a: 'With a price. Listings without one get fewer serious enquiries and never appear when someone filters by budget, which is how most people search.' },
    ],
  },
  'vender-sin-inmobiliaria': {
    h1: 'Selling without an agency: what you do and what you don’t',
    answer: 'You can sell on your own: list the property, handle enquiries, show it and agree the price. What does not change is that the transfer is signed before a notary, and that the deposit agreement is best drafted by a professional. An agency brings reach, filtering of buyers and management of the negotiation, and charges a commission for it.',
    sections: [
      { h2: 'What you can comfortably do yourself', bullets: [
        'Take daylight photos and publish the listing.',
        'Answer enquiries on WhatsApp and arrange viewings.',
        'Show the property and answer questions about the area, the running costs and the services.',
        'Negotiate the price.',
      ] },
      { h2: 'What to delegate', bullets: [
        'Drafting the sale agreement and the deposit terms.',
        'Verifying the title and certificates — that is the notary’s job.',
        'The deed and its registration.',
      ] },
      { h2: 'Practical safeguards', paras: [
        'Do not hand over keys or sign documents for a cash deposit without a receipt. Always ask for proof of transfer and record every payment in writing.',
        'If someone offers to pay up front on unusual terms, or insists on signing outside a notary’s office, stop. The common scam in private sales is not sophisticated: it runs on urgency.',
        'Publish one listing properly rather than five half-done. A listing with bad photos repeated five times is still a listing with bad photos.',
      ] },
      { h2: 'And if you do want an agency?', paras: [
        'It is a decision about time, not principle. If you cannot take viewings during working hours, or the property is in another city, the commission buys availability. On Casa Libre both coexist: agency listings and private-owner listings, on the same map.',
      ] },
    ],
    faq: [
      { q: 'Is it legal to sell without an agency?', a: 'Yes. There is no obligation to use an intermediary; the sale is formalised before a notary exactly as any other.' },
      { q: 'How much does an agency charge?', a: 'A percentage of the sale price, which varies by agreement and by market. Get the percentage and the terms in writing before signing any exclusivity.' },
      { q: 'Does listing privately reach fewer people?', a: 'It depends where you list. What limits reach is not being a private seller — it is a listing without photos, without a location or without a price.' },
    ],
  },
  'documentos-para-vender-un-inmueble': {
    h1: 'What documents you need to sell a property',
    answer: 'To sell you need the title deed registered in your name, your identity document, the property’s cadastral details, and the certificates the notary requires: registry status, property tax and utilities clear. If the property is in probate, has several owners or an active mortgage, that is resolved before the deed.',
    sections: [
      { h2: 'What to gather', bullets: [
        'Title deed and registry number.',
        'Identity documents for every owner (and the spouse where applicable).',
        'Cadastral details for the property.',
        'Property tax receipts, up to date.',
        'Utilities (water, electricity) with no outstanding debt.',
        'If there is a mortgage: the outstanding balance and the terms for discharging it.',
      ] },
      { h2: 'What the notary requests', paras: [
        'The notary obtains the registry and municipal certificates that prove the property is free of attachments, mortgages or other restrictions, and that the details match the registry. That process is what sets the real timeline to signing.',
      ] },
      { h2: 'Cases to resolve first', paras: [
        'Unfinished probate: no deed can be signed until the heirs are registered as owners. Co-owners: everyone signs, or one with sufficient power of attorney. Differences between what is built and what is registered: if you extended the property without regularising it, it shows up in the process and stalls the sale.',
      ] },
    ],
    faq: [
      { q: 'Can I sell if the title is in a deceased relative’s name?', a: 'Not until probate is complete and the heirs are registered. Start that before listing, because it is the longest step.' },
      { q: 'What if I built without a permit?', a: 'The gap between what is registered and what is built appears in the certificates. Regularise it beforehand, or agree it explicitly with the buyer.' },
      { q: 'Do I need the deed to publish a listing?', a: 'Not to publish. To sign, yes: without a clean title the transaction does not complete.' },
    ],
  },
  'como-alquilar-mi-propiedad': {
    h1: 'How to rent out your property: contract, guarantee and deposit',
    answer: 'To rent out your property you need a price in line with the area, a listing with photos and a location, a tenant with proof they can pay — a guarantee or a guarantor — and a written contract setting the term, the rent, increases, the deposit and who pays each utility. Record the condition of the property at move-in and move-out: that is where nearly every dispute starts.',
    sections: [
      { h2: 'Price it against the area', paras: [
        `Rent compares the same way sales do: same neighbourhood, type, size and condition. Between neighbouring districts the difference can be tens of percent, so compare narrowly.`,
        'An empty month costs more than a small price difference: if two or three weeks pass without serious enquiries, the price is above the market.',
      ] },
      { h2: 'Choosing a tenant', bullets: [
        'Ask for identification and proof of income.',
        'Ask for references from the previous tenancy if there are any.',
        'Decide in advance what security you accept: a guarantor, a property guarantee, or a larger deposit.',
      ] },
      { h2: 'The contract: what cannot be missing', bullets: [
        'Term and start date.',
        'Amount, payment date and method.',
        'How and when the rent is adjusted.',
        'Deposit: how much, what it covers, how it is returned.',
        'Who pays each utility, and building charges if any.',
        'Which repairs fall to each party.',
        'What happens if either party ends the contract early.',
      ] },
      { h2: 'Inventory and condition', paras: [
        'Before handing over the keys, photograph every room and write down what furniture and appliances stay and in what condition. Repeat it at the end. Without that record, any argument about the deposit is one word against another.',
      ] },
    ],
    faq: [
      { q: 'How much deposit can be asked for?', a: 'It is agreed between the parties; one or two months is usual, higher when the property is furnished.' },
      { q: 'Does the contract have to be notarised?', a: 'Not required for a tenancy, but a written contract signed by both parties is essential. For long terms or high amounts, certified signatures add protection.' },
      { q: 'Can I rent it out without an agency?', a: 'Yes. You list it, show it and sign the contract directly. What you should not skip is the guarantee and the inventory.' },
    ],
  },
  'gastos-al-comprar-una-casa': {
    h1: 'Costs and taxes when buying a house',
    answer: `Beyond the price, buying a property in ${c} adds the notary, registry inscription, the municipal transfer tax and the prior certificates. Budget an extra percentage on top of the property value, and considerably more if you are buying with a mortgage. Ask your notary for a quote before signing the deposit.`,
    sections: [
      { h2: 'What gets added to the price', table: {
        head: ['Item', 'Usually paid by', 'Note'],
        rows: [
          ['Notary fees', 'Typically split', 'Sliding scale by value'],
          ['Registry inscription', 'Buyer', 'On the transaction value'],
          ['Municipal transfer tax', 'By agreement', 'Varies by municipality'],
          ['Prior certificates', 'Seller, generally', 'Obtained by the notary'],
          ['Mortgage costs', 'Buyer', 'Valuation, insurance and the mortgage deed'],
        ],
      } },
      { h2: 'If you are buying with a mortgage', paras: [
        'A mortgage adds a valuation, insurance and the mortgage deed, which is a separate act from the sale. It also stretches the timeline: the bank runs its own check on the title.',
      ] },
      { h2: 'How to avoid surprises', bullets: [
        'Get the notary’s quote before signing the deposit, not after.',
        'Put in the agreement who pays each item.',
        'Check there are no outstanding property taxes or utility bills.',
        'Keep a margin for moving costs and initial repairs.',
      ] },
    ],
    faq: [
      { q: 'How much should I budget beyond the price?', a: 'It depends on the value and whether there is a mortgage. Get the notary quote and add inscription and transfer tax; those three give you the real total.' },
      { q: 'Can a foreigner buy property?', a: 'Generally yes, with requirements that depend on the country and where the property is. Check with your notary before paying a deposit.' },
      { q: 'Can the price be paid in dollars?', a: 'Agreeing the price in dollars is common, shown in the deed alongside the local-currency equivalent. Payment terms are agreed between the parties.' },
    ],
  },
  'comprar-primera-casa': {
    h1: 'How to buy your first home: steps and checklist',
    answer: 'Buying a first home is five steps: work out what you can really afford including the transfer costs, search by area on the map, visit with a checklist, have a notary verify the title before paying any deposit, and sign the deed. The order matters: verification comes before the deposit, not after.',
    sections: [
      { h2: '1. What you can actually afford', paras: [
        'Add the transfer costs to the price, plus valuation and insurance if there is a mortgage. Subtract what you will need for moving and repairs: almost no home is occupied without spending something in the first month.',
      ] },
      { h2: '2. Search by area, not by list', paras: [
        'Most buyers already know roughly where they want to live. Searching on the map and moving across the neighbourhoods you care about is faster than scrolling a general list, and it shows you the real price range street by street.',
      ] },
      { h2: '3. What to look at during a viewing', bullets: [
        'Damp on lower walls and ceilings.',
        'Water pressure and the state of the wiring.',
        'Orientation and natural light at different times of day.',
        'Noise from the surroundings at peak hours.',
        'Access, transport and what is nearby.',
      ] },
      { h2: '4. Verify before you pay a deposit', paras: [
        'Before handing over money, have a notary check the title, the registry entry and the property’s status. That is the only way to know whether there are attachments, mortgages or differences between what is registered and what is built. Paying first and checking later is the expensive mistake.',
      ] },
      { h2: '5. Deposit, deed and handover', paras: [
        'The sale agreement with a deposit fixes the price, the deadline and the terms. The notary then gathers the certificates, drafts the deed and it gets signed. The handover of keys is set in the same document: make it explicit.',
      ] },
    ],
    faq: [
      { q: 'Is it better to buy or keep renting?', a: 'It depends how long you plan to stay and the gap between a mortgage payment and rent in your area. If the horizon is only a few years, the costs of buying and selling weigh heavily.' },
      { q: 'How long does the process take?', a: '30 to 60 days from deposit to signing, longer if there is a mortgage involved.' },
      { q: 'Can I negotiate the listed price?', a: 'Yes, it is normal. Come with comparables from the area: a reasoned offer negotiates better than a number on its own.' },
    ],
  },
};

export const guideEn = (slug) => GUIDES_EN[slug] || null;
