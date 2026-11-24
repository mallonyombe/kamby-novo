-- O toque e a tentativa de encaminhamento são eventos distintos; nenhum confirma uma venda.
alter table public.kg_store_events
 drop constraint kg_store_events_kind_check,
 add constraint kg_store_events_kind_check check (kind in ('store_view', 'whatsapp_intent', 'whatsapp_click'));
