# Pesquisa do Kamby

A vista `viewSearchResults` usa o catálogo público existente: produtos publicados de lojas aprovadas e lojas aprovadas, incluindo as páginas seguintes da API. Não usa dados de demonstração em produção nem altera o esquema ou as permissões.

O motor em `frontend/search-engine.js` compara palavras sem distinguir maiúsculas ou acentos. Produtos são pesquisados por título, categoria e nome da loja; lojas por nome, localização e descrição. Os filtros Disponíveis e Com produtos actuam sobre o tipo respectivo. Os cartões reutilizam os renderizadores do catálogo.

A rota `#pesquisa?q=...&aba=products|stores` conserva o termo, o separador e os filtros. Abrir produtos e lojas acrescenta uma entrada ao histórico; regressar conserva os resultados e a posição. As pesquisas recentes ficam neste navegador e podem ser limpas. Texto recebido do catálogo e termos pesquisados são apresentados com `textContent`.

Carregamento, zero resultados e falha de ligação têm estados distintos. Pedidos antigos não substituem uma pesquisa mais recente. A primeira pesquisa carrega o catálogo paginado; as seguintes reutilizam o índice por até 60 segundos. Esta implementação é destinada ao catálogo inicial do Kamby; para catálogos grandes, a indexação e a filtragem devem passar para um serviço de pesquisa no servidor.

## Verificação

- `npm run test:search`: correspondência, acentos, filtros, termos vazios, paginação e falha de página.
- `npm run build`: prepara apenas os ficheiros de produção em `dist`.
- `node tests/build-search-fixture.mjs`: depois do build, cria `dist/search-qa.html` para testar os percursos no navegador com 64 produtos e três lojas isolados. `?qa=retry` simula uma falha recuperável; `?qa=offline` simula indisponibilidade. O build seguinte remove esta página. Nunca publicar um pacote criado com a página de QA presente.

Verificações de navegador efectuadas: Enter, resultado depois da primeira página, produto e retorno, loja e retorno, escolha automática de separador, zero resultados, sugestões, disponibilidade, categorias, recuperação de falha e selecção dos separadores pelo teclado. O catálogo real também foi consultado pela interface; encontrava-se sem produtos e lojas publicados durante a verificação.
