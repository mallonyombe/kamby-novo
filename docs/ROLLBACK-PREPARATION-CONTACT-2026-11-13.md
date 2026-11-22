# Recuperação da preparação privada e regras de contacto

Plano local, não executado em produção. Requer aprovação de implantação e revisão independente das alterações críticas.

## Antes de aplicar
1. Registar commit/artifact exactos do frontend actual e candidato, hashes das duas migrações e versões aplicadas. Guardar exportação das definições e ACL das funções que serão substituídas; não exportar tokens/segredos.
2. Repetir `supabase/tests/preflight-preparation-readonly.sql`. Parar se surgirem horários incompatíveis ou lojas aprovadas sem responsável; não reparar automaticamente.
3. Executar suites completas no schema final, build, verificação visual/funcional e confirmar acesso ao procedimento de restauração do fornecedor. Não declarar backup verificado sem testar o respectivo mecanismo.
4. Comunicar impacto: horários existentes passam a bloquear pedidos; [] mantém modo manual; contacto geral continua disponível; não habilitar signup/SMTP nesta entrega.
5. Aplicar migração preparação/horários antes da migração invariantes; cada aplicação deve ser transaccional. Verificar funções, ACL, histórico de migrações e disponibilidade antes de publicar frontend compatível.

## Falha durante aplicação SQL
- Se a transacção falhou e o histórico confirma ausência da migração, corrigir localmente e repetir apenas essa migração após revisão. Não repetir uma aplicação de resultado incerto.
- Se a primeira migração concluiu e a segunda falhou: não promover o frontend; manter dados, rever erro e concluir a segunda. Não remover a primeira automaticamente.
- Verificar sempre estado real e o ledger antes de escolher retry/reparação.

## Regressão depois de publicado
A recuperação preferencial é correcção para a frente, preservando RLS, MFA, responsáveis e dados.

### Falha apenas visual
Preparar e testar um bundle de recuperação que reverte as mudanças visuais defeituosas mas conserva:
- `store-availability.js` e chamadas de verificação em PDP/carrinho, incluindo retries;
- diferenciação entre pergunta geral e pedido;
- serialização de `opening_hours=[]` quando o horário não foi editado;
- cliente compatível com preparação e estados de erro.
Publicar apenas após as mesmas verificações. **Não restaurar cegamente o bundle anterior:** o cliente antigo permite handoff WhatsApp sem a nova verificação, e pode converter [] em semana fechada ao guardar identidade.

### Falha do editor
Manter catálogo/carrinho e controlos de contacto; suspender temporariamente o acesso à operação afectada na interface de recuperação, com mensagem clara, em vez de alargar permissões. Não descartar rascunhos, associações, imagens nem horários existentes.

### Falha de função SQL
Usar migração compensatória nova e revista para corrigir somente a função defeituosa. Preservar ACL, search_path, invariantes, callbacks e compatibilidade do cliente. Executar testes de papéis, horários, idempotência e versão antes de aplicar. Nunca apagar migrações do histórico, tabelas ou dados para simular rollback. Não retirar a regra de último responsável nem reabrir INSERT/grants antigos.

### Indisponibilidade da RPC de horário
O cliente falha fechado para pedidos, mantendo catálogo/carrinho e pergunta geral. Restaurar a função por migração compensatória; não introduzir fallback para relógio do dispositivo nem tratar falha de rede como loja aberta.

## Critérios de recuperação
- Anónimo vê somente catálogo público; cliente não administra; vendedor só prepara lojas atribuídas; MFA permanece exigido na gestão.
- Pedido aberto passa; fechado/fora do horário e retry antigo são recusados; carrinho permanece intacto.
- Guardar somente identidade preserva [] e mantém manual; horário configurado mantém o seu conteúdo.
- Último responsável protegido; mudanças de associação invalidam versão antiga.
- Sem escrita remota não autorizada, sem credenciais em logs, sem falsa alegação de email entregue.

Limites: rollback de dados/restore completo não foi executado; concorrência multi-conexão real, SMTP/Auth reais e desempenho de campo não foram validados nesta etapa. As transacções com fixtures dos testes locais são revertidas, o que não equivale a um ensaio de recuperação integral de produção.
