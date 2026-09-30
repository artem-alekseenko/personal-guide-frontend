import { expect, it } from "vitest";
import { experienceErrorKey } from "../app/utils/experienceErrors";
it("distinguishes proxy conflicts, authentication, validation and unavailable models", () => {
  expect(experienceErrorKey({ statusCode: 409 })).toBe("experience.conflict");
  expect(experienceErrorKey({ response: { status: 401 } })).toBe(
    "experience.authFailed",
  );
  expect(experienceErrorKey({ status: 404 })).toBe("experience.unavailable");
  expect(experienceErrorKey({ statusCode: 422 })).toBe(
    "experience.invalidAction",
  );
  expect(
    experienceErrorKey({
      statusCode: 503,
      data: { data: { code: "provider_unavailable" } },
    }),
  ).toBe("experience.modelUnavailable");
  expect(experienceErrorKey(new Error("Offline"))).toBe("experience.failed");
});
