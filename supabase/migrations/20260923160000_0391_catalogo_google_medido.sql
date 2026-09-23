-- ---------------------------------------------------------------------------
-- 0391 — o catálogo do Google passa a dizer o que o Google FAZ, não o que lista
--
-- A 0104 admitia no cabeçalho: "OS IDS DO GOOGLE NÃO FORAM VERIFICADOS — não há
-- chave Google nesta máquina". Medido em 2026-09-23 com chave real, UMA chamada
-- de generateContent por modelo (listar não basta: GET /v1beta/models ainda
-- devolve `gemini-2.5-flash`, e a chamada responde 404):
--
--   gemini-2.0-flash        404  "no longer available. Please update your code to use models/gemini-3.6-flash"
--   gemini-2.5-flash        404  "no longer available to new users"
--   gemini-2.5-flash-lite   404  "no longer available to new users"
--   gemini-2.5-pro          404  "no longer available to new users"
--   gemini-3.1-pro-preview  429  existe, mas o plano gratuito tem cota ZERO na linha Pro
--   gemini-3.5-flash        200
--   gemini-3.6-flash        200  ← o que o próprio Google indica no lugar dos 2.x
--   gemini-3.5-flash-lite   200
--   gemini-3-flash-preview  200
--
-- Dos seis que o seletor oferecia, quatro não existem mais para conta nova e o
-- agente publicado com um deles falha em TODO turno (`modelo_inexistente`, três
-- vezes por mensagem: classificador de estágio, detector de jailbreak e a
-- resposta). O seletor lê `ai_models` com `deprecated_at is null`, então os
-- quatro saem por DEPRECIAÇÃO, não por delete: `llm_calls` antigas continuam
-- apontando para uma linha que existe, e `ai_pricing` guarda o preço com que
-- foram cobradas.
--
-- Preços em centavos por milhão, medidos em 2026-09-23 na fonte oficial
-- (ai.google.dev/gemini-api/docs/pricing, faixa paga, contexto curto). A
-- própria página avisa que valem até 31/12/2026 e sobem a partir de 2027 —
-- a `notes` grava fonte e data para a próxima correção saber o que vigorava.
--
-- `ai_models` e `ai_pricing` mudam JUNTAS: o invariante
-- tests/invariants/catalogo-de-modelos.test.ts reprova um lado sem o outro.
-- Idempotente: update com guarda, insert em conflict; re-aplicável pelo
-- update.sh do kit.
-- ---------------------------------------------------------------------------

-- 1. os quatro que o Google recusa saem do seletor (depreciação, não delete)
update public.ai_models
   set deprecated_at = now()
 where provider = 'google'
   and model_id in ('gemini-2.0-flash', 'gemini-2.5-flash',
                    'gemini-2.5-flash-lite', 'gemini-2.5-pro')
   and deprecated_at is null;

-- 2. entram os verificados (chamada real, 200)
insert into public.ai_models
  (provider, model_id, display_name, description,
   input_price_per_million_cents, output_price_per_million_cents, supports_tools)
values
  ('google', 'gemini-3.6-flash', 'Gemini 3.6 Flash',
   'Geração corrente do Flash; é o que o Google indica no lugar dos 2.x descontinuados.',
   75, 375, true),
  ('google', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite',
   'O mais barato da linha Gemini, para classificação e tarefas simples.',
   30, 250, true),
  ('google', 'gemini-3-flash-preview', 'Gemini 3 Flash (Preview)',
   'Prévia; o id pode mudar quando sair da prévia.',
   50, 300, true)
on conflict (provider, model_id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  input_price_per_million_cents = excluded.input_price_per_million_cents,
  output_price_per_million_cents = excluded.output_price_per_million_cents,
  supports_tools = excluded.supports_tools,
  deprecated_at = null;

-- A linha Pro existe, mas o plano gratuito da chave tem cota zero para ela:
-- quem testa com chave grátis vê 429 e acha que o produto quebrou.
update public.ai_models
   set description = 'Prévia; exige plano pago no Google (o plano gratuito tem cota zero na linha Pro). Preço sobe para $4/$18 por milhão acima de 200 mil tokens de entrada.'
 where provider = 'google'
   and model_id = 'gemini-3.1-pro-preview'
   and description is distinct from 'Prévia; exige plano pago no Google (o plano gratuito tem cota zero na linha Pro). Preço sobe para $4/$18 por milhão acima de 200 mil tokens de entrada.';

-- 3. padrão do provedor: o que o Google indica. O índice
-- `ai_models_one_default_per_provider` é UNIQUE parcial e IMEDIATO — limpar
-- antes de marcar, senão a migration quebra no meio.
update public.ai_models set is_default_for_provider = false
 where provider = 'google' and is_default_for_provider
   and model_id <> 'gemini-3.6-flash';

update public.ai_models set is_default_for_provider = true
 where provider = 'google' and model_id = 'gemini-3.6-flash'
   and not is_default_for_provider;

-- 4. a conta usa a MESMA lista
insert into public.ai_pricing
  (model, prompt_cents_per_million_tokens, completion_cents_per_million_tokens, notes)
values
  ('gemini-3.6-flash',       75, 375, 'catálogo 0391 — medido na fonte em 2026-09-23 (ai.google.dev/gemini-api/docs/pricing); vale até 31/12/2026'),
  ('gemini-3.5-flash-lite',  30, 250, 'catálogo 0391 — medido na fonte em 2026-09-23 (ai.google.dev/gemini-api/docs/pricing); vale até 31/12/2026'),
  ('gemini-3-flash-preview', 50, 300, 'catálogo 0391 — medido na fonte em 2026-09-23 (ai.google.dev/gemini-api/docs/pricing); vale até 31/12/2026')
on conflict (model) do update set
  prompt_cents_per_million_tokens = excluded.prompt_cents_per_million_tokens,
  completion_cents_per_million_tokens = excluded.completion_cents_per_million_tokens,
  notes = excluded.notes,
  superseded_at = null;
