import { NextResponse } from "next/server";
import { getOllamaConfig, ollamaChatUrl } from "@/lib/ollama/config";
import { loadCatalogCached } from "@/lib/quote/catalog-cache";
import { retrieveProducts } from "@/lib/quote/retrieve";
import { buildUserPrompt, compileLlmCatalog, SYSTEM_PROMPT } from "@/lib/quote/prompt";
import { chatTurnJsonSchema, parseChatTurn } from "@/lib/quote/schema";
import { processTurn, tryPendingTurn } from "@/lib/quote/turn";
import type {
  ChatIntent,
  ConversationFocus,
  QuoteDraft,
} from "@/lib/quote/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function isDraft(value: unknown): value is QuoteDraft {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.quoteNumber === "string" && Array.isArray(record.items);
}

function isFocus(value: unknown): ConversationFocus | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as ConversationFocus;
  return record;
}

async function askOllama(
  system: string,
  user: string,
  extra?: { repair?: string },
): Promise<{ ok: true; intents: ChatIntent[]; reply: string } | { ok: false; error: string; status: number }> {
  const ollama = getOllamaConfig();
  const content = extra?.repair
    ? `${user}\n\nÖnceki çıktın şemaya uymadı (${extra.repair}). Yalnız geçerli JSON üret.`
    : user;
  try {
    const response = await fetch(ollamaChatUrl(ollama), {
      method: "POST",
      headers: ollama.headers,
      signal: AbortSignal.timeout(ollama.timeoutMs),
      body: JSON.stringify({
        model: ollama.model,
        stream: false,
        format: chatTurnJsonSchema(),
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        options: {
          temperature: 0,
          top_p: 1,
          num_ctx: ollama.numCtx,
        },
      }),
    });
    if (response.status === 401) {
      return {
        ok: false,
        status: 502,
        error:
          "Ollama kimlik doğrulaması başarısız (401). OLLAMA_BASIC_USER / OLLAMA_BASIC_PASS kontrol edin.",
      };
    }
    if (!response.ok) {
      return { ok: false, status: 502, error: `Ollama yanıt vermedi (${response.status}).` };
    }
    const ollamaJson: unknown = await response.json();
    const rawContent =
      ollamaJson &&
      typeof ollamaJson === "object" &&
      "message" in ollamaJson &&
      ollamaJson.message &&
      typeof ollamaJson.message === "object" &&
      "content" in ollamaJson.message
        ? (ollamaJson.message as { content?: unknown }).content
        : undefined;
    const raw =
      typeof rawContent === "string" ? (JSON.parse(rawContent) as unknown) : rawContent;
    const turn = parseChatTurn(raw);
    return { ok: true, intents: turn.intents, reply: turn.reply };
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      return { ok: false, status: 0, error: error.message };
    }
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      status: 502,
      error: timedOut
        ? "Ollama zaman aşımına uğradı. Sunucu meşgul olabilir."
        : "Ollama'ya bağlanılamadı. OLLAMA_URL ve kimlik bilgilerini kontrol edin.",
    };
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "İstek gövdesi okunamadı." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const messages = Array.isArray(record.messages)
    ? (record.messages as IncomingMessage[]).filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string",
      )
    : [];
  const lastUser = [...messages].reverse().find((item) => item.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "Kullanıcı mesajı yok." }, { status: 400 });
  }
  if (!isDraft(record.draft)) {
    return NextResponse.json({ error: "Teklif taslağı geçersiz." }, { status: 400 });
  }
  const focus = isFocus(record.focus);

  let cached;
  try {
    cached = await loadCatalogCached();
  } catch {
    return NextResponse.json({ error: "Katalog okunamadı." }, { status: 500 });
  }

  const pendingHit = tryPendingTurn({
    catalog: cached.catalog,
    lookup: cached.lookup,
    draft: record.draft,
    focus,
    userMessage: lastUser.content,
  });
  if (pendingHit) {
    return NextResponse.json({
      reply: pendingHit.reply,
      draft: pendingHit.draft,
      document: pendingHit.document,
      missing: pendingHit.missing,
      warnings: pendingHit.warnings,
      focus: pendingHit.focus,
    });
  }

  const scoped = retrieveProducts(cached.catalog, record.draft, lastUser.content);
  const catalogYaml = compileLlmCatalog(scoped);
  const userPrompt = buildUserPrompt(
    catalogYaml,
    scoped,
    record.draft,
    lastUser.content,
    focus,
  );

  let asked = await askOllama(SYSTEM_PROMPT, userPrompt);
  if (!asked.ok && asked.status === 0) {
    asked = await askOllama(SYSTEM_PROMPT, userPrompt, { repair: asked.error });
  }
  if (!asked.ok && asked.status === 0) {
    return NextResponse.json({
      reply: "Anlayamadım, tekrar eder misiniz?",
      draft: record.draft,
      document: null,
      missing: [],
      warnings: [],
      focus: focus ?? {},
    });
  }
  if (!asked.ok) {
    return NextResponse.json({ error: asked.error }, { status: asked.status || 502 });
  }

  const result = processTurn({
    catalog: cached.catalog,
    lookup: cached.lookup,
    draft: record.draft,
    focus,
    userMessage: lastUser.content,
    intents: asked.intents,
  });

  return NextResponse.json({
    reply: result.reply,
    draft: result.draft,
    document: result.document,
    missing: result.missing,
    warnings: result.warnings,
    focus: result.focus,
  });
}
