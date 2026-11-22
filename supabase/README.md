# Kamby — dados e permissões

## Regra vigente

As lojas são criadas pela gestão Kamby. O cliente não cria nem candidata lojas, incluindo chamadas directas à Data API. Uma conta administrativa pode criar e gerir várias lojas. O catálogo público contém apenas produtos publicados de lojas publicadas (`status='approved'` no contrato SQL).

O projecto continua a usar somente objectos `public.kg_*`, `kg_private` e o bucket privado `kg-product-images`. Nenhuma tabela comercial da implementação anterior é copiada ou removida. Auth existente continua partilhado. Só inserir dados fictícios quando expressamente autorizados pelo titular; o lote autorizado em 12/11/2026 usa `is_test=true` e contactos em simulação.

## Migrações

1. `migrations/20261111070949_initial_greenfield.sql`: base inicial já aplicada; preservada sem alteração. SHA-256 `03f7c674d34a997d06a4e8389e7446dc72f24c3244ff9ab1405a8f46a4be4d3b`.
2. `migrations/20261111091750_managed_store_creation.sql`: correcção de criação central de lojas. Criada com `supabase migration new managed_store_creation` (CLI v3) e aplicada no projecto Kamby.
3. `migrations/20261111134331_product_variants_and_pdp_contract.sql`: contrato da página de produto. Acrescenta unidade de referência, variantes, carrinho por variante e snapshots WhatsApp com preço calculado no servidor. Criada com Supabase CLI v3.1.0 e aplicada no projecto Kamby como versão alojada `20261111135134`.

4. `migrations/20261111185031_merchant_workspace.sql`: Auth do lojista, atribuições privadas, preços/stock com concorrência e métricas.
5. `migrations/20261111213449_merchant_product_creation.sql`: categorias solicitadas, upload privado e criação atómica/idempotente.

O contrato actual resulta das cinco migrações em ordem. Não reaplicar a migração inicial num alvo que já a recebeu. `schema-proposal.sql` é apenas um apontador para as migrações, evitando um terceiro schema divergente.

A correcção remove a unicidade de `owner_id` e adiciona índice não único, sem apagar lojas. O estado inicial passa a `draft`. A tabela `kg_store_applications` permanece histórica; lojas geridas e alterações de estado não geram candidaturas. Os estados antigos `pending/rejected` permanecem na constraint por compatibilidade com eventuais registos anteriores, mas não são permitidos em novas lojas nem em novas transições pela gestão.

## Contrato de gestão

