# 00 — Princípios

Objectivo único: **o utilizador não pensa**. Cada princípio tem uma regra, o porquê e **um teste que podes executar**. Se um ecrã falha um teste, não está acabado.

Quem usa o Kamby: telemóvel Android de gama média, LTE instável, luz forte, uma mão ocupada, atenção dividida (o vendedor está na loja; o comprador está a caminhar). Desenha para esse contexto, não para um ecrã de demonstração.

---

## A. Pensar menos

**P1 · Um ecrã, um trabalho.** Escreve no topo da tua proposta: "O trabalho deste ecrã é ___" numa frase com um verbo. Se precisas de "e", são dois ecrãs.
*Teste:* um desconhecido diz em 5 segundos o que se faz ali.

**P2 · Uma acção primária.** No máximo um botão preenchido visível por ecrã ou folha. Tudo o resto é secundário (contorno) ou texto.
*Teste:* conta botões preenchidos na captura. > 1 = falha.

**P3 · Predefinição antes de pergunta.** Só se pergunta o que só o utilizador sabe. O resto tem valor por defeito sensato, escolhido pelo sistema (categoria única pré-seleccionada, última categoria usada, condição "novo", moeda MT).
*Teste:* cada campo obrigatório visível tem de justificar "só o utilizador sabe isto".

**P4 · Revelação progressiva.** O comum fica à vista; o raro fica a um toque. **Nunca** acordeões com formulários dentro. O raro vive numa linha que mostra o valor actual e abre uma folha focada.
*Teste:* num formulário, nenhum campo abre outros campos no mesmo scroll.

**P5 · Reconhecer, não recordar.** Mostra sempre o valor actual onde o utilizador decide ("Stock · Sem limite", "Promoção · Antes 150 MT"). Rótulo sem valor obriga a abrir para saber.
*Teste:* nenhuma linha de definição mostra só um rótulo e um chevron quando existe um valor.

**P6 · Palavras do utilizador, não do sistema.** "Esgotado", "Ocultar", "Pedidos pausados" — nunca `stock_status`, "rascunho de moderação", "payload", "sessão expirada (401)".
*Teste:* ler o ecrã em voz alta a alguém sem contexto técnico.

**P7 · Sem escolhas falsas.** Se o utilizador não percebe a diferença entre duas opções, só deve existir uma. "Publicar" ou "Guardar para depois" — não "Guardar alterações / Guardar rascunho / Guardar e publicar".
*Teste:* para cada par de botões, descreve a diferença numa frase de 8 palavras. Se não dá, funde.

**P8 · Limites de escolha.** Menus de acções: no máximo 4 itens, ordenados por frequência de uso, o destrutivo no fim e separado. Segmentos: 2–4 opções. Listas de definições: agrupadas em blocos de 2–5.

**P9 · Um caminho por tarefa.** Cada tarefa tem uma entrada canónica. Atalhos só em contexto distinto (estado vazio) e com o mesmo rótulo e o mesmo fluxo. Nunca duas entradas para a mesma coisa no mesmo ecrã.
*Teste:* procura o rótulo da acção no ecrã. Aparece uma vez.

**P10 · Fala o mínimo.** Se o ecrã se explica sozinho, não tem texto. Texto só para ajudar a decidir ou a resolver um problema.
*Teste:* apaga cada frase; se nada se perde, ela não devia existir.

---

## B. Confiança e controlo

**P11 · Perdoar.** Acção reversível ⇒ "Desfazer" (5,5 s). Acção irreversível ⇒ confirmação que **nomeia o objecto e a consequência** ("Apagar «Caneca azul»? Deixa de existir."). Nunca os dois para a mesma acção.

**P12 · Prevenir antes de avisar.** Formata, limita e valida enquanto escreve; mostra o erro no campo, no mesmo sítio onde apareceria a ajuda, sem mexer no layout. Erro diz o que fazer, não o que correu mal.

**P13 · Persistência.** O ecrã regressa como foi deixado: separador, scroll, filtros, pesquisa, rascunho. Formulário com mais de 1 campo guarda rascunho no dispositivo e recupera-o. Voltar de um detalhe nunca devolve a lista ao topo.
*Teste:* navega para dentro, volta; a posição é exactamente a mesma (±0 px).

