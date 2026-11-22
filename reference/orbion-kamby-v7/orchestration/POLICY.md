# Protocolo de orquestração

1. Receber pedido com ID, escopo, repositório, branch, critérios e autorização.
2. Fazer discovery em leitura; identificar dados, módulos e riscos.
3. ORB-13 define interfaces e dependências; ORB-18 esclarece valor e critérios de produto.
4. Atribuir um único dono de escrita por ficheiro/migração. Trabalhos paralelos usam worktrees isoladas.
5. Produzir alterações pequenas; rever contratos e actualizar ADRs.
6. ORB-17 define plano de testes; BE-04 revisa fronteiras de confiança; ORB-19 revisa acessibilidade quando aplicável.
7. BE-06 verifica CI, artefactos, plano de recuperação e estado de deploy.
8. Apenas a autoridade humana aprova alterações críticas de produção.
9. Relatório final separa: executado, testado, bloqueado, não executado.

Estados: PLANNED → DISCOVERED → DESIGNED → IMPLEMENTED → VERIFIED → REVIEWED → APPROVED → DEPLOYED. BLOCKED e FAILED podem ocorrer em qualquer etapa. Nunca saltar directamente de PLANNED para DEPLOYED.
