# Rastreabilidade do mandato Kamby

Data: 11 de Novembro de 2026. Revisão independente de requisitos. Estado: início de implementação; não é declaração de conclusão ou autorização de publicação.

## Correcção do titular

A regra actual é criação de lojas pela gestão. As referências abaixo a candidatura/vendedor descrevem o pacote original e não autorizam esse fluxo no produto. `CORRECTION-BRIEF.md` e `adr-002-managed-stores.md` registam a decisão que as substitui. O público não tem criação/candidatura.

## Base de referência

O pacote Kamby.zip contém 66 ficheiros: 55 Markdown, três Word, duas imagens conceptuais, quatro JSON, um YAML e um script Python. A análise documental abrange os requisitos, governação, todos os 30 perfis, ordens de trabalho, documentos Word com as respectivas tabelas e as duas imagens. A leitura dos documentos não significa que todos os entregáveis tenham sido implementados ou validados.

A missão mestra v6, consolidada no README v7, governa as decisões de produto. O manual de marca é direcção conceptual. Exemplos antigos que dizem «Encomenda recebida» ou «Pagamento» não se aplicam ao percurso actual de intenção de contacto. O WhatsApp não confirma vendas.

## Critérios de rastreabilidade

| ID | Critério do mandato | Implementação atribuída | Evidência necessária para encerrar |
|---|---|---|---|
| GF-01 | Projecto novo, sem cópia automática de código, UI ou schema anterior | Integrador, novo checkout e branches | Histórico Git inicial, diffs, contrato e identificação do novo Site |
| CAT-01 | Catálogo de produtos publicados em lojas aprovadas | Integrador + base de dados | Consulta RLS anon; pesquisa e produto privado em E2E |
| CAT-02 | Pesquisa por texto, categorias apenas com produtos, paginação sem duplicações | Integrador | Pesquisa vazia, mudança de filtro, paginação e revisão visual |
| CAT-03 | Fotografia, preço, loja, disponibilidade e falha de imagem | Integrador | Estados e comportamento verificados no navegador |
| STR-01 | Página pública própria de loja, descrição, contacto e catálogo | Integrador | Deep link e navegação sem mistura do catálogo de outras lojas |
| STR-02 | Localização aproximada e horário informado | Integrador / vendedor | Campos e apresentação correspondentes; horário continua pendente se não existir no schema/UI |
| STR-03 | Contacto sintacticamente válido e processo real de verificação | Base de dados + vendedor/admin | E.164 é apenas validação sintáctica; verificar posse do WhatsApp continua decisão operacional pendente |
| CRT-01 | Carrinhos separados por loja | Domínio + integrador + base de dados | Testes com produtos de duas lojas e restrições SQL |
| CRT-02 | Quantidade positiva, dinheiro inteiro, persistência por utilizador | Domínio + integrador | Limites e overflow; refresh e troca de conta; persistência cloud/cross-device precisa implementação própria |
| CRT-03 | Revalidar produto, preço e disponibilidade antes do contacto | Domínio + integrador + base de dados | Produto removido/oculto, preço alterado, sem stock e loja suspensa |
| WAP-01 | Mensagem editável, resumo de uma loja, subtotal indicativo | Domínio + integrador | Acentos, URL encoding, mensagem longa e cancelamento |
| WAP-02 | Abertura apenas por gesto, link oficial wa.me, sem envio automático | Integrador | Gesto, fallback de abertura e navegação externa testados |
| WAP-03 | Contact intent após acção explícita; prepared/whatsapp_opened nunca venda | Base de dados + integrador | Snapshot autorizado, status limitado e ausência de métrica de vendas fictícia |
| AUT-01 | Registo, login, sessão, recuperação e conta | Conta | Percurso real de Auth e recuperação; envio de email não implica entrega confirmada |
| AUT-02 | Papel administrativo verificado no servidor, sem user_metadata | Base de dados + conta | Não-admin impedido via REST/RPC, provisionamento confiável, testes de permissões |
| SEL-01 | Candidatura e estados draft/pending/approved/suspended/rejected | Vendedor + base de dados | Candidato não se aprova; suspensão bloqueia publicação |
| SEL-02 | Vendedor aprovado gere apenas catálogo próprio | Vendedor + base de dados | SELECT/INSERT/UPDATE/DELETE positivos e cruzados entre lojas |
| SEL-03 | Imagens/stock/preço/contactos e publicação | Vendedor + base de dados | MIME/tamanho/path de storage, ownership e acesso público correcto |
| ADM-01 | Fila de aprovação e decisão fundamentada com auditoria | Administração + base de dados | Operação transaccional, autoria e log protegido |
| ADM-02 | Denúncias, moderação de conteúdos e categorias | Administração + base de dados | Dono não encerra denúncia; admin resolve/suspende e audita |
| ADM-03 | Gestão de contas, configurações e auditoria consultável | Administração | Não confundir um dashboard inicial com cobertura integral destes módulos |
| MET-01 | Indicadores reais e definidos: lojas, produtos, intenção de contacto | Administração + dados | Definições, fontes, privacidade; abrir WhatsApp não mede venda |
| UX-01 | Mobile-first, claro/escuro, UI limpa e ícones consistentes | Integrador + conta | Telemóvel/desktop, contraste, teclado, foco e targets |
| UX-02 | loading/empty/offline/error/unauthorized e estados comerciais | Todos | Matriz de estados e verificação visível |
| UX-03 | Reduced motion e animações com propósito | Integrador | Emulação da preferência e avaliação manual |
| PWA-01 | PWA, instalação, cache e desempenho em Android/iOS | Integrador + qualidade | Manifest/service worker; offline; aparelhos reais e métricas ainda não demonstrados |
| SEC-01 | RLS, grants mínimos, constraints, índices, transacções e idempotência | Base de dados | Revisão independente e testes SQL contra alvo isolado |
| SEC-02 | Sem service_role no browser; storage policies; logs sem PII | Integrador + base de dados | Inspecção de bundle, políticas e logs |
| SEC-03 | Recuperação, backups, retenção e observabilidade | Engenharia / operação | Runbook e ensaio; política de retenção continua decisão pendente |
| QA-01 | Unitários, integração, E2E, concorrência, acessibilidade e carga | Domínio + qualidade | Resultados efectivamente executados, distinguidos dos não executados |
| REL-01 | CI, staging, revisão, evidências, rollback e autorização para release | Integrador / responsável humano | Sem publicação automática por mera existência do pacote |

