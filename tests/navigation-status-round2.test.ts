import { expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";
import { navigationInstructions } from "../app/utils/navigationInstructions";

it("explains destination clarification and time limit in both languages without showing turns", () => {
  for (const locale of [en, ru]) {
    expect(
      locale.experience.navigationStatus.destination_required.length,
    ).toBeGreaterThan(0);
    expect(
      locale.experience.navigationStatus.time_limit.length,
    ).toBeGreaterThan(0);
  }
  for (const status of ["destination_required", "time_limit"] as const) {
    expect(
      navigationInstructions({ status, instructions: ["Turn left"] }),
    ).toEqual([]);
  }
});
