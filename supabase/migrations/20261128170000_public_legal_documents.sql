insert into kg_private.account_terms (version, title, sections)
values ('2026-11-28.1', 'Termos de utilização do Kamby', $terms$[
  {"title":"1. Sobre o Kamby","body":"O Kamby permite consultar anúncios de lojas e contactar os respectivos vendedores. Podes navegar pelo catálogo e preparar o carrinho sem criar conta."},
  {"title":"2. Conta e utilização","body":"Para criar conta, tens de ter pelo menos 18 anos. Mantém os teus dados actualizados, protege o acesso à conta e utiliza a plataforma de forma lícita, respeitando os direitos de outras pessoas."},
  {"title":"3. Pedidos e compras","body":"O carrinho apresenta o subtotal dos artigos. Ao escolheres enviar um pedido, o Kamby prepara uma mensagem para o WhatsApp da loja. O envio da mensagem não confirma a compra. Antes de pagar, confirma com a loja o artigo, a disponibilidade, o preço total, os custos e as condições de entrega. O pagamento é acordado com a loja fora do Kamby."},
  {"title":"4. Cancelamentos, devoluções e reclamações","body":"Para pedir o cancelamento de uma compra, uma troca, uma devolução ou um reembolso, contacta a loja e indica o que foi acordado. Conserva a confirmação da compra e o comprovativo de pagamento. Os teus direitos de consumidor, incluindo o direito de desistir de uma compra à distância quando a lei o prevê, continuam a aplicar-se."},
  {"title":"5. Anúncios e denúncias","body":"As lojas devem apresentar informações exactas sobre os produtos, preços e promoções e ter autorização para usar as fotografias e os textos que publicam. Podes denunciar anúncios enganosos, conteúdo impróprio ou violações de direitos de autor. O Kamby pode restringir anúncios que violem estes termos ou a lei."},
  {"title":"6. Privacidade e alterações","body":"A Política de privacidade explica como o Kamby trata os teus dados e como podes gerir as tuas preferências. Quando os Termos forem actualizados, poderás lê-los antes de voltar a utilizar as funcionalidades da conta. Para esclarecimentos sobre o Kamby, escreve para kambyoficial@gmail.com."}
]$terms$::jsonb);

insert into kg_private.privacy_policy_versions (version)
values ('2026-11-28.1');
