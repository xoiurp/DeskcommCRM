/**
 * Identidade do repositório: o que varia entre o produto-mãe e um fork (marca, dono das
 * imagens, nome do repositório) e os identificadores que derivam dela.
 *
 * O valor nunca é literal em arquivo rastreado. Vem do ambiente (`IDENTIDADE_*`), que
 * `next.config.ts`, o vitest, o kit e o Dockerfile preenchem a partir de `identidade.env`
 * (não rastreado; `identidade.env.example` traz o padrão) ou de build-arg. Sem nada disso
 * vale o padrão abaixo, o do produto-mãe, e este repositório continua exatamente como
 * era. Um fork preenche o arquivo e não edita este módulo: cada literal de identidade
 * num arquivo rastreado é um conflito a cada merge do produto-mãe (docs/FORK.md, 8.1).
 *
 * Só `process.env`, lido por nome fixo: o módulo roda no middleware (edge), no navegador
 * (os valores são queimados no bundle por `next.config.ts`, e o Next só substitui
 * `process.env.NOME` escrito por extenso) e no worker.
 */

/** O produto-mãe. É o que vale sem `identidade.env`. */
export const IDENTIDADE_PADRAO = {
  namespace: "ghcr.io/melgarafael",
  repo: "DeskcommCRM",
  marca: "DeskcommCRM",
  slug: "deskcomm",
  /** Vazio: os nomes históricos das imagens (ver `imagensDe`). */
  imagens: "",
  workflowDeImagens: ".github/workflows/publish-image.yml",
} as const;

export type Identidade = {
  namespace: string;
  repo: string;
  marca: string;
  slug: string;
  imagens: string;
  workflowDeImagens: string;
};

function ou(valor: string | undefined, padrao: string): string {
  const v = valor?.trim();
  return v ? v : padrao;
}

/** Minúsculo, ASCII, hífen entre palavras: "Ótima Gestão" → "otima-gestao". */
export function slugDe(marca: string): string {
  return marca
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const marca = ou(process.env.IDENTIDADE_MARCA, IDENTIDADE_PADRAO.marca);

export const IDENTIDADE: Identidade = {
  namespace: ou(process.env.IDENTIDADE_NAMESPACE, IDENTIDADE_PADRAO.namespace),
  repo: ou(process.env.IDENTIDADE_REPO, IDENTIDADE_PADRAO.repo),
  marca,
  slug: ou(
    process.env.IDENTIDADE_SLUG,
    marca === IDENTIDADE_PADRAO.marca ? IDENTIDADE_PADRAO.slug : slugDe(marca),
  ),
  imagens: ou(process.env.IDENTIDADE_IMAGENS, IDENTIDADE_PADRAO.imagens),
  workflowDeImagens: ou(
    process.env.IDENTIDADE_WORKFLOW_DE_IMAGENS,
    IDENTIDADE_PADRAO.workflowDeImagens,
  ),
};

/** Os quatro repositórios de imagem, sem registro nem dono. */
export function imagensDe(id: Pick<Identidade, "imagens">) {
  const p = id.imagens;
  return p
    ? { app: `${p}-app`, worker: `${p}-worker`, scheduler: `${p}-scheduler`, voz: `${p}-voice-agent` }
    : { app: "deskcommcrm", worker: "deskcomm-worker", scheduler: "deskcomm-scheduler", voz: "deskcomm-voice-agent" };
}

/** `https://github.com/<dono>/<repo>`: o dono é o do namespace (GHCR e GitHub compartilham o login). */
export function origemDe(id: Pick<Identidade, "namespace" | "repo">): string {
  return `https://github.com/${id.namespace.split("/")[1] ?? ""}/${id.repo}`;
}

/**
 * Os identificadores que derivam do slug. Um só lugar, para o par leitura/escrita nunca divergir.
 *
 * Caixa do cabeçalho: cada segmento do slug com a inicial maiúscula (`deskcomm` → `X-Deskcomm-Signature`,
 * byte a byte o que o produto-mãe sempre emitiu; `creator-os` → `X-Creator-Os-Signature`). HTTP não
 * distingue caixa, mas integrador que compara string distingue, então a regra é fixa e testada em
 * `lib/identidade.test.ts` contra o literal histórico. O produto sempre LÊ sem distinguir caixa
 * (`headers.get`, que o Node normaliza).
 */
export function derivadosDe(slug: string) {
  const Slug = slug
    .split("-")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join("-");
  return {
    cookieDeSessao: `sb-${slug}-auth`,
    cookieDeImpersonacao: `${slug}-impersonate`,
    cabecalhoDeEvento: `X-${Slug}-Event`,
    cabecalhoDeAssinatura: `X-${Slug}-Signature`,
    sufixoIcalUid: `${slug}.app`,
    prefixoDePropriedade: slug,
    chaveDoTema: `${slug}-theme`,
  };
}

export const IMAGENS = imagensDe(IDENTIDADE);
export const ORIGEM = origemDe(IDENTIDADE);
export const {
  cookieDeSessao: COOKIE_DE_SESSAO,
  cookieDeImpersonacao: COOKIE_DE_IMPERSONACAO,
  cabecalhoDeEvento: CABECALHO_DE_EVENTO,
  cabecalhoDeAssinatura: CABECALHO_DE_ASSINATURA,
  sufixoIcalUid: SUFIXO_ICAL_UID,
  prefixoDePropriedade: PREFIXO_DE_PROPRIEDADE,
  chaveDoTema: CHAVE_DO_TEMA,
} = derivadosDe(IDENTIDADE.slug);
