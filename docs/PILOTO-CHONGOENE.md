# Piloto em Chongoene

Este build permite testar descoberta, variantes, carrinho por loja e intenção de contacto com duas lojas fictícias. O fluxo termina com um resumo simulado. Não há encomenda, pagamentos, sessão, Google Analytics ou alterações à base de dados de produção. O endereço do projecto está na página «Sobre o piloto e privacidade».

Executar `npm run build -- --pilot` para gerar `dist`. A configuração Vercel desta branch destina-se a um deployment separado do site comercial. Partilhar apenas com as pessoas convidadas. O cabeçalho `noindex` pede aos motores de busca que não indexem o piloto e não restringe o acesso por link.

Pedir a cada participante para procurar um produto, escolher uma opção e simular um pedido. Registar o que conseguiu fazer e onde parou, sem solicitar BI, morada ou outros detalhes pessoais. Usar o contacto do projecto para feedback, pedidos de privacidade e denúncias.

Antes de admitir pedidos reais, validar a identificação e o contacto comercial das lojas, a comunicação do total e da entrega antes de pagar, o processo de devolução e o enquadramento da plataforma com o INTIC. O suporte de pagamentos, a recolha de perfis e as integrações opcionais ficam fora deste piloto.
