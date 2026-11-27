# Kamby — Constituição de trabalho para agentes de IA

Substitui o `AGENTS.md` anterior. Lê este ficheiro inteiro antes de tocar em qualquer coisa. Se algo aqui contradiz o teu instinto, este ficheiro ganha.

## 1. O que está em jogo

O Kamby tem a camada de dados sólida (RPCs idempotentes, concorrência optimista, RLS testada) e uma camada visual que ainda parece gerada por IA: funcionalidades a mais, ecrãs que fazem o utilizador pensar, cores e tamanhos sem sistema. O teu trabalho é **tirar peso e dar rigor**, não acrescentar. Cada linha que acrescentas tem de ter razão escrita num destes documentos.

## 2. Ordem de leitura (obrigatória)

Antes de qualquer trabalho de interface, lê por esta ordem e confirma na tua resposta que o fizeste:

1. `docs/product/00-PRINCIPLES.md` — as leis. Tudo o resto deriva delas.
2. `docs/product/01-DESIGN-SYSTEM.md` — tokens, tipografia, espaço, ícones, imagem, gráficos.
3. `docs/product/02-MOTION-FEEDBACK.md` — movimento e feedback.
4. `docs/product/03-COPY-AND-LEGAL.md` — palavras, estados vazios, erros, termos e privacidade.
5. O documento do ecrã em causa (`04-SELLER-PANEL.md`, `05-SURFACES.md`).
6. `docs/product/06-CHECKLIST-ANTI-IA.md` — a tua auto-revisão antes de dizeres "feito".
7. Contexto técnico existente: `docs/CORRECTION-BRIEF.md`, `docs/MERCHANT-WORKSPACE.md`, `docs/PRODUCT-CREATION.md`, `docs/REVIEW-END-TO-END.md`.

**Autoridade, da maior para a menor:** instrução do titular na conversa → `docs/product/*` → restantes `docs/*` → `reference/*` (histórico, não vinculativo). Onde `docs/product/*` contradiz um doc antigo (ex.: `MERCHANT-SUMMARY-DESIGN.md`), o novo prevalece e deves actualizar ou marcar o antigo como substituído.

## 3. Regras de escopo — a parte mais importante

1. **Se não está escrito, não existe.** Não acrescentes campos, secções, ecrãs, textos, ícones, animações, estados, opções, atalhos ou "melhorias". Criatividade não é pedida. Consistência é.
2. **Uma tarefa = um ecrã ou um fluxo.** Toca só nos ficheiros que a tarefa exige. Tudo o que notares fora do âmbito vai para uma lista no fim da resposta ("Reparei, não mexi"). Não corrijas por tua conta.
3. **Documento omisso ⇒ pergunta.** No máximo 5 perguntas, cada uma com a tua recomendação e a razão. Não adivinhes. Quando a questão é clara à luz dos princípios, decide e explica numa linha.
4. **Nunca removas capacidade de backend.** Variantes, preço anterior, condição, atributos, quantidade, etc. continuam suportados. O que muda é a **exposição na interface** (ver `04-SELLER-PANEL.md`). Antes de esconder um campo, prova com `grep` que nenhuma vista (PDP, pesquisa, carrinho, administração) depende dele. Se depender, o campo passa para "Mais opções"; não é apagado.
5. **Intocáveis:** o logótipo (`icone.svg`); migrações já aplicadas; contratos das RPCs (`kg_*`); políticas RLS; chaves e segredos.
6. **Dados reais, sempre.** Nunca inventes números, avaliações, vendas, nomes, ofertas ou textos de enchimento ("Artigo do catálogo."). Sem dados ⇒ estado vazio honesto. Erro ⇒ "—", nunca "0".
7. **Zero decoração.** Sem emojis, ícones decorativos, gradientes novos, chips/pílulas sem função, texto promocional, slogans, cartões explicativos repetidos.
8. **Componente existente antes de novo.** Um componente novo só com aprovação do titular e depois de descreveres porque os existentes não servem.
9. **Sem bibliotecas novas** sem pedir. Stack: HTML + CSS + JS (módulos ES), esbuild, Supabase. Sem framework.
10. **Português de Moçambique**, tratamento por "tu", sem exclamações, sem emojis. Código em inglês; comentários e commits em português.

## 4. Como me pedem trabalho (e como respondes)

Cada tarefa chega com quatro partes. Se faltar uma, pergunta antes de começar.

```
OBJECTIVO:     o que construir ou mudar (um ecrã/fluxo)
CONTEXTO:      o que já existe, para quem, que documentos se aplicam
RESTRIÇÕES:    o que não tocar, o que evitar
CONCLUÍDO QUANDO: como vou verificar (ver secção 5)
```

