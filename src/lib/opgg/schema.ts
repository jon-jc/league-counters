import { z } from "zod";
import { ROLES } from "@/lib/lol/constants";

/** Validates `data/opgg/lane-meta.json` at the boundary, like Riot snapshots. */
export const opggTierListSchema = z.object({
  meta: z.object({
    fetchedAt: z.iso.datetime(),
    championGames: z.number().int().nonnegative(),
    champions: z.number().int().nonnegative(),
  }),
  rows: z.array(
    z.object({
      championId: z.number().int().positive(),
      role: z.enum(ROLES),
      /* op.gg grades 0 (strongest) through 5. A value outside that range means
         they changed their scale, which would silently mis-colour every pill. */
      tier: z.number().int().min(0).max(5),
      rank: z.number().int().positive(),
      games: z.number().int().nonnegative(),
      wins: z.number().int().nonnegative(),
      pickRate: z.number().min(0).max(1),
      banRate: z.number().min(0).max(1),
      roleRate: z.number().min(0).max(1),
      kda: z.number().nonnegative(),
    }),
  ),
});

export type ParsedOpggTierList = z.infer<typeof opggTierListSchema>;
