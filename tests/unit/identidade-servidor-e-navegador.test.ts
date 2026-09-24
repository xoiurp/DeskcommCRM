import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CABECALHO_DE_ASSINATURA,
  CABECALHO_DE_EVENTO,
  CHAVE_DO_TEMA,
  COOKIE_DE_IMPERSONACAO,
  COOKIE_DE_SESSAO,
  derivadosDe,
  IDENTIDADE,
  PREFIXO_DE_PROPRIEDADE,
  SUFIXO_ICAL_UID,
} from "@/lib/identidade";
import { CHAVES } from "@/lib/identidade/arquivo";

/**
 * Servidor e navegador derivam o MESMO slug (docs/FORK.md, 8.1).
 *
 * O risco: `lib/identidade.ts` roda no navegador, e o Next só expõe ao cliente o que tem
 * prefixo NEXT_PUBLIC_ ou o que está em `env` do next.config. Um `process.env.IDENTIDADE_SLUG`
 * que chegasse `undefined` no cliente cairia no padrão em silêncio: o servidor emitiria
 * `sb-<slug>-auth` e o navegador esperaria `sb-deskcomm-auth`, e nenhum build reprovaria,
 * porque no servidor a variável existe. Este arquivo prende a FONTE do valor nos dois lados.
 *
 * Como o valor chega, medido em 25/09/2026 com `identidade.env` de prova (slug `prova`) e
 * `pnpm build` (Turbopack):
 *   - navegador (`.next/static`): ZERO referências a `process.env.IDENTIDADE_*`; os valores
 *     `"prova"`, `"Prova"`, `"prova-crm"`, `ghcr.io/prova` estão inlinados nos chunks — é o
 *     `env` do next.config, o mesmo mecanismo de NEXT_PUBLIC_*;
 *   - servidor (`.next/server`): `process.env.IDENTIDADE_*` permanece no código (22 refs), e o
 *     valor vem do snapshot do build gravado em `.next/required-server-files.json` (`config.env`)
 *     e em `server.js` (`__NEXT_PRIVATE_STANDALONE_CONFIG`);
 *   - o standalone iniciado com `IDENTIDADE_SLUG=outro` no ambiente respondeu
 *     `/api/v1/health` → `data.identidade.slug = "prova"`: o ambiente de execução NÃO
 *     sobrescreve o snapshot. Os dois lados leem a mesma foto tirada no build, e por isso
 *     não podem divergir. É isso que este arquivo afirma, e é o que quebra se alguém trocar
 *     a fonte (ler por chave dinâmica, sair do `env`, ler `window`, virar NEXT_PUBLIC_).
 */
const RAIZ = process.cwd();
const ler = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf8");

describe("identidade: servidor e navegador leem a mesma foto do build", () => {
  it("next.config põe a identidade carregada em `env` — é o que inlina no cliente e grava o snapshot do servidor", () => {
    const cfg = ler("next.config.ts");
    expect(cfg).toMatch(/const identidade = carregarIdentidade\(/);
    expect(cfg).toMatch(/^\s+env: identidade,$/m);
  });

  it("lib/identidade lê só `process.env.IDENTIDADE_*` por nome fixo — o Next só substitui referência escrita por extenso", () => {
    const fonte = ler("lib/identidade.ts");
    // Só o que executa: linha que abre com `//`, `*` ou `/*` é comentário (a mesma regra da catraca de marca).
    const codigo = fonte
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    const referencias = [...codigo.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]!);
    expect(referencias.length).toBeGreaterThan(0);
    for (const chave of new Set(referencias)) {
      expect(CHAVES as readonly string[], `${chave} não é chave que carregarIdentidade entrega ao env`).toContain(chave);
    }
    expect(fonte, "acesso por chave dinâmica não é inlinado: o cliente receberia undefined").not.toMatch(/process\.env\[/);
    expect(fonte, "NEXT_PUBLIC_ é queimado no bundle de outro jeito e escaparia do snapshot do servidor").not.toMatch(/NEXT_PUBLIC_/);
    expect(fonte, "window.__PUBLIC_ENV__ é a marca DA INSTALAÇÃO (runtime); a identidade é do build").not.toMatch(/window\./);
  });

  it("todo par leitura/escrita usa a constante, nunca o literal: cookie de sessão nos dois lados e no middleware", () => {
    for (const rel of ["lib/supabase/browser.ts", "lib/supabase/server.ts", "proxy.ts"]) {
      const fonte = ler(rel);
      expect(fonte, `${rel} não importa a identidade`).toMatch(/from "@\/lib\/identidade"/);
      expect(fonte, `${rel} usa COOKIE_DE_SESSAO`).toMatch(/COOKIE_DE_SESSAO/);
      expect(fonte, `${rel} voltou a escrever o cookie à mão`).not.toMatch(/"sb-[a-z0-9-]+-auth"/);
    }
    for (const rel of ["lib/impersonate/cookie.ts", "lib/impersonate/cookie-edge.ts"]) {
      expect(ler(rel)).toMatch(/COOKIE_DE_IMPERSONACAO/);
    }
  });

  it("as derivações são função pura do slug: o que o servidor calcula é o que o navegador calcula", () => {
    // O mesmo slug entra nos dois bundles (afirmado acima); aqui, que a saída é determinística
    // e que as constantes exportadas são exatamente derivadosDe(IDENTIDADE.slug).
    const d = derivadosDe(IDENTIDADE.slug);
    expect({
      cookieDeSessao: COOKIE_DE_SESSAO,
      cookieDeImpersonacao: COOKIE_DE_IMPERSONACAO,
      cabecalhoDeEvento: CABECALHO_DE_EVENTO,
      cabecalhoDeAssinatura: CABECALHO_DE_ASSINATURA,
      sufixoIcalUid: SUFIXO_ICAL_UID,
      prefixoDePropriedade: PREFIXO_DE_PROPRIEDADE,
      chaveDoTema: CHAVE_DO_TEMA,
    }).toEqual(d);
    expect(derivadosDe(IDENTIDADE.slug)).toEqual(d);
  });

  it("nenhum template de .env carrega IDENTIDADE_*: identidade não é configuração de instalação", () => {
    // Medido: o ambiente de execução não sobrescreve o snapshot. Mesmo assim, a chave num
    // template convidaria alguém a "configurar" a identidade no servidor, e o único efeito
    // seria confundir o worker (que roda TS direto e LÊ o ambiente). Identidade entra pelo
    // build (identidade.env / build-arg), nunca pelo .env.
    for (const rel of [".env.example", ".env.hostgator.example"]) {
      expect(ler(rel), `${rel} declara IDENTIDADE_*`).not.toMatch(/^\s*IDENTIDADE_/m);
    }
  });
});
