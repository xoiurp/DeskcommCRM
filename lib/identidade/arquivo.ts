/**
 * Lê `identidade.env` para `process.env` (só as chaves ainda vazias: ambiente e
 * build-arg vencem o arquivo). Node apenas: quem chama é `next.config.ts` e o setup
 * do vitest, antes de qualquer módulo importar `@/lib/identidade`.
 *
 * `IDENTIDADE_OBRIGATORIA` (arquivo vazio, rastreado só em repositório de cliente)
 * transforma "sem identidade" em erro: sem ele, um repositório sem o arquivo cai no
 * padrão do produto-mãe, o que é certo no produto-mãe e no tronco e errado num cliente.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CHAVES = [
  "IDENTIDADE_NAMESPACE",
  "IDENTIDADE_REPO",
  "IDENTIDADE_MARCA",
  "IDENTIDADE_SLUG",
  "IDENTIDADE_IMAGENS",
  "IDENTIDADE_IMAGEM_DE_VOZ",
  "IDENTIDADE_WORKFLOW_DE_IMAGENS",
] as const;

export function lerIdentidadeEnv(texto: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linha of texto.split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i < 1) continue;
    const chave = l.slice(0, i).trim();
    const valor = l
      .slice(i + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    if ((CHAVES as readonly string[]).includes(chave)) out[chave] = valor;
  }
  return out;
}

/** Devolve as chaves efetivas (ambiente + arquivo). Lança se a identidade é obrigatória e não veio. */
export function carregarIdentidade(raiz: string = process.cwd()): Record<string, string> {
  const arquivo = join(raiz, "identidade.env");
  const doArquivo = existsSync(arquivo) ? lerIdentidadeEnv(readFileSync(arquivo, "utf8")) : {};
  for (const [chave, valor] of Object.entries(doArquivo)) {
    if (!process.env[chave]?.trim() && valor) process.env[chave] = valor;
  }
  const efetivas: Record<string, string> = {};
  for (const chave of CHAVES) {
    const v = process.env[chave]?.trim();
    if (v) efetivas[chave] = v;
  }
  if (existsSync(join(raiz, "IDENTIDADE_OBRIGATORIA")) && !efetivas.IDENTIDADE_MARCA) {
    throw new Error(
      `identidade obrigatória e ausente: crie ${arquivo} a partir de identidade.env.example ` +
        "(ou passe IDENTIDADE_* pelo ambiente). Este repositório não sobe com a identidade do produto-mãe.",
    );
  }
  return efetivas;
}