O estado operacional de cada linha deve ser reconciliado com os relatórios de execução e testes no fim desta entrega. A coluna «implementação atribuída» identifica o responsável actual; não significa conclusão.

## Decisões provisórias da primeira base

O contrato inicial escolhe React/Vite/TypeScript, monólito modular, moeda MZN, uma loja por vendedor, preços e stock indicativos e carrinhos locais por conta/dispositivo. Visitantes podem explorar e contactar; autenticação é necessária para administração, gerir loja e gravar histórico de intenção associado a conta. Estas escolhas resolvem o arranque e permanecem alteráveis por validação de produto.

O Supabase existente é reutilizado com novas tabelas `kg_*`; não há importação dos dados comerciais anteriores. Auth partilhado não constitui isolamento completo de ambientes: clientes antigos, triggers existentes e configuração global de Auth/Storage continuam a pertencer ao mesmo projecto. Não descrever esta opção como um Supabase novo ou um reset integral.

Continuam por validar: mercado/zona inicial; segmentos; critérios e documentos de aprovação de vendedores; comprovação do WhatsApp; política anti-spam; limites de catálogo; retenção; termos e responsabilidade; marca/SVG mestre; pesquisas e testes com utilizadores consentidos. Comissões, pagamentos internos, logística e IA de recomendação estão fora da fase inicial.

## Correspondência de agentes e execução real

Os 30 perfis são especificações de funções. As instâncias desta execução agrupam competências com escopo verificável: integrador, base de dados, domínio/testes, conta/vendedor/admin e revisão independente. Isto não significa que 30 agentes estejam activos ou que pessoas citadas como referências metodológicas participem na execução.