**P14 · Honestidade.** Sem dados inventados. Sucesso só depois de o servidor confirmar (excepto interruptores reversíveis com reversão visível). Falha de carregamento mostra "—" e a acção de tentar de novo; nunca "0" nem "tudo bem".

**P15 · Estado sempre visível.** Todo o elemento interactivo tem 7 estados desenhados: repouso, pressionado, foco, desactivado, a carregar, erro, sucesso (quando aplicável).
*Teste:* para cada componente, mostra os 7.

**P16 · Feedback proporcional.** Escada (de preferência a mais alta que servir):
1. A própria coisa muda (o interruptor vira, a linha desaparece).
2. Estado visível no contexto ("Publicado").
3. Mensagem breve com "Desfazer", só se o resultado não estiver visível ou for reversível.
Nunca mensagem **e** mudança visível para o mesmo facto. Nunca textos-aviso permanentes tipo "Alterações por guardar." — o botão Guardar activa-se e pronto.

---

## C. Corpo e mão

**P17 · Zona do polegar.** A acção primária de um fluxo fica na metade inferior, fixa, acima da área segura. Título e navegação no topo.

**P18 · Alvos ≥ 44 × 44 px**, com ≥ 8 px entre alvos adjacentes. O alvo pode ser maior que o desenho.

**P19 · Fitts.** O frequente é grande e perto do polegar; o destrutivo é pequeno, longe e nunca encostado ao primário.

**P20 · Gesto com alternativa.** Todo o gesto (deslizar, arrastar) tem uma alternativa visível por toque.

**P21 · Teclado certo.** Cada campo declara `inputmode`, `enterkeyhint`, `autocomplete`, `autocapitalize`. Preço = teclado numérico decimal. Com o teclado aberto, o campo activo e o botão primário permanecem visíveis (usa `visualViewport`).
*Teste:* preencher o formulário inteiro sem fechar o teclado nem fazer scroll à procura do botão.

---

## D. Percepção e velocidade

**P22 · Orçamentos de latência.** < 100 ms: resposta visual ao toque. < 1 s: sem indicador. 1–10 s: esqueleto ou progresso. > 10 s: progresso com cancelamento. O limiar de Doherty (≈ 400 ms) é a fronteira em que o utilizador sente que o sistema "pensa": abaixo, não mostres nada; acima, mostra algo.

**P23 · Esqueleto com a forma final.** Reserva a altura (imagens com `aspect-ratio`, linhas com altura fixa). **Salto de layout = 0.** Valores só aparecem quando todas as consultas necessárias terminaram.

**P24 · A rede fraca é o caso normal.** Operações idempotentes (já existe), tentativa visível, entrada preservada, imagens reduzidas no cliente, listas paginadas, nada que dependa de uma imagem para ter forma.
*Teste:* simula 3G lento e offline; nada se perde, nada bloqueia sem explicação.

---

## E. Visual (os que ninguém vê mas todos sentem)

**P25 · Hierarquia com 3 variáveis.** Só tamanho, peso e tom. Máximo 5 tamanhos e 2 pesos em todo o produto (ver design system).

**P26 · Grelha de 4 px.** Todo o espaçamento é múltiplo de 4. **Proximidade:** o espaço entre grupos é ≥ 2× o espaço dentro de um grupo. Margens laterais iguais em todos os ecrãs.

**P27 · Alinhamento óptico.** Ícone e texto alinham pelo centro óptico, não pela caixa. Números alinham pela direita em colunas. A primeira linha de texto de linhas com imagem alinha com o topo da imagem.

**P28 · Números tabulares.** `font-variant-numeric: tabular-nums` em tudo o que é número comparável. Moeda: `125 MT`, `1 250,50 MT` (formatador `money()` existente; sem decimais se inteiro).

**P29 · Cor com função.** Magenta = acção primária e destino seleccionado. Âmbar = atenção. Verde = confirmado. Vermelho = erro/destrutivo. Neutros = tudo o resto. Cor nunca comunica sozinha (acompanha texto ou forma). Nunca laranja como cor de texto sobre fundo claro (contraste 2,61:1).

**P30 · Uma densidade por tipo de lista.** Um tipo de lista = uma altura de linha em todo o produto (56 ou 64 ou 72). Não se misturam.

