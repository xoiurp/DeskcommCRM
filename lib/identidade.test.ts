import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { derivadosDe, IDENTIDADE_PADRAO, imagensDe, origemDe, slugDe } from "@/lib/identidade";
import { carregarIdentidade, lerIdentidadeEnv, OBRIGATORIAS_NO_BUILD } from "@/lib/identidade/arquivo";

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

  it("com o padrão, os identificadores são byte a byte os literais históricos do produto-mãe", () => {
    // É o contrato com quem já integrou: cookie de sessão, cabeçalhos de webhook (caixa incluída,
    // porque integrador que compara string distingue), sufixo de iCal e chave de tema. Trocar
    // qualquer um destes é mudar o produto-mãe, não configurar um fork.
    expect(derivadosDe(IDENTIDADE_PADRAO.slug)).toEqual({
      cookieDeSessao: "sb-deskcomm-auth",
      cookieDeImpersonacao: "deskcomm-impersonate",
      cabecalhoDeEvento: "X-Deskcomm-Event",
      cabecalhoDeAssinatura: "X-Deskcomm-Signature",
      sufixoIcalUid: "deskcomm.app",
      prefixoDePropriedade: "deskcomm",
      chaveDoTema: "deskcomm-theme",
    });
  });

  it("cabeçalho: cada segmento do slug com inicial maiúscula, o resto como no slug", () => {
    expect(derivadosDe("creator-os").cabecalhoDeAssinatura).toBe("X-Creator-Os-Signature");
    expect(derivadosDe("acme").cabecalhoDeEvento).toBe("X-Acme-Event");
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

  it("com IDENTIDADE_OBRIGATORIA, faltar QUALQUER das cinco chaves do build lança, nomeando o que falta", () => {
    // Identidade parcial numa imagem publicada, sem aviso, é o pior caso: por isso o build inteiro
    // reprova, e o primeiro build de um repositório de cliente sem as variáveis falha de propósito.
    const raiz = mkdtempSync(join(tmpdir(), "identidade-"));
    writeFileSync(join(raiz, "IDENTIDADE_OBRIGATORIA"), "");
    const guardado = Object.fromEntries(OBRIGATORIAS_NO_BUILD.map((k) => [k, process.env[k]]));
    for (const k of OBRIGATORIAS_NO_BUILD) delete process.env[k];
    try {
      expect(() => carregarIdentidade(raiz)).toThrow(/obrigatória e ausente \(IDENTIDADE_NAMESPACE, IDENTIDADE_REPO, IDENTIDADE_MARCA, IDENTIDADE_SLUG, IDENTIDADE_IMAGENS\)/);
      writeFileSync(
        join(raiz, "identidade.env"),
        "IDENTIDADE_NAMESPACE=ghcr.io/acme\nIDENTIDADE_REPO=crm\nIDENTIDADE_MARCA=Acme\nIDENTIDADE_SLUG=acme\n",
      );
      expect(() => carregarIdentidade(raiz)).toThrow(/ausente \(IDENTIDADE_IMAGENS\)/);
      for (const k of OBRIGATORIAS_NO_BUILD) delete process.env[k];
      writeFileSync(
        join(raiz, "identidade.env"),
        "IDENTIDADE_NAMESPACE=ghcr.io/acme\nIDENTIDADE_REPO=crm\nIDENTIDADE_MARCA=Acme\nIDENTIDADE_SLUG=acme\nIDENTIDADE_IMAGENS=acme\n",
      );
      expect(carregarIdentidade(raiz).IDENTIDADE_MARCA).toBe("Acme");
    } finally {
      for (const k of OBRIGATORIAS_NO_BUILD) {
        delete process.env[k];
        if (guardado[k] !== undefined) process.env[k] = guardado[k];
      }
    }
  });
});
