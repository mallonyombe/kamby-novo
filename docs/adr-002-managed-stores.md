# ADR-002 — Lojas criadas pela gestão e interface funcional

Estado: correcção expressa do titular em 11/11/2026. Prevalece sobre ADR-001 nos pontos de criação/candidatura de lojas e sobre as especificações históricas que as permitem.

## Decisão de produto

O Kamby tem um catálogo de lojas criadas pela gestão. O cliente consulta lojas/produtos, guarda produtos, mantém carrinhos por loja e prepara contacto pelo WhatsApp. O registo de conta não concede criação de loja nem acesso à gestão.

A gestão cria várias lojas, edita informação/contacto, publica ou suspende e gere o catálogo. Rascunhos ficam privados. Não existe candidatura pública nesta versão. Um utilizador comum não pode executar a operação por API, mesmo que construa manualmente um pedido que a interface não mostra.

## Correcção de experiência

A interface elimina slogans, frases promocionais, créditos de marca na navegação e introduções que não ajudam a tarefa. Títulos são nomes das áreas; botões descrevem acções. Estados vazios dizem o que falta, sem histórias sobre o lançamento. A ausência de catálogo real não é ocultada com produtos inventados.

Cor, tipografia, contraste, foco, tamanhos de toque, claro/escuro e densidade são definidos em DESIGN-SYSTEM.md e revistos separadamente. A implementação é uma proposta verificável; testes de contraste não equivalem a aprovação estética nem a auditoria WCAG completa.

## Evolução e recuperação

A migração inicial não é reescrita. Nova migração corrige políticas, funções e restrições. As tabelas históricas de candidatura são preservadas sem servir de novo fluxo. Fonte e nova versão do Site são guardadas para revisão; esta correcção não publica release.
