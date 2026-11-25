# Revisão do Kamby de ponta a ponta

## Requisitos e hipótese do piloto

O Kamby ajuda compradores em Chongoene a descobrir produtos de lojas criadas pela gestão e a contactar a loja com a informação necessária para negociar. A hipótese a validar é que mostrar produto, preço indicativo e variante antes do contacto reduz as perguntas repetidas ao lojista. A investigação com compradores e lojistas e a validação de um modelo de receita continuam pendentes.

| Percurso | Trabalho a completar | Critério observável |
|---|---|---|
| Visitante | Feed, pesquisa, lojas, produto, guardados, entrada e ajuda | Encontra uma opção, vê detalhes e escolhe uma variante ou guarda o artigo. |
| Cliente | Conta, edição do perfil, preferências, carrinho por loja e contacto | Mantém os artigos isolados por loja, verifica o subtotal indicativo e abre o WhatsApp por gesto próprio. |
| Lojista | Loja atribuída, catálogo, edição, stock e actividade | Encontra a loja atribuída, edita um produto e vê o resultado só depois de o serviço o aceitar. |
| Gestor | Acesso autorizado, lojas, contas, produtos e operações | Abre os destinos permitidos, consulta estados e recebe resposta clara se uma operação falhar. |

O WhatsApp inicia contacto. Uma venda só conta como confirmada quando existir evidência do lojista. O piloto conserva a criação de lojas pela gestão e a negociação pelo WhatsApp. Uma subscrição ou um novo mecanismo de pagamentos exigem validação própria.

## Protótipos navegáveis e verificação

Após `npm run build`, os scripts de ensaio existentes montam vistas navegáveis no directório `dist`. Usa uma cópia descartável para estes ensaios.

| Script | Vista | Dados da sessão |
|---|---|---|
| `node tests/build-roadmap-qa.mjs` | `/roadmap/` | Produtos, lojas, variantes e catálogo controlados pelo ensaio |
| `node tests/build-merchant-fixture.mjs` | `/merchant-qa.html#lojista/s1` | Lojista com lojas atribuídas e dados simulados |
| `node tests/build-admin-fixture.mjs` | `/admin-qa.html#stores` | Gestor e operações simuladas, incluindo estados de falha |

O build de produção corre sem estes scripts. Simulações provam o percurso e o comportamento da interface. Sessões, gravações e confirmação nativa de instalação em produção requerem contas e dispositivos próprios para validação.

## Adaptação das 37 verificações do checklist

Os números seguem a ordem do PDF. Os itens marcados «nativo» descrevem capacidades de Expo ou SwiftUI. A alternativa para o Kamby usa a plataforma web.

| Família | Verificações individuais e equivalente no Kamby |
|---|---|
| Barra de abas | **1** Camada visual da barra confere com o tema. **2** Barra do sistema é nativa. Na PWA usa-se navegação semântica HTML. **3** Quatro destinos do comprador, sem acções na barra. **4** A aba activa tem cor, peso visual e `aria-current`. **5** Pesquisa tem entrada e ecrã próprios. **6** Minimização ao rolar é opcional e fica por avaliar em dispositivo. |
| Ícones | **7** Bibliotecas externas são uma questão de implementação nativa. Rever a consistência dos SVG do Kamby. **8** Símbolos de interface sem emoji. **9** SF Symbols e Dynamic Type são nativos. Conferir peso junto ao rótulo na web. **10** Variante preenchida é uma opção nativa. Na web o estado seleccionado continua explícito por semântica e peso. **11** Reservar o ícone de IA para uma função de IA. |
| Listas | **12** Agrupar linhas relacionadas do Perfil e das áreas de trabalho. **13** Separadores internos no lugar de contornos por linha. **14** Reservar elevação para elementos flutuantes. **15** Verificar cor e posição do separador nos dois temas. **16** Curva contínua é nativa. Usar o mesmo raio dentro de cada família web. **17** Fundo da página e superfície do grupo têm papéis distintos. |
| Cabeçalhos | **18** Barra do sistema é nativa. Na web, manter um cabeçalho por vista. **19** Título expansível é uma decisão por ecrã. Priorizar leitura e consistência. **20** Gestos e histórico do sistema são nativos. Testar Voltar no ecrã e no navegador. **21** Manter acções de contexto na barra da vista. **22** Verificar limites da área segura e conteúdo durante a rolagem. |
| Diálogos | **23** Usar painel inferior para tarefas curtas quando o contexto se mantém. **24** Fecho por gesto e puxador são nativos. Na web, garantir fecho, Escape e retorno do foco. **25** A altura adapta-se ao conteúdo e ao teclado. **26** Confirmar e fechar têm destinos e nomes reconhecíveis. **27** Usar o backdrop do `dialog` e respeitar superfícies do tema. |
| Feedback | **28** Rever confirmações redundantes. **29** Mostrar a alteração no sítio da acção. **30** Haptics de sucesso são nativos. **31** Erro junto ao campo ou mensagem com acção recuperável. **32** Remover destinos sem função e evitar prometer uma operação ainda indisponível. |
| Modo escuro | **33** Automático segue o dispositivo. **34** Reusar tokens em superfícies, texto e divisores. **35** Verificar versões de cores semânticas nos dois temas. **36** Conferir ecrãs em contraste elevado e texto ampliado. **37** Cor do navegador acompanha o tema quando suportado. |

Os quatro pontos adicionais do PDF entram na revisão de toque, teclado, materiais e largura. Para resultados repetíveis, executar primeiro em 390 px nos dois temas e depois em ecrã largo. Validação visual no iPhone e no Android real continua distinta dos ensaios em Chromium.

