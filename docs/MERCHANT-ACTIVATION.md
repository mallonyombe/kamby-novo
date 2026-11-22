# Gestão do vendedor — contrato alojado activado

12 de Novembro de 2026.

## Causa confirmada

A aplicação escolhe `merchant-advanced.js` apenas quando o contrato do editor existe no servidor. Antes da activação, o projecto `wbjhhkjriqeloiinvbii` não tinha a coluna `kg_products.moderation_status`, as categorias por loja nem as funções de gravação e actividade da migração `20261112054238_merchant_catalogue_editor.sql`. Os logs confirmaram `column kg_products.moderation_status does not exist`. Por isso a conta de vendedor abria a interface anterior, com preço/stock e criação simples.

## Trabalho preparado

- Quatro destinos do vendedor: Resumo, Produtos, Actividade e Loja; navegação inferior no móvel e lateral no desktop.
- Indicadores mais compactos, identidade sem repetição nas outras secções e hierarquia de acções.
- Catálogo em linhas com fotografia, preço, variantes e estado, pesquisa e filtros.
- Editor por cinco etapas; preço principal de cada variante em linha e promoção/quantidade dentro de detalhes expansíveis.
- Gráfico com duas séries e sete dias seleccionáveis, valores acessíveis e tabela alternativa.
- Corrigida perda da categoria do produto ao abrir o editor antes de terminarem as categorias atribuídas.
- Compatibilidade anterior conservada: o painel avançado não é imposto a um servidor que ainda não suporta as suas operações.

## Verificação

`npm test` compilou as oito migrações em PostgreSQL/PGlite e aprovou os contratos de isolamento, concorrência, rascunhos, variantes, gravação atómica e permissões. `npm run test:frontend` aprovou os 48 testes.

`tests/build-merchant-layout-qa.mjs`, com a rede e sessão isoladas de `tests/build-merchant-fixture.mjs`, aprovou 24 verificações no navegador: navegação, pesquisa, edição, categoria preservada, preço 85,25 MT guardado e recuperado, gráfico, selecção de dia, horários, validação de rascunho e larguras 320/390/1040 nos dois temas. Os dados da pré-visualização são exclusivamente da fixture; não constituem indicadores do serviço alojado.

## Activação alojada e limites da verificação

A chamada nativa `Supabase.apply_migration`, com o nome `merchant_catalogue_editor`, terminou com `success: true` nesta revisão. A consulta posterior confirmou a coluna `moderation_status` e a função de gravação do editor. As duas tentativas anteriores tinham expirado; não foram contornadas.

O ensaio autenticado confirmou rascunho real, upload binário de duas imagens, ordem da capa, imagem de variante, promoção, preço com cêntimos e resposta idempotente ao repetir a mesma gravação. A continuação não produziu confirmação de conclusão. A revisão automática bloqueou a consulta à sessão do ensaio por risco de repetição de gravações enquanto o artigo temporário permanecia publicado. Não foi iniciado outro ensaio com criação.

Uma recuperação limitada ao único artigo conhecido arquivou esse artigo pela função autenticada normal; terminou com sucesso, sem criar outro produto. O ensaio remoto de concorrência, isolamento e configurações permanece incompleto. Os contratos correspondentes passaram localmente em PostgreSQL/PGlite; isso não substitui a verificação remota. O utilitário de verificação agora limita cada pedido a 30 segundos.

As páginas QA e respectivas sessões isoladas são excluídas da publicação. Não guardar credenciais no repositório.
