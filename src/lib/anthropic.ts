import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * The model layer.
 *
 * ## Why the PDF goes to the model whole
 *
 * There is no PDF text-extraction library in this app, on purpose. A text-layer
 * extractor reads a born-digital agreement fine and returns nothing at all for
 * a scanned one — and "nothing" is exactly the result that must not be mistaken
 * for "no unusual clauses". Sending the file as a `document` block means a scan
 * is read the way a person reads it, and a genuinely illegible one comes back
 * saying so rather than as a clean review of an empty string.
 *
 * It also matters for evidence. Every finding this app raises carries a
 * verbatim quote and a clause reference; those come from the model reading the
 * actual page, including the numbering and the layout a naive text dump
 * flattens away.
 *
 * ## Why the structure comes from `output_config.format`
 *
 * Asking for JSON in the prompt and parsing the reply puts a fenced code block,
 * an apology or a trailing comma between the model and a liability cap that
 * ends up in front of a lawyer. Structured outputs constrain the response at
 * the decoding layer, and `messages.parse` validates it against the same Zod
 * schema the rest of the app is typed by — so a malformed review is an
 * exception here rather than a wrong field three modules downstream.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Model traits
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The request shape is not the same for every model, and the differences are
 * hard errors rather than degradations.
 *
 * Haiku 4.5 rejects `output_config.effort` and only takes the older
 * `thinking: {type: "enabled", budget_tokens: N}`; it does accept `temperature`.
 * Opus 5 and the rest of the 4.6+ family are the exact inverse — adaptive
 * thinking and `effort`, and a 400 on any sampling parameter. Sending the wrong
 * pair is not a subtle quality loss, it is a failed request.
 *
 * Rather than pin the app to one family, the traits are resolved from the model
 * id and every call assembles its parameters from them. Changing
 * `ANTHROPIC_MODEL` between Haiku and Opus is then a one-line edit that needs
 * no other change, which is the property that matters: the model is the cost
 * dial on this product, and a cost dial nobody can turn is not one.
 */
type Traits = {
  /** `effort` and `thinking: {type: "adaptive"}` are accepted. */
  adaptive: boolean;
  /** `temperature` is accepted (removed on 4.6+). */
  sampling: boolean;
  /** Pages per PDF the Messages API will accept — 100 on 200K-context models. */
  maxPages: number;
  /** Ceiling for `max_tokens` on this model. */
  maxOutputTokens: number;
};

const HAIKU_45: Traits = { adaptive: false, sampling: true, maxPages: 100, maxOutputTokens: 64_000 };
const MODERN: Traits = { adaptive: true, sampling: false, maxPages: 600, maxOutputTokens: 128_000 };

function traitsFor(model: string): Traits {
  // Haiku 4.5 and anything older than the 4.6 generation take the legacy shape.
  if (/haiku-4-5|haiku-3|sonnet-4-5|sonnet-3|opus-4-5|opus-3/.test(model)) return HAIKU_45;
  return MODERN;
}

export const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";
export const MODEL_TRAITS = traitsFor(MODEL);

/**
 * Hard ceilings from the Messages API, not preferences.
 *
 * Checked before a call rather than after, because the failure otherwise
 * arrives as a 400 with the file already uploaded and the contract already in
 * the register. The byte ceiling sits well under the API's 32 MB: base64
 * inflates by a third, and the prompt and schema have to fit alongside it.
 */
export const PDF_LIMITS = {
  get maxPages() {
    return MODEL_TRAITS.maxPages;
  },
  /** Bytes, before base64 expansion. */
  maxBytes: 20 * 1024 * 1024,
};

export const BUDGET = {
  /** Intake is a page of facts about the document. */
  intakeTokens: 8_000,
  /**
   * The risk pass.
   *
   * This is the one call in the app that can genuinely produce tens of
   * thousands of tokens: fifteen to twenty-five findings, each with a verbatim
   * quote and a three-tier redline, plus the red-flag scan, the key terms, the
   * missing provisions and the ranked asks.
   *
   * It was 32K and that was too low. A five-page agreement overran it, and the
   * failure is nastier than a clean cutoff: the response is truncated
   * mid-object, so the schema rejects it and the error names an enum value
   * rather than the token limit that actually caused it. Thinking tokens come
   * out of the same budget, which is the part that is easy to forget.
   */
  reviewTokens: 48_000,
  standardsTokens: 12_000,
};

