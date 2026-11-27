# Resumo do vendedor — propósito e hierarquia

12 de Novembro de 2026.

O Resumo dá uma leitura imediata do estado, do catálogo, das pendências e da actividade da loja. A identidade e os controlos de contactos ficam em Loja. A criação de produtos e o catálogo detalhado ficam em Produtos, e a análise diária fica no Histórico de actividade.

| Elemento | Propósito | Acção e estado |
| --- | --- | --- |
| Estado discreto da loja | Informar visibilidade, pausa ou restrição | Texto e ponto; sem botão de configuração nesta secção |
| Publicados / Esgotados | Conhecer o catálogo | Dois números compactos; abrir Produtos com o filtro correspondente |
| Pendências | Resolver trabalho concreto | Apenas contagens positivas; cada linha abre o grupo correspondente |
| Sem pendências | Confirmar ausência de trabalho | Uma linha; sem cartão ou botão de resolver |
| Actividade | Consultar sinal recente | Duas medidas em linha: visitas e cliques WhatsApp, últimos sete dias |

O magenta da marca identifica a acção principal e o destino seleccionado. Os dados são neutros. O âmbar identifica pendências e acompanha texto, nunca comunica sozinho. Os temas conservam os respectivos contrastes. Números usam algarismos tabulares. As áreas de toque têm pelo menos 44 px; as linhas de pendências têm 48 px.

A navegação principal tem três destinos. No móvel ocupa a base e no desktop ocupa a lateral. Os contadores abrem o catálogo com o filtro correspondente. As pendências abrem a tarefa ou a lista que permite resolvê-las.

O carregamento usa skeletons; o erro mostra traços e uma tentativa de recuperação, nunca zeros nem uma confirmação saudável falsa. Respostas antigas são descartadas após mudança de loja ou reinício. Os valores apenas aparecem depois de todas as consultas necessárias terminarem. Feedback de toque usa cor e transição de 120 ms; o movimento de pressão respeita a preferência de movimento reduzido.

## Verificação histórica

- 23 verificações de estados do Resumo no navegador, incluindo filtros de pendências, moderação, criação, vazio, falha, nova tentativa, skeletons e larguras 320/390/1040 nos temas claro e escuro.
- 24 verificações da gestão, incluindo navegação, editor, variantes, preços, gráfico e configurações.
- 48 testes frontend; contratos PostgreSQL/PGlite das oito migrações aprovados.
- As páginas de revisão e respectivas sessões isoladas não são incluídas na publicação.
