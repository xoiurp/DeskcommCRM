/**
 * `system_version`, `system_update_runs` e `watchdog_cursors` são tabelas da INSTÂNCIA
 * (sem organization_id): RLS ligada, zero policy, lidas e escritas só pelo service_role
 * (rotas /api/v1/system/* e o watchdog, pelo admin client). Até a 0399 elas carregavam
 * os privilégios padrão do Supabase para `anon` e `authenticated` — sem efeito prático
 * (RLS sem policy devolve zero linhas), mas era o único lugar do baseline em que uma
 * tabela server-only ficava com grant sobrando (3 de 31, medido em 24/09/2026), e o
 * advisor de segurança do Supabase apontava. Molde de
 * `credencial-de-anuncios-e-server-side.test.ts`.
 *
 * Sabotagem: sem o bloco da 0399 no baseline, os 6 casos de `anon`/`authenticated`
 * ficam vermelhos (privilégios DELETE,INSERT,…); os 3 de `service_role` seguem verdes.
 */
import { describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

const TABELAS = ["system_version", "system_update_runs", "watchdog_cursors"] as const;

function privilegiosDe(papel: string, tabela: string): string {
  return sql(`
    select coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), 'NENHUM')
      from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = '${tabela}'
       and grantee = '${papel}';
  `).trim();
}

describe.each(TABELAS)("`%s` é server-side: só o service_role tem privilégio", (tabela) => {
  it("a tabela existe e tem RLS ligada — controle positivo da sonda", () => {
    expect(
      sql(`select relrowsecurity from pg_class where oid = 'public.${tabela}'::regclass;`).trim(),
    ).toBe("t");
  });
  it("`anon` não tem privilégio NENHUM", () => {
    expect(privilegiosDe("anon", tabela)).toBe("NENHUM");
  });
  it("`authenticated` também não — nenhuma tela lê isto pelo client de sessão", () => {
    expect(privilegiosDe("authenticated", tabela)).toBe("NENHUM");
  });
  it("`service_role` CONTINUA com privilégio — controle positivo do papel que usa", () => {
    expect(privilegiosDe("service_role", tabela)).toContain("SELECT");
  });
});
