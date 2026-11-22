# Criação de artigos pelo lojista

O botão Novo artigo abre uma folha modal nativa no Espaço do Lojista autorizado. Contém fotografia, nome, categoria, preço em MT, opção/tamanho e descrição. A fotografia é obrigatória: JPEG, PNG ou WebP até 5 MiB; o navegador verifica também que consegue descodificar a imagem. Não são usadas fotografias demonstrativas nem garantias inventadas. Opção e descrição são opcionais.

As categorias activas vêm do servidor. As quatro categorias solicitadas foram configuradas pela migração: Casa & Decoração, Moda & Calçado, Electrónica e Mercearia. A gestão conserva a criação de lojas e a manutenção de categorias.

A API `kg_product_upload_context` autoriza um caminho de Storage para a conta e a loja atribuída. O SDK oficial envia o ficheiro para o bucket privado `kg-product-images`, sem sobrescrever. `kg_merchant_create_product` valida novamente atribuição, loja aprovada, categoria activa, preço em cêntimos e metadados da fotografia. Produto, opção quando indicada, galeria, auditoria e registo de pedido são inseridos na mesma transacção PostgreSQL. As inserções directas continuam bloqueadas para vendedores.

Cada pedido recebe UUID estável. Repetir o mesmo pedido devolve o produto existente; reutilizar o identificador com outro conteúdo é rejeitado. Se a resposta de publicação se perder, os campos ficam bloqueados e Verificar publicação repete o pedido original sem duplicar o artigo. Erros conhecidos preservam o formulário. O upload e a transacção PostgreSQL são operações separadas: a limpeza de uploads sem referência é de melhor esforço; falhas de ligação podem deixar uma fotografia privada sem referência. A política de remoção impede apagar imagens já associadas a produtos.

Depois da confirmação, o catálogo do vendedor é recarregado e as consultas do feed, pesquisa, montra e PDP são invalidadas/revalidadas na mesma aplicação. O novo produto usa a PDP, carrinho e contacto WhatsApp existentes, pelo mesmo identificador. Não há sincronização Realtime entre dispositivos nesta etapa.

## Verificação e limites

- `npm test`: compila as cinco migrações em PGlite/PostgreSQL e verifica isolamento, acesso anónimo, publicação com/sem opção, foto obrigatória, preço exacto, repetição idempotente, payload diferente, rollback após falha de variante, categorias desactivadas e protecção de imagens anexadas.
- `supabase/tests/product-creation.sql` é exclusivamente local. Os objectos de Storage nesse teste são simulados; nunca executar os INSERT/DELETE de metadados deste teste no serviço alojado.
- `npm run test:frontend`: 16 testes de pesquisa, identidade, preços e validação de criação.
- No navegador foi observada a abertura da folha, apresentação completa e foco/erro ao submeter nome vazio. O envio pelo selector de ficheiros e a publicação de ponta a ponta não ficaram concluídos porque a sessão remota foi interrompida; não são apresentados como verificados.
- A migração `20261111213449_merchant_product_creation` foi aplicada ao Supabase Kamby. Os advisors não reportaram novo aviso do contrato desta etapa. Não foram criados artigos, lojas ou contas demonstrativas no serviço alojado.

O gerador `tests/build-merchant-fixture.mjs` produz apenas uma página local de QA com armazenamento de memória e respostas simuladas. Inclui cenários de falha de upload, falha de publicação e resposta incerta. A página e as fotografias de QA não integram o build final.

Actualização de 12/11/2026: por pedido posterior de lojas fictícias, o teste com conta atribuída real, upload binário Storage e publicação idempotente passou pela API oficial. Consultar `TEST-STORES.md`. O teste do selector nativo de ficheiros no navegador continua separado.