/**
 * How much of `max_tokens` a thinking model may spend on thinking.
 *
 * Only used on the legacy shape, where the budget is explicit. It must be less
 * than `max_tokens` or the API rejects the request, and leaving too little
 * behind truncates the answer — so it is a fraction of the call's own budget
 * rather than a constant that happens to fit the largest one.
 */
function thinkingBudget(maxTokens: number): number {
  return Math.max(1024, Math.min(8_000, Math.floor(maxTokens * 0.3)));
}

function checkApiKey() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and fill it in — " +
        "the README says where to get one.",
    );
  }
}

export function modelConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Reads `ANTHROPIC_API_KEY` from the environment.
 *
 * The timeout is raised above the SDK's ten-minute default: a hundred-page
 * master services agreement genuinely takes minutes, and a review that dies at
 * the default having done all the work is the most expensive possible failure.
 */
export const anthropic = new Anthropic({ timeout: 30 * 60 * 1000, maxRetries: 2 });

export type Usage = { inputTokens: number; outputTokens: number };

function usageOf(response: { usage?: Anthropic.Usage }): Usage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * The parameters that differ per model family, assembled in one place.
 *
 * `think` is false for the short factual calls — intake and Q&A — where
 * reasoning buys nothing and, on the legacy shape, would eat a third of the
 * token budget the answer needs.
 */
function tuning(maxTokens: number, think: boolean) {
  if (MODEL_TRAITS.adaptive) {
    return think ? { thinking: { type: "adaptive" as const } } : {};
  }
  return think
    ? { thinking: { type: "enabled" as const, budget_tokens: thinkingBudget(maxTokens) } }
    : { temperature: 0 };
}

/**
 * `effort` only exists on the modern family; sending it to Haiku is a 400.
 * `format` is accepted everywhere, so it is always present.
 */
function outputConfig(effort: Effort, format?: ReturnType<typeof zodOutputFormat>) {
  return {
    ...(MODEL_TRAITS.adaptive ? { effort } : {}),
    ...(format ? { format } : {}),
  };
}

/** A PDF, ready for a `document` content block. */
export type PdfInput = { base64: string; filename?: string };

function documentBlock(pdf: PdfInput): Anthropic.ContentBlockParam {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: pdf.base64 },
    ...(pdf.filename ? { title: pdf.filename } : {}),
  };
}

function guardStop(response: { stop_reason?: string | null }, maxTokens: number) {
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `The model ran out of room reading this document (max_tokens ${maxTokens}). ` +
        `A partial review is not returned, because a truncated list of risks reads exactly like ` +
        `a short one. Try a shorter document, or raise the budget in src/lib/anthropic.ts.`,
    );
  }
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to answer about this document.");
  }
}

/**
 * One structured answer about one PDF.
 *
 * The document block goes before the instruction: the model reads the
 * agreement, then the question about it.
 */
export async function readDocument<T extends z.ZodType>({
  system,
  instruction,
  pdf,
  schema,
  maxTokens,
  effort = "high",
  think = true,
}: {
  system: string;
  instruction: string;
  pdf: PdfInput;
  schema: T;
  maxTokens: number;
  effort?: Effort;
  think?: boolean;
}): Promise<{ value: z.infer<T>; usage: Usage }> {
  checkApiKey();
  const capped = Math.min(maxTokens, MODEL_TRAITS.maxOutputTokens);

  let response;
  try {
    response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: capped,
      system,
      ...tuning(capped, think),
      output_config: outputConfig(effort, zodOutputFormat(schema)),
      messages: [
        { role: "user", content: [documentBlock(pdf), { type: "text", text: instruction }] },
      ],
    });
  } catch (error) {
    throw explainParseFailure(error, capped);
  }

  guardStop(response, capped);
  if (response.parsed_output == null) {
    throw new Error(
      `The model did not return a result matching the expected shape ` +
        `(stop_reason: ${response.stop_reason ?? "none"}).`,
    );
  }
  return { value: response.parsed_output as z.infer<T>, usage: usageOf(response) };
}

