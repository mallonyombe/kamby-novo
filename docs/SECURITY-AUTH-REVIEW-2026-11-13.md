# Revisão de autenticação e autorização Kamby

Base: versão publicada v29, commit 665062e0587067252f73a43fc40a0bcbd83952ac.
Data: 13 de Novembro de 2026. Actualização de implantação: migração aditiva unified_account_context aplicada em produção após autorização. Publicação do frontend coordenada separadamente; não confirmada por este relatório.

## Evidência da auditoria inicial em produção (apenas leitura)
- Projecto `kamby`: migrações até `platform_operations` aplicadas. Nomes/tempos de algumas migrações remotas diferem dos ficheiros locais.
- As 21 tabelas `public.kg_*` têm RLS activada.
- `kg_private.is_admin` consulta a tabela privada de administradores e exige JWT `aal2` (MFA).
- `kg_private.can_manage_store` consulta associação activa e estado aprovado, não metadados editáveis pelo utilizador.
- Políticas de perfil/preferências restringem leitura/escrita à identidade autenticada; gestão pode ler perfis sob MFA.
- Consulta numa transacção READ ONLY com papel anon viu 2 lojas aprovadas. Navegação pública não depende de conta.
- Na auditoria inicial, `kg_account_context` não existia remotamente. Foi posteriormente aplicada e verificada conforme registo abaixo.
- Advisor Supabase: protecção contra palavras-passe comprometidas DESACTIVADA. Não foi alterada.

## Implementação preparada
Migração `20261113115858_unified_account_context.sql` adiciona RPC de leitura, sem parâmetro de utilizador, sem novas contas, credenciais ou concessões. O resultado contém:
- `user_id`: identidade de auth.uid(), que deve continuar a existir em auth.users;
- `roles`: customer, merchant quando há associação activa a loja aprovada, administrator ou operator conforme tabelas privadas;
- `merchant_store_ids`: apenas lojas aprovadas atribuídas à própria conta;
- `admin_access`: identidade com atribuição administrativa/operacional e MFA aal2;
- `admin_mfa_required`: atribuição existente mas MFA ainda necessária.

O contexto serve à apresentação do login único. Não substitui autorização de cada operação nem concede todas as permissões a um operator. As APIs existentes revalidam permissões específicas e RLS. O frontend agora consome esta RPC através de account-access.js. Apenas quando a função não existe (PGRST202/42883), usa kg_admin_context e kg_my_managed_stores, ambos protegidos no backend. Outras falhas negam o contexto. O fallback não classifica administradores como vendedores a partir da listagem administrativa de todas as lojas. A página administrativa encaminha para o mesmo login Kamby e conserva a verificação MFA e permissões por operação. Alterações de identidade invalidam pedidos de conta pendentes e limpam acessos anteriores.

## Testes executados
`npm test` passou: migrações compiladas em PostgreSQL/PGlite, baterias existentes de RLS e nova bateria account-security. Testes usam dados fictícios em memória, com rollback.

Novos cenários: metadados de papel falsificados não promovem cliente; cliente/vendedor não criam lojas; auto-atribuição de administrador/vendedor negada; perfil de outra conta não pode ser criado/lido; revogação de associação reflecte-se na próxima consulta; administrador sem MFA não escreve; administrador com MFA recebe contexto; sessão sem identidade e anon não recebem contexto privado; anon continua a navegar.

Nenhuma tentativa de força bruta, alteração de senha, envio de email/OTP, criação de conta ou exploração destrutiva foi feita em produção. Testes locais de RLS não substituem teste integral Auth/HTTP/browser. Validação visual mínima de 8 caracteres não comprova política de senha no servidor.

## Próximos passos condicionados
1. Autorizar/aplicar a migração após revisão. A integração frontend está preparada e usa fallback seguro enquanto a migração não estiver aplicada.
2. Inspeccionar configurações Auth efectivas (mínimo de senha, protecção de senhas comprometidas, recuperação, rate limits, CAPTCHA e MFA). Alterações exigem autorização específica; não realizadas nesta revisão.
3. Testar login, recuperação, alteração de senha, logout e sessões concorrentes com contas de teste autorizadas, sem usar dados de clientes.
4. Rever ingestão pública de métricas: o debounce do navegador não é defesa contra automação. Não foi executado flood.

