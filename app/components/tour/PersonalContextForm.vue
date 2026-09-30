<template>
  <details class="rounded-lg border p-3">
    <summary class="cursor-pointer font-medium">
      {{ $t("experience.forThisWalk") }}
    </summary>
    <div class="mt-3 grid gap-3">
      <label
        ><input v-model="value.enabled" type="checkbox" />
        {{ $t("experience.personalize") }}</label
      >
      <label
        ><input v-model="value.step_free" type="checkbox" />
        {{ $t("experience.stepFree") }}</label
      >
      <template v-if="value.enabled">
        <label v-if="showInterests" class="grid gap-1"
          >{{ $t("experience.interests") }}
          <select
            v-model="value.interests"
            multiple
            class="rounded border p-2"
            @change="
              value.excluded_topics = value.excluded_topics.filter(
                (topic) => !value.interests.includes(topic),
              )
            "
          >
            <option v-for="topic in topics" :key="topic" :value="topic">
              {{ $t(`experience.topics.${topic}`) }}
            </option>
          </select>
        </label>
        <label class="grid gap-1"
          >{{ $t("experience.excludedTopics") }}
          <select
            v-model="value.excluded_topics"
            @change="
              value.interests = value.interests.filter(
                (topic) => !value.excluded_topics.includes(topic),
              )
            "
            multiple
            class="rounded border p-2"
          >
            <option v-for="topic in topics" :key="topic" :value="topic">
              {{ $t(`experience.topics.${topic}`) }}
            </option>
          </select>
        </label>
        <label class="grid gap-1"
          >{{ $t("experience.purpose")
          }}<input
            v-model="value.purpose"
            maxlength="500"
            class="rounded border p-2"
        /></label>
        <label class="grid gap-1"
          >{{ $t("experience.known")
          }}<textarea
            v-model="value.known_topics"
            maxlength="1000"
            rows="2"
            class="rounded border p-2"
          />
        </label>
        <label class="grid gap-1"
          >{{ $t("experience.note")
          }}<textarea
            v-model="value.note"
            maxlength="1000"
            rows="2"
            class="rounded border p-2"
          />
        </label>
        <label class="grid gap-1"
          >{{ $t("experience.familiarity")
          }}<select v-model="value.knowledge_level" class="rounded border p-2">
            <option
              v-for="level in ['INTRODUCTORY', 'GENERAL', 'SPECIALIST']"
              :key="level"
              :value="level"
            >
              {{ $t(`experience.${level}`) }}
            </option>
          </select></label
        >
        <label class="grid gap-1"
          >{{ $t("experience.depth")
          }}<select v-model="value.detail_level" class="rounded border p-2">
            <option
              v-for="level in ['BRIEF', 'STANDARD', 'DEEP']"
              :key="level"
              :value="level"
            >
              {{ $t(`experience.${level}`) }}
            </option>
          </select></label
        >
        <label class="grid gap-1"
          >{{ $t("experience.pace")
          }}<select v-model="value.pace" class="rounded border p-2">
            <option
              v-for="pace in ['relaxed', 'normal', 'brisk']"
              :key="pace"
              :value="pace"
            >
              {{ $t(`experience.${pace}`) }}
            </option>
          </select></label
        >
      </template>
    </div>
  </details>
</template>
<script setup lang="ts">
import type { PersonalContext } from "~/types/personalContext";
withDefaults(defineProps<{ showInterests?: boolean }>(), {
  showInterests: true,
});
const value = defineModel<PersonalContext>({ required: true });
const topics = [
  "nature",
  "movies",
  "it",
  "politics",
  "science",
  "art",
  "museum",
  "for_child",
];
</script>
