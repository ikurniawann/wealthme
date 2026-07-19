/* WealthMe UI-kit — AI Advisor chat screen. */
function ScreenAI() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { Button } = DS;
  const WM = window.WM;
  const Icon = window.WMIcon;
  const [msgs, setMsgs] = React.useState(WM.aiChat);
  const [text, setText] = React.useState("");
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  function send(t) {
    const content = (t ?? text).trim();
    if (!content) return;
    setText("");
    setMsgs((m) => [...m, { role: "user", text: content }]);
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: "Tentu — aku sedang menganalisis datamu. Berdasarkan arus kas 6 bulan terakhir, kamu punya ruang menabung tambahan ~Rp 3,2 jt/bulan tanpa mengganggu pengeluaran rutin.",
        },
      ]);
    }, 600);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: 14,
        height: "calc(100vh - 64px - 48px)",
      }}
    >
      {/* Chat column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "var(--card)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--ring-card)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            className="gradient-ai"
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="Bot" size={19} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>AI Advisor</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--success)",
                }}
              />
              Online · paham datamu
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="hide-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "76%",
                  display: "flex",
                  gap: 10,
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                }}
              >
                {m.role === "ai" && (
                  <div
                    className="gradient-ai"
                    style={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="Bot" size={15} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    fontSize: 13,
                    lineHeight: 1.5,
                    background:
                      m.role === "user" ? "var(--primary)" : "var(--secondary)",
                    color: m.role === "user" ? "#fff" : "var(--foreground)",
                    borderTopRightRadius: m.role === "user" ? 4 : 14,
                    borderTopLeftRadius: m.role === "ai" ? 4 : 14,
                  }}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 10,
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Tanya apa saja soal keuanganmu..."
            style={{
              flex: 1,
              height: 42,
              padding: "0 16px",
              borderRadius: 999,
              border: "1px solid var(--input)",
              background: "var(--background)",
              fontSize: 13,
              fontFamily: "var(--font-sans)",
              outline: "none",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={() => send()}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="Send" size={17} color="#fff" />
          </button>
        </div>
      </div>

      {/* Suggestions column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          className="gradient-wealth"
          style={{
            borderRadius: "var(--radius-lg)",
            padding: 18,
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Skor Kesehatan Finansial
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4 }}>
            82<span style={{ fontSize: 16, opacity: 0.7 }}>/100</span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              marginTop: 4,
              color: "#6ee7b7",
              fontWeight: 600,
            }}
          >
            ▲ 4 poin dari bulan lalu
          </div>
        </div>
        <div
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--ring-card)",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--muted-foreground)",
              marginBottom: 12,
            }}
          >
            Saran Pertanyaan
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {WM.aiSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  fontSize: 12.5,
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.ScreenAI = ScreenAI;
