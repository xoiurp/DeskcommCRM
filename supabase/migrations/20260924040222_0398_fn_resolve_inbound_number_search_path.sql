-- ---- fn_resolve_inbound_number com search_path fixo (migration 0398) ----
--
-- A função nasceu na 0347 (módulo VoIP) como `security definer` em SQL, sem
-- `set search_path`. Medido numa instalação NOVA do baseline em 24/09/2026 (Supabase
-- Cloud, Postgres 17.6): das 164 funções `security definer` de `public`, era a ÚNICA
-- sem caminho fixo — e é o que o advisor de segurança do Supabase
-- (function_search_path_mutable) aponta.
--
-- Por que importa: `security definer` roda com os privilégios do dono da função
-- (postgres). Sem `search_path` fixo, quem CHAMA decide de que esquema saem os
-- nomes não qualificados. O corpo já qualifica `public.phone_numbers`, então hoje
-- não há exploração conhecida; o conserto é fechar a classe, não um caso —
-- exatamente o `set search_path = public` que as outras 163 já têm.
--
-- Idempotente: `create or replace` mantém assinatura, dono, revokes e grants da
-- 0347 (o Postgres preserva privilégios no replace). Nada de dado tocado.
create or replace function public.fn_resolve_inbound_number(p_number text)
returns table (
  organization_id uuid,
  routing_mode text,
  default_ai_agent_id uuid,
  fallback_user_id uuid
) as $$
  select organization_id, routing_mode, default_ai_agent_id, fallback_user_id
  from public.phone_numbers
  where number = p_number and is_active
  limit 1;
$$ language sql security definer stable set search_path = public;

-- `create or replace` preserva os privilégios da 0347, mas o revoke fica escrito de
-- novo aqui, como em toda migration que (re)cria função em public (regra do item 9
-- do CLAUDE.md): idempotente, e o pré-voo confere pela forma, não pelo efeito.
revoke execute on function public.fn_resolve_inbound_number(text) from public, anon;
grant execute on function public.fn_resolve_inbound_number(text) to service_role;
