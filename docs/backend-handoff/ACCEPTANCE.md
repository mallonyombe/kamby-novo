# Aceitação e operação

## Evidências disponíveis

| Verificação | Resultado conhecido | Limite |
| --- | --- | --- |
| `npm run test:frontend` | 16 testes aprovados na publicação base | Funções de domínio/pesquisa; não prova um upload HTTP real |
| `npm test` | Cinco migrações compilam em PostgreSQL/PGlite; contratos transaccionais/RLS aprovados | Não simula toda a infraestrutura Auth/Storage |
| Criação atómica local | Testes de autorização, fotografia obrigatória, variante opcional, cêntimos, retry estrito e rollback aprovados | `storage.objects` simulado exclusivamente no teste local |
| Base alojada | Cinco migrações confirmadas por nome/versão; bucket privado; 0 lojas/0 produtos/4 categorias | Inspecção de metadados; não é prova de vendas nem de integração binária |
| Navegador: pesquisa/perfil/edição | Percursos da etapa anterior registados nos documentos SEARCH e MERCHANT-WORKSPACE | Credenciais reais não introduzidas automaticamente |
| Navegador: novo artigo | Abertura, apresentação e validação de nome vazio observadas | Selector de ficheiro/publicação de ponta a ponta ficaram interrompidos pela sessão remota |
| Conformidade Handbook v3.0 | Não verificada | Documento não fornecido; não assinar certificação |

Esta revisão do handoff não executa novas escritas em produção, não cria comerciantes, não altera Auth/Storage/RLS e não declara resolvidos os gates acima.

## Reproduzir verificações locais

Node.js 22+, dependências fixadas no lockfile. No repositório entregue:

```sh
npm ci
npm run test:frontend
npm test
npm run build
```

`npm test` executa os testes em PGlite, com fixtures e rollback. Não colar os testes locais no SQL Editor alojado. Em particular, `supabase/tests/product-creation.sql` modifica metadados Storage simulados e é exclusivamente local. O gerador de testes alojados tem restrições próprias; ler `supabase/README.md` e o próprio gerador antes de o executar. `verify-readonly.sql` deste kit só consulta metadados e contagens, sem dados pessoais.

A página `merchant-qa.html` gerada para QA não integra o build. Antes de publicar, confirmar ausência de `*qa.html` e `fixture-product.png` em `dist/`.

## Percurso de recepção a concluir

Usar um projecto Supabase isolado ou ambiente de QA definido pela equipa. Criar contas pela gestão, sem pôr credenciais nos ficheiros. Não assumir que os 0 produtos de produção são um ambiente de teste descartável.

1. Administração cria/aprova loja e atribui conta de vendedor; outra conta continua sem acesso. Revogar a atribuição e verificar acesso negado directamente na API.
2. Entrar, restaurar e terminar sessão. Confirmar que uma conta cliente não recebe acesso à gestão e que não pode ampliar funções por metadata.
3. Publicar fotografia JPEG/PNG/WebP; rejeitar ausência, ficheiro inválido e mais de 5 MiB. Confirmar objecto privado e acesso público apenas às imagens autorizadas do catálogo.
4. Publicar artigo com 450,50 MT e opção; repetir com resposta perdida; confirmar um só produto, variante, imagem e pedido. Repetir UUID com outro conteúdo deve falhar. Testar também artigo sem opção.
5. Simular falha de criação depois do upload. Confirmar ausência de dados parciais; limpeza não pode apagar foto anexada. Testar quota/caminho de outra loja e revogação entre upload e publicação.
6. Verificar catálogo do vendedor, feed, pesquisa, PDP, retorno e carrinho. Editar preço/stock por variante e com duas sessões concorrentes; a versão antiga deve ser rejeitada.
7. Negociar no WhatsApp sem envio automático de mensagem pela equipa de teste; verificar destino e conteúdo preparado. O clique não prova envio, encomenda ou venda. Se integrado o snapshot remoto, validar todos os casos P0 descritos em DECISIONS-AND-GAPS.
8. Verificar imagem após uma sessão superior à validade da URL assinada, perda de ligação, cancelamento/reabertura e teclado em Android/iOS; navegação por teclado, leitor de ecrã e movimento reduzido.
9. Exercitar métricas, isolamento entre lojas, abuso, quotas, logs sem dados sensíveis, restauro e rollback. Registar evidências e quem aceita cada gate.

## Critério de passagem

A equipa receptora confirma o contrato actual e pode continuar o trabalho sem reescrever o visual. A designação “pronto para operar” exige concluir e registar os P0/P1 aplicáveis ao piloto. Não converter testes unitários aprovados em aprovação automática de segurança, desempenho, acessibilidade ou operação.

| Papel | Aceite | Evidência/data |
| --- | --- | --- |
| ORB-13 | Pendente | — |
| ORB-20 | Pendente | — |
| BE-01 | Pendente | — |
| BE-02 | Pendente | — |
| BE-04 | Pendente | — |
