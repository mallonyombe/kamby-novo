# Preparação privada e contactos fora de horário

Estado: duas migrações APLICADAS em 2026-11-13; frontend candidato em publicação coordenada.

## Implantação verificada
- Histórico remoto `20261113164207`: merchant_preparation_contact_rules.
- Histórico remoto `20261113164241`: legacy_store_invariants.
- Pós-checks do responsável backend: 14/14 corpos de funções exactos, ACL esperadas e quatro triggers habilitados; triggers sem EXECUTE para clientes e disponibilidade pública permitida a anon.
- Ensaio remoto read-only: contrato unavailable correcto; overnight 01:59 aberto / 02:00 fechado; [] mantém modo manual.
- Duas lojas approved preservadas; zero sem responsável. Sem alteração de contas, credenciais ou configurações Auth. Signup permanece desactivado.
- Testes reais de login, SMTP e envio WhatsApp não realizados. Recuperação integral de produção não ensaiada.

## Contrato
- `kg_private.can_prepare_store` exige associação privada activa e loja draft/pending/approved. Não permite criação de loja, activação, alteração de permissões nem recuperação de loja suspensa/encerrada/recusada.
- `kg_account_context` inclui lojas atribuídas em preparação e pendentes. `account-access.js` aceita esses estados apenas pelo novo contexto; fallback legado permanece conservador.
- Editor avançado permite rascunhos, fotografias e identidade da loja em preparação. Produto publicado continua a exigir loja approved, cuja activação pertence à gestão. Catálogo público e RLS de leitura pública não foram alargados.
- Editor legado permanece apenas para lojas activas; não simula suporte a preparação.
- `kg_store_contact_availability(p_store_id)` está disponível a anon/authenticated e devolve `{available,reason,timezone}`. reason=open/closed/unavailable; timezone=Africa/Maputo. Lojas não públicas devolvem unavailable sem metadados privados.
- `is_open=false` pausa sempre. Horário vazio/NULL preserva modo manual legado. Array configurado sem dia aplicável fecha. Dias0..6 são segunda..domingo. Intervalo [abertura,fecho), suporte overnight pela continuação do dia anterior. Horas iguais são inválidas, não representam24h.
- `kg_prepare_contact` e `kg_record_contact_activity` revalidam loja aberta/horário antes de devolver até um resultado idempotente antigo. Trigger protege INSERT/UPDATE directo de intents. Carrinho permanece utilizável em lojas publicadas fechadas/fora de horário.
- Preflight do browser imediatamente antes do WhatsApp é necessário. Servidor não revoga telefone/URL externa já conhecida; não afirmar bloqueio absoluto de mensagens externas.

## Verificação isolada
A suite `preparation-contact.sql` cobre: limites temporais e timezone; domingo→segunda overnight; horário vazio/dia omitido/fechado; contexto privado e acesso responsável; impossibilidade de activar/criar loja pelo vendedor; rascunho e configurações; fotografia; outsider/anon sem leitura privada; pending; activação administrativa; carrinho fechado; novos contactos e retries recusados; marcação directa whatsapp_opened recusada; horário configurado bloqueia apesar de is_open=true; suspensão retira preparação.

Suites existentes continuam a validar RLS, MFA, idempotência, variantes, stock, concorrência optimista e auditoria. PostgreSQL/PGlite é teste real SQL isolado mas não teste multi-conexão/SMTP/browser Auth.

## Ordem de revisão e implantação (não executada)
1. `20261113135534_merchant_preparation_contact_rules.sql`.
2. Migração independente `20261113135821_legacy_store_invariants.sql`, revista pelo agente de segurança, que mantém invariantes também nas APIs legadas.
3. Verificação de ACL/definições remotas; depois publicação coordenada frontend.
Não aplicar parcialmente sem rever cliente e estado remoto. A nova RPC de disponibilidade ausente deve falhar fechado para contacto, nunca bloquear carrinho.

## Registo normal de clientes: bloqueio confirmado
Leitura GET `/auth/v1/settings` do projecto actual, sem criar utilizadores ou enviar mensagens:
`disable_signup=true`, `external.email=true`, `external.phone=false`, `external.google=false`, `mailer_autoconfirm=false`.
Assim, adicionar formulário não torna registo funcional. Habilitar signup permitiria contas normais a visitantes; NÃO deveria criar loja, associação ou administração. Exige autorização específica de configuração Auth e validação de SMTP, remetente, Site URL/allowlist e callback de confirmação. Esses detalhes não são expostos pelo endpoint público nem pelo conector Supabase disponível nesta thread, pelo que não foram confirmados. Nenhuma configuração foi alterada. Não há confirmação de entrega email real. Não habilitar Google/SMS implicitamente.

