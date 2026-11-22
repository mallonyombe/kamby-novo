# Arquitectura — Greenfield
## Stack proposta (a validar antes de iniciar)
Frontend: HTML semântico, CSS moderno, TypeScript, React/Vite se a complexidade justificar; PWA.
Backend: Supabase PostgreSQL, Auth, Storage, RLS, Edge Functions para operações privilegiadas.
Deploy: Vercel ou equivalente; GitHub CI; ambientes local, staging e produção separados.
## Princípios
Monólito modular por funcionalidades: `auth`, `catalog`, `stores`, `cart`, `contact`, `admin`, `moderation`.
Camada de domínio com regras e tipos; consultas com RLS; Edge Functions para operações privilegiadas e integrações com segredos.
Não guardar service-role no browser. Não confiar em `role` fornecida pelo cliente.
## Árvore proposta
src/app; src/features/{auth,catalog,stores,cart,contact,admin}; src/shared/{ui,lib,styles}; supabase/{migrations,functions,tests}; docs/{adr,api}; tests/{unit,integration,e2e}; .github/workflows.
## Fronteiras
O browser pode consultar dados públicos aprovados via RLS. Alterações de loja/produto exigem dono autorizado. Aprovação de loja e suspensão exigem papel administrativo verificado no servidor.
## Qualidade
Migrações versionadas, tipos gerados do schema, testes de RLS, contratos, observabilidade, recuperação e revisão de segurança.
