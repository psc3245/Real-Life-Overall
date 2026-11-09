import { customPromptBodySchema, updateCustomPromptBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as prompts from "../services/custom-prompt-service";
import { idParam, parseJson } from "../validation";

/** The player's own scheduled questions (DESIGN.md §7.11). */
export const customPromptRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await prompts.listCustomPrompts(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, customPromptBodySchema);
    return c.json(await prompts.createCustomPrompt(c.get("db"), c.get("userId"), body), 201);
  })
  .patch("/:id", async (c) => {
    const body = await parseJson(c, updateCustomPromptBodySchema);
    return c.json(
      await prompts.updateCustomPrompt(
        c.get("db"),
        c.get("userId"),
        idParam(c, "id", "Question"),
        body,
      ),
    );
  })
  .delete("/:id", async (c) => {
    await prompts.deleteCustomPrompt(c.get("db"), c.get("userId"), idParam(c, "id", "Question"));
    return c.body(null, 204);
  });
