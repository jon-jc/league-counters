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
