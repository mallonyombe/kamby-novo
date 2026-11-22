# Normas de engenharia

- Português para comunicação, documentação e termos de domínio; preservar nomes oficiais das APIs e bibliotecas.
- Preferir TypeScript strict, HTML semântico, CSS tokens, módulos por funcionalidade e fronteiras de confiança explícitas.
- Preferir monólito modular quando adequado; evitar microserviços, caches e filas prematuros.
- DRY/KISS/YAGNI, coesão alta, contratos e invariantes; evitar abstracções artificiais.
- Testar por risco: unidade, integração, E2E, concorrência, acessibilidade e segurança.
- Supabase: RLS e grants, migrations versionadas, transacções para operações críticas, idempotência e logs sem dados pessoais.
- Commits convencionais, PR com problema, solução, riscos, testes e recuperação.
- Decisões estruturais em ADR; optimizações com medições antes/depois.
