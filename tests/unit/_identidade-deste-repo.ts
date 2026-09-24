/**
 * A identidade deste repositório, e a âncora externa que diz de quem é a corrida.
 *
 * NÃO é arquivo de teste (sem `.test.ts`), então o vitest não o coleta — ele é a
 * FONTE ÚNICA de dois gates que precisam da mesma resposta:
 *
 *   tests/unit/namespace-das-imagens.test.ts              (consistência entre as fontes)
 *   tests/unit/namespace-das-imagens-runtime-owner.test.ts (a âncora externa, #616)
 *
 * ── POR QUE ESTE ARQUIVO EXISTE (18/09/2026) ────────────────────────────────
 *
 * Os dois gates acima nasceram em sessões diferentes e, medido, diziam coisas
 * OPOSTAS sobre a mesma corrida:
 *
 *   namespace-das-imagens.test.ts       → DEFERE ao dono do runner num fork
 *   namespace-das-imagens-runtime-owner → COBRA que IMG_NS seja do dono do runner
 *
 * O efeito, medido com `GITHUB_ACTIONS=true GITHUB_REPOSITORY_OWNER=outrodono`:
 * o primeiro pulava o caso (`1 skipped`, exit 0) e o segundo reprovava
 * (`1 failed`, exit 1). Ou seja, a decisão do dono do produto — *não cobrar do
 * fork* — **não era entregue**: o vermelho chegava pelo outro arquivo.
 *
 * O segundo até ADMITIA isso em prosa, na própria mensagem de erro:
 *
 *   "E num fork que NÃO publica imagens, rodando o CI dele mesmo: este vermelho
 *    não pede troca de IMG_NS — é o gate medindo um cenário que não é o seu."
 *
 * Prosa não destrava ninguém. Quem lê um check vermelho obrigatório não conclui
 * "isto não é o meu cenário"; conclui que quebrou o projeto — e é o fork mais
 * comum (o que roda o CI e NÃO republica imagens) que recebia isso.
 *
 * Conserto por CLASSE, não por instância: o mecanismo mora aqui, uma vez, e os
 * dois gates o importam. Duplicar o literal em dois arquivos seria o
 * anti-pattern nº 2 do CLAUDE.md (duplicação sem fonte da verdade declarada), e
 * garantiria que eles voltassem a divergir.
 */
import { execFileSync } from "node:child_process";

import { IDENTIDADE, IMAGENS, ORIGEM } from "@/lib/identidade";

/**
 * O valor literal que ESTE repositório publica. A âncora da identidade.
 *
 * ⚠️ Ele é o que decide "esta corrida é de um fork?". Um PR consegue editar este
 * literal — e foi o que o #1130 fez. O que impede a edição de ligar a deferência
 * sozinha é a URL do repositório em `install.sh`, `comecar.sh`, `_common.sh` e
 * nos 3 Dockerfiles ser DERIVADA deste valor em
 * `namespace-das-imagens.test.ts`: trocar só isto deixa a URL divergente e
 * reprova lá. Não remova essa derivação pensando que é redundante — ela é o que
 * torna a âncora não-falsificável de dentro do diff.
 */
export const NAMESPACE_DESTE_REPO = IDENTIDADE.namespace;

/**
 * O resto da identidade, no mesmo lugar e pelo mesmo motivo. Desde a 8.1 do FORK.md
 * nada aqui é literal: tudo vem de `lib/identidade` (identidade.env ou o padrão do
 * produto-mãe). As catracas de marca e de imagens leem daqui; um fork preenche o
 * arquivo e não toca em teste nenhum.
 */
export const NOME_DESTE_REPO = IDENTIDADE.repo;
export const MARCA_DESTE_REPO = IDENTIDADE.marca;
export const WORKFLOW_DE_IMAGENS_DESTE_REPO = IDENTIDADE.workflowDeImagens;
export const ORIGEM_DESTE_REPO = ORIGEM;
export const IMAGENS_DESTE_REPO = IMAGENS;

/**
 * O kit AVALIADO (`source _common.sh`), que é como install/update o leem. Ler o
 * literal por regex deixou de valer quando IMG_NS passou a derivar de identidade.env.
 */