A execução usa worktrees isoladas e um único dono de escrita por módulo. O revisor não implementa o SQL que revê. Nenhuma instância pode aprovar o próprio código crítico nem converter uma revisão técnica em autorização de produção.

## Inconsistências documentais registadas

1. `AGENT-WORK-ORDERS.md` usa ORB-01..12 e ORB-21..30; o registry usa FE-01..06, BE-01..06 e BR-21..30. A função/nome é a correspondência; os IDs canónicos são os do registry.
2. `examples/kamby-brand-task.json` não contém `repository`, `environment` e `risk_level`, obrigatórios em `task.schema.json`.
3. `templates/task.yaml` inclui campos não admitidos pelo schema e usa `destructive_operations` onde o schema espera `destructive`. O novo projecto deve gerar contratos coerentes em vez de copiar esse modelo sem revisão.
4. `tests/validate.py` passou a verificação de integridade de 30 perfis e governança nesta execução. Uma verificação adicional com `jsonschema.Draft202012Validator` confirmou: sample-task PASS; kamby-brand-task FAIL pelas três propriedades ausentes; task.yaml FAIL por campos extra/incompatíveis e placeholders vazios. O script original não valida integralmente JSON Schema nem testa software, Auth, RLS, marca ou E2E.
5. O manual conceptual inclui frases de encomenda/pagamento incompatíveis com o escopo WhatsApp actual. As regras da missão mestra prevalecem.
6. Os painéis usam paletas e símbolos ligeiramente diferentes. São propostas visuais; não comprovam SVG final, licença SF Pro, exclusividade jurídica, contraste ou marca registada. Não usar ®.

## Inventário da referência

Os hashes identificam os bytes consultados; não exprimem aprovação do conteúdo.

