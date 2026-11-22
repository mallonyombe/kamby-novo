# Cabeçalho durante a rolagem

O cabeçalho usa a posição da página. Mudar a direcção da rolagem não o expande.

| Estado ou acção | Comportamento |
| --- | --- |
| Topo, até 8 px | Pesquisa completa e cabeçalho expandido |
| Sair do topo, a partir de 48 px | Cabeçalho compacto de 56 px, além da área segura |
| Entre 8 e 48 px | Preserva o estado anterior para evitar oscilações |
| Subir ou descer longe do topo | Mantém o estado compacto |
| Tocar no ícone | Abre a pesquisa e foca o campo no mesmo gesto |
| Cancelar pesquisa longe do topo | Restaura o estado compacto e devolve o foco ao ícone |
| Cancelar pesquisa no topo | Mantém a pesquisa completa |
| Regressar à página inicial ou a um produto | Sincroniza com a posição restaurada sem animar uma expansão intermédia |
| Cabeçalho escondido numa subpágina | Ignora a rolagem dessa subpágina |
| Movimento reduzido | Sem transições |

A altura do cabeçalho fixo não altera a margem nem a altura do feed. As transições não escalam o campo nem o ícone. O botão tem largura e altura fixas de 44 px e raio de 50%.

`node --test tests/header-scroll.test.mjs` verifica os limites, as inversões de direcção, 3.000 amostras de movimentos pequenos, a pesquisa, a restauração, páginas curtas e coordenadas de overscroll.

Para reproduzir a verificação de navegador, depois do build copiar `tests/header-scroll-browser.html` para `dist/header-qa.html`. A ferramenta usa o catálogo e a interface locais em iframe, em larguras de 320, 390 e 1040 px. Aguarda os frames de rolagem antes de avaliar os estados. Este ficheiro não faz parte do build publicado.

## Verificação de 12 de Novembro de 2026

- 36 testes de frontend aprovados, incluindo oito cenários de cabeçalho.
- 45 verificações na interface real do navegador aprovadas: 15 estados em cada largura de 320, 390 e 1040 px.
- Confirmados: altura de 56 px, botão de 44 × 44 px, pesquisa oculta fora da navegação por teclado, foco ao abrir, preservação durante pesquisa e retorno compacto ao cancelar e ao regressar de Lojas.
- Esta verificação correu em Chrome no ambiente de desenvolvimento; não substitui uma verificação física do teclado e da rolagem elástica em dispositivos iOS e Android.
