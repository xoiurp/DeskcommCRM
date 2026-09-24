---
impacto: nada_mudou
secao: corrigido
titulo: A função que resolve o número de entrada da telefonia deixa de aparecer no advisor de segurança do Supabase
---

`fn_resolve_inbound_number` era a única função `security definer` do banco sem `search_path` fixo, e o advisor de segurança do Supabase apontava isso em toda instalação. Ela passa a fixar o caminho como as outras; nada muda no comportamento da telefonia. Crédito: @xoiurp.
