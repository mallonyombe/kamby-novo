# Lojas fictícias e teste de percursos — 12/11/2026

Por pedido explícito do titular, foram criadas duas lojas fictícias no mesmo contrato Supabase usado pela aplicação. Não há um catálogo alternativo em memória. As lojas são publicadas e identificadas com `is_test=true`, nomes e descrições de teste. O ícone do carrinho foi corrigido: o SVG anterior sobrepunha uma sacola a um carrinho; agora contém um só desenho.

## Acessos

| Conta | Email | Permissão |
| --- | --- | --- |
| Lojista Casa | casa.teste@kamby.invalid | Apenas Casa & Estilo · Teste |
| Lojista Mercearia | mercearia.teste@kamby.invalid | Apenas Mercearia do Bairro · Teste |
| Cliente | cliente.teste@kamby.invalid | Comprador, sem acesso de vendedor |

As palavras-passe foram entregues separadamente ao titular e não integram o código, este documento ou a saída de publicação. As contas foram criadas pela Auth Admin API, confirmadas, sem emails enviados. O domínio é fictício: não permite testar entrega de email ou recuperação por correio. Nenhuma conta nova recebeu privilégios administrativos.

## Catálogo

- Casa & Estilo · Teste: caneca 350/500 ml, jarro 22/30 cm, ténis 38–44 (44 esgotado), auriculares sem variantes/esgotados e uma caneca criada durante o teste real de publicação.
- Mercearia do Bairro · Teste: arroz 1/5/10 kg, óleo 500 ml/1/2/5 litros, açúcar 1 kg sem variantes e café 250/500 g esgotado.
- São 9 artigos publicados e 18 variantes, após o teste de criação; os 8 artigos iniciais têm duas imagens cada, e o artigo criado pelo lojista tem uma imagem.
- Os preços são dados fictícios em cêntimos MZN, incluindo 450,50 MT para exercitar casas decimais.
- As imagens são ilustrações originais geradas por código, identificadas como teste. Os PNG foram enviados pela API Storage ao bucket privado. A galeria usa caminhos e URLs assinadas reais.

## Contactos de teste

As lojas usam números da gama fictícia 555-0100–0199, reservada pela NANPA ([fonte oficial](https://nanpa.com/numbering/555-line-numbers)). A interface identifica `is_test` e abre Simulação de WhatsApp na montra, PDP e carrinho. A mensagem pode ser revista/editada/copiada e a simulação pode ser concluída; nenhuma mensagem é enviada. Os números de exemplo também são reconhecidos como simulação para carrinhos antigos, mesmo quando não trazem a nova flag.

Uma loja real continua a usar o seu contacto e o fluxo WhatsApp habitual. Só a gestão pode alterar a flag de teste: as permissões/grants existentes e o trigger de vendedor impedem essa alteração por lojistas. Nenhuma política foi relaxada para as contas de teste.

## Percursos para o titular

1. Sem sessão: explorar categorias, pesquisar arroz/caneca/ténis, alternar Produtos/Lojas, aplicar preço/disponibilidade e testar termo inexistente.
2. Abrir cada loja e um produto; percorrer a galeria e voltar. Nos ténis, comparar 38/40/42 e confirmar que 44 não pode ser escolhido. No café e nos auriculares, confirmar bloqueio de compra.
3. Adicionar artigos das duas lojas. Alterar quantidades, verificar cada subtotal e remover uma linha. Simular um pedido de cada loja e verificar que as mensagens não misturam comerciantes.
4. Em Definições, entrar como Cliente. Guardar um produto, consultar Actividade/Guardados e Contactos, remover um guardado e abrir os avisos. O cliente de teste já tem um guardado, dois contactos e avisos produzidos pelo teste de integração.
5. Terminar sessão e entrar como Lojista Casa. Abrir A minha loja, alterar preço/stock, abrir/fechar a loja e criar artigo com imagem. Voltar ao catálogo e verificar o mesmo dado. Repetir com Lojista Mercearia; cada conta só mostra a própria loja.
6. Verificar aparência, entrada/saída de sessão, dados pessoais, erros de rede e retorno das subtelas. Recuperação por email e alteração efectiva de palavra-passe não são necessárias para testar estas contas; emails fictícios não recebem mensagens.

## Evidências

- `npm run test:frontend`: 21 testes; `npm test`: sete migrações e contratos PostgreSQL/RLS, incluindo impossibilidade de o lojista alterar `is_test`.
- `scripts/fixtures/verify-live-test-stores.mjs` executou com credenciais lidas de stdin oculto: 3 entradas Auth reais, atribuição de uma loja por lojista, edição/restauro de preço/stock, fechar/reabrir loja e recusa de edição da outra loja.
- O teste descarregou uma URL assinada real, enviou um PNG como lojista e publicou um produto com opção e galeria pela RPC. A repetição devolveu o mesmo ID, sem duplicação. Verificou ainda snapshots de contacto com subtotal calculado no servidor para as duas lojas e avisos privados após alteração de um guardado.
- A função temporária de provisionamento foi substituída por uma resposta fechada (410), com verificação JWT reactivada. Não permanece uma operação de bootstrap disponível.
- No navegador, com API real: catálogo/imagens, opções e preço por tamanho, variante esgotada, adição ao carrinho de duas lojas, subtotais independentes e simulação da mensagem. Credenciais reais não foram introduzidas automaticamente no formulário do navegador; a validação de entrada real foi feita pela API oficial.

O teste de upload binário e publicação deixou de estar pendente no nível API/Storage/RPC. O selector nativo de ficheiros do formulário e a entrega de emails continuam verificações distintas; não são inferidos desse teste.
