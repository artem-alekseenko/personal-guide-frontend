import { defineStore } from "pinia";
import { shallowRef } from "vue";
import { useTourResearchApi } from "~/composables/api/tours/useTourResearchApi";
import type { PreparationMessageRequest } from "#shared/types/preparationProgress";
import type { GenerationDetail } from "#shared/types/researchLifecycle";

interface CaptionScope {
  uid: string;
  ownerId: string;
  tourId: string;
  generationId: string;
}
interface CaptionOperation {
  readonly key: string;
  readonly generationId: string;
  readonly body: Readonly<PreparationMessageRequest>;
  busy: boolean;
  uncertain: boolean;
  result: GenerationDetail | null;
  settledAt: number;
}

/** Shared across list/detail remounts; uncertain requests retain their original key and body. */
export const usePreparationMessageStore = defineStore(
  "preparationMessages",
  () => {
    const operations = shallowRef<Record<string, CaptionOperation>>({});
    const inFlight = new Map<string, Promise<GenerationDetail | null>>();
    const scopeKey = (scope: CaptionScope) =>
      JSON.stringify([scope.uid, scope.ownerId, scope.tourId]);
    const forScope = (scope: CaptionScope) => operations.value[scopeKey(scope)];
    const publish = (id: string, operation: CaptionOperation) => {
      operations.value = { ...operations.value, [id]: operation };
    };
    function retain(id: string, operation: CaptionOperation) {
      try {
        sessionStorage.setItem(
          `pg-preparation-caption-${id}`,
          JSON.stringify({
            version: 1,
            key: operation.key,
            generationId: operation.generationId,
            body: operation.body,
          }),
        );
        return true;
      } catch {
        return false;
      }
    }

    /** Restore only a known account/owner/tour receipt; getters never touch storage. */
    function restore(scope: CaptionScope): boolean {
      if (forScope(scope)) return true;
      const id = scopeKey(scope);
      try {
        const stored = sessionStorage.getItem(`pg-preparation-caption-${id}`);
        if (!stored) return true;
        const receipt = JSON.parse(stored);
        if (
          receipt?.version !== 1 ||
          typeof receipt.key !== "string" ||
          !receipt.key.trim() ||
          receipt.key.length > 128 ||
          typeof receipt.generationId !== "string" ||
          !receipt.generationId.trim() ||
          !["en", "ru"].includes(receipt.body?.lang) ||
          !Number.isInteger(receipt.body?.message_variant) ||
          receipt.body.message_variant < 0 ||
          receipt.body.message_variant > 2_147_483_647 ||
          (receipt.body.previous_activity_text !== undefined &&
            (typeof receipt.body.previous_activity_text !== "string" ||
              receipt.body.previous_activity_text.length > 280)) ||
          Object.keys(receipt.body).some(
            (field) =>
              !["lang", "message_variant", "previous_activity_text"].includes(
                field,
              ),
          )
        )
          return false;
        publish(id, {
          key: receipt.key,
          generationId: receipt.generationId,
          body: Object.freeze({ ...receipt.body }),
          busy: false,
          uncertain: true,
          result: null,
          settledAt: 0,
        });
        return true;
      } catch {
        // Unknown local receipt state must not create a fresh paid operation.
        return false;
      }
    }

    function request(
      scope: CaptionScope,
      body: PreparationMessageRequest,
      manual: boolean,
    ): Promise<GenerationDetail | null> {
      const id = scopeKey(scope);
      const running = inFlight.get(id);
      if (running) return running;
      if (!restore(scope)) return Promise.resolve(null);
      let operation = forScope(scope);
      if (operation?.uncertain && !manual) return Promise.resolve(null);
      if (
        operation &&
        !operation.uncertain &&
        !manual &&
        operation.generationId === scope.generationId &&
        operation.body.lang === body.lang &&
        Date.now() - operation.settledAt < 5000
      )
        return Promise.resolve(operation.result);
      if (!operation?.uncertain) {
        operation = {
          key: crypto.randomUUID(),
          generationId: scope.generationId,
          body: Object.freeze({ ...body }),
          busy: false,
          uncertain: true,
          result: null,
          settledAt: 0,
        };
      }
      const submitted = operation;
      submitted.busy = true;
      publish(id, submitted);
      if (!retain(id, submitted)) {
        submitted.busy = false;
        publish(id, submitted);
        return Promise.resolve(null);
      }
      const promise = (async () => {
        try {
          const response = await useTourResearchApi().progressMessage(
            scope.tourId,
            submitted.generationId,
            submitted.key,
            submitted.body,
          );
          if (response.generation.owner_id !== scope.ownerId)
            throw new Error("The progress caption generation owner changed");
          submitted.result = response;
          submitted.uncertain =
            response.progress?.rich_progress_enabled === false ||
            [
              "request_in_progress",
              "request_uncertain",
              "receipt_uncertain",
              "idempotency_conflict",
              "rich_progress_disabled",
              "provider_unavailable",
            ].includes(response.progress?.activity_fallback_reason ?? "");
          return response;
        } catch {
          submitted.uncertain = true;
          return null;
        } finally {
          submitted.busy = false;
          submitted.settledAt = Date.now();
          if (submitted.uncertain) retain(id, submitted);
          else {
            try {
              sessionStorage.removeItem(`pg-preparation-caption-${id}`);
            } catch {}
          }
          publish(id, submitted);
          inFlight.delete(id);
        }
      })();
      inFlight.set(id, promise);
      return promise;
    }
    return { operations, forScope, restore, request };
  },
);
