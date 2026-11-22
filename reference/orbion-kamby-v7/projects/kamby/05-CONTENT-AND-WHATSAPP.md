# Identidade verbal e WhatsApp
## Voz
Português de Moçambique; simples, próxima, respeitosa e precisa. Não prometer entregas, pagamentos seguros ou descontos sem suporte operacional.
## Exemplos de interface
'Explorar produtos'; 'Ver loja'; 'Adicionar ao carrinho'; 'Negociar no WhatsApp'; 'Rever pedido'; 'O teu carrinho está vazio'; 'O preço pode ser confirmado com a loja'; 'A conversa continua no WhatsApp'.
## Mensagem pré-preenchida (editável)
Olá! Vi estes produtos da loja {loja} no Kamby e gostaria de confirmar disponibilidade e negociar:
{linhas: quantidade × produto — preço indicativo}
Subtotal indicativo: {subtotal} MZN.
Podemos combinar os detalhes?
## Regras
Não afirmar que a compra foi efectuada ao abrir WhatsApp. Não incluir endereço pessoal, telefone do comprador ou dados sensíveis na mensagem sem acção explícita. Validar número da loja, codificar texto via `encodeURIComponent`, mostrar confirmação de saída para serviço externo se necessário.
## Conteúdo transaccional
Estado 'Pedido preparado' não significa 'Encomenda confirmada'. Erro de ligação: 'Não foi possível abrir o WhatsApp. Tenta novamente ou copia o contacto da loja.'
