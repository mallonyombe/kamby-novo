# Pesquisa da loja e remoção do carrinho — 12 de Novembro de 2026

A pesquisa da loja estava numa segunda barra sticky, com a acção de pesquisa ainda presente na navegação original. O contorno exterior de foco podia ser cortado junto ao cabeçalho.

O formulário passou para dentro do cabeçalho e substitui a navegação enquanto está aberto. Mantém uma única linha com o campo e Cancelar, foco síncrono no gesto de abertura e identificação acessível da loja. O foco é desenhado no interior do campo com a cor da Kamby. Cancelar recupera a capa, o perfil, a navegação, a posição anterior e o foco no ícone. Abrir um produto e voltar preserva a consulta e os resultados. A pesquisa continua limitada ao catálogo da loja.

Cada linha do carrinho tem agora um botão com ícone de caixote e nome acessível que identifica produto e variante. Remove a linha inteira, independentemente da quantidade, actualiza subtotal e contadores, mantém as outras lojas e permite Desfazer. O botão menos fica desactivado a uma unidade; a função de alteração de quantidade também impede valores inferiores a um. As áreas de toque do caixote e dos botões de quantidade têm 44 px. Num ecrã estreito, os controlos repartem-se em duas linhas.

Validação:

- Build concluído e 48 testes automáticos de frontend aprovados.
- 59 verificações no navegador aprovadas pelo cenário actualizado `tests/build-buyer-qa.mjs`: remoção com uma e três unidades, Desfazer com variante e quantidade, isolamento entre lojas, total, último artigo/estado vazio, foco, cancelamento, retorno do produto, filtragem local e regressão dos fluxos de compra.
- Geometria do campo dentro do cabeçalho validada em 320, 390 e 1040 px nos temas claro e escuro; sem transbordo horizontal. Verificada também uma área segura superior de 24 px e a retenção de foco ao reduzir a altura disponível.
- A validação de foco e da altura foi feita no navegador de desktop com viewport reduzida. Não constitui uma execução num telefone Android com teclado virtual do utilizador.
- Carrinho local anterior restaurado após os cenários. Não foram enviados pedidos de compra nem mensagens pelo WhatsApp.

Os ficheiros HTML de revisão são locais e ficam fora do pacote de publicação.
