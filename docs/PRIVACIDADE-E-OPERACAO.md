# Kamby · Revisão de privacidade e operação

O catálogo auditado é moçambicano, com preços em meticais e negociação pelo WhatsApp. Confirmar o âmbito da actividade e os critérios territoriais do artigo 3.º da LGPD com o operador. Em Moçambique, rever a Lei n.º 22/2009, a Lei n.º 3/2017 e as regras sectoriais do INTIC. Para o Brasil, verificar também o ECA Digital se o serviço for dirigido a menores ou de acesso provável por eles. A pergunta de idade restringe o cadastro declarado e não verifica a idade real.

## Fornecedores e fluxos

| Serviço | Dados ou destino | A confirmar pelo operador |
| --- | --- | --- |
| Vercel | Hospedagem, IP, dados de rede e logs técnicos. | Contrato, região, subprocessadores, prazos, Analytics e Speed Insights no painel. |
| Supabase | Identidade e sessão, dados da conta e da operação, ficheiros, logs, backups e envio de confirmação ou recuperação. | Região, DPA, backups, SMTP, prazo de logs e quem pode aceder. |
| Google Identity | Autenticação quando escolhida, e-mail, identificador e os dados de perfil disponibilizados pelo Google. | Configuração do OAuth, escopos, ligação de contas preexistentes. |
| Google Analytics | Medição consentida, identificadores de medição e dados técnicos do navegador, categoria de evento. O código usa a origem sem caminho e desliga sinalização publicitária. | Desactivar recolha melhorada não necessária, publicidade, partilha e ligações não utilizadas no painel. Rever a retenção no serviço. |
| Meta / WhatsApp e loja destinatária | Número de destino e mensagem do pedido quando a pessoa decide usar o encaminhamento. O Kamby não lê as conversas. | Quem responde por cada etapa e se existe outra integração empresarial. |
| Provedor SMTP | Se houver SMTP próprio, recebe endereços, metadados e mensagens transaccionais. O repositório não identifica o fornecedor configurado. | Nome, configuração e contrato. |
| Pagamentos e IA | Nenhum processador de pagamentos ou de treino de IA identificado no código em execução. Lojas podem usar serviços próprios fora do Kamby. | Confirmar as operações fora do repositório e que nenhuma exportação é usada para treinar modelos. |

Registar em cada relação a finalidade, papel, cláusulas de tratamento quando aplicáveis, subprocessadores, localização, transferências, retenção, eliminação, segurança, contacto de incidente e prazo de aviso. O WhatsApp usado por iniciativa do utilizador ou pela loja pode actuar como agente independente. Confirmar os papéis antes de escolher o contrato. A página pública está no código e precisa de identificação, contacto e verificação de fornecedores antes de ser publicada.

## Acesso, exportação e eliminação

O cadastro pede a confirmação de 18 anos ou mais antes de mostrar e-mail e palavra-passe. O utilizador pode consultar os termos da versão exacta sem sair do cadastro. A evidência é registada na mesma transacção da criação da conta com data e hora do servidor (timestamptz), versões de ambos os documentos e conta. Alterações dos metadados do perfil não reescrevem a prova. Guardar as versões dos textos publicados. Ao alterar a política, mudar a versão no HTML, no código e numa migração nova.

Publicar na ordem migração, frontend e configuração de **Before User Created** no Supabase com `public.kg_before_user_created`. Confirmar a forma real do evento e ensaiar e-mail, reenvio, novos acessos Google, entrada de conta Google existente e provisionamento administrativo num ambiente de teste. Se algum fluxo por convite não emitir evidência, definir como recolhê-la antes de activar o hook em produção. A migração sem o hook regista o fluxo novo do site, mas ainda permite aos clientes antigos ou alternativos criar contas fora dele.

A exportação da conta inclui perfil, contactos da conta, preferências, aceites, guardados, avisos, actividade, carrinhos, denúncias próprias e o pedido de encerramento. A própria fotografia pode ser descarregada separadamente quando disponível. O ficheiro não inclui credenciais, tokens, identidade de moderadores ou dados de outras contas. Para apurar dados fora deste fluxo, incluindo relatórios dos fornecedores, logs, fotografias indisponíveis e registos específicos de loja, disponibilizar atendimento por um canal que verifique a identidade.

A equipa responsável consulta os pedidos de encerramento em `public.kg_account_requests` com acesso administrativo restrito. Registar recepção e verificação da identidade, delimitar o pedido, responder pela via verificada e acompanhar até ao fecho. Antes de eliminar a conta Auth, rever dependências de lojas activas, vínculos, decisões administrativas e registos que devem ser preservados por obrigação confirmada. Transferir responsabilidades legitimamente, terminar sessões, apagar a fotografia pela Storage API, efectuar a eliminação pela Admin API e verificar a cascata e os fornecedores. Preservar o mínimo exigido pela obrigação aplicável, com acesso restrito e data de eliminação. Atualizar o estado antes de remover a conta, pois a linha do pedido é actualmente removida em cascata. Tratar novamente eliminações após restauro de um backup. A gestão real do prazo e da eliminação requer operador e política aprovados.

