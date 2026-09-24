import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IDENTIDADE_PADRAO, imagensDe } from "@/lib/identidade";

import { imagensDaMatriz, kitAvaliado, WORKFLOW_DE_IMAGENS_DESTE_REPO } from "./_identidade-deste-repo";

/**
 * Duas fontes de verdade, e é de propósito (docs/FORK.md, 8.1):
 *
 *   - o workflow de imagens DESTE repositório (`WORKFLOW_DE_IMAGENS_DESTE_REPO`, da
 *     identidade) é o que o kit tem de conferir antes de pinar — `trio_publicado`
 *     avalia as referências de `_common.sh`, que derivam de identidade.env;
 *   - `publish-image.yml` e `release.yml` são os do produto-mãe. As guardas de tag e
 *     de packaging leem os nomes históricos deles, e continuam valendo tal qual num
 *     fork, porque são sobre os workflows do produto-mãe, não sobre os do fork.
 */
const RAIZ = process.cwd();
const publishDoProdutoMae = readFileSync(join(RAIZ, IDENTIDADE_PADRAO.workflowDeImagens), "utf8");
const publishDesteRepo = readFileSync(join(RAIZ, WORKFLOW_DE_IMAGENS_DESTE_REPO), "utf8");
const tagSoNasceDaMain = readFileSync(join(RAIZ, "tests/unit/tag-so-nasce-da-main.test.ts"), "utf8");
const packaging = readFileSync(join(RAIZ, "tests/unit/packaging-artefato-do-cliente.test.ts"), "utf8");

function stringsDoArray(texto: string): string[] {
  return [...texto.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]!).sort();
}

/** As referências do kit no NOSSO namespace, sem ele. A de voz sai quando mora noutro dono. */
function imagensDoKit(): string[] {
  const kit = kitAvaliado();
  const prefixo = `${kit.IMG_NS}/`;
  return [kit.IMG_APP, kit.IMG_WORKER, kit.IMG_SCHEDULER, kit.IMG_VOICE_AGENT]
    .filter((ref) => ref.startsWith(prefixo))
    .map((ref) => ref.slice(prefixo.length))
    .sort();
}

function imagensDoTesteDaTag(): string[] {
  const lista = /for\s*\(const\s+img\s+of\s+\[([^\]]+)\]\)/.exec(tagSoNasceDaMain)?.[1] ?? "";
  return stringsDoArray(lista);
}

function imagensDoTesteDePackaging(): string[] {
  const lista = /for\s*\(const\s+imagem\s+of\s+\[([^\]]+)\]\)/.exec(packaging)?.[1] ?? "";
  return stringsDoArray(lista);
}

const IMAGENS_DESTE_REPO = imagensDaMatriz(publishDesteRepo);
const IMAGENS_DO_PRODUTO_MAE = imagensDaMatriz(publishDoProdutoMae);

describe("listas de imagens Docker seguem a matriz de publicação", () => {
  it("o instrumento está vivo e encontra as duas fontes de verdade", () => {
    for (const [nome, lista] of [
      [WORKFLOW_DE_IMAGENS_DESTE_REPO, IMAGENS_DESTE_REPO],
      [IDENTIDADE_PADRAO.workflowDeImagens, IMAGENS_DO_PRODUTO_MAE],
    ] as const) {
      expect(lista.length, `não consegui extrair imagens da matriz de ${nome}`).toBeGreaterThan(0);
      expect(new Set(lista).size, `a matriz de ${nome} contém nomes duplicados`).toBe(lista.length);
    }
    expect(IMAGENS_DO_PRODUTO_MAE).toEqual(Object.values(imagensDe(IDENTIDADE_PADRAO)).sort());
  });

  it("o kit confere exatamente as imagens que o workflow deste repositório publica", () => {
    expect(
      imagensDoKit(),
      "trio_publicado() divergiu da matriz: uma imagem pode ficar invisível para install/update",
    ).toEqual(IMAGENS_DESTE_REPO);
  });

  it("a guarda de criação de tag usa exatamente as imagens do produto-mãe", () => {
    expect(
      imagensDoTesteDaTag(),
      "tag-so-nasce-da-main ficou com uma cópia diferente da matriz de imagens",
    ).toEqual(IMAGENS_DO_PRODUTO_MAE);
  });

  it("a guarda do artefato do cliente usa exatamente as imagens do produto-mãe", () => {
    expect(
      imagensDoTesteDePackaging(),
      "packaging-artefato-do-cliente ficou com uma cópia diferente da matriz de imagens",
    ).toEqual(IMAGENS_DO_PRODUTO_MAE);
  });
});
