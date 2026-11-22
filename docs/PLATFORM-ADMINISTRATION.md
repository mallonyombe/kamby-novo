# Administração da plataforma — primeira entrega operacional

Orbion Technology · Kamby · 12 de Novembro de 2026

## Arquitectura e alcance

Aplicação independente em `admin.html`, partilhando o cliente autenticado e a identidade visual do Kamby. Não há ligação pública de administração dentro da navegação do comprador. O servidor decide o acesso; conhecer o URL não concede permissões.

Esta entrega implementa A1, a visão operacional de A2 e o ciclo principal de lojas de A3. As restantes áreas têm consultas autorizadas reais; isso não significa que os respectivos fluxos completos de escrita estejam concluídos.

| Área | Disponível nesta entrega | Trabalho seguinte |
| --- | --- | --- |
| Visão geral | Contagens actuais verificáveis e filas de lojas/denúncias | Alertas de segurança instrumentados e prioridades por gravidade |
| Lojas | Pesquisa, filtros, ficha, criação em preparação, identidade, acessos, decisões e histórico | Identidade visual com upload administrativo e reatribuição do titular legal |
| Produtos | Pesquisa global, estado, loja, categoria, preço e restrição | Investigação e decisões de moderação de produto |
| Utilizadores | Pesquisa de perfis e quantidade de vínculos; sem emails/telefones por defeito | Sessões, medidas de conta e gestão de papéis críticos |
| Categorias | Taxonomia disponível e utilização no catálogo | Editor, ordenação, atribuição por loja e regras de desactivação |
| Moderação | Denúncias novas, resolvidas e arquivadas do modelo existente | Triagem, investigação, espera de informação, reabertura, evidências e recursos |
| Análises | Eventos de loja/WhatsApp em 7/30 dias, gráfico e tabela | Eventos adicionais, deduplicação no servidor e relatórios exportáveis |
| Sistema | Pesquisa de auditoria e responsáveis | Regras configuráveis, recuperação, segurança de sessões e gestão de privilégios |

Não foram criadas contas, concedidas novas permissões ou alteradas lojas reais nesta entrega. A migração `platform_operations` foi aplicada pela operação nativa e a pós-verificação confirmou as funções, duas lojas existentes e zero concessões delegadas.

## Gestão de Lojas: hierarquia e propósito

A lista permite localizar e abrir uma loja. O único botão preenchido inicia a criação. Pesquisa e filtros reduzem a lista; as linhas mostram nome, responsável, quantidade de produtos e estado. Não há botões de suspensão ou aprovação nas linhas.

No desktop, oito destinos na lateral. No móvel, um menu dedicado em duas colunas; nenhuma barra inferior com oito separadores. O conteúdo principal fica inerte enquanto o menu está aberto. O menu fecha por navegação e Escape.

| Separador da ficha | Propósito e operação |
| --- | --- |
| Resumo | Estado, localidade, WhatsApp, responsáveis, criação e última alteração |
| Identidade | Editar nome, descrição, WhatsApp e localidade; rever com motivo antes da gravação |
| Catálogo | Consultar os 30 artigos mais recentes; pesquisa global em Produtos |
| Acessos | Consultar responsáveis, pesquisar conta existente, confirmar atribuição/reactivação/revogação |
| Moderação | Consultar denúncias da loja e dos seus artigos, até 30 mais recentes |
| Histórico | Consultar os 30 eventos mais recentes; pesquisa anterior em Sistema |
| Acções | Mostrar apenas as transições permitidas a partir do estado actual |

`owner_id` continua a registar o criador histórico, conforme o contrato existente. O acesso comercial é definido por `kg_private.store_merchants`. A interface usa «responsável» e não simula uma alteração de propriedade legal. Para substituir um responsável, atribuir primeiro a nova conta, depois revogar a anterior. O servidor protege o último responsável de uma loja activa.

## Estados da loja

| Origem | Destinos permitidos na nova operação |
| --- | --- |
| Em preparação | Pendente, Activa, Encerrada |
| Pendente | Activa, Recusada, Encerrada |
| Activa | Suspensa, Encerrada |
| Suspensa | Activa, Encerrada |
| Recusada / Encerrada | Em preparação |

Todas as decisões exigem motivo entre 3 e 2000 caracteres. A activação exige pelo menos um responsável activo. Uma suspensão ou encerramento oculta loja/produtos públicos, bloqueia novos contactos e preserva os dados. Os carrinhos guardados são revalidados pelos contratos de contacto existentes. Os estados de publicação dos produtos não são reescritos em massa: reactivar a loja permite recuperar o catálogo previamente publicado e autorizado.

