# Contrato em execução

## Fronteiras e adaptadores

| Operação | Implementação actual | Persistência/garantias |
| --- | --- | --- |
| Feed e PDP | `frontend/index.html`: `catalogueRequest`, `fetchPublishedProducts`, `fetchPDPProduct`, normalizadores | Data API `/rest/v1/kg_products`, relações de loja, categoria, variantes e galeria; RLS |
| Directório/montra | `fetchApprovedStores`, `openStorefront` | `/rest/v1/kg_stores`; só lojas aprovadas no percurso público |
| Pesquisa Produtos/Lojas | `frontend/search-engine.js` + `loadSearchCatalogue` | Carrega páginas do catálogo público; índice em memória com validade de 60 s; sem tolerância a gralhas por trigram |
| Conta e sessão | `frontend/platform.js`, `merchant.js` | SDK Supabase Auth; palavra-passe com email ou telefone; `getUser()` valida a conta |
| Lojas geridas | RPC `kg_my_managed_stores` | Atribuições privadas em `kg_private.store_merchants`; não usar `owner_id` como autorização de vendedor |
| Preço/stock | RPC `kg_merchant_update_item` | Preço em cêntimos; variante opcional; versão `updated_at`; alteração transaccional |
| Abrir/fechar loja | `UPDATE kg_stores` condicionado por ID e `updated_at` | Vendedor só altera `is_open`; zero linhas devolvidas exige revalidação |
| Criar artigo | `frontend/product-composer.js` | Contexto de upload + API Storage + RPC atómica e idempotente |
| Carrinho do comprador | `kamby_cart` no navegador | Não sincronizado com `kg_carts/kg_cart_items` nesta interface |
| WhatsApp do comprador | PDP/carrinho → `wa.me` | Mensagem e subtotal estimado gerados no navegador; não confirma encomenda, pagamento ou entrega |
| Interacções da loja | `trackStoreEvent` → `kg_store_events` | Visitas/cliques; sem identidade do visitante; contagens não representam vendas |
| Pedido persistido com preço validado | RPC existente `kg_prepare_contact` | Snapshot calculado pelo servidor, sessão obrigatória; não chamado pelo fluxo WhatsApp actual |

A camada de leitura e os normalizadores ainda residem parcialmente em `index.html`. A proposta Ports & Adapters é uma direcção para extracção futura; não se afirma que `shared/api/kambyClient.js` já existe. Extrair os acessos preservando DTOs e estados da interface é uma tarefa separada, com testes de contrato. Não introduzir um segundo adaptador com dados simulados como fallback.

## Modelo canónico

| Entidade da proposta | Objecto real | Diferença relevante |
| --- | --- | --- |
| stores | `kg_stores` | `status`, `is_open`, `whatsapp_e164`, `location`; sem Maputo predefinido; gestão cria/aprova |
| products | `kg_products` | `category_id` UUID, `price_minor` bigint, `currency='MZN'`, `stock_status`, `unit_reference`, `status` |
| product_variants | `kg_product_variants` | SKU único, `option_name`, preço em cêntimos, `in_stock`, `stock_quantity`, `updated_at` |
| product_media | `kg_product_images` | Caminho privado `storage_path`, `sort_order` 0–9; URL assinada temporária na leitura |
| order_intents | `kg_contact_intents` | Comprador autenticado, UUID do pedido, snapshot calculado pelo servidor; não é tabela de cliques |
| metrics | `kg_store_events` | Eventos `store_view` e `whatsapp_click`; leitura privada por loja |
| seller accounts | `kg_profiles`, Auth e `kg_private.store_merchants` | Perfil não concede função; atribuição só pela gestão |
| local cart | `kg_carts/kg_cart_items` também existem | Contrato de carrinho remoto disponível; interface actual continua local |
| audit/idempotency | `kg_audit_events`, `kg_private.product_creations` | Auditoria de alterações e pedido original de criação; acesso directo privado |

`owner_id` identifica o criador administrativo da loja e o prefixo legado de imagens. Uma conta administrativa pode criar várias lojas. `is_open=false` não equivale a suspensão: a loja aprovada continua visível; a PDP/montra desactivam a negociação nessa condição. Rever também o comportamento do carrinho no aceite operacional.

### Dinheiro, stock e variantes

450,50 MT corresponde a `price_minor=45050`, moeda MZN. Não usar `parseInt` para preço em meticais nem armazenar valores com ponto flutuante. Limite por preço: 900.000.000.000 cêntimos. Criação pelo modal exige valor maior que zero; o contrato existente de edição admite zero. Essa diferença deve ser decidida pela equipa de produto antes de a uniformizar.

Produtos podem não ter variantes. Se a opção é omitida, o formulário não inventa uma variante. A criação actual aceita uma fotografia e, opcionalmente, uma opção; não é um editor de múltiplas combinações. Em produtos com variantes, a interface edita cada variante, e o servidor recalcula a disponibilidade agregada. `stock_quantity=0` tem actualmente significado de quantidade não limitada no contrato de contacto; não o reinterpretar como zero unidades sem migração.