export function kitAvaliado(): Record<
  "IMG_NS" | "IMG_APP" | "IMG_WORKER" | "IMG_SCHEDULER" | "IMG_VOICE_AGENT" | "REPO_ORIGEM",
  string
> {
  const saida = execFileSync(
    "bash",
    [
      "-c",
      'source hostgator-setup-kit/_common.sh; printf "%s\\n" "$IMG_NS" "$IMG_APP" "$IMG_WORKER" "$IMG_SCHEDULER" "$IMG_VOICE_AGENT" "$REPO_ORIGEM"',
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  const [IMG_NS, IMG_APP, IMG_WORKER, IMG_SCHEDULER, IMG_VOICE_AGENT, REPO_ORIGEM] = saida
    .trim()
    .split("\n");
  if (!IMG_NS || !IMG_APP || !IMG_WORKER || !IMG_SCHEDULER || !IMG_VOICE_AGENT || !REPO_ORIGEM) {
    throw new Error(`não consegui avaliar as imagens em hostgator-setup-kit/_common.sh: ${saida}`);
  }
  return { IMG_NS, IMG_APP, IMG_WORKER, IMG_SCHEDULER, IMG_VOICE_AGENT, REPO_ORIGEM };
}

/**
 * Os nomes de imagem na matriz de um workflow de publicação. Num workflow de fork o nome
 * vem das variáveis do repositório (`${{ vars.IDENTIDADE_IMAGENS }}-app`), e aqui ele vale
 * o prefixo da identidade, que é o que o CI dele vai resolver.
 */
export function imagensDaMatriz(yml: string): string[] {
  return [...yml.matchAll(/^\s{10}- name: (.+?)\s*$/gm)]
    .map((m) => m[1]!.replace(/\$\{\{\s*vars\.IDENTIDADE_IMAGENS\s*\}\}/g, IDENTIDADE.imagens))
    .sort();
}

/**
 * O dono de uma referência `<registry>/<dono>`.
 *
 * Nunca minusculiza: quem compara é que decide a caixa. O GHCR exige namespace
 * minúsculo, e `GITHUB_REPOSITORY_OWNER` devolve o login com a caixa que o dono
 * escolheu — um fork `Founders-BR` publicando CORRETAMENTE em `founders-br`
 * precisa dos dois lados em minúsculas para não ficar vermelho estando certo.
 */
export function donoDo(namespace: string): string {
  const partes = namespace.split("/");
  if (partes.length !== 2 || !partes[1]) {
    throw new Error(`namespace precisa ter a forma <registry>/<dono>; recebido: ${namespace}`);
  }
  return partes[1];
}

/** O dono deste repositório, derivado da âncora — ele não é escrito duas vezes. */
export const DONO_DESTE_REPO = donoDo(NAMESPACE_DESTE_REPO);

/**
 * O dono da conta que EXECUTA o workflow, ou `null` fora do GitHub Actions.
 *
 * `GITHUB_REPOSITORY_OWNER` é a única referência que NÃO vem do checkout do PR.
 */
export function donoConfiavelDoRunner(): string | null {
  if (process.env.GITHUB_ACTIONS !== "true") return null;
  const dono = process.env.GITHUB_REPOSITORY_OWNER?.trim();
  if (!dono) {
    // Falhar fechado na AÇÃO: sem a âncora externa não dá para dizer de quem é a
    // corrida, e deferir por falta de medição seria desarmar o gate no escuro.
    throw new Error(
      "GITHUB_ACTIONS=true sem GITHUB_REPOSITORY_OWNER: sumiu a âncora externa do runner",
    );
  }
  return dono;
}

/**
 * `true` só quando o CI roda na conta de OUTRO dono — a corrida interna de um fork.
 *
 * Fora do Actions devolve `false` DE PROPÓSITO: lá não existe âncora externa, e
 * um no-op local perderia o erro de digitação em `IMG_NS`. Medido: o custo para
 * o fork é zero, porque quem segue o recado fica com os dois literais no mesmo
 * dono e o `pnpm test:unit` local passa.
 */
export function corridaInternaDeFork(): boolean {
  const dono = donoConfiavelDoRunner();
  if (dono === null) return false;
  return dono.toLowerCase() !== DONO_DESTE_REPO.toLowerCase();
}
