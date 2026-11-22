# Quality gates

## Todos os changes
- Scope explícito e diffs revistos; lint, typecheck e testes aplicáveis; documentação coerente.
- Erros e estados vazios; compatibilidade; evidências reais.

## Interface
- Semântica HTML, teclado, foco, contrastes, estados, responsividade, reduced-motion; revisão visual.
- Performance medida com LCP, INP e CLS quando aplicável, em dispositivos representativos.

## Dados / Supabase
- SQL com constraints, migrações testadas, RLS para papéis permitidos e proibidos, privilégios SQL, concorrência e idempotência quando relevante.
- Segredos nunca no browser; storage policies e edge functions revistas.

## Crítico
- Revisão independente BE-04, plano de rollback/recuperação, autorização humana e evidência da execução no ambiente alvo.
- Falha, teste ignorado e teste não executado são estados distintos.
