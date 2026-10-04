import { describe, expect, it } from "vitest";
import {
  apiErrorMessage,
  apiFieldErrorMap,
  fieldError,
  fieldLabel,
} from "@/lib/api/errors";

describe("api field errors", () => {
  const payload = {
    message: "Gönderilen bilgilerde hatalar var. Lütfen işaretli alanları düzeltin.",
    fieldErrors: [
      { field: "code", message: "Bu alan zorunludur." },
      { field: "properties[0].name", message: "Bu alan zorunludur." },
    ],
  };

  it("maps field errors and root keys", () => {
    const map = apiFieldErrorMap(payload);
    expect(map.code).toBe("Bu alan zorunludur.");
    expect(map.properties).toBe("Bu alan zorunludur.");
    expect(map["properties[0].name"]).toBe("Bu alan zorunludur.");
  });

  it("includes field details in summary message", () => {
    expect(apiErrorMessage(payload)).toContain("Kod: Bu alan zorunludur.");
  });

  it("fieldError reads first matching key", () => {
    const map = apiFieldErrorMap(payload);
    expect(fieldError(map, "name", "code")).toBe("Bu alan zorunludur.");
    expect(fieldLabel("code")).toBe("Kod");
  });
});
