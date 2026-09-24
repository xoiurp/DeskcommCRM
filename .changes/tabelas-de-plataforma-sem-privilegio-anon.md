---
impacto: nada_mudou
secao: corrigido
titulo: Três tabelas internas da instalação deixam de aparecer no advisor de segurança do Supabase
---

`system_version`, `system_update_runs` e `watchdog_cursors` são tabelas internas da instalação que só o servidor lê e escreve; elas ainda carregavam os privilégios padrão para os papéis do navegador, sem efeito prático (a RLS já barrava tudo), mas apontados pelo advisor de segurança do Supabase em toda instalação. Os privilégios são revogados; nada muda na tela de atualização nem no watchdog. Crédito: @xoiurp.
