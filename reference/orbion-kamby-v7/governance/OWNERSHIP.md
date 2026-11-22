# Matriz de autoridade — decisão / execução / revisão

| Domínio | Decisão | Execução | Revisão independente |
|---|---|---|---|
| Arquitectura transversal | ORB-13 | FE-01 / BE-03 | BE-04 e afectados |
| Interfaces | FE-03 | FE-01 / FE-02 | FE-04 / ORB-19 |
| Motion | FE-05 | FE-05 | FE-06 / ORB-19 |
| Supabase | BE-01 | BE-01 | BE-04 / BE-06 |
| Modelo de dados | BE-02 | BE-02 | BE-01 / BE-04 |
| Regras de negócio | BE-03 | BE-03 | BE-02 / ORB-17 |
| IA | ORB-14 | ORB-14 | BE-04 / ORB-17 |
| Analytics | ORB-15 | ORB-15 | BE-02 / ORB-18 |
| Developer platform | ORB-16 | ORB-16 | BE-06 |
| Estratégia de testes | ORB-17 | agentes executores | BE-06 |
| Produto | ORB-18 | FE-04 / FE-03 | ORB-19 |
| Acessibilidade | ORB-19 | FE-01 / FE-03 | ORB-19 (verificação separada) |
| Documentação | ORB-20 | ORB-20 | autor técnico |
| Release | BE-06 | CI/CD autorizado | BE-04 e responsável humano |

Conflitos: ORB-13 arbitra contratos técnicos; ORB-18 arbitra prioridades de produto; BE-04 pode bloquear riscos críticos; BE-06 pode bloquear releases sem evidência. O utilizador ou responsável designado mantém a aprovação de produção.