## Proposta de retenção para aprovação

| Classe | Proposta ou estado | Execução |
| --- | --- | --- |
| Sessão e opção de medição | Sessão até terminares sessão ou até expirar no serviço. Cookies GA até 30 dias no navegador. | SDK Auth, opção de revogação no site e configuração de cookies existente. |
| Carrinho local, guardados e histórico de pesquisa | Até serem removidos ou os dados locais serem limpos. Rever prazo por finalidade. | Limpeza do dispositivo disponível. Sem tarefa de expiração específica para cada chave. |
| Perfil, ficheiros, avisos e guardados da conta | Enquanto a conta estiver activa. Eliminar após pedido ou encerramento salvo obrigação validada. | Pedidos disponíveis. A execução exige operação da conta, Storage e fornecedores. |
| Eventos de loja e actividade opcional | Proposta técnica de 90 dias para eventos detalhados, sujeita a aprovação. | Eliminar por data em lotes após validar métricas e testar recuperação. Relatórios futuros podem manter agregados efectivamente anónimos. |
| Prova de aceites e opções, denúncias e auditoria | Prazos dependem de obrigação legal, litígios e finalidade. | Aprovar prazos por classe antes de introduzir eliminação agendada. Atualizar a política pública e o plano de restauro. |
| Logs, backups e dados de fornecedores | Determinar prazo real por fornecedor e contrato. | Configuração de cada serviço, com verificação periódica e eliminação das cópias após expiração. |

## Resposta a incidente

1. Regista hora de conhecimento pelo controlador, sistemas afectados, dados, titulares, volumes, sinais e quem coordena. Guarda evidência mínima em local restrito.
2. Contém o incidente, revoga acessos e roda chaves afectadas, preserva logs necessários e separa recuperação da análise de causa.
3. Avalia risco ou dano relevante, incluindo autenticação, menores, dados financeiros, fraude, exposição permanente e escala. Anota a decisão, as medidas e quem a aprovou.
4. Quando a regra brasileira se aplicar e houver risco ou dano relevante, comunica à ANPD e às pessoas afectadas em até três dias úteis do conhecimento pelo controlador, salvo prazo legal específico. Envia comunicação preliminar quando faltarem informações, com justificação. Complementa a comunicação à ANPD em até 20 dias úteis da comunicação preliminar conforme o regulamento. Usa comunicação directa sempre que possível, linguagem simples e indica a natureza dos dados, riscos, medidas e contacto. Em Moçambique, valida as obrigações locais e o canal do INTIC.
5. Documenta a resposta, os contactos, as decisões e a correção. Para o regime da ANPD, mantém registo dos incidentes de segurança, incluindo os que não forem comunicados, pelo período mínimo de cinco anos, ressalvadas obrigações mais longas. Faz uma simulação e nomeia titulares e substitutos da resposta.

## Comércio, divulgação e licenças

O Kamby mostra subtotal e transfere o contacto ao WhatsApp. Não tem cobrança, renovação ou assinatura dentro do produto. O total final e entrega precisam de confirmação da loja. Validar com o operador e advogado o procedimento de devolução, a responsabilidade de cada vendedor e a exibição do NUIT ou CNPJ aplicável. Se futuramente houver campanhas, o envio deve consultar a opção separada e incluir link funcional de descadastro sem login. Os e-mails de autenticação são transaccionais.

A triagem do código não encontrou avaliação de consumidor fabricada, selo SOC 2, SLA de disponibilidade, contador de urgência ou fornecedor de treino de IA. As lojas marcadas para teste passam a ficar identificadas publicamente como demonstração. Verificar também descrições, avaliações e anúncios que estejam apenas na base publicada e campanhas fora do site. Não tratámos os textos do catálogo como prova das promessas feitas por cada vendedor.

As dependências registadas nos dois lockfiles usam MIT, 0BSD e Apache-2.0. O build inclui os avisos das dependências de execução que distribui. Não foi encontrada GPL ou AGPL nos lockfiles auditados. Usam-se fontes de sistema, sem redistribuição de SF Pro. O inventário de fotos está em [CATALOGUE-PHOTOS.md](CATALOGUE-PHOTOS.md). Retirámos duas imagens de origem comercial sem licença apresentada. Para as restantes, confirmar direitos de imagem ou marca quando aplicáveis, autoria do logótipo e procedência dos textos e das fotos que os lojistas enviarem. Nenhuma declaração de licença substitui esses comprovativos.

## Fontes

- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [CDC](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)
- [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm)
- [ANPD · Cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais)
- [ANPD · Incidentes](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)
- [ANPD · Aferição de idade](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-orientacoes-preliminares-e-cronograma-para-afericao-de-idade-no-ambiente-digital)
- [INTIC · Legislação sectorial](https://intic.gov.mz/sectorial/)
- [INTIC · Canal de denúncias](https://intic.gov.mz/canal-de-denuncias-proteccao-de-dados-pessoais/)
- [Supabase · Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Supabase · Bcrypt](https://supabase.com/docs/guides/auth/password-security)
- [Unsplash · Licença e limites](https://unsplash.com/license)