/**
 * Turn a schema-validation failure into the sentence that actually helps.
 *
 * `messages.parse` validates inside the SDK and throws before this code sees
 * `stop_reason`, so a response truncated at `max_tokens` surfaces as "invalid
 * enum value at missingProvisions.9.priority" — which sends somebody to debug a
 * schema that is fine. The cause is almost always the budget, and the message
 * should say so.
 */
function explainParseFailure(error: unknown, maxTokens: number): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (!/parse structured output|Invalid option|invalid_value|Validation issues/i.test(message)) {
    return error instanceof Error ? error : new Error(message);
  }
  return new Error(
    `The model's answer did not fit in ${maxTokens} tokens and was cut off mid-object, so it no ` +
      `longer matched the expected shape. This is a budget problem, not a schema problem — the ` +
      `partial answer is discarded rather than saved, because a review that stops halfway through ` +
      `its findings reads exactly like a short one. Raise the budget in src/lib/anthropic.ts, or ` +
      `review a shorter document. Underlying error: ${message.slice(0, 300)}`,
  );
}

/** The same structured shape, over text rather than a file. */
export async function readText<T extends z.ZodType>({
  system,
  prompt,
  schema,
  maxTokens,
  effort = "high",
  think = true,
}: {
  system: string;
  prompt: string;
  schema: T;
  maxTokens: number;
  effort?: Effort;
  think?: boolean;
}): Promise<{ value: z.infer<T>; usage: Usage }> {
  checkApiKey();
  const capped = Math.min(maxTokens, MODEL_TRAITS.maxOutputTokens);

  let response;
  try {
    response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: capped,
      system,
      ...tuning(capped, think),
      output_config: outputConfig(effort, zodOutputFormat(schema)),
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw explainParseFailure(error, capped);
  }

  guardStop(response, capped);
  if (response.parsed_output == null) {
    throw new Error(
      `The model did not return a result matching the expected shape ` +
        `(stop_reason: ${response.stop_reason ?? "none"}).`,
    );
  }
  return { value: response.parsed_output as z.infer<T>, usage: usageOf(response) };
}

/** Plain prose, for the drafting and Q&A paths where the answer is the document. */
export async function complete({
  system,
  prompt,
  pdf,
  maxTokens = 8_000,
  effort = "high",
  think = true,
}: {
  system: string;
  prompt: string;
  pdf?: PdfInput;
  maxTokens?: number;
  effort?: Effort;
  think?: boolean;
}): Promise<{ text: string; usage: Usage }> {
  checkApiKey();
  const capped = Math.min(maxTokens, MODEL_TRAITS.maxOutputTokens);

  const content: Anthropic.ContentBlockParam[] = pdf
    ? [documentBlock(pdf), { type: "text", text: prompt }]
    : [{ type: "text", text: prompt }];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: capped,
    system,
    ...tuning(capped, think),
    ...(MODEL_TRAITS.adaptive ? { output_config: outputConfig(effort) } : {}),
    messages: [{ role: "user", content }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return { text, usage: usageOf(response) };
}

/**
 * Consistent, human error text for model failures.
 *
 * Typed SDK classes rather than string matching, so a message Anthropic rewords
 * does not silently turn a rate limit into a 500.
 */
export function explainModelError(error: unknown): { message: string; status: number } {
  if (error instanceof Anthropic.AuthenticationError) {
    return {
      message: "The Anthropic API key is missing or invalid. Check ANTHROPIC_API_KEY in .env.local.",
      status: 401,
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      message: "Rate limited by Anthropic. Wait a moment and run the review again.",
      status: 429,
    };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return {
      message:
        `Anthropic rejected the request: ${error.message}. If this mentions pages or size, the ` +
        `contract is past the ${PDF_LIMITS.maxPages}-page or ` +
        `${Math.round(PDF_LIMITS.maxBytes / 1024 / 1024)} MB limit for ${MODEL}.`,
      status: 422,
    };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { message: `Could not reach Anthropic: ${error.message}`, status: 503 };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      message: `Anthropic error ${error.status}: ${error.message}`,
      status: error.status ?? 500,
    };
  }
  return { message: error instanceof Error ? error.message : String(error), status: 500 };
}
