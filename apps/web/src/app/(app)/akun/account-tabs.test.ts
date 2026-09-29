import {
  getAccountTabForSubpage,
  getInitialAccountTab,
  isAccountTab,
} from "./account-tabs";

describe("account tab state", () => {
  it("uses the URL tab before the remembered tab", () => {
    expect(getInitialAccountTab("?tab=bantuan", "keamanan")).toBe("bantuan");
  });

  it("restores a valid remembered tab when the URL has no tab", () => {
    expect(getInitialAccountTab("", "preferensi")).toBe("preferensi");
  });

  it("falls back to profile for invalid URL and saved values", () => {
    expect(getInitialAccountTab("?tab=unknown", "unknown")).toBe("profil");
  });

  it("maps account subpages into their parent tabs", () => {
    expect(getAccountTabForSubpage("keamanan")).toBe("keamanan");
    expect(getAccountTabForSubpage("notif-setting")).toBe("preferensi");
    expect(getAccountTabForSubpage("hubungi")).toBe("bantuan");
  });

  it("recognizes only supported tab ids", () => {
    expect(isAccountTab("profil")).toBe(true);
    expect(isAccountTab("family")).toBe(false);
  });
});
