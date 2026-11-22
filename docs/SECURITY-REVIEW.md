# Revisão independente de segurança — Kamby greenfield

Data: 11 de Novembro de 2026. Revisor: instância separada da autoria SQL. Estado: revisão técnica inicial concluída, sem bloqueadores altos na migração exacta abaixo. Este documento não autoriza publicação nem substitui verificação do ambiente alvo.

## Escopo e fronteiras

A revisão cobre o contrato de início, SQL de `supabase/migrations/20261111070949_initial_greenfield.sql` (igual ao draft revisto), políticas/grants/funções/Storage e as regras de carrinho/contacto. A autoria do SQL pertence à instância de base de dados; o revisor não modificou essas implementações nem executou writes remotos.

Fronteiras de confiança: visitante → catálogo autorizado; comprador autenticado → perfil/carrinhos/intenções próprios; dono → candidatura e catálogo da própria loja aprovada; administrador provisionado no servidor → decisões independentes, moderação e auditoria. O cliente e `user_metadata` não concedem privilégios. A negociação continua num serviço externo e não constitui confirmação de venda.

Reutilizar Auth do Supabase existente preserva configuração/triggers/sessões anteriores. As tabelas novas isolam o novo domínio comercial, mas não criam separação integral entre staging e produção nem revogam automaticamente tokens antigos. O projecto antigo não foi auditado integralmente nesta revisão.

## Achados na primeira proposta

| ID | Gravidade | Achado | Correcção requerida | Estado |
|---|---|---|---|---|
| S-01 | Alta | Bucket de imagens público com SELECT irrestrito permite acesso a imagens de rascunhos/suspensos por URL | Bucket privado; acesso de dono/admin e público apenas para produto publicado em loja aprovada; frontend resolve URLs autorizadas | Corrigido; leitura e suite SQL PASS |
| S-02 | Alta | Validações de `kg_private.prepare_contact` usam comparações que deixam SQL NULL passar: items=NULL ou quantity ausente/null | Rejeitar explicitamente NULL/tipos errados/props obrigatórias; quantidade inteira positiva limitada | Corrigido; leitura e suite SQL PASS |
| S-03 | Média | Até 100×999×900000000000 centavos excede Number.MAX_SAFE_INTEGER e pode perder precisão no cliente | Limites coerentes frontend/backend e cap de subtotal seguro | Corrigido; leitura confirmada |
| S-04 | Média | `kg_product_images.storage_path` não garante no primeiro draft associação ao owner/store/product correcto | Constraint/trigger/policy de caminho consistente e testes cruzados | Corrigido; leitura confirmada |
| S-05 | Média | `kg_stores.review_reason` é seleccionável por visitantes em lojas aprovadas | Manter motivo administrativo apenas no recurso protegido de revisão/aplicação | Corrigido; leitura confirmada |
| I-01 | Integração | Domínio aceita máximo99, SQL máximo999; regras divergentes | Unificar limite de quantidade e documentar | Alinhado em 99 no SQL e no domínio |
| I-02 | Integração | Revalidar apenas antes do RPC pode deixar resumo editado stale durante alteração concorrente de preço/contacto | Comparar snapshot de servidor com revisão e exigir nova revisão quando divergirem | Integrador corrigiu comparação de snapshot; verificação E2E ainda necessária |

## Controlos observados na primeira proposta

- Tabelas novas com RLS e revogação explícita de grants gerais; concessão de colunas mutáveis específicas.
- Papéis administrativos em tabela privada; `is_admin` não depende de claims editáveis pelo utilizador.
- Identidade/owner de loja e identidade/store de produto protegidos por trigger e colunas permitidas.
- Loja inserida pelo utilizador fica pending; administrador dono da própria loja não pode aprová-la.
- Catálogo público exige produto published e loja approved.
- Carrinhos limitados ao comprador; trigger impede produto de outra loja e tira preço do catálogo.
- Snapshots de contacto derivados no servidor, sem conversa privada ou dados pessoais do comprador.
- Contactos têm apenas prepared/whatsapp_opened, sem estado de venda concluída.
- Auditoria criada por triggers e sem INSERT/UPDATE/DELETE concedidos ao cliente.
- Funções auxiliares privilegiadas em schema não exposto, search_path fixo e EXECUTE revogado por defeito; wrappers públicos com autenticação explícita.

