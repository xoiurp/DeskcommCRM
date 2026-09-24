/**
 * Toda função `security definer` de `public` fixa o `search_path`.
 *
 * `security definer` roda com os privilégios do dono (postgres). Sem caminho fixo,
 * quem CHAMA decide de que esquema saem os nomes não qualificados — a classe de
 * defeito que o advisor de segurança do Supabase chama de
 * function_search_path_mutable. O baseline já fixava o caminho em 163 de 164
 * funções; a 0398 fecha a última (`fn_resolve_inbound_number`, da 0347). Este
 * invariante impede a 165ª de nascer sem ele.
 *
 * Sabotagem (medida em 24/09/2026 com `pnpm test:db`): sem a cláusula no apêndice, o segundo caso fica vermelho com
 * exatamente `fn_resolve_inbound_number(p_number text)` — 1 vermelho de 2235, o previsto; o controle
 * positivo e os outros 263 arquivos seguem verdes.
 */
import { describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

const SEM_SEARCH_PATH = `
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
   order by 1;
`;

describe("security definer em public fixa o search_path", () => {
  it("a sonda enxerga funções security definer — controle positivo", () => {
    const n = Number(
      sql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef;`),
    );
    expect(n).toBeGreaterThan(100);
  });

  it("nenhuma fica sem search_path", () => {
    const soltas = sql(SEM_SEARCH_PATH).split("\n").filter(Boolean);
    expect(
      soltas,
      "função security definer sem `set search_path`: acrescente a cláusula na definição " +
        "(migration + apêndice, antes da varredura anon), como a 0398 fez.",
    ).toEqual([]);
  });
});
