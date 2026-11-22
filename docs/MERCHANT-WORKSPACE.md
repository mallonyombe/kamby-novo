# Espaço do Lojista

A experiência do comprador mantém os seus destinos. A conta com atribuição comercial activa abre um espaço próprio com Resumo, Produtos, Actividade e Loja. Desktop usa navegação lateral; mobile usa a barra da loja. A administração continua a criar e autorizar lojas.

## Catálogo e editor

A lista consulta páginas de 30 produtos no servidor e carrega progressivamente. Pesquisa por nome ou UUID completo, estado, categoria atribuída, disponibilidade, intervalo do preço inicial e ordenação. A posição e os filtros mantêm-se durante a edição.

O editor tem cinco secções: informações, fotografias, variantes, preços e revisão. Guarda rascunhos sem fotografia ou preço positivo; exige nome e categoria permitida. Publicar exige fotografia e preços positivos. Aceita até 10 imagens JPEG/PNG/WebP de 5 MiB e até 100 variantes, nomes únicos sem distinguir maiúsculas. O browser optimiza fotografias; a ordem da galeria define a capa. Cada variante pode seleccionar uma fotografia dessa galeria.

Preços usam inteiros em centavos e aceitam duas casas decimais na entrada. Preço anterior precisa de superar o actual. Quantidade em branco significa que unidades não são controladas; quantidade zero com controlo significa esgotado. Retirar uma variante desactiva-a sem eliminar o identificador ou a relação com carrinhos antigos. Arquivar retira o produto da descoberta e dos novos contactos, conservando o registo. Produtos bloqueados continuam sujeitos à administração.

## Escrita e isolamento

`kg_save_catalogue_product` recebe identificador do pedido, loja, produto, versão esperada e documento. O wrapper é invoker; a implementação em `kg_private` valida sessão, atribuição, aprovação, categoria, preços, variantes e ficheiros existentes. A gravação de produto, variantes, galeria e pedido é atómica. Um contexto privado limitado à transacção permite as alterações pelos triggers sem alargar as permissões directas. O mesmo identificador e documento permite confirmar respostas perdidas; reutilizá-lo com outros dados é recusado. Uma versão antiga recebe `40001`.

Ficheiros são enviados pela API Storage, sem upsert, antes de gravar referências. Não existe escrita directa nos metadados Storage. Uploads concluídos podem anteceder uma falha da gravação e ficar temporariamente sem referência; não há neste lançamento um processo automático de recolha de ficheiros órfãos. O formulário mantém os caminhos para repetir a gravação.

`kg_save_store_settings` permite identidade, contactos, localização, imagens e horário. Não permite aprovação, classificação de teste, criador ou permissões. Horários são informativos, em hora local; não alternam automaticamente a abertura. Categorias globais e atribuições são geridas pela administração, nunca criadas pelo lojista. Novas lojas recebem as categorias activas como atribuição inicial, que a administração pode restringir.

## Indicadores

Resumo e Actividade usam eventos registados e alterações reais do catálogo. Visitas são aberturas da loja; cliques são tentativas de abrir WhatsApp. Não representam pessoas únicas, conversas confirmadas, receitas ou vendas. O gráfico oferece os mesmos valores em tabela acessível.

## Verificação

- `npm run test:frontend`: validação de preços, pesquisa e conta.
- `npm test`: compila todas as migrações em PostgreSQL/PGlite e verifica isolamento, permissões, escrita atómica, rascunhos, retry, concorrência, promoções, galeria e variantes. Metadados Storage de teste existem apenas no banco local descartável.
- `tests/build-merchant-fixture.mjs`: ambiente de navegador isolado, com sessão e rede simuladas; inclui iframe de 390 px para testar media queries reais. As páginas QA nunca entram no pacote publicado.
- A migração `merchant_catalogue_editor` deve estar aplicada no projecto Supabase antes da publicação da interface. Um teste local não confirma a aplicação dessa migração no serviço hospedado.

Limites desta entrega: colaboradores adicionais ficam para uma fase posterior. Conflitos são detectados ao guardar, sem edição colaborativa em tempo real. Dados ainda não enviados mantêm-se no formulário enquanto a página permanece aberta; não são guardados automaticamente no dispositivo. Eliminação definitiva não é exposta; o lojista pode arquivar e recuperar pelo editor.

## Compatibilidade da publicação seguinte

A revisão de compra separa a disponibilidade do editor avançado da publicação da interface do comprador. `merchant.js` detecta o contrato e carrega o módulo avançado apenas quando a coluna de versão existe; caso contrário mantém as ferramentas anteriores e o respectivo formulário. As consultas públicas retiram campos da migração ainda pendente ao usar o contrato anterior. Isto permite publicar produto e carrinhos sem declarar a migração aplicada.
