import { z } from "zod";
import { BRACKETS, QUEUES, ROLES } from "@/lib/lol/constants";
import { PLATFORMS } from "@/lib/lol/regions";

const platformSchema = z.enum(
  Object.keys(PLATFORMS) as [keyof typeof PLATFORMS, ...(keyof typeof PLATFORMS)[]],
);

const bracketSchema = z.enum(
  Object.keys(BRACKETS) as [keyof typeof BRACKETS, ...(keyof typeof BRACKETS)[]],
);

const queueSchema = z
  .number()
  .int()
  .refine((v): v is keyof typeof QUEUES => v in QUEUES, { message: "Unsupported queue" });

const roleSchema = z.enum(ROLES);

const optionCountSchema = z.object({
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
});

export const snapshotMetaSchema = z.object({
  platform: platformSchema,
  queue: queueSchema,
  bracket: bracketSchema,
  patch: z.string().min(1),
  matches: z.number().int().nonnegative(),
  generatedAt: z.iso.datetime(),
  source: z.enum(["riot", "seed"]),
});

export const snapshotSchema = z.object({
  meta: snapshotMetaSchema,
  champions: z.array(
    z.object({
      championId: z.number().int().positive(),
      bans: z.number().int().nonnegative(),
      byRole: z.partialRecord(
        roleSchema,
        z.object({
          games: z.number().int().nonnegative(),
          wins: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
  matchups: z.array(
    z.object({
      championId: z.number().int().positive(),
      opponentId: z.number().int().positive(),
      role: roleSchema,
      games: z.number().int().nonnegative(),
      wins: z.number().int().nonnegative(),
    }),
  ),
  /* Optional so snapshots written before builds existed still validate. */
  builds: z
    .array(
      z.object({
        championId: z.number().int().positive(),
        role: roleSchema,
        games: z.number().int().nonnegative(),
        items: z.record(z.string(), optionCountSchema),
        boots: z.record(z.string(), optionCountSchema),
        keystones: z.record(z.string(), optionCountSchema),
        secondaryStyles: z.record(z.string(), optionCountSchema),
        spells: z.record(z.string(), optionCountSchema),
      }),
    )
    .optional(),
});

export const snapshotIndexSchema = z.object({
  generatedAt: z.iso.datetime(),
  snapshots: z.array(snapshotMetaSchema),
});

export type ParsedSnapshot = z.infer<typeof snapshotSchema>;
export type ParsedSnapshotIndex = z.infer<typeof snapshotIndexSchema>;
