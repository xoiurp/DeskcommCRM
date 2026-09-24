-- ---- tabelas de plataforma sem privilégio para anon e authenticated (migration 0399) ----
--
-- `system_version` e `system_update_runs` (0089) e `watchdog_cursors` (0050) são infra
-- da INSTÂNCIA: sem organization_id, RLS ligada e ZERO policy. Quem as lê e escreve é
-- só o service_role — as rotas /api/v1/system/* e o watchdog, pelo admin client.
-- Mas as três nasceram com os privilégios padrão do Supabase para `anon` e
-- `authenticated` (`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES`); a 0050 revogou
-- só `anon` de watchdog_cursors, e as outras duas nada. Medido numa instalação nova em
-- 24/09/2026: das 31 tabelas com RLS e zero policy, eram as três com grant sobrando.
--
-- O que muda para o app: NADA. Com RLS ligada e zero policy, o PostgREST já devolvia
-- zero linhas a esses papéis; o app não passa por eles. O que muda é a defesa virar
-- dupla (sem privilégio E sem policy), e o advisor de segurança parar de apontar
-- privilégio de tabela para papel que não deveria tê-lo. Molde da 0380
-- (ad_hierarchy_cache). Idempotente: revoke e grant repetidos são no-op.
revoke all on public.system_version    from anon, authenticated;
revoke all on public.system_update_runs from anon, authenticated;
revoke all on public.watchdog_cursors   from anon, authenticated;
grant select, insert, update, delete on public.system_version    to service_role;
grant select, insert, update, delete on public.system_update_runs to service_role;
grant select, insert, update, delete on public.watchdog_cursors   to service_role;
