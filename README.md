# Kamby · Orbion Technology

Frontend incremental orientado pelos ficheiros e pedidos do titular: catálogo público, lojas e montras, pesquisa Produtos/Lojas, carrinho por loja, Definições e Espaço do Lojista. Os cabeçalhos partilham `frontend/navigation.css`; o cabeçalho principal apresenta Kamby.

## Estrutura

- `frontend/index.html`: vistas principais e navegação por hash.
- `frontend/product.html`: compatibilidade com ligações antigas de produto.
- `frontend/search-engine.js`: correspondência e paginação da pesquisa.
- `frontend/merchant.js`, `merchant-domain.js`, `merchant.css`: perfil e gestão delegada do catálogo.
- `frontend/product-composer.js`: folha de criação, fotografia e recuperação de publicação.
- `frontend/platform.js`: cliente oficial Supabase Auth e gravação de interacções da loja.
- `supabase/migrations/` e `supabase/tests/`: contrato PostgreSQL, permissões e verificações.
- `docs/SEARCH.md` e `docs/MERCHANT-WORKSPACE.md` e `docs/PRODUCT-CREATION.md`: contratos e limites das etapas.
- `reference/orbion-kamby-v7/`: referências históricas fornecidas pelo titular; as instruções actuais prevalecem.

As lojas são criadas pela gestão. Vendedores recebem acesso explícito por atribuição, podem criar artigos com fotografia e alterar preço, stock e abertura das lojas autorizadas. O catálogo usa o Supabase real. Lojas fictícias só existem nos lotes de teste autorizados e identificados; as métricas não são preenchidas artificialmente.

## Preparar e verificar

Node.js 22 ou superior. Dependências fixadas em `package-lock.json`.

```sh
npm ci
npm test
npm run test:frontend
npm run build
```

O build copia HTML, CSS e assets e empacota os módulos autenticados com o SDK Supabase. A saída está em `dist/`, sem dependências de CDN. As páginas de QA são geradas apenas pelos scripts de teste e removidas pelo build final.

Os testes locais usam PostgreSQL/PGlite com rollback. As verificações alojadas são explícitas e descritas nos documentos da etapa; não são executadas por `npm test`. Credenciais de Auth nunca integram o código. A chave publicável do catálogo é limitada pelas políticas do servidor.

## Publicação

O Site conserva a identidade e o acesso privado existentes. `.openai/hosting.json` declara `dist/` como saída estática. O histórico Git conserva as etapas anteriores.

## Handoff de backend

O [kit técnico](docs/backend-handoff/README.md) documenta a integração Supabase já existente, as RPCs, os dados que continuam locais, as diferenças da proposta REST e a aceitação operacional pendente. Não executar DDL paralelo de `stores/products` nem activar uma origem HTTP de exemplo.

A [integração de Pesquisa e Definições](docs/SETTINGS-AND-SEARCH.md) inclui as subtelas reais, aparência local, actividade privada e limites de validação.

Por pedido do titular em 12/11/2026, há duas [lojas fictícias de teste](docs/TEST-STORES.md), identificadas no catálogo real. As credenciais são privadas e não integram o repositório.
