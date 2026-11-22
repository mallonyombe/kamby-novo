# Desvanecimento do header e da navbar

12 de Novembro de 2026. Referência: Pulse, commit `caab995761046089ef6a48a6afe4e005d032c1c1`, `src/GlassSurface.web.tsx` e navegação de separadores.

`chrome-fade.css` aplica o tratamento às barras superiores partilhadas, à navegação inferior do comprador, à navegação móvel do lojista e ao header móvel administrativo. As barras laterais desktop conservam o seu formato.

- Fundo contínuo em degradê, prolongado 24 px além dos controlos, até zero de opacidade. O header desvanece para baixo e a navbar para cima.
- Sem blur, sombra, borda ou cápsula nas faixas principais. Os controlos conservam as formas e as cores existentes do Kamby.
- Camada visual isolada, atrás dos controlos e sem eventos de ponteiro. O conteúdo continua a passar por trás durante a rolagem.
- O header pode deixar o degradê transbordar; o recorte fica apenas no conteúdo que contém a pesquisa. A lógica de histerese não foi alterada.
- As margens de repouso respeitam a extensão do degradê; áreas seguras e afastamento inferior preservam acesso ao conteúdo.
- Tema claro, escuro e automático usam os neutros existentes. As cores da marca não mudam.
- Preferências de transparência reduzida, contraste elevado e cores forçadas activam fundo opaco nas barras.

Verificação: 51 testes frontend, 38 verificações das barras no navegador e 24 verificações da gestão do lojista aprovadas. Cobertura dos temas em 320/390/1040 px, fundo inferior em toda a largura útil, transparência das camadas aos toques, colapso, pesquisa/foco, regresso ao topo e áreas seguras. Verificada também a navegação e editor do lojista. As páginas QA usam rede/sessão isoladas e ficam fora da publicação.
