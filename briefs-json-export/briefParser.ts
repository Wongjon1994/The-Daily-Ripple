/**
 * Type shim — the brief files in this folder were exported from
 * client/src/lib and import their types from "./briefParser".
 * Re-export the canonical types so both tsc and the seed script resolve them.
 */

export type {
  DailyBrief,
  BriefSection,
  KeyMetric,
  BriefSource,
} from "../client/src/lib/briefParser";
