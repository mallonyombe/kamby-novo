# Movimento no Kamby

O movimento confirma uma acção e indica onde olhar. Estado, texto e foco continuam a comunicar o resultado com movimento reduzido.

| Acção | Feedback | Estado |
| --- | --- | --- |
| Adicionar ao carrinho | Confirmação sobe 6 px em 180 ms e oferece «Ver carrinho». | Implementado. |
| Guardar produto | O coração preenche e cresce até 1,16× durante 220 ms depois de guardar. | Implementado. |
| Retirar dos guardados | O coração volta ao contorno e a confirmação identifica a acção. | Implementado nos cards e nos detalhes. |
| Remover do carrinho | O artigo sai e «Desfazer» fica disponível durante 5,5 segundos. | Implementado. |
| Mudar quantidade | Actualizar preço da linha e subtotal juntos. Experimentar um destaque breve no subtotal, sem mover a linha. | Próxima iteração. |
| Abrir uma folha ou galeria | Testar a entrada suave e manter uma saída previsível por toque e teclado. | Próxima iteração. |

Usar curvas de saída suaves para confirmações curtas. Mostrar progresso enquanto se aguarda o servidor e reservar o feedback de sucesso para depois da confirmação. Testar cada gesto também com a preferência de movimento reduzido.

Referência de exploração: [FreeFrontend, exemplos de CSS keyframes](https://freefrontend.com/css-keyframes/page/3/).
