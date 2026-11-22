# Estados de espera e montra — 12 de Novembro de 2026

A interface usa skeletons para conteúdo ainda desconhecido e spinners para acções pendentes. Mensagens de erro, resultados vazios, confirmação de sucesso e estados do negócio continuam legíveis. Os rótulos «A carregar» existem apenas nos nomes acessíveis dos indicadores, sem texto pintado no ecrã.

| Área | Feedback aplicado |
| --- | --- |
| Feed e directório | Cartões skeleton; erro com nova tentativa |
| Pesquisa global | Grelha skeleton, contagens skeleton e indicador compacto no total |
| Produto no app | Skeletons na fotografia, título, preço, loja, descrição e subtotal; acções indisponíveis até à resposta |
| Rota autónoma product.html | Skeletons desde o HTML inicial e na galeria |
| Carrinho da loja | Spinner no botão durante revalidação; erro ou mudança de preço devolvem o controlo ao comprador |
| Selecção de variante | Spinner na confirmação sem alterar largura; saída e confirmação duplicada bloqueadas enquanto o pedido está pendente |
| Conta, entrada, saída e recuperação | Perfil skeleton na resolução inicial; spinner nas acções de acesso e formulários |
| Definições autenticadas | Skeletons nas leituras de actividade, notificações e pedido de encerramento; spinners ao guardar, remover, marcar lido e alterar preferências |
| Gestão actual e contrato anterior | Catálogo, paginação, indicadores e actividade com skeletons/spinners; acções de guardar, actualizar, publicar e enviar imagens com feedback visual |
| Editor de produto actual e anterior | Categorias com indicador junto ao campo; spinner no botão durante preparação local, envio e gravação; dados preservados após erro |

`frontend/loading.js` e `frontend/loading.css` partilham o comportamento. O botão mantém o seu conteúdo e dimensões; o spinner ocupa o centro enquanto `aria-busy` anuncia a operação. A restauração remove o estado visual. Skeletons são substituídos pelo conteúdo ou pelo estado de erro. O movimento reduzido retira o shimmer e abranda a rotação.

A identidade da loja passou de 60 para 84 px no móvel e de 64 para 88 px em ecrãs maiores. Mantém proporção quadrada, fotografia circular, aro da cor do fundo e sobreposição de 30/32 px à capa. Os botões compactos usam tons de magenta da Kamby; o catálogo mantém a maior área da página. Não foi introduzido um estado público de loja «Aberta».

## Verificação

- Build da interface concluído; 48 testes automáticos de frontend aprovados.
- 34 verificações no navegador dos fluxos de loja, pesquisa contextual, variantes e carrinhos por loja aprovadas.
- 29 verificações adicionais no navegador: espera forçada, sucesso, falha de rede, reposição do botão, ausência de frases visíveis de espera, dimensão do perfil e adaptação a 320, 390 e 1040 px nos temas claro e escuro.
- Contraste medido em repouso nos botões da loja: Sobre/Partilhar 4,54:1 no claro e 6,62:1 no escuro; contacto com texto branco 5,16:1 em ambos.
- O carrinho anterior foi restaurado após a preparação dos cenários de compra.
- Auditoria de todas as fontes HTML/JS distribuídas: os textos transitórios encontrados foram substituídos. Mensagens como «Não foi possível carregar» e «A aguardar aprovação» são erros/estados do negócio, não indicadores de espera.

As verificações de navegador foram executadas no build local servido pelo preview. Os fluxos privados de alteração de conta, publicação e configuração da loja foram revistos no código e compilados, sem efectuar operações com credenciais de um utilizador autenticado. Os scripts `tests/build-buyer-qa.mjs` e `tests/build-loading-qa.mjs` permitem repetir os cenários locais; a compilação de publicação apaga os ficheiros de revisão antes de empacotar.
