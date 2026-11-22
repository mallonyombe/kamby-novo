# ADR-001 — Base nova no Supabase existente

Estado: escolha de execução inicial; validar antes do piloto.

O titular autorizou iniciar projecto novo e reutilizar/reiniciar o Supabase do Kamby. O pacote exige não copiar código/BD/UI antigos. Foi escolhido um repositório novo e objectos novos com prefixo `kg_`, conservando Auth e sem apagar dados anteriores. Isto satisfaz o início de raiz sem depender de uma remoção irreversível para começar.

O domínio contém catálogos públicos aprovados, loja única por vendedor, candidaturas pendentes, preços MZN indicativos, carrinhos por loja e intenções de contacto. Visitantes podem abrir WhatsApp sem conta; somente contas autenticadas guardam intenções no servidor. Nada confirma venda, pagamento ou entrega automaticamente.

A aplicação é React/Vite, monólito modular com Supabase Auth/Data API/Storage privado. A autorização reside no servidor. Imagens conservam URL canónica no banco e usam URLs assinadas temporárias na visualização. O SVG conceptual ainda não é um ficheiro de marca final; usa-se texto Kamby.

Consequências: o catálogo novo começa vazio, as contas Auth antigas podem continuar a autenticar e a configuração Auth é herdada. É obrigatório validar redirects/SMTP e preparar ambiente de piloto antes do release. As antigas tabelas não são dependências do cliente novo. Se futuramente houver limpeza dos dados antigos, deverá existir exportação e restauro verificado antes da remoção.