## Autenticação e autorização

A chave publicável permite identificar o projecto; não substitui a sessão do utilizador. O SDK gere o access token do lojista. Nunca enviar chave secreta/service role ao browser nem derivar autorização de `user_metadata`. OTP não foi implementado no formulário actual; não alterar o método de autenticação como efeito colateral do handoff.

RLS, grants por coluna, triggers e funções verificam permissões no servidor. Visitantes lêem produtos publicados de lojas aprovadas e respectivas imagens/variantes. Atribuições são explícitas e revogáveis. O vendedor gere apenas lojas atribuídas; criação directa de produto pela Data API não é o caminho autorizado de publicação. Administração conserva gestão de lojas, categorias e suspensão.

## Escritas consumidas pela interface

As chamadas RPC usam `POST /rest/v1/rpc/<nome>`, JSON com os nomes abaixo, chave publicável em `apikey` e JWT do utilizador em `Authorization: Bearer <access_token>`. Preferir o SDK já configurado em `frontend/platform.js` para gerir sessão/refresh. Não copiar tokens para documentos ou URLs.

### Preço/stock — uma operação, por item ou variante

```js
const { data, error } = await platform.rpc('kg_merchant_update_item', {
  p_product_id: productId,
  p_variant_id: variantId || null,
  p_price_minor: 45050,
  p_in_stock: true,
  p_expected_updated_at: item.updated_at
});
```

Sucesso: `{product_id, updated_at}` ou `{product_id, variant_id, updated_at}`. `40001` indica edição desactualizada: recarregar; não repetir cegamente. `42501` indica falta de autorização; `22023`, dados inválidos. O SDK devolve `{data,error}`; nunca tratar uma Promise resolvida ou HTTP não-2xx como gravação confirmada.

### Fotografia e criação

1. Gerar `productId` UUID uma vez por tentativa lógica.
2. Chamar `kg_product_upload_context({p_store_id, p_product_id, p_extension})` com `jpg|png|webp`; usar o `{path}` devolvido.
3. Enviar pela API Storage/SDK para `kg-product-images`, com MIME real, máximo 5 MiB e `upsert:false`. Caminho do lojista: `<user>/<store>/<product>/photo.ext`; admin recebe prefixo do criador da loja.
4. Publicar:

```js
const { data, error } = await platform.rpc('kg_merchant_create_product', {
  p_product_id: productId, p_store_id: storeId, p_category_id: categoryId,
  p_title: title, p_price_minor: 45050,
  p_option_name: '500 ml', p_description: description,
  p_image_path: uploadedPath
});
```

Resposta: `{id,status}`. Guardar o mesmo UUID, conteúdo e caminho ao verificar resposta perdida; repetir o pedido exacto não cria duplicados. Outro conteúdo com o mesmo UUID é rejeitado. A função valida atribuição, loja aprovada, categoria activa e metadados da imagem. Produto, variante opcional, galeria, auditoria e registo do pedido são transaccionais. Upload binário é uma operação separada; ficheiros privados órfãos podem exigir limpeza. Só remover uploads não referenciados através da API Storage. Nunca inserir/apagar directamente linhas de `storage.objects` no ambiente alojado.

Depois do sucesso, a aplicação revalida catálogo do lojista, feed, pesquisa e detalhes na mesma sessão. Não há subscrição Realtime entre dispositivos. Nome: 2–160 caracteres; descrição: até 5.000; opção: até 120; categoria: UUID de categoria activa.

### Métricas

`kg_merchant_metrics({p_store_id})` devolve `{store_views,whatsapp_clicks,active_products,days:7,as_of}`. `active_products` conta produtos publicados, incluindo os esgotados. O evento público só aceita ID, loja e tipo autorizados; o servidor atribui a data. A limitação actual de frequência no navegador não é um mecanismo anti-abuso de servidor.

### Snapshot de negociação — disponível, ainda não ligado à UI

```js
await platform.rpc('kg_prepare_contact', {
  p_store_id: storeId,
  p_request_id: requestId,
  p_items: [{product_id: productId, variant_id: variantId, quantity: 2}]
});
```

Não aceitar total enviado pelo comprador. O servidor obtém preços e valida loja/produto/variante, quantidades 1–99, até 100 linhas e devolve `kg_contact_intents` com `snapshot.subtotal_minor`. A repetição actual é por comprador/request_id e loja: devolve o snapshot inicial; não compara de forma estrita um novo conteúdo dos itens. Não confundir esta garantia com a comparação estrita do pedido de criação de produto.

Antes de ligar esta RPC ao checkout, testar variante obrigatória quando o produto tem opções, loja fechada, alterações de preço/stock, tentativa com mesma chave e itens diferentes, e sessão revogada. Não apresentar o subtotal do carrinho local como total confirmado pelo servidor.
