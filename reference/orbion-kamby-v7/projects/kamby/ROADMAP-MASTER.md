# KAMBY — ROADMAP EXECUTÁVEL

**Sem prazos inventados:** fases por dependências e critérios de saída; tarefas independentes podem avançar em paralelo.

## G00 — Discovery & validação
**Responsáveis:** Product Strategy, UX Research, Consumer Research, Brand Strategy.

**Entregáveis:** Entrevistas/hipóteses, personas provisórias, fluxos, escopo MVP, decisões pendentes.

**Gate de saída:** Requisitos aprovados e riscos identificados.

## G01 — Identidade e experiência
**Responsáveis:** Logo & Symbol, Art Direction, Typography & Colour, UX Writing, Product UI, Motion, Accessibility.

**Entregáveis:** SVG mestre, marca clara/escura, tokens, biblioteca de ícones, microcopy, protótipos e motion specs.

**Gate de saída:** Marca legível em mono e 32px; UX testável; contrastes revistos.

## G02 — Arquitectura e segurança
**Responsáveis:** Principal Architect, Frontend Architecture, Supabase, PostgreSQL, Backend Systems, Application Security.

**Entregáveis:** ADRs, contratos, esquema SQL, políticas RLS, threat model, ambientes isolados.

**Gate de saída:** Aprovação de arquitectura e testes de permissões planeados.

## G03 — Marketplace comprador
**Responsáveis:** Frontend Architecture, Visual Engineering, Backend Systems, Supabase, Web Performance.

**Entregáveis:** Catálogo, pesquisa, lojas, carrinho por loja, revisão e ligação WhatsApp.

**Gate de saída:** Percurso comprador E2E, sem vendas fictícias.

## G04 — Vendedor e administração
**Responsáveis:** Backend Systems, PostgreSQL, Supabase, Product UI, Security, Data Engineering.

**Entregáveis:** Candidatura de loja, aprovação, gestão de produtos, denúncias, auditoria e indicadores.

**Gate de saída:** Isolamento entre lojas e moderação testados.

## G05 — Qualidade e preparação
**Responsáveis:** Advanced Quality, SRE, Security, Accessibility, Scalability, Web Performance.

**Entregáveis:** Testes E2E, RLS, carga, acessibilidade, CI, observabilidade e recuperação.

**Gate de saída:** Nenhuma falha crítica aberta; evidências e rollback.

## G06 — Piloto e lançamento
**Responsáveis:** Product Strategy, UX Research, Data Engineering, SRE, Technical Documentation.

**Entregáveis:** Piloto controlado, feedback, métricas, correcções, documentação e plano de lançamento.

**Gate de saída:** Aceitação do produto e aprovação explícita de release.

## Backlog de histórias priorizadas
P0-01 Como comprador, quero encontrar produtos por pesquisa e categoria.
P0-02 Como comprador, quero consultar produtos de uma loja aprovada.
P0-03 Como comprador, quero adicionar itens a carrinho **daquela loja**.
P0-04 Como comprador, quero rever e abrir uma mensagem WhatsApp editável para essa loja.
P0-05 Como vendedor, quero candidatar-me a gerir uma loja.
P0-06 Como administrador, quero aprovar/rejeitar/suspender uma loja com auditoria.
P0-07 Como vendedor aprovado, quero publicar e gerir produtos.
P0-08 Como utilizador, quero autenticação e recuperação de conta funcionais.
P0-09 Como administrador, quero tratar denúncias e bloquear conteúdos indevidos.
P0-10 Como utilizador, quero experiência acessível, rápida e responsiva.
P1-01 Favoritos, histórico de intenções e notificações relevantes.
P1-02 Analytics de descoberta e contacto com privacidade.
P2-01 Comissões, entregas ou pagamentos apenas após validação comercial.

## Dependências
G00 define os requisitos; G01 e G02 podem decorrer em paralelo após alinhamento; G03/G04 usam contratos de G02 e design de G01; G05 verifica a integração; G06 depende de aprovação G05.

## Métricas a instrumentar (sem inventar valores)
Descoberta→visualização de produto; produto→carrinho; carrinho→intenção de contacto; taxa de lojas aprovadas; produtos activos; tempo para concluir tarefa; erros; Core Web Vitals; violações RLS; incidentes. Não confundir abertura de WhatsApp com conversão em venda.
