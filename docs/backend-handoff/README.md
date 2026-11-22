# KAMBY — Handoff técnico de backend

Orbion Technology · Architecture, Data Engineering & Governance  
Revisão: 12/11/2026 · Base de implementação: `b8bc1ca1177653bd2599a56b71a323d03ce6f394`  
Estado: integração Supabase existente documentada; aceitação operacional pendente.

Este kit reconcilia a proposta de handoff com a implementação publicada. A interface já consulta e escreve no Supabase real. Não existe `USE_MOCKS`, `KAMBY_DATA`, `PDP_PRODUCTS_MAP` ou serviço `/v1` no percurso de produção. Não executar o DDL de tabelas `stores/products/product_media` fornecido na proposta sobre este projecto: criaria um segundo contrato incompatível com o frontend.

## Conteúdo

- [Contrato actual](CONTRACT.md): adaptadores, tabelas, RPCs, unidades, autorização e exemplos.
- [Diferenças e trabalho pendente](DECISIONS-AND-GAPS.md): proposta `/v1`, segurança e prioridades.
- [Aceitação operacional](ACCEPTANCE.md): evidências, testes e condições de passagem.
- [Verificação alojada somente de leitura](verify-readonly.sql).
- `../../supabase/migrations/`: DDL canónico versionado, incluindo RLS, grants, triggers e índices; não há DDL alternativo neste kit.
- `../../supabase/tests/` e `../../tests/`: testes automatizados; observar as restrições dos testes exclusivos de ambiente local.

Os caminhos relativos acima são para a cópia entregue em `docs/backend-handoff/` dentro do repositório. O pacote inclui as mesmas pastas e um manifesto SHA-256.

## Responsabilidades propostas

| Papel indicado pelo titular | Entrega a aceitar |
| --- | --- |
| ORB-13 · Principal Architect | Fronteiras de dados; decisão sobre futura fachada HTTP; critérios de passagem |
| ORB-20 · Technical Documentation | Contrato, alterações, provas e limitações verificáveis |
| BE-01 · Supabase | Auth, Storage, configuração de ambientes e migrações |
| BE-02 · PostgreSQL | Transacções, invariantes monetárias, permissões, pesquisa e desempenho |
| BE-04 · Application Security | Isolamento entre lojas, abuso, sessões e exposição de dados |

Estes papéis identificam responsáveis de recepção; não representam assinaturas de aprovação nem revisões independentes já realizadas. O conteúdo do Orbion AI Engineering Handbook v3.0 não foi disponibilizado nesta etapa; não se declara conformidade certificada com esse documento.

## Alvo confirmado em 12/11/2026

Supabase Kamby: `wbjhhkjriqeloiinvbii`. Objectos de domínio: `public.kg_*` e `kg_private`. Bucket `kg-product-images`: privado, máximo 5.242.880 bytes, JPEG/PNG/WebP. Consulta somente de leitura encontrou 0 lojas, 0 produtos e 4 categorias. Não foi criada uma loja demonstrativa para simular prontidão operacional.

| Migração local, em ordem | Versão no histórico alojado |
| --- | --- |
| `20261111070949_initial_greenfield.sql` | `20261111071816` |
| `20261111091750_managed_store_creation.sql` | `20261111093311` |
| `20261111134331_product_variants_and_pdp_contract.sql` | `20261111135134` |
| `20261111185031_merchant_workspace.sql` | `20261111185031` |
| `20261111213449_merchant_product_creation.sql` | `20261111213449` |

Os três primeiros identificadores locais diferem dos identificadores gerados pela aplicação alojada. Reconciliar o histórico por conteúdo e nome antes de automatizar `db push`; não reenviar migrações por comparar apenas os timestamps. Não renomear ou reparar o histórico de produção sem essa reconciliação. Num ambiente vazio, aplicar os cinco ficheiros locais em ordem com as dependências Supabase Auth/Storage disponíveis.

Actualização posterior: a sexta migração `20261112045650_settings_experience.sql` integra as Definições e a Pesquisa avançada. Consultar [o contrato desta integração](../SETTINGS-AND-SEARCH.md); a base histórica deste kit mantém o SHA indicado no início.
