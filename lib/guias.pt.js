// Portuguese (pt-BR) versions of the /guias answer pages, keyed by slug.
//
// Same idea as lib/guias.en.js: the Spanish copy (lib/guias.js) is what the server
// renders and crawlers index; this only feeds the site's PT toggle on those URLs.
import { COUNTRY, COUNTRY_PT } from './country';

const c = COUNTRY.name;

export const GUIDES_PT = {
  'como-vender-mi-casa': {
    h1: `Como vender seu imóvel ${COUNTRY_PT.in}: um guia passo a passo`,
    answer: `Vender um imóvel ${COUNTRY_PT.in} exige quatro coisas: a escritura em ordem, um preço de referência baseado em imóveis comparáveis na sua região, um anúncio com fotos reais e um pin no mapa, e um tabelião para a escritura. O anúncio é gratuito e você pode fazer tudo sozinho; a transferência é sempre assinada perante um tabelião público.`,
    sections: [
      { h2: 'Antes de anunciar: verifique a documentação', paras: [
        'O que mais atrasa não é o preço, e sim a documentação. Antes de anunciar, confirme que o imóvel está registrado em seu nome, que os dados do registro e cadastrais correspondem à realidade, e que não há impostos imobiliários ou contas de serviços pendentes.',
        'Se o imóvel veio por herança, tem mais de um proprietário ou ainda está hipotecado, resolva isso primeiro: esses são os três motivos mais comuns de uma venda desmoronar depois que o preço foi acertado.',
      ] },
      { h2: 'Definindo o preço', paras: [
        'A referência mais honesta é o que os imóveis comparáveis estão pedindo hoje: mesmo bairro, tamanho similar, mesma quantidade de quartos, condição equivalente. Você pode ver essa faixa filtrando o mapa para a sua área.',
        'Vale a pena fazer duas correções: os anúncios mostram os preços de pedido, não os preços de fechamento, que costumam ser um pouco menores; e a condição real — cozinha, banheiros, telhado, umidade — altera o valor mais do que os metros quadrados.',
        'Se precisar de um valor com respaldo formal, para herança ou hipoteca, solicite uma avaliação de um avaliador licenciado.',
      ] },
      { h2: 'Publique o anúncio', paras: [
        'Um anúncio eficaz tem entre oito e quinze fotos tiradas à luz do dia, a localização marcada no mapa, a área útil real e uma descrição que informa o que há sem exageros. A primeira foto decide se alguém vai abrir o anúncio.',
        `No Casa Libre o anúncio é gratuito, sem comissão e sem planos: ele aparece no marketplace e no mapa no momento em que você publica, ao lado de imóveis de imobiliárias e outros proprietários privados em ${COUNTRY_PT.all}.`,
      ] },
      { h2: 'Visitas e negociação', paras: [
        'Agrupe as visitas em alguns horários, registre o nome completo de todos que comparecem e mostre o imóvel você mesmo, se puder: ninguém conhece os detalhes melhor que o proprietário.',
        'Quando chega uma proposta, o passo usual é um contrato de compra e venda com sinal, que reserva o imóvel e fixa o prazo, as condições de pagamento e o que acontece se alguma das partes desistir. Esse documento deve ser elaborado por um tabelião ou advogado, embora a assinatura final ocorra depois.',
      ] },
      { h2: 'A escritura', paras: [
        'A transferência é feita por escritura pública perante um tabelião, que verifica a escritura, solicita os certificados de registro, cadastrais e municipais, redige a escritura, coleta as assinaturas e registra a transferência.',
        'Normalmente, de trinta a sessenta dias se passam entre o sinal e a assinatura, dependendo do tempo que os certificados levam. Custos e quem paga o quê estão detalhados no guia de impostos e custos.',
      ] },
    ],
    faq: [
      { q: 'Posso vender meu imóvel sem uma imobiliária?', a: 'Sim. Você pode anunciar, mostrar e negociar por conta própria. O que não pode ser pulado é o tabelião: a transferência de um imóvel é sempre feita por escritura pública.' },
      { q: 'Quanto tempo leva para vender um imóvel?', a: 'Depende do preço e da localização. A fase final é previsível: de 30 a 60 dias entre o acordo e a assinatura, devido aos certificados que o tabelião solicita.' },
      { q: 'Quais custos o vendedor paga?', a: 'Normalmente, uma parte da escritura e os impostos que incidem sobre a venda. As porcentagens variam caso a caso; confirme-as com seu tabelião antes de acertar o preço final.' },
      { q: 'Preciso de avaliação para anunciar?', a: 'Não. Um preço de referência baseado em imóveis comparáveis basta para anunciar. Uma avaliação formal é necessária quando o valor precisa ser aceito por terceiros, como um banco.' },
    ],
  },
  'impuestos-y-gastos-al-vender': {
  h1: `Quais impostos e custos o vendedor paga ${COUNTRY_PT.in}`,
  answer: `Vender um imóvel ${COUNTRY_PT.in} normalmente envolve as taxas do tabelião, a taxa de inscrição no registro, o imposto municipal de transferência e os impostos que incidem sobre a transação. Na prática, comprador e vendedor costumam dividir a escritura, e o total chega a um percentual de um dígito baixo sobre o preço de venda. Os percentuais exatos dependem do valor e do caso: confirme-os com o seu tabelião.`,
  sections: [
    {
      h2: 'O que é pago na venda',
      paras: [
        'É útil separar três itens: honorários profissionais (o tabelião), encargos estaduais (inscrição no registro, imposto municipal de transferência) e os impostos que incidem sobre o ganho ou a transação.'
      ],
      table: {
        head: ['Item', 'Normalmente pago por', 'Ordem de grandeza'],
        rows: [
          ['Taxas do tabelião', 'Normalmente divididas entre comprador e vendedor', 'Um percentual do valor, diminuindo com o montante'],
          ['Inscrição no registro', 'Comprador, salvo acordo em contrário', 'Menos de 1% do valor'],
          ['Imposto municipal de transferência', 'Depende do município e do acordo', 'Uma fração de ponto percentual'],
          ['Impostos sobre a venda', 'Vendedor', 'Depende do regime e do caso'],
          ['Certificados e documentação prévia', 'Vendedor', 'Um valor fixo menor']
        ]
      }
    },
    {
      h2: 'Por que não há um número único',
      paras: [
        'As taxas do tabelião são calculadas em escala móvel: quanto maior o valor, menor o percentual. Os encargos municipais variam conforme a localização do imóvel. E a carga tributária depende se o vendedor é pessoa física ou jurídica, e como a transação é tratada.',
        'Portanto, a única estimativa confiável é um orçamento. Obtenha um de dois ou três tabeliães antes de fechar o preço: as taxas são negociáveis e a diferença entre orçamentos é real.'
      ]
    },
    {
      h2: 'O que acordar por escrito antes de assinar',
      bullets: [
        'Quem paga cada item, especialmente a escritura.',
        'O que acontece se surgir uma dívida ou objeção sobre o título.',
        'O prazo para assinatura e o que ocorre se ele for ultrapassado.',
        'Como e quando a posse será entregue.'
      ]
    }
  ],
  faq: [
    {
      q: 'Quem paga a escritura, o vendedor ou o comprador?',
      a: 'É negociável e definido no contrato de compra e venda. Dividir o custo é o mais comum, mas registre por escrito antes do sinal.'
    },
    {
      q: 'Quanto cobra o tabelião?',
      a: 'Em escala móvel: o percentual diminui à medida que o valor do imóvel aumenta, mais o IVA aplicável. Solicite orçamentos de dois ou três tabeliães e compare.'
    },
    {
      q: 'É possível vender um imóvel com impostos em aberto?',
      a: 'O tabelião exigirá certidões limpas antes da escritura, portanto, na prática as dívidas são quitadas durante o processo, geralmente descontadas do preço.'
    }
  ]
},
  'cuanto-vale-mi-propiedad': {
    h1: 'Qual o valor do meu imóvel e como precificá-lo',
    answer: "O valor de mercado de um imóvel é o que alguém pagaria hoje por um semelhante ao seu. A forma prática de estimá-lo é por comparação: encontre imóveis no seu próprio bairro com tamanho, quartos e condição semelhantes, observe a faixa de preços de venda, e posicione o seu dentro dela com base na condição real. Para obter um número com respaldo formal, solicite uma avaliação de um perito licenciado.",
    sections: [
      { h2: 'Compare corretamente: o que deve coincidir', bullets: [
        'Área: o mesmo bairro, não a mesma cidade. Dois distritos vizinhos podem diferir enormemente.',
        'Área construída e área do terreno, separadamente.',
        'Quartos e banheiros.',
        'Condição e idade: reformas recentes, umidade, telhado, fiação.',
        'Extras que o mercado realmente paga: vaga de garagem, jardim, piscina, segurança, elevador.',
      ] },
      { h2: 'Ajuste para dois vieses', paras: [
        'Primeiro: os anúncios mostram preços de pedido, não preços de fechamento. Os fechamentos são mais baixos, e quanto mais tempo o anúncio fica ativo, maior a diferença.',
        'Segundo: seu próprio imóvel sempre parece melhor para você do que para o mercado. Observe sua casa como alguém que a vê pela primeira vez faria, e compare-a com as fotos dos anúncios na sua região.',
      ] },
      { h2: 'Quando você precisa de uma avaliação formal', paras: [
        'Não para anúncio. É importante quando há financiamento, herança, divisão de bens ou qualquer situação em que o valor precise ser reconhecido por terceiros.',
      ] },
      { h2: 'O que acontece se você anunciar acima do mercado', paras: [
        'Um preço alto não se corrige sozinho: o anúncio envelhece, deixa de aparecer como novo, e quem o vê repetidamente assume que algo está errado. Reduzir o preço depois funciona pior do que precificá-lo corretamente desde o início.',
      ] },
    ],
    faq: [
      { q: 'Quantos imóveis devo comparar?', a: 'De cinco a dez comparáveis reais na sua região mostram a faixa. Menos é anedótico; muito mais, de áreas diferentes, mistura mercados distintos.' },
      { q: 'A avaliação municipal é o valor de mercado?', a: 'Não. O valor fiscal é usado para impostos e geralmente fica bem abaixo do preço de mercado.' },
      { q: 'Devo anunciar com preço ou "sob consulta"?', a: 'Com preço. Anúncios sem preço recebem menos consultas sérias e nunca aparecem quando alguém filtra por orçamento, que é como a maioria das pessoas busca.' },
    ],
},
  'vender-sin-inmobiliaria': {
    h1: 'Vendendo sem corretora: o que você faz e o que não faz',
    answer: 'Você pode vender por conta própria: anunciar o imóvel, atender às consultas, mostrá‑lo e acertar o preço. O que não muda é que a transferência deve ser assinada perante um notário, e que o contrato de sinal deve ser elaborado por um profissional. Uma corretora traz alcance, filtragem de compradores e gestão da negociação, e cobra uma comissão por isso.',
    sections: [
      { h2: 'O que você pode fazer confortavelmente por conta própria', bullets: [
        'Tire fotos em luz natural e publique o anúncio.',
        'Responda às consultas pelo WhatsApp e agende visitas.',
        'Mostre o imóvel e responda a perguntas sobre a região, os custos de manutenção e os serviços.',
        'Negocie o preço.',
      ] },
      { h2: 'O que delegar', bullets: [
        'Elaboração do contrato de compra e venda e dos termos do sinal.',
        'Verificação da escritura e dos certificados — essa é a função do notário.',
        'A escritura e seu registro.',
      ] },
      { h2: 'Medidas práticas de segurança', paras: [
        'Não entregue as chaves nem assine documentos por um depósito em dinheiro sem recibo. Sempre peça comprovante de transferência e registre cada pagamento por escrito.',
        'Se alguém oferecer pagamento adiantado em condições incomuns, ou insistir em assinar fora do cartório, pare. O golpe mais comum em vendas particulares não é sofisticado: baseia‑se na urgência.',
        'Publique um único anúncio corretamente ao invés de cinco meio feitos. Um anúncio com fotos ruins repetido cinco vezes continua sendo um anúncio com fotos ruins.',
      ] },
      { h2: 'E se você quiser uma corretora?', paras: [
        'É uma decisão de tempo, não de princípio. Se você não pode fazer visitas durante o horário de trabalho, ou o imóvel está em outra cidade, a comissão garante disponibilidade. No Casa Libre ambos coexistem: anúncios de corretoras e anúncios de proprietários particulares, no mesmo mapa.',
      ] },
    ],
    faq: [
      { q: 'É legal vender sem corretora?', a: 'Sim. Não há obrigação de usar um intermediário; a venda é formalizada perante um notário exatamente como qualquer outra.' },
      { q: 'Quanto cobra uma corretora?', a: 'Um percentual do preço de venda, que varia conforme o acordo e o mercado. Obtenha o percentual e as condições por escrito antes de assinar qualquer exclusividade.' },
      { q: 'Anunciar como particular alcança menos pessoas?', a: 'Depende de onde você anuncia. O que limita o alcance não é ser um vendedor particular — é um anúncio sem fotos, sem localização ou sem preço.' },
    ],
  },
  'documentos-para-vender-un-inmueble': {
  h1: 'Quais documentos você precisa para vender um imóvel',
  answer: 'Para vender, você precisa da escritura registrada em seu nome, do seu documento de identidade, dos dados cadastrais do imóvel e dos certificados que o notário exige: situação registral, imposto imobiliário e contas de água e luz em dia. Se o imóvel estiver em inventário, tiver vários proprietários ou houver hipoteca ativa, isso deve ser resolvido antes da escritura.',
  sections: [
    {
      h2: 'O que reunir',
      bullets: [
        'Escritura e número de registro.',
        'Documentos de identidade de cada proprietário (e do cônjuge, quando houver).',
        'Dados cadastrais do imóvel.',
        'Comprovantes do imposto imobiliário, atualizados.',
        'Contas de água e energia elétrica sem débitos pendentes.',
        'Se houver hipoteca: saldo devedor e condições para sua quitação.'
      ]
    },
    {
      h2: 'O que o notário solicita',
      paras: [
        'O notário obtém os certificados registral e municipal que comprovam que o imóvel está livre de ônus, hipotecas ou outras restrições, e que os dados conferem com o registro. Esse processo define o prazo real para a assinatura.'
      ]
    },
    {
      h2: 'Casos que precisam ser resolvidos primeiro',
      paras: [
        'Inventário incompleto: nenhuma escritura pode ser assinada até que os herdeiros estejam registrados como proprietários. Co-proprietários: todos assinam, ou um com procuração suficiente. Diferenças entre o que foi construído e o que está registrado: se você ampliou o imóvel sem regularizá-lo, isso aparece no processo e atrasa a venda.'
      ]
    }
  ],
  faq: [
    {
      q: 'Posso vender se a escritura estiver no nome de um parente falecido?',
      a: 'Não, até que o inventário seja concluído e os herdeiros estejam registrados. Comece isso antes de anunciar, pois é a etapa mais demorada.'
    },
    {
      q: 'E se eu construí sem licença?',
      a: 'A diferença entre o que está registrado e o que foi construído aparece nos certificados. Regularize antes, ou concorde explicitamente com o comprador.'
    },
    {
      q: 'Preciso da escritura para publicar um anúncio?',
      a: 'Não para publicar. Para assinar, sim: sem uma escritura limpa a transação não se conclui.'
    }
  ]
},
  'como-alquilar-mi-propiedad': {
  h1: 'Como alugar seu imóvel: contrato, garantia e caução',
  answer: 'Para alugar seu imóvel você precisa de um preço alinhado com a região, um anúncio com fotos e localização, um locatário com comprovação de que pode pagar — uma garantia ou um fiador — e um contrato escrito definindo o prazo, o aluguel, reajustes, a caução e quem paga cada utilidade. Registre o estado do imóvel na entrada e na saída: é aí que quase todas as disputas começam.',
  sections: [
    {
      h2: 'Preço comparado à região',
      paras: [
        `Aluguel se compara da mesma forma que vendas: mesmo bairro, tipo, tamanho e condição. Entre distritos vizinhos a diferença pode chegar a dezenas de por cento, então compare de forma restrita.`,
        'Um mês vazio custa mais do que uma pequena diferença de preço: se duas ou três semanas se passam sem consultas sérias, o preço está acima do mercado.'
      ]
    },
    {
      h2: 'Escolhendo um locatário',
      bullets: [
        'Solicite identificação e comprovação de renda.',
        'Peça referências da locação anterior, se houver.',
        'Decida antecipadamente que tipo de garantia aceita: fiador, garantia de imóvel ou caução maior.'
      ]
    },
    {
      h2: 'O contrato: o que não pode faltar',
      bullets: [
        'Prazo e data de início.',
        'Valor, data de pagamento e forma.',
        'Como e quando o aluguel é reajustado.',
        'Caução: quanto, o que cobre, como é devolvida.',
        'Quem paga cada utilidade e taxas condominiais, se houver.',
        'Quais reparos cabem a cada parte.',
        'O que acontece se alguma das partes rescindir o contrato antecipadamente.'
      ]
    },
    {
      h2: 'Inventário e condição',
      paras: [
        'Antes de entregar as chaves, fotografe cada cômodo e anote quais móveis e eletrodomésticos permanecem e em que condição. Repita ao final. Sem esse registro, qualquer discussão sobre a caução fica apenas uma palavra contra a outra.'
      ]
    }
  ],
  faq: [
    {
      q: 'Qual o valor da caução que pode ser exigido?',
      a: 'É acordado entre as partes; um ou dois meses é o usual, maior quando o imóvel está mobiliado.'
    },
    {
      q: 'O contrato precisa ser notarizado?',
      a: 'Não é exigido para locação, mas um contrato escrito assinado por ambas as partes é essencial. Para prazos longos ou valores altos, assinaturas certificadas acrescentam proteção.'
    },
    {
      q: 'Posso alugar sem uma imobiliária?',
      a: 'Sim. Você anuncia, mostra e assina o contrato diretamente. O que você não deve pular é a garantia e o inventário.'
    }
  ]
},
  'gastos-al-comprar-una-casa': {
  h1: 'Custos e impostos ao comprar um imóvel',
  answer: `Além do preço, comprar um imóvel ${COUNTRY_PT.in} inclui o tabelião, a inscrição no registro, o imposto municipal de transferência e os certificados prévios. Reserve um percentual extra sobre o valor do imóvel, e consideravelmente mais se você estiver comprando com financiamento. Peça ao tabelião uma cotação antes de assinar o sinal.`,
  sections: [
    {
      h2: 'O que se soma ao preço',
      table: {
        head: ['Item', 'Normalmente pago por', 'Observação'],
        rows: [
          ['Taxas de tabelião', 'Normalmente dividido', 'Escala móvel conforme o valor'],
          ['Inscrição no registro', 'Comprador', 'Sobre o valor da transação'],
          ['Imposto municipal de transferência', 'Por acordo', 'Varia conforme o município'],
          ['Certificados prévios', 'Vendedor, geralmente', 'Obtidos pelo tabelião'],
          ['Custos de financiamento', 'Comprador', 'Avaliação, seguro e escritura de financiamento'],
        ],
      },
    },
    {
      h2: 'Se você está comprando com financiamento',
      paras: [
        'Um financiamento acrescenta avaliação, seguro e a escritura de financiamento, que é um ato separado da compra. Também prolonga o prazo: o banco faz sua própria verificação da escritura.',
      ],
    },
    {
      h2: 'Como evitar surpresas',
      bullets: [
        "Obtenha a cotação do tabelião antes de assinar o sinal, não depois.",
        'Especifique no contrato quem paga cada item.',
        'Verifique se não há impostos imobiliários ou contas de serviços pendentes.',
        'Reserve uma margem para custos de mudança e reparos iniciais.',
      ],
    },
  ],
  faq: [
    {
      q: 'Quanto devo reservar além do preço?',
      a: 'Depende do valor e se houver financiamento. Peça a cotação do tabelião e adicione a inscrição e o imposto de transferência; esses três dão o total real.',
    },
    {
      q: 'Um estrangeiro pode comprar imóvel?',
      a: 'Em geral sim, com requisitos que variam conforme o país e a localização do imóvel. Consulte seu tabelião antes de pagar o sinal.',
    },
    {
      q: 'O preço pode ser pago em dólares?',
      a: 'É comum acertar o preço em dólares, constando na escritura ao lado do equivalente em moeda local. As condições de pagamento são acordadas entre as partes.',
    },
  ],
},
  'comprar-primera-casa': {
    h1: 'Como comprar seu primeiro imóvel: passos e checklist',
    answer: 'Comprar o primeiro imóvel envolve cinco etapas: calcule o que realmente pode pagar, incluindo os custos de transferência, pesquise por região no mapa, visite com um checklist, peça a um tabelião que verifique a escritura antes de pagar qualquer sinal, e assine a escritura. A ordem importa: a verificação vem antes do sinal, não depois.',
    sections: [
      { h2: '1. O que você realmente pode pagar', paras: [
        'Some os custos de transferência ao preço, mais avaliação e seguro se houver financiamento. Subtraia o que será necessário para mudança e reparos: quase nenhum imóvel é ocupado sem gastar algo no primeiro mês.',
      ] },
      { h2: '2. Pesquise por região, não por lista', paras: [
        'A maioria dos compradores já tem uma ideia aproximada de onde quer morar. Pesquisar no mapa e percorrer os bairros de seu interesse é mais rápido que rolar uma lista geral, e mostra a faixa real de preços rua a rua.',
      ] },
      { h2: '3. O que observar durante a visita', bullets: [
        'Umidade nas paredes e tetos inferiores.',
        'Pressão da água e estado da fiação.',
        'Orientação e iluminação natural em diferentes horários do dia.',
        'Ruído do entorno em horários de pico.',
        'Acesso, transporte e o que há nas proximidades.',
      ] },
      { h2: '4. Verifique antes de pagar o sinal', paras: [
        'Antes de entregar o dinheiro, peça a um tabelião que verifique a escritura, o registro e a situação do imóvel. Essa é a única forma de saber se há ônus, hipotecas ou divergências entre o que está registrado e o que foi construído. Pagar primeiro e checar depois é o erro caro.',
      ] },
      { h2: '5. Sinal, escritura e entrega', paras: [
        'O contrato de compra e venda com sinal fixa o preço, o prazo e as condições. O tabelião então reúne os certificados, elabora a escritura e a assina. A entrega das chaves é prevista no mesmo documento: torne isso explícito.',
      ] },
    ],
    faq: [
      { q: 'É melhor comprar ou continuar alugando?', a: 'Depende de quanto tempo você pretende ficar e da diferença entre a parcela do financiamento e o aluguel na sua região. Se o horizonte for de apenas alguns anos, os custos de compra e venda pesam bastante.' },
      { q: 'Quanto tempo leva o processo?', a: '30 a 60 dias do sinal à assinatura, mais tempo se houver financiamento.' },
      { q: 'Posso negociar o preço anunciado?', a: 'Sim, é normal. Apresente comparáveis da região: uma oferta fundamentada negocia melhor do que um número isolado.' },
    ],
  },
};

export const guidePt = (slug) => GUIDES_PT[slug] || null;
