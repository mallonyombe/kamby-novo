# Kamby — Project Charter (Greenfield)
**Estado:** especificação inicial para revisão; nenhuma implementação ou deploy autorizado.
**Patrocinador:** Orbion Technology. **Idioma do produto:** português de Moçambique.
## Decisão principal
Recomeçar a implementação **do zero**, mantendo a ideia de marketplace local e a identidade conceptual aprovada. Código, estrutura, BD e UI antigos **não são fonte de implementação**. Podem ser consultados apenas para identificar necessidades, falhas e requisitos históricos; nunca copiar automaticamente.
## Visão
Kamby aproxima compradores e lojas locais. O cliente descobre produtos, organiza um carrinho por loja, prepara um pedido e **negocia/finaliza a compra pelo WhatsApp** com a loja. A plataforma facilita a descoberta e a comunicação, sem fingir que o acordo comercial foi concluído automaticamente.
## Objectivos
- Pesquisa e descoberta de produtos e lojas.
- Perfis de comprador e vendedor; gestão de lojas aprovada por administradores.
- Carrinho isolado por loja, preços e disponibilidade claros.
- Preparação de pedido e contacto via WhatsApp com mensagem contextual.
- Gestão administrativa, denúncias, moderação, auditoria e métricas.
- PWA responsiva e acessível; modos claro e escuro.
## Não-objectivos da fase 1
- Checkout com captura de dinheiro pela plataforma; escrow; split de pagamentos.
- Entregas operadas pela Kamby; logística e rastreio prometidos.
- IA de recomendação complexa, microserviços ou automação de mensagens WhatsApp.
- Assumir que enviar mensagem WhatsApp equivale a venda concluída.
## Hipóteses a validar
Mercado inicial, zona geográfica, política de aprovação de lojas, comissão futura, meios de pagamento entre as partes, categorias e limites de catálogo.
## Princípio de execução
Sem produção ou alterações ao projecto antigo. Criar repositório/branch novo e ambientes isolados mediante autorização.
