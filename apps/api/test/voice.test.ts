import { desc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { llmCalls } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const coachReply = jsonResult({ reply: "Noted.", suggestions: [] });

const systemOf = (call: { prompt: unknown }) =>
  JSON.stringify((call.prompt as { role: string; content: unknown }[])[0]);

describe("sports talk voice", () => {
  it("follows the player's setting on voiced calls", async () => {
    const t = await createRatedApp([coachReply, coachReply, coachReply]);
    const ask = () => t.request("/coach/messages", { method: "POST", ...json({ content: "Hi" }) });
    const lastVersion = async () =>
      (
        await t.db
          .select({ v: llmCalls.promptVersion })
          .from(llmCalls)
          .where(eq(llmCalls.purpose, "coach.chat"))
          .orderBy(desc(llmCalls.createdAt))
          .limit(1)
      )[0]!.v;

    await ask();
    expect(systemOf(t.model.doGenerateCalls.at(-1)!)).toContain("Voice: light sports framing");
    expect(await lastVersion()).toBe("coach-v1+talk-normal");

    for (const [level, phrase] of [
      ["extra", "Voice: full sports"],
      ["none", "Voice: plain and numbers-first"],
    ] as const) {
      await t.request("/me", { method: "PATCH", ...json({ preferences: { sportsTalk: level } }) });
      await ask();
      expect(systemOf(t.model.doGenerateCalls.at(-1)!)).toContain(phrase);
      expect(await lastVersion()).toBe(`coach-v1+talk-${level}`);
    }
  });

  it("leaves calls that only produce names unvoiced", async () => {
    const t = await createRatedApp();
    await t.request("/me", { method: "PATCH", ...json({ preferences: { sportsTalk: "extra" } }) });
    const calls = t.model.doGenerateCalls.length;
    await t.request("/habits/suggest-links", {
      method: "POST",
      ...json({ name: "Run", type: "checkbox" }),
    });
    expect(t.model.doGenerateCalls.length).toBeGreaterThan(calls);
    const call = t.model.doGenerateCalls.at(-1)!;
    expect(systemOf(call)).not.toContain("Voice:");
  });
});
