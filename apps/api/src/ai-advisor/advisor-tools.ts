import { z } from "zod";

/**
 * What the advisor can ASK FOR, instead of being handed everything up front.
 *
 * The context prompt carries this month only. Widening it to every month, or
 * to raw rows, costs tokens on EVERY message — which is precisely the free
 * quota that runs out. A tool inverts that: the model pays for history only
 * on the questions that need it, and can reach any period rather than the
 * fixed window someone guessed at.
 *
 * The single most important property here: **the family is not a parameter**.
 * The model names a period and a type; the tenant, the viewer's role and the
 * privacy filter are bound server-side from the authenticated request. A
 * `familyGroupId` argument would be an id the model could change.
 */

/** Bounds a single answer so one question cannot blow the whole prompt. */
export const ADVISOR_TOOL_MAX_ROWS = 40;
/** Bounds how many rows one call may SCAN when aggregating per month. Far
 *  above any real family's year, and a period that exceeds it is reported as
 *  partial rather than silently summarised from a slice. */
export const ADVISOR_TOOL_MAX_SCANNED_ROWS = 5000;

/** Bounds how many times the model may call tools before it must answer. */
export const ADVISOR_MAX_TOOL_ROUNDS = 3;

export const ADVISOR_TOOL_NAME = "query_transactions" as const;

export const advisorToolArgsSchema = z.object({
  /** Inclusive ISO date (YYYY-MM-DD). */
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  /** Inclusive ISO date (YYYY-MM-DD). */
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  /** Ask for the rows themselves; otherwise only the summary comes back. */
  includeRows: z.boolean().optional(),
});

/**
 * The declaration, in the neutral shape every provider can be built from.
 * Kept in ONE place so Claude, OpenAI and Gemini cannot describe the same
 * tool differently to their models.
 */
export const ADVISOR_TOOL_DECLARATION = {
  name: ADVISOR_TOOL_NAME,
  description:
    "Look up this family's OWN transactions for any period, including months not in the prompt. Returns totals per month, the biggest categories, and optionally the individual rows. Use it whenever the question mentions a month, a date range, 'tahun ini', a comparison between periods, or anything the summary in the system prompt does not already answer. Do not guess figures you were not given.",
  parameters: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Start date, inclusive, as YYYY-MM-DD.",
      },
      to: {
        type: "string",
        description: "End date, inclusive, as YYYY-MM-DD.",
      },
      type: {
        type: "string",
        enum: ["income", "expense", "transfer"],
        description: "Restrict to one direction. Omit for all.",
      },
      includeRows: {
        type: "boolean",
        description: `Include the individual transactions (max ${ADVISOR_TOOL_MAX_ROWS}, largest first). Omit for totals only.`,
      },
    },
    required: [] as string[],
  },
};

/** Runs one tool call. Bound to a family and a viewer by the service. */
export type AdvisorToolRunner = (
  name: string,
  args: unknown,
) => Promise<string>;
