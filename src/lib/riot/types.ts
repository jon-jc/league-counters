import { z } from "zod";

/** Only the fields the aggregator actually reads are modelled. */

export const leagueListSchema = z.object({
  tier: z.string(),
  entries: z.array(z.object({ puuid: z.string().min(1) })),
});

export const leagueEntriesSchema = z.array(
  z.object({
    puuid: z.string().min(1),
    tier: z.string().optional(),
    rank: z.string().optional(),
  }),
);

export const matchIdsSchema = z.array(z.string().min(1));

export const matchSchema = z.object({
  metadata: z.object({ matchId: z.string() }),
  info: z.object({
    gameVersion: z.string(),
    queueId: z.number(),
    gameDuration: z.number(),
    /** "GameComplete" on a normal finish; remakes report otherwise. */
    endOfGameResult: z.string().optional(),
    participants: z.array(
      z.object({
        championId: z.number(),
        teamId: z.number(),
        /** "" when Riot could not classify the position — those are dropped. */
        teamPosition: z.string(),
        win: z.boolean(),
        /* Inventory at the final tick. Slots 0-5 are items, 6 is the trinket.
           A slot is 0 when empty. */
        item0: z.number().optional(),
        item1: z.number().optional(),
        item2: z.number().optional(),
        item3: z.number().optional(),
        item4: z.number().optional(),
        item5: z.number().optional(),
        summoner1Id: z.number().optional(),
        summoner2Id: z.number().optional(),
        perks: z
          .object({
            styles: z.array(
              z.object({
                /** "primaryStyle" or "subStyle". */
                description: z.string().optional(),
                style: z.number(),
                selections: z.array(z.object({ perk: z.number() })),
              }),
            ),
          })
          .optional(),
      }),
    ),
    teams: z.array(
      z.object({
        teamId: z.number(),
        bans: z.array(z.object({ championId: z.number() })),
      }),
    ),
  }),
});

export type RiotMatch = z.infer<typeof matchSchema>;
