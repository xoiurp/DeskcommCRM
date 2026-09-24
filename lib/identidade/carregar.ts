/**
 * Efeito colateral de propósito: a PRIMEIRA importação de um processo Node fora do
 * Next (o worker roda TS direto via tsx), para identidade.env chegar a process.env
 * antes de qualquer módulo avaliar `@/lib/identidade`. No app quem faz isto é o
 * next.config.ts; nos testes, o setup do vitest.
 */
import { carregarIdentidade } from "./arquivo";

carregarIdentidade(process.cwd());