## Divulgação e medição

Organizar experiências de divulgação em torno dos relatos que o piloto confirmar. Para cada experiência, conservar a mensagem, a audiência e o resultado. Acompanhar descoberta de produto, intenção de contacto e, quando houver confirmação do lojista, venda concluída. As experiências de divulgação e o calendário de conteúdo ficam por executar após recolher os relatos. O título do playbook não estabelece uma previsão de receita para este piloto.

## Evidência desta revisão

| Âmbito | Resultado |
|---|---|
| Comprador | 6 cenários de navegador passaram, incluindo acesso directo ao produto durante carregamento do feed, pesquisa com falha no diretório de lojas, rolagem até ao produto 61, guardados após recarregar, variantes, stock, subtotal e retorno do carrinho. |
| Perfil | Em claro e escuro, a entrada recebe foco no título, Voltar devolve o foco a «Iniciar sessão» e Tab continua em «Guardados». Largura conferida a 390 px. |
| Lojista | A ligação directa abre a loja atribuída durante o arranque. O menu identifica o destino actual. Pesquisa, abertura do editor e validação de rascunho verificadas. Editor conferido em 320, 390 e 1040 px. |
| Gestor | Em claro e escuro, menu com destino activo, fecho com Escape, abertura de ficha e largura a 390 px verificados. Estados vazio e erro passaram. |
| Suítes do repositório | Build, 110 testes de frontend e testes SQL locais passaram. |
| Por verificar | Jornadas de produção com sessões reais, envio pelo WhatsApp, confirmação nativa de instalação, teclado nativo, contraste elevado e texto ampliado em dispositivos reais. Testes locais usam dados simulados. |


## Validação da produção em 25 de Novembro de 2026

O feed e o directório abriram em sessão de visitante e apresentaram os estados sem produtos e sem lojas. O carrinho apresentou zero artigos e a acção «Explorar produtos». Uma consulta de leitura ao projecto de produção confirmou zero registos nas tabelas de lojas e produtos. A compra com dados em produção fica pendente de um catálogo autorizado.

| Ensaio do piloto | Evidência de aceitação |
|---|---|
| Loja e catálogo | Uma loja autorizada, com contacto controlado e pelo menos um produto com variantes e preços distintos. A gestão confirma a publicação e o visitante encontra o mesmo produto no feed, na pesquisa e na loja. |
| Carrinho | A variante mantém-se após recarregar. Mudar a quantidade actualiza o subtotal. O pedido contém os artigos da loja seleccionada. |
| WhatsApp | O pedido abre uma conversa com o número de teste autorizado e com a variante, quantidade e subtotal correctos. Registar em separado se foi aberto, enviado e recebido. |
| Sessões reais | Cliente, lojista e gestor confirmam as suas acções com contas autorizadas. Depois de guardar, recarregar a vista e observar o dado persistido. |
| Instalação | Em Android físico, registar navegador e estado do convite. Tocar em «Instalar Kamby», observar a confirmação nativa e abrir a aplicação pelo ícone. |

## Entrevistas do piloto

Pedir a cada comprador que descreva a última compra local. Onde encontrou a loja, que informação precisou de pedir e em que ponto decidiu avançar ou desistir? Pedir ao lojista que descreva o último pedido recebido. Que dados vinham na primeira mensagem, o que teve de perguntar e como soube se a venda se concretizou? Registar a tarefa, a dificuldade observada e a consequência relatada. Depois, pedir à pessoa que tente encontrar um produto e preparar um pedido no Kamby, sem lhe indicar onde clicar. Usar essas observações para decidir o que entra no próximo ciclo e quais mensagens vale a pena testar na divulgação.

## Ensaio com catálogo e contas fictícias

O ensaio do comprador usa 61 produtos distribuídos por duas lojas identificadas como teste. Em Chromium, os sete cenários passaram. O último cenário carrega os dois carrinhos após recarregar e verifica a mensagem de cada loja, a variante, as quantidades e os subtotais de 780 MT e 12 MT. A simulação termina dentro do Kamby, sem janela externa. As vistas do lojista e do gestor foram exercitadas com sessões fictícias. Verificámos credencial incorrecta seguida de entrada válida, loja atribuída, pesquisa e validação do editor em três larguras, menu do gestor e os estados vazio e de erro.

A suíte de frontend inclui três testes do convite PWA. Cobrem a primeira visita elegível, a persistência da dispensa e a app já instalada. O sistema operativo e a confirmação nativa em Android físico continuam fora deste ensaio. Os dados fictícios desta execução ficaram no navegador de teste e na base SQL de teste. A validação de entrega pelo WhatsApp real e as contas de produção continuam pendentes.

O oitavo cenário do comprador passou em Chromium. A loja fechada bloqueou o pedido. Após reabrir, o aumento de preço actualizou o subtotal de 780 MT para 840 MT e exigiu um novo toque. Só depois desse toque foi apresentado o pedido simulado com o valor revisto.

### Actualização e acesso offline da PWA

Depois de `npm run build`, executar `node tests/pwa-offline-browser.mjs` com Playwright, Chromium e Python 3 disponíveis. A variável `KAMBY_QA_CHROMIUM` permite usar outro executável Chromium. O ensaio usa uma cópia temporária do build num servidor local e bloqueia pedidos externos do navegador. Em Chromium, o Perfil reabriu sem rede. Após voltar a ligar, o novo service worker assumiu o controlo, removeu a cache anterior e a versão nova reabriu também sem rede.
