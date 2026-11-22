# Experiência de produto e carrinhos

## Ficha de produto

A ficha comercial tem header contextual, galeria, nome, preço, opções, ligação à loja, descrição e recomendações da mesma loja. Não repete o nome completo no header nem mistura localização com o nome da loja. O favorito é um ícone com estado acessível. A disponibilidade normal não é apresentada em etiquetas.

No mobile, a galeria tem altura entre 230 e 340 px, limitada a 34 svh; usa imagens contidas, swipe nativo e contador numérico. O nome usa 21 px, preço 24 px e texto comercial 13 px. As opções têm alvo de 44 px e mostram apenas o nome; o preço principal acompanha a selecção. Desktop organiza fotografia e informação em duas colunas. Os controlos fixos têm 44 px de altura, com espaço reservado no conteúdo.

A quantidade não aparece na ficha. Adicionar ao carrinho ou WhatsApp abre uma folha contextual com produto, opção, quantidade, total e confirmação. A quantidade começa em uma unidade, respeita stock quantificado e contabiliza o que já existe no carrinho quando a intenção é adicionar. Alterar a opção recalcula o total.

Antes da confirmação, o catálogo é consultado novamente. Uma alteração de preço pede nova revisão do total; uma opção indisponível impede a acção. Confirmar o carrinho guarda exactamente a quantidade escolhida e apresenta um aviso breve com acesso à loja. O nome da acção não muda permanentemente para «Adicionado». O contacto directo prepara apenas o produto seleccionado e não o adiciona ao carrinho.

## Carrinhos

O ícone na ficha e na montra abre `#carrinho/loja/:id`. Este ecrã contém exclusivamente os artigos dessa loja, com opções, quantidades, total e acção fixa de WhatsApp. O botão Geral abre o carrinho principal. O carrinho geral preserva grupos independentes, subtotais e acesso ao carrinho de cada loja.

Quantidades e remoção alteram apenas a linha identificada por loja, produto e variante. Antes de abrir WhatsApp, o grupo é validado novamente: loja aberta, produto publicado, variante existente, stock, quantidade e preço. Se os preços mudarem, o carrinho é actualizado e a pessoa revê o subtotal antes de continuar. Alterar o carrinho enquanto uma validação está em curso cancela essa tentativa. Os preços são estimativas para negociação, não confirmação de encomenda ou pagamento.

As fotografias guardadas com assinaturas temporárias recuperam o caminho original do Storage e pedem uma assinatura nova. A cache de assinaturas expira antes da assinatura do servidor. A falha de uma fotografia mantém a área estável.

## Separação da demonstração

O catálogo público é o padrão. Apenas lojas `is_test=false` entram na descoberta, pesquisa e PDP desse modo. O catálogo demonstrativo é explicitamente activado por `?catalogo=demo`, pelo estado vazio do catálogo público ou nas Definições. Tem uma indicação no header principal e consulta apenas as lojas de teste.

O carrinho demonstrativo usa uma chave separada. Artigos de teste anteriormente guardados no carrinho antigo são preservados nesse espaço. As acções do produto mantêm a linguagem comercial; a confirmação de WhatsApp das lojas fictícias abre uma pré-visualização local do pedido, sem contactar os números fictícios.

## Verificação desta revisão

- 28 testes frontend aprovados: preços exactos, variantes, limites, isolamento de grupos, modo de catálogo, contrato anterior e renovação de imagens, além de pesquisa e conta.
- Consultas reais ao Supabase: catálogo público com zero produtos de teste; demonstração com nove produtos, todos das lojas de teste.
- Navegador com catálogo real: selecção de variante, quantidade posterior à acção, adição ao carrinho, pedido directo de 2 × 450,50 MT = 901 MT, pedido por loja com duas linhas = 6.101 MT e carrinho geral com dois grupos.
- Layout em 320 e 390 px sem scroll horizontal; controlos da folha com 44 px. Temas claro e escuro inspeccionados.
- Gestão anterior e formulário de publicação verificados numa sessão de QA isolada com o contrato anterior. Nenhuma credencial é introduzida pelo navegador nem publicada no pacote.

A revisão não aplica a migração pendente do editor avançado. Detecta o contrato disponível e mantém a gestão já operacional quando as novas colunas ainda não existem. O novo espaço de quatro destinos continua preservado para activação após a aplicação e validação da migração.
