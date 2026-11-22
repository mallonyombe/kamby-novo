# Plano de validação
## Catálogo
Pesquisa sem resultados, categorias vazias, paginação, imagens inválidas, produto suspenso, preço alterado.
## Carrinho por loja
Itens de lojas A e B separados; refresh; alterações de quantidade; item removido; sessão expirada; stock desactualizado.
## WhatsApp
Número válido/inválido; URL E.164; codificação de acentos e caracteres; mensagem longa; app WhatsApp ausente; fallback browser; cancelar abertura; nenhuma venda automaticamente confirmada.
## Segurança
Utilizador A não edita loja B; vendedor não aprova a própria loja; visitante não vê produto privado; RLS para SELECT/INSERT/UPDATE/DELETE; chaves privilegiadas ausentes do bundle.
## UX
Android e iOS, teclado, navegação, leitores de ecrã, foco, alvos de toque, tema claro/escuro, movimento reduzido.
## Fiabilidade
Testes de integração, CI, migrações reversíveis/recuperáveis, logs sem PII, backups, alertas, staging e revisão manual de release.
## Condição de saída
Todos os testes críticos aprovados; falhas documentadas e mitigadas; aprovação expressa para produção. Nenhum teste descrito aqui foi executado.
