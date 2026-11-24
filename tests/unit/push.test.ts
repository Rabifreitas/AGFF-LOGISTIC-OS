import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "@/modules/push/push.service";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QAbc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts browser push service %s", (u) => expect(isAllowedPushEndpoint(u)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "https://fcm.googleapis.com.evil.test/x",
    "https://evilpush.apple.com.attacker.io/x",
    "not a url",
  ])("rejects %s", (u) => expect(isAllowedPushEndpoint(u)).toBe(false));
});
