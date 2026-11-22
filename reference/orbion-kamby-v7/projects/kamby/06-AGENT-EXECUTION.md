# Operação dos 30 agentes no Kamby
## Governance
ORB-18 Product Strategy é dono do problema e prioridades; ORB-13 Principal Architect aprova arquitectura; FE-04 UX Research desenha jornadas; BR-21 define posicionamento; BR-22/23/24 entregam identidade; BR-25/26 validam todos os textos; FE-01/02/03/05/06 implementam UI; BE-01/02/03 criam backend; BE-04 revê segurança; ORB-17 define testes; BE-06 controla release; ORB-20 mantém documentação.
## Sequência e gates
G0 Discovery: produto, público, fluxos, hipóteses, decisões abertas.
G1 Design: protótipo navegável, brand assets e textos aprovados.
G2 Architecture: ADR, modelo de dados, autorização e contratos.
G3 Implementation: branches isoladas e PRs por feature.
G4 Verification: unitários, integração, E2E, RLS, acessibilidade, carga e observabilidade.
G5 Release: staging, revisão de segurança, autorização explícita, monitorização e rollback.
## Política greenfield
Proibido importar automaticamente ficheiros ou schema do Kamby anterior. Apenas consultar como referência histórica, quando autorizado.
## Contrato de saída
Cada agente reporta: descobertas; decisões; ficheiros alterados; testes executados; evidências; riscos; dependências; estado real. Não afirmar que trabalhou sem execução verificável.
## Paralelismo seguro
Pesquisa e brand podem decorrer em paralelo. Modelação e UI usam contratos acordados. Alterações a schemas, auth, RLS e pagamentos exigem revisão independente. Nenhum agente publica sozinho.