## Revisão de lock e pré-check real (13/11/2026)
`guard_contact_open` agora adquire FOR SHARE na loja antes de permitir INSERT/UPDATE de intent. É função privada SECURITY DEFINER com search_path vazio e EXECUTE revogado para clientes: o lock como invoker era filtrado pela RLS UPDATE da loja para compradores. RLS da tabela de intents e privilégios de coluna continuam a restringir proprietário/status. Não foi relaxada política de loja. A suite SQL completa passou após esta alteração; não há PostgreSQL nativo/Docker para teste multi-conexão, pelo que concorrência foi revista por semântica dos locks e testes sequenciais, não anunciada como E2E concorrente.

Pré-check remoto somente leitura: 2 lojas, 0 aprovadas sem responsável activo; 1 horário manual/vazio e 1 configurado; 0 horários incompatíveis e 0 horários incompatíveis em lojas aprovadas. Consulta reproduzível em `supabase/tests/preflight-preparation-readonly.sql`; deve ser repetida antes de aplicar porque os dados podem mudar. Nenhum saneamento foi feito.

Impacto deliberado: a loja com horário configurado passa a ter bloqueio de pedidos fora do horário (antes o horário era informativo); a loja sem horário mantém controlo manual. Clientes antigos que tentem criar loja approved sem responsável passam a receber erro de validação pela migração de invariantes. Horários legados mal tipados, se aparecerem depois do pré-check, falham fechados e precisam revisão explícita, nunca conversão silenciosa.

## Aplicação verificável do Arsenal Orbion v4
Lidos README, agent-base-prompt, BE-01 Supabase, BE-02 PostgreSQL, BE-03 Backend e QUALITY-GATES. Aplicação concreta: estado remoto inspeccionado; contrato coordenado com UI; SQL/migrações e papéis permitidos/proibidos testados; revisão independente corrigiu lock e tipos de horário; pré-check e rollback separados de implantação; testes não executados identificados. Não foram visionados vídeos nem activados automaticamente os perfis de agentes da biblioteca. Critérios de browser, performance de campo e concorrência multi-conexão não são apresentados como cumpridos por testes SQL.

## Plano de rollback/recuperação do lote
Antes de aplicar: guardar definições/ACL actualmente remotas e versão do Site; repetir pré-check. Aplicar cada migração em transacção. Se a primeira falhar, rollback transaccional da própria migração; não publicar frontend que dependa dela. Se a segunda falhar, manter frontend anterior e rever o estado efectivamente aplicado antes de tentar novamente, sem repetir cegamente.

Após publicação, a recuperação preferencial é uma correcção para a frente ou um bundle de recuperação revisto, conforme `ROLLBACK-PREPARATION-CONTACT-2026-11-13.md`. Não restaurar cegamente o artefacto frontend v30: esse cliente pode iniciar WhatsApp sem a nova verificação e converter horários [] em semana fechada ao guardar identidade. Preservar as verificações de pedidos e retries, a distinção entre pergunta genérica e pedido, a serialização de horários manuais, o hardening backend e os dados existentes. Qualquer migração compensatória deve ser específica, revista e testada; não remover protecções para simplificar a recuperação.

Se houver necessidade concreta de reverter SQL, preparar migração compensatória revista a partir das definições/ACL capturadas, verificando dependências e dados criados entretanto. Não remover triggers de último responsável, afrouxar RLS ou repor contacto fechado por simples conveniência de rollback. Não usar CASCADE nem eliminar perfis, associações, horários ou rascunhos. Mudanças no significado de horários ou autorização exigem decisão e testes específicos. Nenhum rollback remoto foi executado.

Revisão independente da migração de invariantes: desenho aprovado após leitura de triggers e helper. Eliminar uma conta que seja último responsável de loja activa poderá ser recusado pela cascata; primeiro deve existir substituto ou a loja ser suspensa/encerrada por operação autorizada. Testes transaccionais não comprovam execução concorrente multi-conexão.
