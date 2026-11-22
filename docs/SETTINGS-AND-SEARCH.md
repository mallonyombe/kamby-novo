# Integração de Pesquisa e Definições — 12/11/2026

Os estudos interactivos foram integrados no frontend de produção. O quarto destino usa `#definicoes` e preserva `#perfil` como ligação antiga. Cabeçalhos continuam no contrato comum de 56 px, títulos de 17 px e controlos de 44 px. O primeiro destino apresenta Kamby.

## Definições reais

- Visitantes: entrada na conta numa subtela, aparência, ajuda, informações da plataforma e limpeza local. Não aparecem acções privadas ou acesso administrativo.
- Sessão verificada: dados pessoais, actividade, segurança, notificações e saída. A loja só aparece após `getUser()` e consulta de atribuições no servidor. As subtelas usam `#definicoes/<destino>`, sem navbar; o regresso conserva posição e foco. Campos não guardados pedem confirmação antes de descarte.
- Nome e localização são gravados em `kg_profiles` e confirmados pela API antes de sucesso. Telefone/email aparecem apenas para consulta: alteração de contacto e fotografia não foram acrescentadas nesta integração.
- Palavra-passe: confirmação actual por Auth e alteração com `updateUser`; na recuperação, usa a sessão de recuperação. Os campos de palavra-passe são limpos depois da operação e na saída. A recuperação por email usa PKCE e o evento `PASSWORD_RECOVERY`; entrega de email e redirects dependem da configuração Auth/SMTP do projecto. A recuperação de contas só com telefone continua a precisar de assistência.
- Sessões: mostra o acesso actual e permite revogar a renovação das outras sessões com `signOut({scope:'others'})`. Não inventa uma lista de dispositivos; access tokens já emitidos só deixam de funcionar quando expirarem.
- Encerramento: regista um pedido privado para análise, não apaga a conta automaticamente. A gestão trata o pedido pelo processo administrativo; não foi criado um novo painel administrativo nesta etapa.
- Aparência: claro/escuro/automático, guardado por dispositivo e aplicado sem reload. Continua a funcionar sem conta ou rede. A opção de guardar pesquisas recentes também é local e pode ser desligada.

## Actividade, guardados e avisos

A migração `20261112045650_settings_experience` acrescenta `kg_saved_products`, `kg_user_preferences`, `kg_contact_activity`, `kg_account_requests` e `kg_notifications`, com grants e RLS privados por utilizador. Nenhuma destas tabelas é fonte de papéis ou de autorização de vendedor.

A PDP tem Guardar/Guardado. A conta pode consultar ou remover os guardados; artigos retirados da publicação aparecem como indisponíveis. A actividade lista até 100 guardados e 100 contactos por consulta. O registo `kg_record_contact_activity` copia nomes do catálogo no servidor e usa UUID idempotente; os cliques anónimos não criam histórico pessoal. É um registo de abertura solicitada do WhatsApp, não prova de mensagem enviada, encomenda ou pagamento. A gravação é de melhor esforço e não impede a abertura externa.

Os avisos são internos ao Kamby, não push, SMS ou email. Alterações de preço/stock de artigos guardados e actualizações do pedido de encerramento geram avisos privados, sujeitos às preferências. Apenas a leitura/marcação de lido é permitida ao cliente; inserções são feitas por triggers privados. Uma alteração de variante evita um segundo aviso pela actualização do produto agregado.

## Pesquisa integrada

Sugestões por termo usam o catálogo publicado e lojas aprovadas. Sugestões surgem após 150 ms de escrita e descartam respostas antigas. Os resultados continuam separados por tipo. A folha de filtros contém categoria, mínimo/máximo em MT, disponibilidade e ordenação de preço para produtos; existência de catálogo, loja aberta e ordenação de nome para lojas. Aplicar confirma o rascunho; fechar cancela. Os filtros de cada tipo são independentes e ficam no hash para retorno/histórico. Mudar o termo mantém os filtros; Limpar filtros repõe apenas o tipo activo.

Carregamento conserva grelha estável; zero resultados, ausência por filtros e falha de rede têm recuperação distinta. A pesquisa continua no cliente para o catálogo inicial; não se declara implantado um serviço `/v1` ou pesquisa por trigrams.

## Verificação

- `npm run test:frontend`: 21 testes aprovados, incluindo nome/localização, palavra-passe, tema, cêntimos, filtros e ordenação independentes.
- `npm test`: seis migrações compilam; testes anteriores continuam aprovados. `settings-rls.sql` verifica isolamento, favoritos de produtos públicos, notificações/preferências, permissões de pedidos e idempotência de contactos.
- A migração foi aplicada ao projecto Kamby. Os mesmos testes de Definições passaram no Supabase alojado dentro de uma transacção com rollback. Não deixaram lojas, contas ou dados de teste.
- Navegador: visitante com API real, subtelas sem navbar, tema escuro e retorno; com respostas de API isoladas: sessão restaurada, gravação de dados pessoais, falha de gravação com preservação de rascunho e confirmação de descarte, produto guardado e listado em Actividade, pesquisa, filtros de preço, zero filtrado e sugestões.
- Não foram alteradas palavras-passe reais, terminadas sessões de terceiros, enviados emails de recuperação ou pedidos reais de encerramento durante os testes de interface. Esses percursos dependem da configuração real de autenticação e entrega.
- A verificação de upload binário real/publicação do modal de artigo continua pendente, como registado em PRODUCT-CREATION.md; esta etapa não a apresenta como concluída.

Os documentos formais de termos/privacidade e um contacto oficial de suporte não foram fornecidos. Sobre informa essa ausência; não foram inventados políticas, contactos ou documentos legais. A ajuda tem respostas operacionais do próprio fluxo. O acesso à administração mantém-se separado.

O símbolo original foi preservado. No cabeçalho principal, Kamby fica junto ao ícone com cerca de 8 px de separação visual; os títulos contextuais mantêm o alinhamento centrado.