Referências: https://supabase.com/docs/guides/auth/password-security e https://supabase.com/docs/guides/database/postgres/row-level-security.

## Visibilidade e concorrência da administração
A entrada administrativa só é construída para conta autenticada pronta, online, cuja identidade coincide com o contexto protegido e `adminEntry === true`. Visitantes e clientes normais não recebem a entrada. Um operador com concessão privada administrativa também pode vê-la, mas continua limitado às permissões específicas; não é promovido a administrador. A exigência MFA permanece no painel.

Corrigidas respostas MFA obsoletas após logout: carregamento dos factores, inscrição do autenticador, verificação de código e erro inicial verificam a geração da sessão antes de alterar a interface. Testes determinísticos executam a função MFA real com promises controladas, reproduzindo logout durante cada operação. Não substituem teste browser/Auth real. Total actual: 85 testes frontend aprovados e build aprovado.

## Plano de aplicação e reversão (aplicação concluída; reversão NÃO executada)
1. Rever a migração local `20261113115858_unified_account_context.sql` e conferir novamente a ausência das duas funções no remoto. Se já existirem, parar e comparar definições; não sobrescrever silenciosamente.
2. Após autorização específica para a alteração remota, aplicar apenas esta migração aditiva numa transacção: cria a função interna de contexto e a RPC invocadora; restringe EXECUTE a authenticated; não altera contas, senhas, atribuições, lojas, tabelas ou políticas existentes.
3. Verificar definições/ACL e ausência de EXECUTE para anon. Com sessão de teste autorizada, verificar cliente, vendedor atribuído, admin AAL1 e AAL2. Não criar contas, promover utilizadores ou mudar senhas para obter esses testes sem autorização.
4. Publicar o frontend somente após revisão conjunta. Antes da migração, ele usa APIs protegidas existentes como fallback; falhas diferentes de função ausente fecham o acesso.
5. Reversão preferencial da interface: republicar o artefacto anterior conhecido, mantendo a RPC aditiva inofensiva. Se for necessário retirar a RPC, criar uma migração compensatória transaccional que remova primeiro `public.kg_account_context()` e depois `kg_private.account_context()`, sem CASCADE. Preservar o histórico de migrações. O novo frontend regressa automaticamente ao fallback de APIs protegidas quando a função deixa de existir.
6. Após reversão, verificar navegação pública, login existente, MFA administrativo e isolamento das lojas. Nenhum rollback deve apagar dados ou atribuições.


## Registo de implantação verificada
Em 13/11/2026, após autorização e nova confirmação de que nenhuma das duas funções existia, foi aplicada exclusivamente a migração revista `unified_account_context`. Histórico remoto: versão `20261113121020`; ficheiro local correspondente: `20261113115858_unified_account_context.sql` (o serviço atribui o timestamp remoto). A ferramenta confirmou success e a listagem de migrações confirmou o registo.

As definições foram novamente lidas: função privada STABLE SECURITY DEFINER, wrapper público STABLE SECURITY INVOKER, ambos com search_path vazio. Verificação efectiva de privilégios confirmou EXECUTE=false para anon e EXECUTE=true para authenticated em ambas. Uma chamada com papel authenticated sem identidade, numa transacção READ ONLY revertida, foi correctamente recusada com insufficient_privilege.

Nenhuma tabela, conta, atribuição, senha, configuração Auth ou dado de negócio foi alterado. Não foram executadas simulações de identidade de utilizadores reais nem login/reset de senha/MFA em contas reais. Matriz cliente/vendedor/admin/MFA continua validada nos testes locais, não como teste Auth E2E remoto. As observações sobre senhas comprometidas e limites das métricas públicas permanecem pendentes. O frontend está entregue ao coordenador da publicação; este registo não afirma que o Site já foi publicado.
