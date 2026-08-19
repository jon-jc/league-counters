/**
 * Reports whether RIOT_API_KEY still works.
 *
 *   npm run key:check
 *
 * Exit codes are meaningful, so CI can tell "you must rotate the key" apart
 * from "Riot is having a moment":
 *   0  usable
 *   1  needs rotation (expired or revoked)
 *   2  could not reach Riot
 *
 * The key is never printed.
 */
import { checkKey, isUsable, needsRotation } from "../src/lib/riot/key-status";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine — the key may come from the real environment instead (CI).
}

const apiKey = process.env.RIOT_API_KEY ?? "";
const result = await checkKey(apiKey);

console.log(`status : ${result.status}`);
console.log(`http   : ${result.httpStatus || "no response"}`);
console.log(`detail : ${result.message}`);

/* Set exitCode rather than calling process.exit(): forcing exit while the
   fetch's handles are still unwinding trips a libuv assertion on Windows. */
if (isUsable(result.status)) process.exitCode = 0;
else if (needsRotation(result.status)) process.exitCode = 1;
else process.exitCode = 2;
