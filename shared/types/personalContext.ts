import {
  DEFAULT_INTERACTION_PREFERENCE,
  normalizeInteractionPreference,
  type InteractionPreference,
} from "./guideInteraction";

export interface PersonalContext {
  enabled: boolean;
  interests: string[];
  excluded_topics: string[];
  purpose: string;
  known_topics: string;
  note: string;
  knowledge_level: "INTRODUCTORY" | "GENERAL" | "SPECIALIST";
  detail_level: "BRIEF" | "STANDARD" | "DEEP";
  step_free: boolean;
  interaction_mode: InteractionPreference;
  pace: "relaxed" | "normal" | "brisk";
}

export const emptyPersonalContext = (): PersonalContext => ({
  enabled: true,
  interests: [],
  excluded_topics: [],
  purpose: "",
  known_topics: "",
  note: "",
  knowledge_level: "GENERAL",
  detail_level: "STANDARD",
  step_free: false,
  interaction_mode: DEFAULT_INTERACTION_PREFERENCE,
  pace: "normal",
});

/** Add legacy defaults and copy mutable topics without changing visitor choices. */
export function normalizePersonalContext(
  context?: Partial<PersonalContext> | null,
): PersonalContext {
  return {
    ...emptyPersonalContext(),
    ...context,
    interests: [...(context?.interests ?? [])],
    excluded_topics: [...(context?.excluded_topics ?? [])],
    interaction_mode: normalizeInteractionPreference(context?.interaction_mode),
  };
}
