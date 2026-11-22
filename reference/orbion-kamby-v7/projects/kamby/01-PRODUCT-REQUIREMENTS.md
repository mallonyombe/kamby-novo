# Kamby — Requisitos do Produto
## Papéis
**Visitante:** explorar lojas/produtos; solicitar login ao guardar carrinho persistente ou contactar, conforme decisão de produto.
**Comprador:** perfil, favoritos (opcional), carrinhos por loja, histórico de intenções de compra e contacto WhatsApp.
**Vendedor/gestor de loja:** solicitar loja, editar perfil comercial, produtos, imagens, stock indicativo, disponibilidade, contactos e receber pedidos.
**Administração:** aprovar/suspender lojas, gerir categorias, denúncias, conteúdos, utilizadores, auditoria, configurações e métricas.
## Módulos e critérios
### Catálogo
Pesquisa por texto; filtros úteis; categorias só quando houver produtos publicados; cartões com fotografia, preço, loja e disponibilidade; paginação/infinite scroll sem duplicações.
### Lojas
Página pública própria, nome, descrição, contactos verificados, localização aproximada opcional, horário informado e catálogo. Estado: draft, pending, approved, suspended, rejected.
### Carrinho
**Um carrinho por loja.** Adicionar/remover/alterar quantidade; validar itens antes do contacto; evitar misturar vendedores num único pedido; persistência por utilizador.
### Negociação WhatsApp
Gerar resumo do carrinho de **uma loja**, quantidades, preços indicativos, subtotal e identificação da loja. Botão 'Negociar no WhatsApp' abre URL oficial `https://wa.me/<numero>?text=<texto_codificado>`; usar número E.164 validado, sem '+' no segmento da URL. Mensagem é editável pelo utilizador. Não enviar automaticamente nem simular confirmação de recepção.
O WhatsApp é serviço externo; a plataforma não controla resposta, preço final, disponibilidade, pagamento ou entrega.
### Pedidos/intenções
Guardar um registo `contact_intent` apenas após acção explícita; estado `prepared` ou `whatsapp_opened` significa tentativa de contacto, **não** venda confirmada. Eventual confirmação manual por vendedor requer provas/fluxo próprio.
### Autenticação
Email/senha ou telefone conforme validação; recuperação real, sessões e gestão de conta; RLS e privilégios por função.
### Gestão
Dashboard com lojas pendentes, produtos reportados, categorias, auditoria, contas e indicadores definidos; nenhuma aprovação implícita.
## Fluxos essenciais
Visitante→pesquisa→produto→loja→carrinho da loja→revisão→WhatsApp.
Vendedor→registo→pedido de loja→aprovação→produto→publicação.
Admin→fila de revisão→decisão fundamentada→auditoria.
## Estados UI obrigatórios
loading, empty, offline, error, unauthorized, pending, rejected, suspended, success, stale price, out of stock.
## Critérios não funcionais
WCAG 2.2 AA como alvo; português moçambicano; protecção de dados; design responsivo; acessibilidade de toque; telemóveis modestos; monitorização e testes de segurança.
