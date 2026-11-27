# Kamby · Revisão do painel do gestor

O painel é uma superfície de trabalho para consultar o estado da plataforma e executar decisões autorizadas. A revisão combina os princípios do Kamby com padrões de listas, barras laterais, gráficos e feedback da Apple. A referência visual complementar foi o sistema Linear, pela hierarquia com fundos neutros e pela contenção de ênfase.

| Ecrã | Onde o painel perdia clareza | Decisão aplicada ou ponto por validar |
| --- | --- | --- |
| Visão geral | A actividade repetia métricas e pedidos do ecrã Actividade. | Mostrar primeiro denúncias por rever e depois os totais operacionais. Os detalhes ficam na área respectiva. |
| Lojas e ficha de loja | Identidade, responsáveis, catálogo e histórico têm objectivos diferentes. | Manter secções e acções contextuais. A lista usa pesquisa, filtros e paginação. O ensaio da troca de responsável real fica por validar. |
| Produtos | O resumo consultava mais colunas que as necessárias para miniatura e preço. | Consultar os campos necessários na lista e carregar o detalhe quando se abre o produto. |
| Utilizadores | Contactos e últimos acessos têm sensibilidade diferente do nome e estado operacional. | A ficha omite os campos ausentes. As permissões são verificadas no servidor, incluindo o nível de autenticação administrativa. |
| Categorias | A lista serve para localizar uma categoria e a ficha serve para a editar. | Preservar os dois níveis, com a acção na ficha. Validar o erro de nome e a gravação com sessão administrativa. |
| Moderação | O diálogo de denúncia incluía código de edição de produto que podia interromper a abertura. | Limitar o diálogo à denúncia, ao conteúdo e à decisão. Confirmar a decisão na ficha e devolver o resultado à fila. |
| Actividade | Faltava uma escala contextual e as séries dependiam demasiado das cores. | Distinguir as séries também pela forma, apresentar período e escala e oferecer valores diários em tabela. |
| Auditoria | O histórico tem valor quando é fácil ligar cada registo à sua acção. | Preservar data, acção e nível de detalhe sob o contrato de permissões existente. Falta validar com dados operacionais autorizados. |
| Acesso e termos | Os termos estavam por publicar no ecrã do perfil. | Servir o documento activo, pedir aceitação explícita antes das funções da conta e gravar a versão ligada à sessão. Separar essa decisão da medição opcional. |

## Feedback, ícones e segurança

Os controlos mais frequentes usam os símbolos e tokens existentes. Os botões com ícone mantêm nome acessível. As acções de trabalho recebem feedback no próprio contexto. A abertura do menu por teclado e a preferência de movimento reduzido mantêm o contexto sem animar interacções frequentes.

O Google Analytics permanece inactivo até uma escolha afirmativa e pode ser desligado em Privacidade. As contagens operacionais do Kamby são explicadas em separado. O service worker mantém uma lista de ficheiros públicos permitidos. As rotas administrativas, respostas privadas e pedidos autenticados ficam fora desse cache. A sessão administrativa mantém MFA e concessões verificadas no servidor.

Os termos desta revisão descrevem o fluxo actual de descoberta e contacto comercial. A aplicação em produção requer validar os dados do operador, os canais de suporte e a redacção final, e aplicar as migrações antes de publicar o frontend. A sessão actual usa o SDK no navegador. A adopção de cookies de sessão HttpOnly depende de um backend que emita e valide a sessão.

## Validação

- Os 124 testes de frontend passaram. A suite de base de dados verificou permissões de gestor com MFA, os dados devolvidos ao operador delegado e o registo da aceitação por conta e versão.
- Em Chromium, com dados simulados, o gestor abriu Lojas depois de aceitar os termos e o vendedor abriu Resumo. A compra como visitante completou 10 verificações a 390 px.
- Na gestão foram ensaiados 320, 390 e 1100 px, temas claro e escuro, teclado e recuperação de foco, fila de denúncias com resolução, falha localizada da telemetria e os estados de carregamento, vazio e erro. As verificações de cache automatizadas passaram. O ensaio do PWA totalmente sem ligação e as verificações com sessões de produção ficam por concluir.

## Referências

- [Apple HIG · Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Apple HIG · Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- [Apple HIG · Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data)
- [Apple HIG · Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
- [Apple HIG · Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Apple · UI Design Dos and Don’ts](https://developer.apple.com/design/tips/)
- [Linear · Análise do sistema de design](https://getdesign.md/design-md/linear)
- [Supabase · Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Vercel · Cache-Control](https://vercel.com/docs/caching/cache-control-headers)
- [Google · Consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
