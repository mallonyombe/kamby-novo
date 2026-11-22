# Revisão da experiência de compra · 12 de Novembro de 2026

## Diagnóstico e decisões

| Área | Problema observado | Decisão e razão |
| --- | --- | --- |
| Carrinho geral | Os dados estavam agrupados, mas todas as linhas de cada loja permaneciam expostas numa lista extensa. | Um cartão por loja, com nome, localização, miniaturas, quantidade e subtotal. Abrir o cartão leva às quantidades e aos produtos apenas dessa loja. O agrupamento passa a ser reconhecível antes de ler cada artigo. |
| Carrinho da loja | O acesso ao carrinho dependia indevidamente de existir um contacto WhatsApp. Alterações de quantidade perdiam o foco; remover não tinha recuperação imediata. | Consultar o carrinho independe do contacto. Quantidades actualizam o subtotal, mantêm o foco e anunciam o resultado. Remover permite Desfazer. O contacto continua a validar preços e stock antes de avançar. |
| Identidade da loja | Avatar parcialmente cortado por margem negativa, nome repetido, selo decorativo e CTA verde com peso maior que o catálogo. | Capa a toda a largura, recorte panorâmico próprio e perfil circular de 60 px, sobreposto em 22 px à borda inferior. Nome e localização abaixo em fundo sólido; Sobre, WhatsApp e Partilhar como acções secundárias. Retirar o rótulo Aberta/Fechada. Produtos continuam a ser o conteúdo principal. |
| Pesquisa da loja | Só existia pesquisa global. | Ícone no cabeçalho abre um campo contextual, com o nome da loja no placeholder. Pesquisa local por todos os termos, sem acentos, sem misturar lojas; limpar e cancelar têm comportamentos distintos. |
| Catálogo da loja | Nome da própria loja repetido em todos os cartões e poucas formas úteis de explorar. | Remover a identificação repetida, acrescentar disponibilidade e ordenação por data ou preço. Zero resultados oferece limpeza de pesquisa e filtros. |
| Opções do produto | Select HTML abria o diálogo padrão do Android, separado visualmente do painel. | Grupo de opções integrado no painel, nome, preço e selecção persistentes. Opções esgotadas desactivadas com rótulo textual. Teclas de seta, Home e End preservam selecção e foco. O preço total muda imediatamente ao escolher ou alterar a quantidade. |

## Hierarquia visual

A cor principal mantém os valores já definidos no Kamby. Superfícies, bordas discretas e texto estabelecem os grupos; o contacto WhatsApp deixa de criar uma faixa verde dominante. A apresentação adapta-se aos temas claro e escuro existentes. As transições de cor são breves, e a preferência de movimento reduzido é respeitada.

O formulário de pesquisa tem âmbito local explícito e fica junto ao conteúdo que pesquisa. Não altera a pesquisa global, o feed ou os carrinhos de outras lojas. Abrir um produto e voltar conserva a exploração dentro da loja.

## Referências consultadas

- Nielsen Norman Group — Visual Hierarchy in UX: contraste, escala, proximidade e regiões comuns: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- Apple Human Interface Guidelines — Search fields: âmbito da pesquisa, pesquisa inline e feedback ao escrever: https://developer.apple.com/design/human-interface-guidelines/search-fields
- Apple Human Interface Guidelines — Pickers: https://developer.apple.com/design/human-interface-guidelines/pickers

## Verificação

Testes de domínio em `tests/storefront-domain.test.mjs` cobrem isolamento de loja, múltiplos termos, acentos, disponibilidade, ordenação, catálogo vazio e preservação da ordem original dos dados.

`node tests/build-buyer-qa.mjs` cria uma verificação local, fora do build publicado. Usa leitura do catálogo actual e carrinhos apenas no armazenamento do navegador; não publica artigos nem envia mensagens. O botão Restaurar carrinho anterior repõe os dados locais anteriores.

Resultados finais: 48 testes de frontend aprovados; verificações de interface no Chrome, incluindo carrinhos em 320, 390 e 1040 px. O ensaio confirma subtotais de 985 MT e 1075 MT ao alterar a quantidade, isolamento entre lojas, Desfazer, pesquisa contextual, zero resultados, disponibilidade, ordenação, informações e escolhas de variantes. As variantes são ordenadas por medidas comparáveis e tamanhos; uma ordem explícita configurada mantém prioridade. A interface não usa componentes UIKit ou Android nativos: o selector é um controlo web integrado no painel do Kamby.


## Tratamento das imagens da loja

A capa usa um ficheiro panorâmico de 1200 × 440 px e `object-fit: cover`, sem esticar. A fotografia de perfil tem ficheiro quadrado independente de 240 × 240 px, apresentado num círculo de 60 px (64 px em ecrãs largos), com borda de 3 px na cor da página. A sobreposição é de 22 px (24 px em ecrãs largos). O nome e os botões não ficam sobre a fotografia.

Imagens carregadas pelo lojista têm prioridade sobre as fotografias de referência das duas lojas do catálogo inicial. Logótipos carregados preservam o desenho com contain; as fotografias de referência preenchem o círculo com cover. Outras lojas sem imagens configuradas usam superfície neutra e iniciais; não recebem uma fotografia de outra loja. Em falhas de imagem, o espaço mantém-se estável e não mostra ícone de imagem quebrada.

Durante a pesquisa contextual, capa e perfil recolhem para deixar os resultados visíveis acima do teclado. Ao cancelar, regressam e a posição anterior da loja é restaurada.

Verificação da revisão de capa/perfil: 48 testes de frontend aprovados e 34 verificações de navegador aprovadas. Confirmados o carregamento das imagens, a capa a toda a largura, o perfil circular sobreposto em 320/390/1040 px e a ausência do rótulo Aberta/Fechada. A pesquisa recolhe a identidade e repõe as imagens ao cancelar, preservando os restantes fluxos aprovados.

A leitura do carrinho já não regrava dados durante a sincronização entre vistas ou separadores; a migração de carrinhos antigos ocorre uma única vez, sem sobrescrever uma quantidade alterada entretanto.
