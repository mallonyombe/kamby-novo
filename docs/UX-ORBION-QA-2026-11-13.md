# QA UI integrado e referências Orbion — 2026-11-13

## Fontes efectivamente lidas
Pacote original `orbion-ai-engineering-v4`: README; governance/agent-base-prompt.md; governance/KAMBY-BRAND-STANDARDS.md; agents/fe-01-frontend-architecture.md, fe-02-visual-engineering.md, fe-03-product-ui.md, fe-04-ux-research.md e fe-05-motion-engineering.md (ficheiros FE-01–05 do pacote).

São especificações metodológicas, não agentes instalados nem prova de vídeos visionados. Nenhum vídeo YouTube foi visionado nesta tarefa. A norma de marca é uma proposta, não autorização para substituir a identidade existente.

## Aplicação evidenciada
- FE-01: contrato canPrepareStore separado da autoridade backend; testes negativos para estados suspensos/encerrados; revisão cruzada.
- FE-02: reaproveitamento de tokens e componentes; guia sem cartão/borda, links legíveis sublinhados; inspeccionados 320 e 390 px.
- FE-03/04: Preparar/Gerir na conta existente; mantém acesso cliente; estado textual em preparação; acções directas dados/catálogo; confirmação administrativa resume dados; criação/atribuição normal sem motivo escrito obrigatório.
- Marca/acessibilidade: rótulo acessível acompanha Preparar/Gerir; estado não depende só de cor; não se chama público ao catálogo da loja em preparação.
- FE-05: não foi adicionada animação ao onboarding. Regras reduced-motion existentes preservadas. Não foram medidos fps nem simulados dispositivos modestos.

## Browser QA isolado
Fixture intercepta todos pedidos Supabase e guarda estado exclusivamente em memória. Sem gravação remota ou mensagens enviadas.
- Preparação: conta mantém cliente/carrinho; botão Preparar; resumo visível e sem corte horizontal observado a 320/390 px.
- Formulário de loja draft habilitado, abertura manual desabilitada antes de aprovação, preview público oculto; gravação de nome simulada verificada.
- Editor de produto abre e fecha sem alteração.
- Loja approved/fechada: detalhe de produto permite escolher quantidade após Adicionar; gravação local no carrinho e contador 1 verificados.
- Carrinho de loja mantém artigo/total; botão Loja fechada bloqueia pedido com aviso.
- Carrinho geral mantém loja e artigo; verificado a 320 px.
- Perguntar à loja é contacto genérico permitido pela decisão actual, separado de pedido. Não foi enviado WhatsApp.

## Correcção posterior à revisão independente
Guardar identidade preserva opening_hours original (incluindo [] manual) até uma alteração deliberada nos controlos de horário. hoursDirty é isolado do restante formulário; sucesso/reset limpam marca. Testes abrangem []/undefined, semana existente e edição deliberada/overnight. Copy diz não enviar pedidos, não proíbe pergunta genérica.

## Resultados e limites
94 testes frontend e build passaram após correcção. diff check limpo. Correcção hoursDirty confirmada também via browser: alterar só nome enviou opening_hours=[]; seleccionar Segunda e guardar enviou semana explícita com Segunda aberta. Formulário Horário inspeccionado a 320 px, sem corte horizontal observado. Diálogos Sair sem guardar? e Filtros do catálogo nomeados na árvore acessível; Cancelar preservou edição e Fechar filtros devolveu foco ao botão. Pergunta genérica com loja fechada gerou apenas texto genérico, verificado por interceptor local de window.open sem abrir WhatsApp nem enviar mensagem. Não validado login real, persistência Auth/RLS via browser, entrega WhatsApp, todas as telas/temas, nem WCAG completa. Sem publicação nesta tarefa.
