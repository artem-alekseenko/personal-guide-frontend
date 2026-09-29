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
  pace: "normal",
});
