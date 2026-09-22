// Answer pages (/guias) — the content Google and the AI engines quote.
//
// Why these exist: searching "cómo vender mi casa" in Spanish returns dead
// marketplaces and competitor blogs, because they wrote the page and we didn't.
// The engines lift whoever answered the question, so each guide leads with a
// short, quotable answer, then the detail, then an FAQ block (mirrored into
// FAQPage schema), and links into the matrix/listing pages.
//
// Written in Spanish on purpose: these target local-language searches.
//
// NOTE ON FIGURES: fee/tax ranges below are the commonly published ones and are
// presented as approximations that the reader must confirm with their notary.
// Have a notary verify them once and the hedging can be replaced by exact
// numbers plus a "verificado por…" line (a trust signal the competing pages lack).
import { COUNTRY } from './country';

export const UPDATED = '2026-09-23';

const c = COUNTRY.name;
const cap = COUNTRY.capital;
const cur = COUNTRY.currencyName;
// The notary's title differs by country: escribano (PY/UY) vs notario (BO/VE).
const esc = COUNTRY.notary || `${esc}`;

export const GUIDES = [
  {
    slug: 'como-vender-mi-casa',
    h1: `Cómo vender tu casa en ${c}: guía paso a paso`,
    title: `Cómo vender tu casa en ${c} — guía paso a paso 2026`,
    description: `Cómo vender una casa en ${c}: preparar la propiedad, ponerle precio, publicarla gratis, mostrarla, negociar la seña y firmar la escritura ante ${esc}.`,
    answer: `Para vender tu casa en ${c} necesitás cuatro cosas: el título de propiedad en regla, un precio de referencia basado en propiedades parecidas de tu zona, un aviso con fotos reales y ubicación en el mapa, y un ${esc} para la escritura. Publicar el aviso es gratis y podés hacerlo vos mismo; la transferencia siempre se firma ante ${esc} público.`,
    sections: [
      { h2: 'Antes de publicar: revisá los papeles', paras: [
        'El punto que más demoras genera no es el precio, es la documentación. Antes de publicar, confirmá que el inmueble esté inscripto a tu nombre en el Registro de la Propiedad, que la matrícula y los datos catastrales coincidan con la realidad, y que no haya deudas de impuesto inmobiliario ni de servicios.',
        'Si la propiedad viene de una sucesión, si hay más de un titular o si todavía figura una hipoteca, resolvé eso primero: son las tres causas habituales de una venta que se cae después de acordar el precio.',
      ] },
      { h2: 'Cómo ponerle precio', paras: [
        'La referencia más honesta es lo que piden hoy propiedades parecidas a la tuya: mismo barrio, metros cuadrados similares, misma cantidad de dormitorios y estado equivalente. Ese rango lo ves filtrando el mapa por tu zona.',
        'Dos correcciones que conviene hacer: los avisos muestran el precio pedido, no el precio de cierre, que suele quedar algo por debajo; y el estado real —cocina, baños, techos, humedad— mueve el valor más que los metros.',
        'Si necesitás un número con respaldo, por ejemplo para una sucesión o un crédito, pedí una tasación a un profesional matriculado.',
      ] },
      { h2: 'Publicá el aviso', paras: [
        'Un aviso que funciona tiene entre ocho y quince fotos con luz de día, la ubicación marcada en el mapa, los metros cuadrados reales, y una descripción que dice lo que hay sin adornos. La primera foto decide si alguien abre el aviso.',
        `En Casa Libre publicar es gratis, sin comisión y sin planes: el aviso queda visible en el marketplace y en el mapa apenas lo publicás, junto a las propiedades de inmobiliarias y de otros dueños particulares de ${c}.`,
      ] },
      { h2: 'Mostrar la propiedad y negociar', paras: [
        'Agrupá las visitas en pocos horarios, pedí el nombre completo de quien visita y mostrá vos la casa si podés: nadie conoce los detalles mejor que el propietario.',
        `Cuando llega una oferta, lo habitual es firmar un acuerdo de compraventa con una seña, que reserva la propiedad y fija plazo, forma de pago y qué pasa si una de las partes se arrepiente. Ese documento conviene que lo redacte un ${esc} o un abogado, aunque la firma final sea más adelante.`,
      ] },
      { h2: 'La escritura', paras: [
        `La transferencia se hace por escritura pública ante ${esc}. El ${esc} verifica el título, pide los certificados registrales, catastrales y municipales, redacta la escritura, toma las firmas e inscribe la transferencia en el Registro.`,
        'Entre la seña y la firma suelen pasar entre treinta y sesenta días, según cuánto tarden los certificados. Los costos y quién paga cada parte se detallan en la guía de impuestos y gastos.',
      ] },
    ],
    faq: [
      { q: '¿Puedo vender mi casa sin inmobiliaria?', a: `Sí. Podés publicar el aviso, mostrar la propiedad y negociar vos mismo. Lo que no podés evitar es el ${esc}: la transferencia de un inmueble se hace siempre por escritura pública.` },
      { q: '¿Cuánto tarda vender una casa?', a: `Depende del precio y de la zona. Lo que sí es previsible es el tramo final: desde que hay acuerdo hasta la firma suelen pasar entre 30 y 60 días por los certificados que pide el ${esc}.` },
      { q: '¿Qué gastos paga el vendedor?', a: `Normalmente una parte de la escritura y los impuestos que correspondan a la venta. Los porcentajes cambian según el caso; confirmalos con tu ${esc} antes de acordar el precio final.` },
      { q: '¿Necesito tasación para publicar?', a: 'No. Para publicar alcanza con un precio de referencia basado en propiedades comparables. La tasación formal se usa cuando hace falta un valor con respaldo, por ejemplo para un crédito o una sucesión.' },
    ],
    related: [['venta', 'casas'], ['venta', 'departamentos'], ['alquiler', 'casas']],
  },
  {
    slug: 'impuestos-y-gastos-al-vender',
    h1: `Qué impuestos y gastos paga el vendedor en ${c}`,
    title: `Impuestos y gastos al vender una propiedad en ${c}`,
    description: `Qué paga el vendedor de un inmueble en ${c}: honorarios del ${esc}, inscripción registral, impuesto municipal de transferencia e impuestos sobre la venta.`,
    answer: `Al vender un inmueble en ${c} los costos habituales son los honorarios del ${esc}, la tasa de inscripción en el Registro, el impuesto municipal de transferencia y los impuestos que gravan la operación. En la práctica comprador y vendedor suelen repartirse la escritura, y el total ronda un porcentaje bajo de un dígito sobre el valor de venta. Los porcentajes exactos dependen del monto y del caso: confirmalos con tu ${esc}.`,
    sections: [
      { h2: 'Qué se paga en una venta', paras: [
        `Conviene separar tres cosas: los honorarios profesionales (${esc}), las tasas del Estado (inscripción registral, impuesto municipal de transferencia) y los impuestos que gravan la ganancia o la operación.`,
      ], table: {
        head: ['Concepto', 'Quién lo paga habitualmente', 'Orden de magnitud'],
        rows: [
          [`Honorarios del ${esc}`, 'Suele repartirse entre comprador y vendedor', 'Un porcentaje del valor, decreciente según el monto'],
          ['Inscripción en el Registro', 'Comprador, salvo acuerdo distinto', 'Menos del 1% del valor'],
          ['Impuesto municipal de transferencia', 'Según la municipalidad y lo acordado', 'Fracción de punto porcentual'],
          ['Impuestos sobre la venta', 'Vendedor', 'Depende del régimen y del caso'],
          ['Certificados y trámites previos', 'Vendedor', 'Monto fijo, menor'],
        ],
      } },
      { h2: 'Por qué no hay un número único', paras: [
        `Los honorarios de oficina de ${esc} se calculan por escalas: cuanto mayor el valor de la propiedad, menor el porcentaje. Las tasas municipales cambian según dónde esté el inmueble. Y la carga impositiva depende de si quien vende es una persona física o una empresa, y de cómo se computa la operación.`,
        `Por eso la única cifra confiable es un presupuesto. Pedilo a dos o tres oficinas de ${esc} antes de cerrar el precio: los honorarios son negociables y la diferencia entre presupuestos suele ser real.`,
      ] },
      { h2: 'Qué acordar por escrito antes de firmar', bullets: [
        'Quién paga cada concepto, especialmente la escritura.',
        'Qué pasa si aparece una deuda o una observación en el título.',
        'El plazo máximo para firmar y qué sucede si se vence.',
        'Cómo y cuándo se entrega la posesión del inmueble.',
      ] },
    ],
    faq: [
      { q: '¿El vendedor o el comprador paga la escritura?', a: 'Es negociable y se pacta en el acuerdo de compraventa. Lo más común es repartirla, pero conviene dejarlo por escrito antes de la seña.' },
      { q: `¿Cuánto cobra un ${esc}?`, a: `Por escalas: el porcentaje baja a medida que sube el valor de la propiedad, más el IVA correspondiente. Pedí presupuesto a dos o tres oficinas de ${esc} y compará.` },
      { q: '¿Se puede vender con deudas de impuesto inmobiliario?', a: `El ${esc} va a exigir los certificados al día antes de escriturar, así que en la práctica las deudas se cancelan durante el proceso, normalmente descontándolas del precio.` },
    ],
    related: [['venta', 'casas'], ['venta', 'departamentos'], ['venta', 'terrenos']],
  },
  {
    slug: 'cuanto-vale-mi-propiedad',
    h1: 'Cuánto vale mi propiedad y cómo ponerle precio',
    title: `Cuánto vale mi propiedad en ${c} y cómo ponerle precio`,
    description: `Cómo estimar el precio de tu casa o departamento en ${c} comparando propiedades similares, qué ajusta el valor y cuándo conviene una tasación profesional.`,
    answer: 'El valor de mercado de una propiedad es lo que alguien está dispuesto a pagar hoy por una parecida a la tuya. La forma práctica de estimarlo es comparar: buscá en tu mismo barrio propiedades con metros, dormitorios y estado similares, mirá el rango de precios pedidos y ubicate dentro de él según el estado real de la tuya. Para un valor con respaldo formal, pedí una tasación a un profesional matriculado.',
    sections: [
      { h2: 'Compará bien: qué tiene que coincidir', bullets: [
        'Zona: el mismo barrio, no la misma ciudad. La diferencia entre dos barrios vecinos puede ser enorme.',
        'Superficie cubierta y terreno, por separado.',
        'Dormitorios y baños.',
        'Estado y antigüedad: refacciones recientes, humedad, techos, instalación eléctrica.',
        'Extras que el mercado paga: cochera, patio, piscina, seguridad, ascensor.',
      ] },
      { h2: 'Ajustá por dos sesgos', paras: [
        'Primero: los avisos muestran precio pedido, no precio de cierre. El cierre suele quedar por debajo, y cuanto más tiempo lleva publicado un aviso, mayor la diferencia.',
        'Segundo: la propiedad propia siempre parece mejor de lo que el mercado ve. Mirá tu casa como la vería alguien que entra por primera vez y compará contra las fotos de los avisos de tu zona.',
      ] },
      { h2: 'Cuándo necesitás una tasación formal', paras: [
        'Para publicar no hace falta. Sí conviene cuando hay un crédito hipotecario de por medio, una sucesión, una división de bienes o cualquier situación donde el valor tenga que sostenerse ante un tercero.',
      ] },
      { h2: 'Qué pasa si publicás por encima del mercado', paras: [
        'Un precio alto no se corrige solo: el aviso acumula tiempo, deja de aparecer como novedad y quien lo ve varias veces asume que algo no cierra. Bajar el precio después funciona peor que haber publicado bien desde el principio.',
      ] },
    ],
    faq: [
      { q: '¿Cuántas propiedades tengo que comparar?', a: 'Con cinco a diez comparables reales de tu zona ya ves el rango. Menos que eso es anécdota; muchas más, de zonas distintas, mezclan mercados diferentes.' },
      { q: '¿La tasación municipal sirve como valor de mercado?', a: 'No. El valor fiscal se usa para impuestos y suele estar muy por debajo del precio de mercado.' },
      { q: '¿Conviene publicar con precio o "a consultar"?', a: 'Con precio. Los avisos sin precio reciben menos consultas serias y no aparecen cuando alguien filtra por presupuesto, que es como busca la mayoría.' },
    ],
    related: [['venta', 'casas'], ['venta', 'departamentos']],
  },
  {
    slug: 'vender-sin-inmobiliaria',
    h1: 'Vender sin inmobiliaria: qué hacés vos y qué no',
    title: `Vender una propiedad sin inmobiliaria en ${c}`,
    description: `Qué podés hacer por tu cuenta al vender tu propiedad en ${c}, qué sigue necesitando un profesional, y los cuidados para no equivocarte con la seña ni con el pago.`,
    answer: `Podés vender por tu cuenta: publicar el aviso, atender consultas, mostrar la propiedad y acordar el precio. Lo que no cambia es que la transferencia se firma ante ${esc}, y que conviene que el acuerdo de seña lo redacte un profesional. La inmobiliaria aporta difusión, filtro de interesados y manejo de la negociación, y cobra comisión por eso.`,
    sections: [
      { h2: 'Lo que hacés vos sin problema', bullets: [
        'Sacar fotos con luz de día y publicar el aviso.',
        'Responder consultas por WhatsApp y coordinar visitas.',
        'Mostrar la propiedad y contestar preguntas sobre el barrio, los gastos y los servicios.',
        'Negociar el precio.',
      ] },
      { h2: 'Lo que conviene delegar', bullets: [
        'La redacción del acuerdo de compraventa y de la seña.',
        `La verificación del título y los certificados: eso lo hace el ${esc}.`,
        'La escritura y la inscripción en el Registro.',
      ] },
      { h2: 'Cuidados prácticos', paras: [
        'No entregues llaves ni firmes documentos por una seña en efectivo sin recibo. Pedí siempre comprobante de la transferencia y dejá constancia escrita de cada pago.',
        `Si alguien te ofrece pagar por adelantado con condiciones raras, o insiste en firmar fuera de oficina de ${esc}, frená. La estafa habitual en venta particular no es sofisticada: se apoya en el apuro.`,
        'Publicá el mismo aviso en un solo lugar bien hecho antes que en cinco a medias. Un aviso con fotos malas repetido cinco veces sigue siendo un aviso con fotos malas.',
      ] },
      { h2: '¿Y si igual querés una inmobiliaria?', paras: [
        'Es una decisión de tiempo, no de moral. Si no podés atender visitas en horario laboral, o la propiedad está en otra ciudad, la comisión compra disponibilidad. En Casa Libre conviven las dos: avisos de inmobiliarias y de dueños particulares, en el mismo mapa.',
      ] },
    ],
    faq: [
      { q: '¿Es legal vender sin inmobiliaria?', a: `Sí. No hay obligación de intermediar; la operación se formaliza ante ${esc} igual que cualquier otra.` },
      { q: '¿Cuánto cobra una inmobiliaria?', a: 'Un porcentaje del precio de venta, que varía por acuerdo y por plaza. Pedí el porcentaje y las condiciones por escrito antes de firmar exclusividad.' },
      { q: '¿Publicar por mi cuenta llega a menos gente?', a: 'Depende de dónde publiques. Lo que reduce el alcance no es ser particular, es un aviso sin fotos, sin ubicación o sin precio.' },
    ],
    related: [['venta', 'casas'], ['venta', 'departamentos']],
  },
  {
    slug: 'documentos-para-vender-un-inmueble',
    h1: 'Qué documentos necesitás para vender un inmueble',
    title: `Documentos para vender un inmueble en ${c}`,
    description: `Lista de documentos para vender una casa, departamento o terreno en ${c}: título, cédula, certificados registrales y catastrales, y comprobantes al día.`,
    answer: `Para vender necesitás el título de propiedad inscripto a tu nombre, tu documento de identidad, los datos catastrales del inmueble y los certificados y comprobantes que pide el ${esc}: situación registral, deudas de impuesto inmobiliario y servicios al día. Si la propiedad está en sucesión, tiene varios titulares o una hipoteca vigente, eso se resuelve antes de escriturar.`,
    sections: [
      { h2: 'Lo que tenés que reunir', bullets: [
        'Título de propiedad y número de matrícula.',
        'Documento de identidad de todos los titulares (y del cónyuge cuando corresponda).',
        'Datos catastrales del inmueble.',
        'Comprobantes de impuesto inmobiliario al día.',
        'Servicios (agua, electricidad) sin deuda.',
        'Si hay hipoteca: constancia del saldo y condiciones de levantamiento.',
      ] },
      { h2: `Lo que pide el ${esc}`, paras: [
        `El ${esc} solicita los certificados registrales y municipales que acreditan que el inmueble está libre de embargos, hipotecas u otras restricciones, y que los datos coinciden con el Registro. Ese trámite es el que marca el plazo real hasta la firma.`,
      ] },
      { h2: 'Casos que conviene resolver antes', paras: [
        'Sucesión no terminada: no se puede escriturar hasta que los herederos figuren como titulares. Copropietarios: firman todos, o uno con poder suficiente. Diferencias entre lo construido y lo registrado: si ampliaste sin regularizar, aparece en el trámite y frena la operación.',
      ] },
    ],
    faq: [
      { q: '¿Puedo vender si el título está a nombre de un familiar fallecido?', a: 'No hasta que se complete la sucesión y los herederos queden inscriptos. Empezá ese trámite antes de publicar, porque es el que más tiempo lleva.' },
      { q: '¿Qué pasa si construí sin permiso?', a: 'La diferencia entre lo registrado y lo construido aparece en los certificados. Conviene regularizarla antes o acordarla explícitamente con el comprador.' },
      { q: '¿Necesito escritura para publicar el aviso?', a: 'Para publicar, no. Para escriturar, sí: sin título en regla la operación no se completa.' },
    ],
    related: [['venta', 'casas'], ['venta', 'terrenos']],
  },
  {
    slug: 'como-alquilar-mi-propiedad',
    h1: 'Cómo alquilar tu propiedad: contrato, garantía y depósito',
    title: `Cómo alquilar tu propiedad en ${c}: contrato, garantía y depósito`,
    description: `Cómo alquilar tu casa o departamento en ${c}: fijar el precio, elegir inquilino, qué garantías se piden y qué cláusulas no pueden faltar en el contrato.`,
    answer: 'Para alquilar tu propiedad necesitás un precio acorde a la zona, un aviso con fotos y ubicación, un inquilino con respaldo de pago —garantía o fiador— y un contrato escrito que fije plazo, monto, ajustes, depósito y quién paga cada servicio. Documentá el estado del inmueble al entrar y al salir: ahí se originan casi todos los conflictos.',
    sections: [
      { h2: 'Poné el precio mirando la zona', paras: [
        `El alquiler se compara igual que la venta: mismo barrio, tipo, metros y estado. En ${cap} la diferencia entre barrios vecinos puede ser de decenas de por ciento, así que compará fino.`,
        'Un mes vacío cuesta más que una diferencia de precio pequeña: si en dos o tres semanas no hay consultas serias, el precio está por encima del mercado.',
      ] },
      { h2: 'Elegir inquilino', bullets: [
        'Pedí identificación y comprobante de ingresos.',
        'Pedí referencias del alquiler anterior si las hay.',
        'Definí antes qué garantía aceptás: fiador, garantía inmobiliaria o depósito ampliado.',
      ] },
      { h2: 'El contrato: lo que no puede faltar', bullets: [
        'Plazo y fecha de inicio.',
        'Monto, día de pago y forma de pago.',
        'Cómo y cuándo se ajusta el monto.',
        'Depósito: cuánto, qué cubre y cómo se devuelve.',
        'Quién paga cada servicio y las expensas si las hay.',
        'Qué reparaciones corresponden a cada parte.',
        'Qué pasa si alguna parte termina el contrato antes.',
      ] },
      { h2: 'Inventario y estado', paras: [
        'Antes de entregar las llaves, tomá fotos de cada ambiente y dejá por escrito qué muebles y artefactos quedan y en qué estado. Repetí lo mismo al finalizar. Sin ese registro, la discusión por el depósito es palabra contra palabra.',
      ] },
    ],
    faq: [
      { q: '¿Cuánto depósito se puede pedir?', a: 'Se pacta entre las partes; lo habitual es el equivalente a uno o dos meses, más alto cuando la propiedad se entrega amoblada.' },
      { q: `¿El contrato tiene que hacerse ante ${esc}?`, a: 'No es obligatorio para alquilar, pero un contrato escrito y firmado por ambas partes es imprescindible. Para plazos largos o montos altos, la certificación de firmas da respaldo.' },
      { q: '¿Puedo alquilar sin inmobiliaria?', a: 'Sí. Publicás el aviso, mostrás la propiedad y firmás el contrato directamente. Lo que no conviene saltear es la garantía y el inventario.' },
    ],
    related: [['alquiler', 'departamentos'], ['alquiler', 'casas']],
  },
  {
    slug: 'gastos-al-comprar-una-casa',
    h1: 'Gastos e impuestos al comprar una casa',
    title: `Gastos e impuestos al comprar una casa en ${c}`,
    description: `Qué se paga además del precio al comprar un inmueble en ${c}: oficina de ${esc}, inscripción registral, impuesto de transferencia, certificados y gastos de crédito.`,
    answer: `Además del precio, comprar un inmueble en ${c} suma oficina de ${esc}, inscripción en el Registro, el impuesto municipal de transferencia y los certificados previos. En conjunto conviene presupuestar un porcentaje adicional sobre el valor de la propiedad, y bastante más si comprás con crédito hipotecario. Pedí presupuesto a tu ${esc} antes de firmar la seña.`,
    sections: [
      { h2: 'Qué se suma al precio', table: {
        head: ['Concepto', 'Quién lo paga habitualmente', 'Comentario'],
        rows: [
          [`Honorarios de oficina de ${esc}`, 'Suele repartirse', 'Escalas decrecientes según el valor'],
          ['Inscripción registral', 'Comprador', 'Sobre el valor de la operación'],
          ['Impuesto municipal de transferencia', 'Según acuerdo', 'Varía por municipalidad'],
          ['Certificados previos', 'Vendedor, en general', `Los tramita el ${esc}`],
          ['Gastos de crédito hipotecario', 'Comprador', 'Tasación, seguros y constitución de la hipoteca'],
        ],
      } },
      { h2: 'Si comprás con crédito', paras: [
        'El crédito agrega tasación, seguros y la escritura de hipoteca, que es un acto aparte de la compraventa. También alarga los plazos: el banco pide su propia verificación del título.',
      ] },
      { h2: 'Cómo evitar sorpresas', bullets: [
        `Pedí presupuesto de oficina de ${esc} antes de firmar la seña, no después.`,
        'Dejá escrito en el acuerdo quién paga cada concepto.',
        'Verificá que no haya deudas de impuesto inmobiliario ni servicios.',
        'Reservá un margen para gastos de mudanza y arreglos iniciales.',
      ] },
    ],
    faq: [
      { q: '¿Cuánto hay que presupuestar además del precio?', a: `Depende del valor y de si hay crédito. Pedí presupuesto de oficina de ${esc} y sumá inscripción e impuesto de transferencia; con esos tres números tenés el total real.` },
      { q: '¿Puede un extranjero comprar propiedad?', a: `En general sí, con requisitos que dependen del país y de la ubicación del inmueble. Consultalo con tu ${esc} antes de señar.` },
      { q: '¿Se puede pagar en dólares?', a: `Es habitual acordar el precio en dólares y reflejarlo en la escritura junto al equivalente en ${cur}. La forma de pago se pacta entre las partes.` },
    ],
    related: [['venta', 'casas'], ['venta', 'departamentos']],
  },
  {
    slug: 'comprar-primera-casa',
    h1: 'Cómo comprar tu primera casa: pasos y checklist',
    title: `Cómo comprar tu primera casa en ${c}: pasos y checklist`,
    description: `Guía para comprar tu primera casa en ${c}: cuánto podés pagar, cómo buscar, qué mirar en la visita, cómo verificar el título y cómo se cierra la operación.`,
    answer: `Comprar tu primera casa son cinco pasos: definir cuánto podés pagar sumando los gastos de escrituración, buscar por zona en el mapa, visitar con una lista de control, verificar el título con un ${esc} antes de señar, y firmar la escritura. El orden importa: la verificación va antes de la seña, no después.`,
    sections: [
      { h2: '1. Cuánto podés pagar de verdad', paras: [
        'Al precio sumale los gastos de escrituración y, si hay crédito, tasación y seguros. Restá de tu presupuesto lo que vas a necesitar para mudanza y arreglos: casi ninguna casa se ocupa sin gastar algo el primer mes.',
      ] },
      { h2: '2. Buscar por zona, no por lista', paras: [
        'La mayoría de los compradores ya sabe en qué zona quiere vivir. Buscar en el mapa y mover la vista sobre los barrios que te interesan es más rápido que recorrer una lista general, y te muestra el rango de precios real de cada cuadra.',
      ] },
      { h2: '3. Qué mirar en la visita', bullets: [
        'Humedad en paredes bajas y techos.',
        'Presión de agua y estado de la instalación eléctrica.',
        'Orientación y luz natural a distintas horas.',
        'Ruido del entorno en horario pico.',
        'Accesos, transporte y qué hay alrededor.',
      ] },
      { h2: '4. Verificá antes de señar', paras: [
        `Antes de entregar dinero, pedí a un ${esc} que revise el título, la matrícula y la situación registral. Es la única forma de saber si hay embargos, hipotecas o diferencias entre lo registrado y lo construido. Señar primero y verificar después es el error caro.`,
      ] },
      { h2: '5. Seña, escritura y entrega', paras: [
        `El acuerdo de compraventa con seña fija precio, plazo y condiciones. Después el ${esc} reúne los certificados, redacta la escritura y se firma. La entrega de llaves se pacta en el mismo documento: dejalo explícito.`,
      ] },
    ],
    faq: [
      { q: '¿Conviene comprar o seguir alquilando?', a: 'Depende de cuánto pensás quedarte y de la diferencia entre la cuota y el alquiler en tu zona. Si el horizonte es menor a unos pocos años, los gastos de compra y venta pesan mucho.' },
      { q: '¿Cuánto tarda la operación?', a: 'Desde la seña hasta la firma suelen pasar entre 30 y 60 días, más si hay crédito de por medio.' },
      { q: '¿Puedo negociar el precio publicado?', a: 'Sí, es lo habitual. Llegá con comparables de la zona: una oferta fundamentada se negocia mejor que una cifra suelta.' },
    ],
    related: [['venta', 'casas'], ['venta', 'departamentos'], ['alquiler', 'departamentos']],
  },
];

export const getGuide = (slug) => GUIDES.find((g) => g.slug === slug) || null;
export const guideSlugs = () => GUIDES.map((g) => g.slug);