| Ficheiro | SHA-256 |
|---|---|
| `README.md` | `525304d514b739503b1fdeb87789f283c912ed038d56852ea0af7d67a0a27e9e` |
| `agents/be-01-supabase-platform.md` | `d9c80deeb3c72b48f210e4b5fd8130b6fcc0513c0d9669d1d91964149154fd12` |
| `agents/be-02-postgresql.md` | `5965873a3018197386e970bbb51703dac81ef1b4d2d6c242801bc7ce3a77489c` |
| `agents/be-03-backend-systems.md` | `295e047545385b0012c6476926c6ec552e6374cbc6b6fb41b1045c162df81865` |
| `agents/be-04-application-security.md` | `e66f5acb4cf059a892ae84f9f0f4d0c20bf679f7be97cffe51bfbe594e2971f4` |
| `agents/be-05-scalability.md` | `7a4cbc334ec81d10c01e060b478ac03e8a0e7141109fcd72b92ec8e851cfe2a6` |
| `agents/be-06-sre-and-quality.md` | `45f0da2e9876e9e1c99d9e5ce532e6c0e8b3242441e00de3f6b7ad3aad9a4275` |
| `agents/br-21.md` | `e8735d289f6f5e35ab5c20814c265c84a90acff1b89b010ed23332529a10dd12` |
| `agents/br-22.md` | `5d4d6a89087e7183b849641bf4ade2658ba90043f19e746f222bf0d11a1f143a` |
| `agents/br-23.md` | `c836bd5a1a6133aba3234b673cb8c7edf69376229c6c020f20441287b353198b` |
| `agents/br-24.md` | `10ff0e9a7ee75824ac03816ee4faf46d89da1b34383a5a42b9fa287612c66345` |
| `agents/br-25.md` | `def395e99fe90153d110dd4a1fc4a0cbbcb68a176fe7062fc157c3ee031f583d` |
| `agents/br-26.md` | `db2df3efa9f65ea8b62a2c34a661e81e07cbb42a33f09a93d5bd9d7e21495442` |
| `agents/br-27.md` | `f8a97b7aab7fceb1ea0cf26e256815bf02f224e356ce70a47563929bc2ef9dee` |
| `agents/br-28.md` | `a6bc65748265a1587234c28a823ca7625d6e23bdb82e4ac230145fe476bdabf3` |
| `agents/br-29.md` | `59d9926b00e92ba5ae31297fdef03a44147881e41e3e2d9d95d40e98cf24f53b` |
| `agents/br-30.md` | `1895ea684825daa917995de0da7fc1c3111f8a9570f22d33915c54fb3820c5d6` |
| `agents/fe-01-frontend-architecture.md` | `8efee26db5b705d9acf91ec92ccc902bbe3543e1fb92e2289cc882d2c5e8dfbd` |
| `agents/fe-02-visual-engineering.md` | `758e22ba9a4a70a683746b395d5a6959482e044e16ccd1c84e67e0f6b8ae93c4` |
| `agents/fe-03-product-ui.md` | `407326dae1ccc068bea9b4760a48648daf2bc4781b73795128d60ef04ee6ed21` |
| `agents/fe-04-ux-research.md` | `e00c82a897480000e1b1631e0ef94a65763f3eccc93d6744ec3725371e0627db` |
| `agents/fe-05-motion-engineering.md` | `6c6ec30918720b26aefa353a907d672e0adc9f5c4ed466bb64fad2bd85c3364a` |
| `agents/fe-06-web-performance.md` | `267f9115b1349c6106db2a3b9ed072af4d317a1ebcfb933a6635baf5fe3eedf1` |
| `agents/orb-13.md` | `d98cbe83738ca132f3af2a4137199a27092c301511cab4e0bbd78ca6b2e5fb83` |
| `agents/orb-14.md` | `81a6e6e9078f4c99996c3f1ca66cf15a3e93f7cec3ae03da0b73dfa6e664225d` |
| `agents/orb-15.md` | `c4966a39772ca914add23494e3996782961022f3ff1b1bd3a12dfa513c778d80` |
| `agents/orb-16.md` | `28ab865ece81b2e6278e3b5739605a64669c096c78f553d97512fef0c014f518` |
| `agents/orb-17.md` | `7793a2d87489d906e2ddb0839e410d5e06089112c9448244a3172032de2ad174` |
| `agents/orb-18.md` | `3647ed7bac84c68b05b277c6974aea874cdce7c48dc9417b1f6058775565f836` |
| `agents/orb-19.md` | `e7857609a5ae0f5a281d10d2c0edf89b7405e4ae93233d917f0390ca9711f239` |
| `agents/orb-20.md` | `3f5150c831ef0bf1019d5815f9085013e99ef97d2efc9d979d596362c01da4a4` |
| `examples/kamby-brand-task.json` | `6be9e91b014f927ebfc1294e10a1b80375ba891f54832fe190f6e3693a865ff4` |
| `examples/sample-task.json` | `d24aa0ddc8ebbc2722be0fd9915733d01cc5684356afaaf8d311f09d09c4ccb0` |
| `governance/BRAND-OWNERSHIP.md` | `4e1a8615fc9a863fc021c73c80a79eca62792c4b70c745ad211584a31f2160b6` |
| `governance/ENGINEERING-STANDARDS.md` | `8262df5669ef6aa0952242ffd5712c44ec323dc50b991b80acadc679113309b9` |
| `governance/KAMBY-BRAND-STANDARDS.md` | `5f3573506f0145db854c6517b682fdc71a26703488b8bffa002b04c672ef609c` |
| `governance/OWNERSHIP.md` | `2fa14678295c44e710cb7e05ac92393175bd573d603693226e5782592839254a` |
| `governance/QUALITY-GATES.md` | `75d9669cf764bfc8eae8da02f2eacf3762613b0a5aa3d8689f2d0b1168d97f41` |
| `governance/SECURITY.md` | `fc917f31c74e33d7010a745aa7d6d1168536e12be102c677baa4a33451f5011c` |
| `governance/agent-base-prompt.md` | `be297f4957804dd8c8986994095f6b703617eea3aeeda092310c18342b92a372` |
| `orchestration/POLICY.md` | `5baeaf1d419d5d1dae55d750fafa338dd2779c2f330e4b8759266a1ea4eddace` |
| `orchestration/registry.json` | `52a03b1bce545566a069879420099d8cc55a8e04d630578a423e65eb1805812d` |
| `orchestration/task.schema.json` | `2fbf1ec4758adf5fbb0cb056844d9ad7bdcfefba8e18304a76606e6d58cd40a8` |
| `projects/kamby/00-PROJECT-CHARTER.md` | `4b439c3856ec7b6a83ce07053a53b4e9ad1b04bef122771b47783f98f3f51510` |
| `projects/kamby/01-PRODUCT-REQUIREMENTS.md` | `19fff9c385ff8b32218ec0f355cc7da84adcb5f55bcf9186349ef3d0a4f66977` |
| `projects/kamby/02-ARCHITECTURE.md` | `3137009d0a875166c8b600f969266f42b509206f3ff57821706ea0fac4327d87` |
| `projects/kamby/03-DATA-MODEL.md` | `26c2262ca24a82e1c23038d5e586dfcdda9d8593f00cc6e864d6480d441dc430` |
| `projects/kamby/04-BRAND-IMPLEMENTATION.md` | `102af9eac8a3ce293bcc79f353e42b6e9da0daddc053aa6f461b23310027cb01` |
| `projects/kamby/05-CONTENT-AND-WHATSAPP.md` | `2549bf5097ad53781ae9633a33186ade612284a990d3e81b3d63b5815569c918` |
| `projects/kamby/06-AGENT-EXECUTION.md` | `11da29de29c078333a328319b8bb47e09fe5b4670a0c0c281335815c03558748` |
| `projects/kamby/07-ACCEPTANCE-TESTS.md` | `2eff48c024373b8e4463742b460395c98947d497bed015f8ced514460cb0bf7a` |
| `projects/kamby/08-OPEN-DECISIONS.md` | `65637c831e69f2dec8c8c950579692e1c90fee02e803362504aaaf7a0641e403` |
| `projects/kamby/AGENT-WORK-ORDERS.md` | `8f54870a033b537fd54bc3f04a941d65bcae60b84b7ccb1bf208a8b8901e23cd` |
| `projects/kamby/DEFINITION-OF-DONE.md` | `2daae20dea9c6ef6b6cb4a05e455d23dc1f41b9c0672a3ed59ec9e38185869e4` |
| `projects/kamby/EXECUTION-START.md` | `b2f2e9395e2cff1607f6fc7e7ef6d038297456b8bda8c434f28eb8ea755b710d` |
| `projects/kamby/MISSION-MASTER.md` | `37f7577e0896c4d9719b6564ac14b0cc61f829b6813a37879dc562671ed23fea` |
| `projects/kamby/Orbion_Kamby_Mandato_Greenfield_v5.docx` | `d2d7856f68c90f3e9765428eb6554b714cce81b9105ce305deeaaf0f35eb4dd5` |
| `projects/kamby/Orbion_Kamby_Missao_Roadmap_v6.docx` | `fd8c54dbf6488f50b224934218fe181a9c6f02e9a4af6478edb41c95eff17927` |
| `projects/kamby/ROADMAP-MASTER.md` | `951a0bb2c81ece7546ae2ddfe6b31ae150831a5f938ee18af64441dcefe2cfb7` |
| `projects/kamby/brand-assets/Exploracao_Visual_Alternativa.png` | `95b0933f9d251c45a606b7e58b1384600914040fed8c5b62fc3f3a83859c90b8` |
| `projects/kamby/brand-assets/Kamby_Manual_Identidade_v1.docx` | `975ffa5c41a74c5be2608d483ef3d455e8363fed6596124a2bdc16157e67a7fd` |
| `projects/kamby/brand-assets/Painel_Identidade_Conceito.png` | `c739c67401d0058fa2363109f1a415dc212ce1e6470859fa5592146310ed2b3a` |
| `templates/adr.md` | `8fbab4ac2c951082b02220b0550da80d18ec7c3d30587acc7a20cf9806300470` |
| `templates/brand-brief.md` | `40036c99f77dab091a0d286f6c9a833e371db76e13a620a7b1dacd7df15d1aa9` |
| `templates/task.yaml` | `0b159231830711c0eed6494492532a02bd0ff2650a9aac202bf472a8f6120024` |
| `tests/validate.py` | `3befa52357ec9f6230c29ccddf9adbf6c9f46ba31884c64499fb74d664a5b9f7` |