**P31 · Uma superfície, uma elevação.** Nada de cartão dentro de cartão. Separa por espaço e fio fino (`--ui-line`), não por caixas em tudo. Sombra só em camadas flutuantes.

**P32 · Consistência vence criatividade.** O mesmo problema tem sempre a mesma solução visual. Se achas que merece solução nova, é pergunta ao titular, não decisão tua.

**P33 · Movimento comunica causa e efeito.** Nunca decora. 120–300 ms, só `transform` e `opacity`, respeita movimento reduzido (ver `02-MOTION-FEEDBACK.md`).

**P34 · Imagem com respeito.** Nunca esticada (`object-fit: cover`), proporções fixas por contexto, forma reservada antes de carregar, sem filtros nem molduras duplas.

---

## F. Segurança, dados, acessibilidade

**P35 · Privilégio mínimo na interface.** O que o utilizador não pode fazer não aparece (não fica "cinzento sem explicação"). Se for contextual (loja suspensa), aparece desactivado **com a razão ao lado**.

**P36 · Idempotência visível.** Duplo toque não duplica. Cada submissão tem identificador de pedido. Resposta perdida ⇒ "Verificar gravação", nunca reenvio cego.

**P37 · Privacidade por defeito.** Pedir permissão (câmara, ficheiros, notificações) só no momento do uso e com a razão numa frase. Nunca no arranque.

**P38 · Acessibilidade é base, não extra.** Contraste ≥ 4,5:1 (texto) e ≥ 3:1 (elementos gráficos), foco visível, ordem lógica, nomes acessíveis, `aria-live` para resultados, texto em `rem` (respeita o tamanho do sistema), zoom a 200 % sem perda.

**P39 · Os dois temas são de primeira classe.** Claro e escuro desenhados em conjunto; nenhum valor visual fixo fora dos tokens.

---

## Leis de design e onde se aplicam aqui

| Lei | Em palavras | Aplicação no Kamby |
|---|---|---|
| Hick | Mais opções ⇒ mais tempo | Criar produto = foto, nome, preço, categoria. O resto fica a um toque. |
| Fitts | Alvo grande e perto = rápido | Primário em baixo; destrutivo longe; alvos ≥ 44 px. |
| Jakob | Os utilizadores esperam o que já conhecem | Folhas de baixo, interruptor iOS, lista de definições, separadores em baixo. Não inventar padrões. |
| Tesler | A complexidade não desaparece; alguém a carrega | O sistema carrega: pré-selecciona, formata, recupera rascunhos, reduz fotos. O utilizador não. |
| Postel | Sê liberal no que aceitas | Preço aceita `125`, `125,5`, `125.50`, `1 250`. Telefone aceita `84 123 4567` e `+258841234567`. |
| Doherty | < 400 ms mantém o fluxo | Orçamentos de latência (P22). |
| Pico-fim | Lembra-se o ponto alto e o fim | O fim de uma tarefa é limpo e claro: publicar ⇒ aterra na lista com o produto realçado. Sem confetti. |
| Von Restorff | O que é diferente destaca-se | Uma só coisa diferente por ecrã (a acção primária). Se tudo destaca, nada destaca. |
| Zeigarnik / progresso | O incompleto chama a atenção | Primeiros passos derivam dos dados reais (nunca marcados à mão). |
| Estética–usabilidade | O que parece ordenado parece usável | Grelha, alinhamento e tokens não são cosmética: são confiança. |
| Proximidade / Gestalt | O que está perto pertence junto | P26. |
| Posição em série | Lembra-se o primeiro e o último | Separadores: o mais usado primeiro (Resumo); acção principal ao fim da leitura. |
| Carga cognitiva | A memória de trabalho é pequena | P3, P4, P5, P8. |
| Lei de Pareto | 80 % do uso vem de 20 % das funções | O editor optimiza 4 campos; o resto é "Mais opções". |

---

## Como aplicar

1. Antes de desenhar: escreve o P1 do ecrã.
2. Antes de entregar: percorre P2, P9, P13, P14, P15, P23 com o ecrã aberto. Cada falha é uma correcção, não uma opinião.
3. Se dois princípios entram em conflito, vence o que reduz o trabalho mental do utilizador. Regista a decisão numa linha no teu relatório.
