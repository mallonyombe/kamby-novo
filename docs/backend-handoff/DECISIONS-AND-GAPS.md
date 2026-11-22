# Decisões, diferenças e trabalho pendente

## Correcções à proposta recebida

| Proposta | Decisão do handoff | Motivo verificável |
| --- | --- | --- |
| Desligar mocks e substituir arrays | Documentar os acessos Supabase existentes | O catálogo publicado já é real; QA simulado só existe nas páginas de teste |
| Criar `stores/products/product_media` | Reutilizar `kg_stores/kg_products/kg_product_images` | Evita duplicação de esquema, permissões e fonte de dados |
| Público lê todas as lojas/variantes/imagens | Visibilidade herdada da publicação/aprovação do produto e loja | `USING(true)` permitiria divulgar linhas privadas ou não publicadas nesses objectos |
| Dono pode actualizar qualquer coluna da sua linha | Atribuição privada + grants/guards por campo + RPC | RLS por linha, isoladamente, não impede alterar campos de moderação autorizados pelo grant |
| Preço inteiro em MT | `price_minor` em cêntimos e MZN | Mantém 450,50 MT sem truncagem |
| Publicação `true` por omissão e escritas separadas | RPC validada e transaccional | Evita publicação parcial sem imagem/opção e implementa repetição idempotente |
| Qualquer pessoa insere intenção e total | Separar evento de clique de snapshot de negociação | Totais e itens enviados pelo cliente não são autoridade de preço; entrada pública exige controlo de abuso |
| Bucket público `product-media` | Preservar bucket privado `kg-product-images` | Links assinados após autorização; não expor ficheiros de artigos não publicados |
| OTP obrigatório | Manter Auth por palavra-passe existente | OTP/fornecedor SMS/SMTP e recuperação precisam de tarefa e aceitação próprias |
| Maputo por omissão | Preservar `location` real sem geografia inventada | Directório e filtros reflectem dados do catálogo |
| Trigrams já disponíveis | Pesquisa actual no cliente; migração de pesquisa é pendente | Há índice FTS `simple` no produto, mas nenhuma consulta trigram publicada nesta interface |
| Frontend completo e certificado | Funcionalidades implementadas, aceite operacional pendente | Upload E2E e outros gates não concluídos; Handbook v3.0 não fornecido |

O adaptador da proposta também usa `/products` para o feed enquanto a tabela define `/feed`, ignora `response.ok` e mistura respostas JSON, booleanos e `Response`. Se for adoptada uma fachada HTTP, definir um contrato único de retorno, propagação de erros e paginação antes da migração do frontend. Não activar `api.kamby.orbion.tech` ou preencher uma origem de exemplo sem serviço provisionado e verificado.

## Fachada HTTP futura — proposta, não implementada

O Supabase Data API é o backend em execução. As rotas abaixo são uma especificação de intenção para uma eventual fachada, sem SLA, DNS ou deployment confirmados. A aprovação desta camada não é necessária para continuar a usar o backend actual.

Todas as listas usam `page` inteiro >=1 e `pageSize` 1–60; devolvem `{data:[],page,pageSize,hasMore}`. Ordenação de produtos: `created_at desc,id asc`. A estabilidade de paginação perante inserções concorrentes é limitada; antes de grande escala, decidir cursor opaco e testes de consistência. UUIDs e enumerações devem ser validados; parâmetros codificados pelo cliente. Nunca devolver linhas privadas através de uma chave privilegiada sem aplicar a autorização equivalente no servidor.

