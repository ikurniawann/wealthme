jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

import { id } from "@/i18n/id";
import { greetingFor } from "./page-greeting";

describe("greetingFor", () => {
  test.each([
    [6, "Selamat pagi"],
    [10, "Selamat pagi"],
    [11, "Selamat siang"],
    [14, "Selamat siang"],
    [15, "Selamat sore"],
    [18, "Selamat sore"],
    [19, "Selamat malam"],
    [0, "Selamat pagi"],
  ])("hour %i reads %s", (hour, expected) => {
    expect(greetingFor(hour, id)).toBe(expected);
  });
});