A versão final foi re-inspeccionada e a suite SQL executada por esta instância independente. Não foram encontrados bloqueadores altos no escopo da migração inicial. Esta conclusão é limitada aos caminhos cobertos e ao ambiente PostgreSQL/PGlite com plataforma simulada; não demonstra comportamento completo do Supabase hospedado, Auth/email, navegador ou clientes antigos.

## Verificação e limites

Executado nesta revisão:

- Leitura do pacote de referência (66 ficheiros, incluindo Word com tabelas e imagens conceptuais).
- Inspecção estática das propostas SQL, tipos/domínio e dos pontos de integração de contacto/imagens do frontend.
- `kamby-brief/tests/validate.py`: PASS para integridade dos perfis/governança; validação adicional Draft202012Validator confirmou as inconsistências dos templates descritas no mapa de cobertura.
- Consulta somente de leitura às políticas de `storage.objects` no Supabase alvo: as políticas anteriores estão limitadas aos seus próprios buckets; não foi encontrada uma policy geral que abrangesse `kg-product-images`.
- Execução independente de `npm test --prefix supabase/tests` no worktree de base de dados: PASS na compilação da migração; PASS em RLS/aprovação de loja/isolamento de carrinhos/snapshots gerados no servidor/denúncias/auditoria/Storage privado; PASS no rollback de fixtures e configuração do bucket (privado, limite 5 MiB, JPEG/PNG/WebP).
- Re-inspecção do fix de idempotência: a chave é validada antes e depois do conflito de inserção, incluindo loja distinta e argumentos NULL; quantidade máxima 99 em ambas as camadas.

Artefacto SQL revisto: `supabase/migrations/20261111070949_initial_greenfield.sql`.

SHA-256 revisto e executado: `03f7c674d34a997d06a4e8389e7446dc72f24c3244ff9ab1405a8f46a4be4d3b`.

Não executado pelo revisor: migração hospedada; chamadas REST com perfis distintos; testes do serviço Storage HTTP; envio/entrega de recuperação por email; E2E de navegador; testes concorrentes reais; carga; scanner de dependências; auditoria integral da base legada; teste real em Android/iOS; pentest. A suite SQL usa um mock mínimo de Auth/Storage sobre PostgreSQL/PGlite; não testa os serviços Supabase. Resultados de execução no alvo e frontend precisam ser reportados pelo integrador com evidência.

Os findings S-01..S-05 estão corrigidos na migração deste hash. A suite revelou também uma correlação SQL ambígua em `name` no Storage; o autor qualificou as referências como `storage.objects.name`, e a versão corrigida passou a suite. Os ajustes de integração reportados pelo integrador incluem revalidar também a loja para visitantes, comparar snapshot/quantidades/preços/contacto antes de abrir WhatsApp, invalidar resumo quando o carrinho muda e resolver URLs de imagem com assinatura temporária sem persistir o token no produto. Esta instância ainda não verificou esses ajustes num navegador.

A aplicação das novas tabelas `kg_*` pode seguir dentro do escopo autorizado pelo utilizador, mantendo os dados anteriores, com verificação no alvo após a migração. Esta é uma conclusão de revisão técnica da base inicial; não é uma autorização de release nem uma declaração de conformidade/segurança integral.

Continuam decisões operacionais: comprovação da posse do número WhatsApp, anti-spam/rate limit de candidaturas/denúncias/contactos, retenção e anonimização, termos e recuperação/backups. São requisitos de preparação de piloto; não constituem funcionalidades já verificadas.
