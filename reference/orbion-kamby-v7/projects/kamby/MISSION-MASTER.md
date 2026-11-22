# ORBION TECHNOLOGY — MISSÃO MESTRA DO KAMBY
Versão 6.0 · 11/11/2026 · Mandato de produto e execução · Status: especificação, não implementação

## MISSÃO INEGOCIÁVEL
Criar de raiz o **Kamby**, marketplace digital moçambicano para aproximar compradores e lojas locais. Pessoas descobrem produtos e lojas, escolhem produtos, mantêm **carrinhos separados por loja**, preparam o resumo de interesse e iniciam uma negociação **no WhatsApp da loja**. A plataforma oferece descoberta, organização e confiança, mas não declara compra concluída apenas por abrir WhatsApp.

## POR QUE EXISTIMOS
O comércio local pode ser difícil de descobrir, comparar e contactar. O Kamby organiza a oferta, dá presença digital a pequenos negócios e simplifica a ponte entre interesse e conversa comercial. A marca deve ser humana, moderna, acessível, clara e fiável.

## O QUE NÃO VAMOS FAZER
Não copiar o código, banco de dados, UI ou fluxos antigos; não construir um clone de AliExpress; não implementar pagamentos internos, entregas, comissões ou confirmação automática de vendas sem decisão posterior; não prometer funcionalidades inexistentes; não publicar sem aprovação. A identidade visual já explorada é **direcção conceptual**, não SVG final nem marca legalmente registada.

## PRINCÍPIOS DO PRODUTO
- Mobile-first, PWA com excelente desempenho em Android de entrada e iOS.
- Português de Moçambique, linguagem simples e textos precisos.
- Lojas com páginas próprias, catálogo e gestão; aprovação administrativa real.
- Carrinho por loja: nunca misturar produtos de lojas distintas na mesma negociação.
- WhatsApp: link `wa.me` para número validado; mensagem editável, com produtos, quantidades e valores indicativos; nunca enviar sem gesto explícito.
- Acesso, RLS, integridade, privacidade, auditoria e recuperação desde a arquitectura.
- UI limpa, design tokens, ícones consistentes, animações com propósito e reduced motion.

## DEFINIÇÃO DE SUCESSO
Um comprador consegue encontrar uma loja e um produto, construir um carrinho, rever o resumo e abrir o WhatsApp da loja com mensagem correcta. Um vendedor aprovado consegue gerir a loja e o catálogo sem aceder a dados de terceiros. Um administrador consegue rever lojas e conteúdos com auditoria. Os fluxos passam testes E2E, RLS e acessibilidade em dispositivos representativos.

## COMANDO AOS AGENTES
Cada agente deve conhecer o problema antes de propor soluções. Inspeccionar requisitos, declarar hipóteses, produzir artefactos verificáveis, pedir revisão cruzada e não reportar implementação, testes ou deploys que não ocorreram. Trabalhar em ambiente novo e isolado. O coordenador de engenharia organiza dependências, mas não tem autorização automática de produção.
