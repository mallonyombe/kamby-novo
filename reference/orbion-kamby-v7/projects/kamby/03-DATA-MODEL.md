# Modelo de dados inicial (proposta, não aplicado)
- `profiles(id uuid PK references auth.users, display_name, created_at)`
- `stores(id uuid PK, owner_id uuid FK, name, slug UNIQUE, whatsapp_e164, status, created_at)`
- `store_members(store_id, user_id, role, PK(store_id,user_id))` para equipa da loja se necessário.
- `categories(id, name, slug, is_active)`
- `products(id, store_id FK, category_id FK, title, description, price_minor bigint, currency char(3), stock_status, status, created_at)`
- `product_images(id, product_id FK, storage_path, sort_order)`
- `carts(id, buyer_id, store_id, UNIQUE(buyer_id,store_id))`
- `cart_items(cart_id, product_id, quantity, unit_price_snapshot_minor, UNIQUE(cart_id,product_id))`
- `contact_intents(id, buyer_id, store_id, cart_snapshot jsonb, status, created_at)`
- `store_applications(id, applicant_id, store_id, status, reviewed_by, reviewed_at, reason)`
- `reports(id, reporter_id, target_type, target_id, reason, status)`
- `audit_events(id, actor_id, action, resource_type, resource_id, metadata, created_at)`
## Regras
Montantes em unidades mínimas inteiras; moeda explícita (MZN no lançamento, se confirmado). `CHECK(quantity>0)`, `CHECK(price_minor>=0)`, índices por loja/status/categoria; FKs; constraints e transacções.
**RLS**: apenas produtos publicados de lojas aprovadas para visitantes; donos gerem apenas recursos próprios; administração com permissões explícitas. Testar acesso cruzado entre duas lojas.
Não guardar conversas privadas WhatsApp sem consentimento e integração autorizada.
Eliminar/anonimizar dados segundo política de retenção a definir.
