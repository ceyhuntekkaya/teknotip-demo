import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { parseCatalog } from "@/lib/catalog/normalize";
import { missingSlots } from "@/lib/catalog/rules";
import { getOllamaConfig, ollamaChatUrl } from "@/lib/ollama/config";
import { applyActions } from "@/lib/quote/apply";
import { hydrateQuote } from "@/lib/quote/hydrate";
import { buildUserPrompt, compileLlmCatalog, SYSTEM_PROMPT } from "@/lib/quote/prompt";
import { chatTurnJsonSchema, parseChatTurn } from "@/lib/quote/schema";
import type { ChatTurnOutput, QuoteDraft } from "@/lib/quote/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const DATA_PATH = path.join(process.cwd(), "app/data/product.json");

type IncomingMessage = { role: "user" | "assistant"; content: string };

function isDraft(value: unknown): value is QuoteDraft {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.quoteNumber === "string" && Array.isArray(record.items);
}

async function loadCatalog() {
  const file = await readFile(DATA_PATH, "utf8");
  const parsed = parseCatalog(file);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.catalog;
}

function collectMissing(catalog: Awaited<ReturnType<typeof loadCatalog>>, draft: QuoteDraft) {
  return draft.items.flatMap((line) => {
    const product = catalog.find((item) => item.id === line.productId);
    if (!product) return [];
    return missingSlots(product, line.selections);
  });
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

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    return NextResponse.json({ error: "Katalog okunamadı." }, { status: 500 });
  }

  const ollama = getOllamaConfig();
  const catalogYaml = compileLlmCatalog(catalog);
  const history = messages.slice(-12, -1);
  const historyBlock = history.length
    ? `\n\nSon konuşma:\n${history.map((item) => `${item.role}: ${item.content}`).join("\n")}`
    : "";

  let ollamaJson: unknown;
  try {
    const response = await fetch(ollamaChatUrl(ollama), {
      method: "POST",
      headers: ollama.headers,
      signal: AbortSignal.timeout(ollama.timeoutMs),
      body: JSON.stringify({
        model: ollama.model,
        stream: false,
        format: chatTurnJsonSchema(catalog, record.draft),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${buildUserPrompt(catalogYaml, catalog, record.draft, lastUser.content)}${historyBlock}`,
          },
        ],
        options: {
          temperature: 0,
          top_p: 1,
          num_ctx: ollama.numCtx,
        },
      }),
    });

    if (response.status === 401) {
      return NextResponse.json(
        { error: "Ollama kimlik doğrulaması başarısız (401). OLLAMA_BASIC_USER / OLLAMA_BASIC_PASS kontrol edin." },
        { status: 502 },
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama yanıt vermedi (${response.status}).` },
        { status: 502 },
      );
    }
    ollamaJson = await response.json();
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "Ollama zaman aşımına uğradı. Sunucu meşgul olabilir."
          : "Ollama'ya bağlanılamadı. OLLAMA_URL ve kimlik bilgilerini kontrol edin.",
      },
      { status: 502 },
    );
  }

  const content =
    ollamaJson &&
    typeof ollamaJson === "object" &&
    "message" in ollamaJson &&
    ollamaJson.message &&
    typeof ollamaJson.message === "object" &&
    "content" in ollamaJson.message
      ? (ollamaJson.message as { content?: unknown }).content
      : undefined;

  let turn: ChatTurnOutput;
  try {
    const raw =
      typeof content === "string"
        ? (JSON.parse(content) as unknown)
        : content;
    turn = parseChatTurn(raw);
  } catch {
    return NextResponse.json(
      { error: "Model çıktısı beklenen şemaya uymadı." },
      { status: 502 },
    );
  }

  const applied = applyActions(catalog, record.draft, turn.actions);
  const document = hydrateQuote(catalog, applied.draft);

  return NextResponse.json({
    reply: turn.reply,
    draft: applied.draft,
    document,
    missing: collectMissing(catalog, applied.draft),
    warnings: applied.warnings,
  });
}