| Método/rota proposta | Entrada principal | Resultado e adaptação |
| --- | --- | --- |
| GET `/v1/feed` | `category=all|slug`, page/pageSize | Lista pública com categorias activas derivadas dos produtos visíveis; adaptar `kg_products` |
| GET `/v1/products/:id` | UUID | Produto, loja, galeria e variantes; 404 para ausente/invisível |
| GET `/v1/stores` | filtro de localização real; page/pageSize | Só lojas aprovadas; não inferir `city` de texto sem migração de localização |
| GET `/v1/stores/:id` | UUID; paginação de catálogo | Loja aprovada e seus produtos publicados |
| GET `/v1/search` | `q`, `type=products|stores`, filtros, page/pageSize | Resultados e contagens por tipo; ranking/acentos/gralhas a definir e medir no servidor |
| PATCH `/v1/merchant/products/:id/price` | JWT; `{variantId:null|uuid,priceMinor:45050,expectedUpdatedAt}` | Adaptar `kg_merchant_update_item` com stock actual sob controlo de concorrência; 409 se versão antiga |
| PATCH `/v1/merchant/products/:id/stock` | JWT; `{variantId:null|uuid,inStock:false,expectedUpdatedAt}` | Mesma RPC com preço actual; impedir corrida entre leitura e alteração |
| POST `/v1/merchant/product-upload-context` | JWT; `{storeId,productId,extension}` | RPC de contexto; não recebe binário nem devolve autorização para outro caminho |
| POST `/v1/merchant/products` | JWT; `{productId,storeId,categoryId,title,priceMinor,optionName,description,imagePath}` | RPC de criação; ID estável, conteúdo estrito; `{data:{id,status}}` |
| POST `/v1/analytics/store-event` | `{id,storeId,kind}` | Evento sem telefone/total; validar tipo e loja; implementar limitação no servidor |
| POST `/v1/contact-intents` | JWT; `{storeId,requestId,items:[{productId,variantId,quantity}]}` | Snapshot recalculado no servidor; não é compra ou venda confirmada |

DTO de produto proposto: `{id,storeId,categoryId,title,description,priceMinor,currency:'MZN',stockStatus,status,unitReference,updatedAt,variants:[{id,optionName,priceMinor,inStock,updatedAt}],images:[{url,sortOrder}]}`. URLs são temporárias; não persistir URL assinada como identificação de imagem. Para listas, anexar apenas dados de loja/categoria públicos necessários ao cartão. DTO de loja proposto: `{id,name,slug,description,location,whatsappE164,isOpen}`.

Resposta de erro proposta: `{error:{code,message,requestId}}`, sem stack SQL, tokens ou dados de terceiros. Definir 400 para dados inválidos, 401 para sessão ausente, 403 para acesso recusado, 404 para recurso público invisível, 409 para conflito de versão/idempotência, 429 para limites e 5xx para indisponibilidade. Os códigos HTTP definitivos da fachada ainda não existem; não confundir esta tabela com os SQLSTATE e respostas PostgREST actuais. A fachada deve testar a conversão explícita de `42501`, `22023`, `40001`, `23505`, `23514` e erros de transporte.

## Prioridades de recepção

| Prioridade | Trabalho | Critério de conclusão |
| --- | --- | --- |
| P0 para aceite da nova criação | Enviar fotografia real e publicar com conta atribuída em ambiente isolado | Ficheiro válido, produto/variante/galeria, retry sem duplicar, PDP/carrinho/WhatsApp e nenhum acesso cruzado |
| P0 antes de negociação com preço confirmado | Integrar snapshot remoto ou manter indicação explícita de estimativa | Preço/stock revalidados; variante correcta; loja fechada; alterações do catálogo e chaves repetidas testadas |
| P1 antes de piloto exposto | Protecção contra abuso de eventos/uploads e quotas | Limite no servidor; custo/volume observáveis; deduplicação e alertas testados |
| P1 | Ciclo Auth, recuperação, SMTP/SMS se adoptado, redirects e sessão revogada | Percursos testados com contas reais de QA; sem exposição de credenciais |
| P1 | Limpeza de uploads órfãos e expiração de URLs assinadas em sessões longas | Remover apenas ficheiros não referenciados; renovar URL após expiração sem perder produto |
| P1 | Operação: backups/restauro, observabilidade e rollback | Exercício de restauro, dono de incidentes e métricas acordadas; preservar dados de domínio |
| P2 conforme volume | Pesquisa no servidor e extracção Ports & Adapters | Paridade de acentos/filtros, relevância, isolamento, paginação e latência medida com carga representativa |

A data de verificação dos advisors encontra-se na documentação da criação. Há um aviso conhecido de protecção de palavras-passe comprometidas desactivada e sete informações de tabelas privadas sem políticas; não foram corrigidos como efeito colateral deste handoff. Confirmar situação e plano antes do piloto. A ausência de novo aviso não certifica a aplicação inteira.

## Referências primárias consultadas em 12/11/2026

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Funções de base de dados](https://supabase.com/docs/guides/database/functions)
- [Supabase — Modelo do schema Storage](https://supabase.com/docs/guides/storage/schema/design)
- [Supabase — Buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)

As decisões específicas do Kamby baseiam-se no código e nas migrações entregues; as referências explicam os mecanismos, não constituem auditoria ou aprovação do projecto.