**Antes de escreveres código:** (a) resume o plano em ≤ 10 linhas; (b) lista os ficheiros que vais tocar; (c) lista as perguntas em aberto. Espera o OK se houver perguntas ou se a tarefa tocar mais de 3 ficheiros.

**Um agente, uma tarefa, uma branch.** Se houver trabalho paralelo, cada tarefa vive no seu `git worktree` e só se junta ao `main` depois de revista por outro agente ("lê as alterações, corre os testes, confirma que cumpre os docs").

## 5. "Concluído" significa prova

"Funciona" é uma afirmação; a prova é o que a sustenta. Só dizes **Concluído** quando mostrares, por esta ordem:

1. `npm run build` sem erros.
2. `npm run test:frontend` e `npm test` verdes (mostra o resumo final).
3. Capturas do ecrã, **antes e depois**, em 320, 390 e 1040 px, tema claro e escuro, geradas pelos fixtures de QA (secção 7).
4. Todos os estados do ecrã (carregamento, vazio, erro, offline, parcial, restrito, sucesso) visitados e capturados quando existam.
5. Movimento reduzido testado (`prefers-reduced-motion: reduce`): estado, texto e foco ainda comunicam o resultado.
6. Navegação só por teclado: foco visível, ordem lógica, Esc fecha folhas.
7. Auditoria de tokens (comandos em `06-CHECKLIST-ANTI-IA.md`): o ecrã não introduziu cores, tamanhos de letra ou raios fora do sistema.
8. A lista "Reparei, não mexi" e a lista "Não verifiquei" (o que não conseguiste testar e porquê). **Nunca digas que um teste correu se não correu.**

## 6. Quando algo parte (depuração)

- Reproduz primeiro e mostra a saída que falha antes de editares.
- Procura a causa-raiz. É proibido esconder o erro com `try/catch`, valores por defeito silenciosos ou `?.` só para a falha parar.
- É proibido editar, saltar ou apagar testes existentes para os fazer passar. Se um teste parece errado, pára e explica.
- Diff mínimo: só os ficheiros que a correcção exige, sem refactors de passagem.
- Logs temporários com prefixo `[debug]`, sem passwords nem tokens, removidos antes de terminares.
- Duas correcções falhadas seguidas ⇒ pára, escreve o que aprendeste e recomeça.
- Para bugs visuais: imagem 1 = o que vejo, imagem 2 = o que devia ser. Lista **todas** as diferenças, confirma na consola/rede se não é problema de dados, corrige só essas, captura de novo e compara.

## 7. Comandos

```sh
npm ci                                  # dependências (Node 22+)
npm run build                           # frontend/ → dist/
npm run test:frontend                   # testes de domínio e UI
npm test                                # migrações e RLS em PGlite
python3 -m http.server 3000 --directory dist   # servir (localhost)

node tests/build-merchant-fixture.mjs   # gera dist/merchant-qa.html
# abrir: /merchant-qa.html?qa=<modo>
# modos: baseline | attention | empty | closed | unassigned | no-categories
#        summary-loading | summary-error | save-error | upload-error
#        create-error | create-uncertain | fade
```

Os fixtures simulam sessão e rede; **as páginas de QA nunca entram na publicação**. Entrar no painel: aba Perfil → "Gerir".

## 8. Armadilhas conhecidas

- O CSS é uma cascata de várias folhas (`merchant.css`, `merchant-refinements.css`, `buyer-*.css`, …) e há **três vocabulários de tokens** (`--ui-*`, `--bg-*`/`--text-*`, `--mw-*`). A direcção é convergir para `--ui-*` (ver `01-DESIGN-SYSTEM.md`). Não crias um quarto.
- `merchant-workspace.js` e `product-composer.js` são densos (marcação em strings, funções de uma linha). Edita com substituições cirúrgicas; não reescrevas ficheiros inteiros.
- Os ficheiros `*-legacy*` existem por compatibilidade com uma migração que pode não estar aplicada no Supabase alojado. Não os apagues sem confirmar.
- A PDP usa `condition` e `attributes`. Esconder estes campos no editor não os pode apagar.
- `--spring-physics` é, na verdade, uma curva ease-out (`cubic-bezier(.16,1,.3,1)`), não uma mola. Usa os tokens de movimento de `02-MOTION-FEEDBACK.md`.
- Armazenamento de fotografias: o upload acontece só ao gravar; o formulário guarda os caminhos para repetir a gravação. Não alteres esta ordem.
- Se o titular partilhar tokens de GitHub ou chaves na conversa, avisa que ficaram expostos e recomenda revogá-los.

## 9. Formato da tua resposta final

```
Li: (lista dos documentos)
Fiz: (≤ 8 linhas, factos)
Prova: (build, testes, capturas antes/depois, estados)
Não verifiquei: (honesto)
Reparei, não mexi: (lista)
Perguntas: (se houver)
```
