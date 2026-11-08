import { describe, expect, it } from "vitest";
import { availableTransitions, canTransition, nextStatus } from "@/modules/org/status";

describe("transições de estado da organização", () => {
  it("PENDING_APPROVAL → approve/reject", () => {
    expect(availableTransitions("PENDING_APPROVAL").sort()).toEqual(["approve", "reject"]);
    expect(nextStatus("PENDING_APPROVAL", "approve")).toBe("ACTIVE");
    expect(nextStatus("PENDING_APPROVAL", "reject")).toBe("REJECTED");
  });

  it("ACTIVE → suspend; SUSPENDED → reactivate", () => {
    expect(nextStatus("ACTIVE", "suspend")).toBe("SUSPENDED");
    expect(nextStatus("SUSPENDED", "reactivate")).toBe("ACTIVE");
  });

  it("rejeita transições inválidas", () => {
    expect(canTransition("ACTIVE", "approve")).toBe(false);
    expect(canTransition("REJECTED", "suspend")).toBe(false);
    expect(nextStatus("PENDING_APPROVAL", "suspend")).toBeNull();
  });
});
