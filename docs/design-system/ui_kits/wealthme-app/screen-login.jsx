/* WealthMe UI-kit — Login screen (gated entry to the app). */
function ScreenLogin({ onLogin }) {
  const DS = window.WealthMeDesignSystem_6818de;
  const { Input, Button } = DS;
  const Icon = window.WMIcon;
  const [email, setEmail] = React.useState("demo@wealthme.id");
  const [pw, setPw] = React.useState("demo1234");
  const [show, setShow] = React.useState(false);

  return (
    <div
      className="gradient-auth"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(255,255,255,.97)",
          borderRadius: 24,
          padding: 40,
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--primary)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            W
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            Wealth<span style={{ color: "var(--primary)" }}>Me</span>
          </div>
        </div>
        <h1
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Selamat Datang Kembali 👋
        </h1>
        <p
          style={{
            margin: "6px 0 24px",
            textAlign: "center",
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          Masuk ke Personal Wealth OS kamu
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderRadius: 12,
            border: "1.5px solid #c7d2fe",
            background: "linear-gradient(135deg,#eef2ff,#f5f3ff)",
            padding: "10px 14px",
            marginBottom: 20,
          }}
        >
          <Icon name="Info" size={16} color="var(--primary)" />
          <div style={{ fontSize: 12, color: "#3730a3" }}>
            <strong style={{ display: "block" }}>Demo tersedia</strong>
            demo@wealthme.id / demo1234
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <Input
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            iconStart={<Icon name="Mail" size={14} />}
          />
          <Input
            label="Password"
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            iconStart={<Icon name="Lock" size={14} />}
            iconEnd={
              <span
                style={{ cursor: "pointer", display: "flex" }}
                onClick={() => setShow((s) => !s)}
              >
                <Icon name={show ? "EyeOff" : "Eye"} size={14} />
              </span>
            }
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12.5,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                defaultChecked
                style={{ accentColor: "#4f46e5" }}
              />{" "}
              Ingat saya
            </label>
            <a
              style={{
                fontWeight: 600,
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              Lupa password?
            </a>
          </div>
          <Button
            size="lg"
            iconStart={<Icon name="LogIn" size={16} color="#fff" />}
            style={{ width: "100%", height: 46 }}
          >
            Masuk
          </Button>
        </form>
      </div>
    </div>
  );
}
window.ScreenLogin = ScreenLogin;
