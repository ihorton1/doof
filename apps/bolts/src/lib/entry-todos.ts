import { z } from "zod";

export function parseEntryContent(text: string) {
  const content = text.trim();
  const isTodo = content.startsWith("[]");
  return { content: isTodo ? content.slice(2).trim() : content, isTodo };
}

export const entryIdentitySchema = z.object({
  ideaId: z.cuid("This bolt could not be found. Return to your bolts and try again."),
  entryId: z.cuid("This entry could not be found. Refresh the page and try again."),
});

export const todoCompletionSchema = entryIdentitySchema.extend({
  completed: z.enum(["true", "false"], "Choose whether this to-do is complete.").transform((value) => value === "true"),
});