- `kg_is_admin()`: consulta membership em `kg_private.admins`, sem confiança em `user_metadata`. O browser nunca recebe uma chave secreta.
- `kg_create_store(p_name text,p_description text,p_whatsapp_e164 text,p_location text,p_status text)`: exige admin no servidor; aceita `draft|approved`; retorna `kg_stores`. `owner_id` é sempre o identificador autenticado do criador; o cliente não escolhe o proprietário. O slug é normalizado e recebe sufixo UUID no servidor. O mesmo admin pode criar várias lojas.
- REST directo `INSERT kg_stores`: RLS e trigger impõem as mesmas regras. Uma conta comum não consegue criar loja, atribuir `owner_id` de outra pessoa ou publicar através de um payload manipulado.
- `kg_update_store(p_store_id,p_name,p_description,p_whatsapp_e164,p_location,p_status,p_reason)`: admin-only, actualiza dados e estado numa única operação atómica com as mesmas validações e auditoria. Se a validação ou a suspensão falhar, nenhum campo é guardado. É o contrato da edição na interface de gestão.
- Dados da loja: `UPDATE name,description,whatsapp_e164,location` por conta autorizada. ID, proprietário e data de criação são imutáveis. Todas as escritas são exclusivas da gestão. `owner_id` regista o criador e o prefixo das imagens; não concede qualquer privilégio residual. Retirar uma conta de `kg_private.admins` retira leitura privada e escritas de catálogo imediatamente nas políticas, sem depender de claims JWT antigas.
- `kg_review_store(p_store_id uuid,p_status text,p_reason text default '')`: nome interno mantido por compatibilidade; agora gere publicação (`draft|approved|suspended`). Um administrador pode gerir lojas que criou e lojas criadas por outro administrador. Suspender exige motivo com pelo menos três caracteres. Não é um processo de candidatura ou auto-aprovação de vendedor.
- Produtos: admin pode criar, editar, arquivar e remover em qualquer loja. Não existe nesta revisão um papel de operador delegado. Produto publicado exige sempre loja publicada. Preço inteiro em centavos MZN entre 0 e 900000000000; quantidade no carrinho até 99.
- Variantes: `kg_product_variants` guarda SKU globalmente único, opção visível, preço em centavos, disponibilidade e stock. O catálogo público só lê variantes de produtos publicados em lojas aprovadas; toda escrita continua exclusiva da gestão. Produtos antigos sem variantes permanecem compatíveis. Quando uma variante é indicada, o servidor valida produto, disponibilidade, stock e preço.
- Imagens: bucket privado, até 5 MiB, JPEG/PNG/WebP. O caminho é `owner_id_da_loja/store_id/uuid.ext`, inclusive se outro administrador fizer o upload. As policies exigem loja e prefixo correspondentes. Admin pode preparar imagens em loja em rascunho; clientes comuns, incluindo um criador que perdeu o papel admin, não podem usar caminhos de lojas geridas nem ler imagens privadas. Paths/associação de produto são também verificados por trigger. Guardar URL canónica no produto; usar URL assinada de curta duração na visualização.
- Galeria: `kg_product_images` é o contrato canónico de `product_media`; associa até dez caminhos privados por produto através de `sort_order`. Não se cria uma segunda tabela com URLs públicas divergentes.
- Auditoria: só triggers escrevem; só admin lê. Eventos `store.created`, `store.published`, `store.unpublished`, `store.suspended`, `store.updated` guardam actor real e estado. O motivo de suspensão fica somente na auditoria protegida; não introduzir dados pessoais nesse texto. Eventos de produto/categoria/denúncia mantêm autoria automática. Nenhum cliente pode forjar actor ou inserir eventos.

## Comprador

`kg_set_cart_item(p_product_id,p_quantity)` mantém compatibilidade com produtos sem variantes. `kg_set_cart_item(p_product_id,p_variant_id,p_quantity)` guarda a opção seleccionada e o preço da variante no servidor, separa carrinhos por loja e aceita zero para remover. O frontend pode usar persistência local enquanto a sincronização cloud não estiver ligada; não afirmar que existe sincronização entre dispositivos sem a executar.

`kg_prepare_contact(p_store_id,p_items,p_request_id)` aceita `variant_id` opcional em cada item, deriva SKU, opção, unidade, preço e subtotal do catálogo actual, limita até 100 combinações únicas e é idempotente por conta/chave. Preços enviados pelo cliente são ignorados. Estados `prepared|whatsapp_opened` nunca confirmam venda. `kg_reports` e `kg_resolve_report` mantêm acesso próprio/admin e decisão fundamentada. Todos os recursos públicos têm RLS e grants explícitos.

O WhatsApp é validado sintacticamente em E.164; +258 aceita oito ou nove dígitos nacionais, em coerência com o domínio cliente. Isto não comprova posse do número nem conta WhatsApp activa.

## Verificação local

```sh
npm ci --prefix supabase/tests
npm test --prefix supabase/tests
```

O harness PostgreSQL/PGlite aplica as migrações em ordem, preserva o teste histórico da base inicial e executa o contrato actual. Testa criação exclusiva pela gestão, variantes públicas e privadas, múltiplas imagens ordenadas, preços de variante controlados pelo servidor, stock, carrinhos, snapshots WhatsApp, despromoção administrativa, auditoria, idempotência e denúncias. Confirma rollback e configuração privada do bucket. O mock Auth/Storage não substitui o servidor Auth, emails, HTTP Storage ou E2E no navegador.

