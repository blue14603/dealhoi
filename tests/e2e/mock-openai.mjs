// MOCK OpenAI Chat Completions server for end-to-end tests ONLY.
// It is NOT the production AI integration. It echoes identifiers and figures
// found in the supplied context so the app's validation pipeline can be tested.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_OPENAI_PORT ?? 4010);

createServer(async (req, res) => {
  if (req.method === "GET") return res.end("ok");
  let body = "";
  for await (const c of req) body += c;
  const payload = JSON.parse(body);
  const ctxMsg = payload.messages.find((m) => m.role === "system" && m.content.startsWith("<context>"));
  const ctx = JSON.parse(ctxMsg.content.replace(/^<context>\n/, "").replace(/\n<\/context>$/, ""));
  const lastUser = [...payload.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const deal = ctx.deals.find((d) => d.calculation?.is_highest_estimate) ?? ctx.deals[0];
  const isSummary = payload.response_format.json_schema.name === "dealhoi_summary";
  let answer = deal
    ? `[MOCK] Ưu đãi phù hợp: ${deal.title}. Mức tối đa: ${deal.maximum_benefit_vnd ?? "chưa rõ"}.`
    : "[MOCK] Không có dữ liệu.";
  if (lastUser.includes("bịa")) answer = "[MOCK] Thẻ này hoàn 99% không giới hạn."; // unsupported figure
  const content = isSummary
    ? { summary: answer, highlighted_benefits: [], key_differences: [], important_restrictions: [], related_deal_ids: deal ? [deal.deal_id] : [], source_ids: deal?.source_id ? [deal.source_id] : [], uncertainties: [] }
    : {
        answer,
        source_ids: deal?.source_id ? [deal.source_id, "00000000-0000-0000-0000-000000000000"] : [],
        related_deal_ids: deal ? [deal.deal_id] : [],
        suggested_questions: ["Ưu đãi này có giới hạn hoàn tiền không?"],
        uncertainties: [],
      };
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } }] }));
}).listen(port, () => console.log(`mock openai on ${port}`));
