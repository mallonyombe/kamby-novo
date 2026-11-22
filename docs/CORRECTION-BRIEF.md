# Correcção de produto e design — 11/11/2026

Esta decisão do titular prevalece sobre as candidaturas presentes no pacote inicial:

- As lojas são criadas pela gestão Kamby. O público não cria nem candidata lojas.
- O cliente explora produtos e lojas, guarda itens e prepara contacto WhatsApp por loja.
- A interface é uma aplicação de catálogo. Não usar slogans, frases decorativas, títulos promocionais, capítulos, créditos de marca em navegação nem cartões explicativos repetidos.
- Linguagem funcional em português adequado a Moçambique: «Produtos», «Lojas», «Carrinhos», «Definições», «Entrar», «Guardar», estados e erros claros. Explicações só quando ajudam a decidir ou resolver um problema.
- Paleta semântica clara/escura a partir da direcção Kamby: neutros dominantes; laranja/rosa/violeta nos papéis medidos, sem gradiente universal. Contraste calculado, tipografia compacta, navegação consistente e hierarquia contida.
- Criação central de várias lojas pela mesma conta administrativa. Criar em rascunho ou publicar com decisão explícita. Sem candidatura/revisão fictícia da própria gestão.
- Gestão cria/edita lojas e produtos com auditoria e RLS. Utilizadores sem permissão não devem ver acções administrativas nem conseguir executá-las por API.
- Reaproveitar o novo projecto/Site existente. Não modificar a versão anterior nem publicar release: guardar nova versão para revisão.

## Contrato entre frentes

Backend: nova migration sem alterar a migration inicial já aplicada; `kg_create_store(p_name text,p_description text,p_whatsapp_e164 text,p_location text,p_status text)` retorna kg_stores, papel admin server, owner_id do criador admin, slug gerado no servidor, status draft|approved. Remove unique owner_id para permitir várias lojas geridas. Insere novas lojas sem gerar candidaturas. Admin pode publicar/suspender a própria loja gerida, sem rito de auto-aprovação. RLS bloqueia INSERT de loja não-admin mesmo por REST directo. Toda escrita de lojas/produtos/imagens exige admin. Leituras privadas também exigem admin; clientes lêem apenas catálogo publicado. owner_id regista o criador e o caminho de imagem; não concede acesso residual a administradores despromovidos. Não existe papel de operador delegado nesta versão.

Frontend gestão: painel lojas default Todas e botão Adicionar loja (só admin). Formulário dentro da gestão, cadastro e edição reais. Produtos admin pode criar/editar/arquivar, seleccionar loja/categoria, imagem/stock/preço. Remover entrada «A minha loja»/candidatura do perfil comum. A rota de vendedor pública foi removida. Operadores delegados não fazem parte desta decisão. Não expor owner/auth UUID como escolha ao utilizador do produto.

Dono root: App.tsx, navegação/páginas públicas, docs de produto. Dono visual: shared/styles.css e docs de tokens/linguagem. Dono gestão: features/account/**. Dono backend: supabase/**. Revisor: docs/review e testes de contraste próprios. Um único dono de escrita por ficheiro.
