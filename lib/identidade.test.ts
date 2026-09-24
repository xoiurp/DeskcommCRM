import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { derivadosDe, IDENTIDADE_PADRAO, imagensDe, origemDe, slugDe } from "@/lib/identidade";
import { carregarIdentidade, lerIdentidadeEnv } from "@/lib/identidade/arquivo";

describe("identidade: tudo deriva do slug, num lugar só", () => {
  it("cookies, cabeçalhos, iCal e tema saem do mesmo slug", () => {
    expect(derivadosDe("acme")).toEqual({
      cookieDeSessao: "sb-acme-auth",
      cookieDeImpersonacao: "acme-impersonate",
      cabecalhoDeEvento: "X-Acme-Event",
      cabecalhoDeAssinatura: "X-Acme-Signature",
      sufixoIcalUid: "acme.app",
      prefixoDePropriedade: "acme",
      chaveDoTema: "acme-theme",
    });
  });

  it("o slug derivado da marca é minúsculo, ASCII e sem espaço", () => {
    expect(slugDe("Ótima Gestão")).toBe("otima-gestao");
    expect(slugDe("  Acme CRM! ")).toBe("acme-crm");
  });

  it("o prefixo de imagens gera os quatro nomes; vazio mantém os históricos do produto-mãe", () => {
    expect(imagensDe({ imagens: "acme" })).toEqual({
      app: "acme-app",
      worker: "acme-worker",
      scheduler: "acme-scheduler",
      voz: "acme-voice-agent",
    });
    expect(new Set(Object.values(imagensDe(IDENTIDADE_PADRAO))).size).toBe(4);
  });

  it("a origem no GitHub usa o dono do namespace", () => {
    expect(origemDe({ namespace: "ghcr.io/acme", repo: "crm" })).toBe("https://github.com/acme/crm");
  });
});

describe("identidade.env", () => {
  it("lê só as chaves conhecidas, sem aspas, ignorando comentário", () => {
    const texto = ["# x", 'IDENTIDADE_MARCA="Acme"', "OUTRA=1", "IDENTIDADE_SLUG=acme", ""].join("\n");
    expect(lerIdentidadeEnv(texto)).toEqual({ IDENTIDADE_MARCA: "Acme", IDENTIDADE_SLUG: "acme" });
  });

  it("com IDENTIDADE_OBRIGATORIA e sem arquivo, carregar lança em vez de cair no padrão", () => {
    const raiz = mkdtempSync(join(tmpdir(), "identidade-"));
    writeFileSync(join(raiz, "IDENTIDADE_OBRIGATORIA"), "");
    const marca = process.env.IDENTIDADE_MARCA;
    delete process.env.IDENTIDADE_MARCA;
    try {
      expect(() => carregarIdentidade(raiz)).toThrow(/obrigatória e ausente/);
      writeFileSync(join(raiz, "identidade.env"), "IDENTIDADE_MARCA=Acme\n");
      expect(carregarIdentidade(raiz).IDENTIDADE_MARCA).toBe("Acme");
    } finally {
      delete process.env.IDENTIDADE_MARCA;
      if (marca !== undefined) process.env.IDENTIDADE_MARCA = marca;
    }
  });
});
