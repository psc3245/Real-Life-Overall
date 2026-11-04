import { describe, expect, it } from "vitest";
import { premiumTenure } from "./schemas/account";

describe("premiumTenure", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  it("counts days, then weeks", () => {
    expect(premiumTenure(null, now)).toBeNull();
    expect(premiumTenure(ago(0.5), now)).toBe("New to Premium");
    expect(premiumTenure(ago(1), now)).toBe("1 day Premium");
    expect(premiumTenure(ago(7), now)).toBe("1 week Premium");
    expect(premiumTenure(ago(23), now)).toBe("3 weeks Premium");
  });
});
