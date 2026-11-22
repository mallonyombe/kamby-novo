# Contrato actual de implementação

## Direcção do frontend

Por instrução do titular em 11/11/2026, todo o frontend anterior foi removido. O titular fornece os ficheiros e guia o desenho e a montagem da próxima interface. A experiência activa do comprador é montada incrementalmente em `frontend/index.html`; `frontend/product.html` permanece somente para compatibilidade histórica. Não reutilizar componentes, paleta, ícones, textos ou navegação das versões removidas sem indicação expressa.

## Backend

As lojas são criadas exclusivamente pela gestão. Clientes não criam nem candidatam lojas. A autorização efectiva está nas funções, grants e políticas RLS do Supabase. O contrato completo encontra-se em `../supabase/README.md` e nas migrações.

A página de produto usa variantes explícitas por SKU, unidade de referência e galeria ordenada. As RPCs de carrinho e snapshot de contacto aceitam a variante escolhida e calculam preço e subtotal no servidor. A interface actual mantém o carrinho local e prepara o WhatsApp com subtotal estimado; ainda não chama essas RPCs no percurso do comprador. A tabela `kg_product_images` existente representa a galeria; não duplicar mídia em URLs públicas.

O feed principal, o diretório, a montra pública e a PDP lêem apenas o contrato `kg_*` actual. A chave publicável pode existir no HTML estático porque não concede privilégios: a exposição pública é limitada pelos grants e RLS. Não utilizar as tabelas comerciais legadas como fallback, não publicar o `service_role` e não criar um percurso paralelo com dados de demonstração. O `id` enviado pelo cartão do feed é a identidade canónica usada pela PDP, pelas variantes, pelos media, pelo carrinho local e pelo despacho WhatsApp. A identidade canónica da montra é `kg_stores.id`; a interface nunca infere aprovação, cidade, biografia, contacto ou catálogo fora das linhas devolvidas pelo contrato público.

A remoção do frontend não reinicia o Supabase, não apaga dados e não modifica o backend. O histórico Git e os documentos originais permanecem preservados.

O [handoff de backend](backend-handoff/README.md) distingue o contrato em execução da fachada HTTP proposta e explicita os gates de aceitação.