Depois da terceira migração, uma verificação transaccional no Supabase alojado criou loja, produto, variante, carrinho e snapshot WhatsApp, confirmou o preço da variante e a leitura pública por RLS, e terminou em `ROLLBACK`. O alvo permaneceu com zero produtos, variantes e carrinhos. Os advisors não reportaram nova falha de segurança; o índice de variantes aparece apenas como ainda não utilizado porque o catálogo está vazio.

## Verificação no Supabase alojado

O autor desta correcção não executa writes remotos. Depois de revisão independente, o integrador aplica apenas a segunda migração e verifica o alvo. Consultar advisors e confirmar que clientes sem papel administrativo não conseguem inserir lojas por REST/RPC.

A suite transaccional alojada é gerada por `tests/make-hosted-test.mjs`, recebendo por stdin quatro UUIDs reais distintos: `sellerA`, `sellerB`, `buyer`, `admin`. Os dois primeiros nomes são compatibilidade do harness; representam contas comuns, não vendedores a candidatar lojas. Seleccionar três contas comuns sem membership e uma conta admin. O SQL não cria ou altera `auth.users`; usa uma segunda membership administrativa temporária para o teste cross-admin, que termina em ROLLBACK com todos os fixtures. A última query devolve `kamby_greenfield_rls_suite=passed_with_explicit_not_run`, distinguindo os casos executados dos não executados. O servidor Supabase protege `storage.objects` com `storage.protect_delete`: DELETE directo por SQL é recusado antes de avaliar RLS, mesmo se a conta não pudesse remover linhas. O gerador alojado preserva esta protecção e substitui somente esse caso por UPDATE de metadados negado ao ex-admin; acrescenta UPDATE de metadados permitido ao segundo admin, mantendo os INSERT/SELECT de metadados já existentes. O resultado explicita `casesStorageSQLdelete=not_run_provider_requires_api` e `casesStorageHTTPdeleteE2E=not_run`. Estes testes manipulam apenas fixtures de metadados revertidas; não carregam nem apagam ficheiros reais e não demonstram o percurso HTTP da Storage API. A suite PGlite original mantém o caso DELETE integral, sem adaptações. Um teste local separado executa o SQL gerado com uma recusa de DELETE por statement num mock descartável, verifica a sintaxe, os resultados explícitos NOT_RUN e o rollback; isso não é execução no Supabase alojado. Não alterar triggers, políticas globais ou settings para contornar a protecção do fornecedor. Executar na nova base vazia ou adaptar os nomes de fixtures se já existir catálogo real; não remover triggers antigos para fazer testes passar.

## Recuperação e limites

Para reverter a interface, regressar à versão anterior do novo Site; não reactivar candidaturas públicas como regra comercial. A correcção não apaga dados, mas não contém downgrade automático para o modelo anterior: esse modelo deixou de corresponder ao produto e a unicidade antiga pode ser incompatível com várias lojas geridas.

Antes de qualquer futura remoção, exportar dados/imagens/membership por via autorizada e testar restauro isolado. Não executar `DROP ... CASCADE` em `public`, `auth` ou `storage`. Não alterar Auth global ou papéis legados como parte desta correcção.

A configuração Auth/SMTP/redirects, backup/retencão, verificação operacional de contacto, limites anti-spam, E2E e piloto continuam gates separados. Evidências do integrador pertencem ao relatório de execução, não são inferidas dos testes locais.

## Handoff actualizado

A etapa posterior de vendedor autoriza preço/stock, abertura da loja e criação via RPC validada nas lojas explicitamente atribuídas. A administração conserva a criação/aprovação de lojas e gestão de categorias. As regras históricas acima devem ser lidas com as migrações 4 e 5. Ver [contrato em execução](../docs/backend-handoff/CONTRACT.md) e [reconciliação de versões locais/alojadas](../docs/backend-handoff/README.md).

A sétima migração `20261112051337_test_store_configuration.sql` acrescenta a identificação de lojas de teste. Ver `../docs/TEST-STORES.md`.