Encerrar é um estado reversível; esta entrega não disponibiliza eliminação permanente. Suspensão em massa e alteração de privilégios não existem nesta interface.

## Transacções, autorização e auditoria

- A autoridade administrativa antiga e nova exige JWT `aal2`; o fluxo oferece configuração TOTP e desafio do autenticador. Isso também protege as políticas RLS e funções antigas que consultam `kg_private.is_admin()`.
- Os administradores existentes conservam as operações autorizadas. Não se usa `user_metadata` para conceder acesso.
- Consultas delegadas exigem concessão específica por operação na tabela privada `operation_grants`. Esta entrega não inclui concessões de escrita delegada nem um editor de privilégios.
- A função de gravação valida autorização, versão esperada, transição e motivo no servidor. Os pedidos têm identificador idempotente vinculado ao actor e ao conteúdo. Reutilizar um identificador com outros dados é recusado.
- A ficha é bloqueada durante a transacção. A decisão, a alteração comercial e a auditoria são gravadas atomicamente; falha de auditoria desfaz a alteração.
- `kg_admin_decisions` preserva actor, instante, operação, motivo, estado anterior e novo. O cliente não possui INSERT/UPDATE/DELETE nesta tabela. As concessões e pedidos internos também não têm acesso directo.
- Os pedidos usam funções privadas `SECURITY DEFINER` com autorizações explícitas e `search_path` vazio, expostas por invólucros `SECURITY INVOKER`. As consultas são fixas, com parâmetros limitados e paginação de 30 linhas.
- Não se altera o acesso público do Site. Não se utiliza uma chave de serviço no navegador.

## Métricas e estados da interface

As quatro contagens da visão geral são um retrato do estado actual com `as_of`: lojas activas, lojas pendentes, produtos públicos autorizados e denúncias abertas. Nenhuma depende do selector de 7/30 dias. O intervalo afecta somente Análises, com dias em Africa/Maputo e filtro temporal indexado.

Visitas e cliques WhatsApp são eventos, não pessoas únicas, mensagens confirmadas ou vendas. O limite do cliente é informado na análise: visita por loja/sessão a cada 30 minutos; cliques com intervalo mínimo de 1,5 segundos. A deduplicação não é garantida entre sessões/dispositivos e ainda não é uma garantia antifraude do servidor.

Carregamento usa skeletons/spinners, sem frases visíveis. Vazio, falha, sem acesso, MFA pendente e conflito são diferentes. Em conflito, o estado não é substituído e a interface pede actualização. A geração da consulta impede respostas antigas de substituir outro destino. Nenhuma confirmação de sucesso é apresentada antes da resposta do servidor.

## Critérios e evidência

- 51 testes frontend e 29 verificações no navegador passaram, incluindo criação em preparação, procura de conta, confirmação de acesso, decisão, identidade, histórico, conflito, vazio, erro, MFA, consulta limitada e larguras 320/390/1100 nos dois temas.
- As nove migrações compilaram em PostgreSQL/PGlite. Os testes verificaram bloqueio sem MFA inclusive em funções antigas, consulta delegada sem escrita, idempotência, conflito, transições, responsável obrigatório, protecção do último responsável e rollback quando a auditoria falha. As fixtures são revertidas por transacção.
- A verificação de interface usa sessão/rede isoladas, sem contas ou gravações no serviço real. As páginas QA são excluídas do pacote publicado.
- A pós-verificação alojada confirmou o contrato e a privacidade das tabelas; o fluxo autenticado com TOTP de uma pessoa real não foi executado pelo agente. O titular configura/confirma o autenticador ao entrar.
- Os avisos do assessor de segurança mantêm-se anteriores à alteração: tabelas privadas sem políticas (acesso revogado) e protecção de senhas comprometidas desactivada. Não foram ocultados nem modificados como parte desta entrega. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Recuperação e próximos critérios

Não reverter a protecção MFA para contornar uma dificuldade de acesso. Recuperação de um factor exige procedimento administrativo do titular no serviço de identidade, com prova de identidade e auditoria. Não há um botão público de recuperação de privilégios nesta entrega.

A continuidade deve seguir as dependências do roadmap: fluxo completo de moderação antes de novos estados de recurso, modelo de eventos antes de relatórios comerciais, gestão de privilégios com confirmação reforçada antes de novas funções de escrita delegada. Ambientes separados e um ensaio de restauro permanecem requisitos de A8/A9, não devem ser inferidos desta publicação.
