/* @ds-bundle: {"format":3,"namespace":"WealthMeDesignSystem_6818de","components":[{"name":"BarChart","sourcePath":"components/charts/BarChart.jsx"},{"name":"Donut","sourcePath":"components/charts/Donut.jsx"},{"name":"DonutLegend","sourcePath":"components/charts/Donut.jsx"},{"name":"Sparkline","sourcePath":"components/charts/Sparkline.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"ProgressBar","sourcePath":"components/core/ProgressBar.jsx"},{"name":"StatusBadge","sourcePath":"components/core/StatusBadge.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"HeroCard","sourcePath":"components/surfaces/HeroCard.jsx"},{"name":"MoneyStat","sourcePath":"components/surfaces/MoneyStat.jsx"},{"name":"SectionCard","sourcePath":"components/surfaces/SectionCard.jsx"},{"name":"SummaryCard","sourcePath":"components/surfaces/SummaryCard.jsx"}],"sourceHashes":{"components/charts/BarChart.jsx":"f6666c133314","components/charts/Donut.jsx":"c8ec09606aa5","components/charts/Sparkline.jsx":"95dbb1780fab","components/core/Badge.jsx":"9116007c902e","components/core/Button.jsx":"458f38d93c2e","components/core/ProgressBar.jsx":"00819a244b95","components/core/StatusBadge.jsx":"e093ae5b114e","components/forms/Input.jsx":"fa5865bc7fcf","components/forms/Select.jsx":"7f84f54e844b","components/forms/Switch.jsx":"b043de83418e","components/surfaces/Card.jsx":"ee2189cd1555","components/surfaces/HeroCard.jsx":"fff04429ac68","components/surfaces/MoneyStat.jsx":"2918891340e5","components/surfaces/SectionCard.jsx":"572263bd24f5","components/surfaces/SummaryCard.jsx":"a577864b18da","ui_kits/wealthme-app/app.jsx":"7d031abab735","ui_kits/wealthme-app/data.js":"0da92b6b1e40","ui_kits/wealthme-app/icons.jsx":"782bc8c2bf51","ui_kits/wealthme-app/kit-helpers.jsx":"326fec32c913","ui_kits/wealthme-app/screen-ai.jsx":"d66aaf4d9982","ui_kits/wealthme-app/screen-akun.jsx":"17cad2d0246f","ui_kits/wealthme-app/screen-anggaran.jsx":"e34282a8fdfd","ui_kits/wealthme-app/screen-aset.jsx":"8d338d242dfa","ui_kits/wealthme-app/screen-asuransi.jsx":"ffc521921d19","ui_kits/wealthme-app/screen-beranda-enhanced.jsx":"8f4dea283f4e","ui_kits/wealthme-app/screen-beranda.jsx":"174b9c59cc52","ui_kits/wealthme-app/screen-dana.jsx":"2ff6b8c95cc5","ui_kits/wealthme-app/screen-donation.jsx":"4e6a80a861e9","ui_kits/wealthme-app/screen-investasi.jsx":"ee268e8b83e6","ui_kits/wealthme-app/screen-kalkulator.jsx":"254f1703a906","ui_kits/wealthme-app/screen-laporan.jsx":"baaf27efecc9","ui_kits/wealthme-app/screen-liabilitas.jsx":"21cbd9f13b32","ui_kits/wealthme-app/screen-login.jsx":"360a3c42f671","ui_kits/wealthme-app/screen-masterdata.jsx":"4813ed34ea95","ui_kits/wealthme-app/screen-notifikasi.jsx":"4fe6548f5cfa","ui_kits/wealthme-app/screen-quickinput.jsx":"a2f6c809389e","ui_kits/wealthme-app/screen-rekening.jsx":"b060c7eb2bdd","ui_kits/wealthme-app/screen-rekonsiliasi.jsx":"678c4c38c939","ui_kits/wealthme-app/screen-ringkasan.jsx":"36f8685daf9e","ui_kits/wealthme-app/screen-splitbill.jsx":"8643f949200c","ui_kits/wealthme-app/screen-tax.jsx":"12301909f053","ui_kits/wealthme-app/screen-transaksi.jsx":"65127d005fe2","ui_kits/wealthme-app/screen-tujuan.jsx":"447261761e24","ui_kits/wealthme-app/screen-warisan.jsx":"bb05a68a7bf2","ui_kits/wealthme-app/shell.jsx":"202f0453305c"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {
  const __ds_ns = (window.WealthMeDesignSystem_6818de =
    window.WealthMeDesignSystem_6818de || {});

  const __ds_scope = {};

  __ds_ns.__errors = __ds_ns.__errors || [];

  // components/charts/BarChart.jsx
  try {
    (() => {
      /**
       * WealthMe BarChart — grouped income/expense bars per month. Green = income,
       * red = expense. Ported from the app's renderBar(). Pure CSS bars.
       */
      function BarChart({
        months = [],
        income = [],
        expense = [],
        max,
        height = 90,
        showLegend = true,
      }) {
        const peak = max || Math.max(1, ...income, ...expense);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              fontFamily: "var(--font-sans)",
            },
          },
          showLegend &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginBottom: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                /*#__PURE__*/ React.createElement("span", {
                  style: {
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--success)",
                  },
                }),
                " Pemasukan",
              ),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                /*#__PURE__*/ React.createElement("span", {
                  style: {
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--destructive)",
                  },
                }),
                " Pengeluaran",
              ),
            ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                paddingTop: 8,
                height,
              },
            },
            months.map((_, i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    display: "flex",
                    flex: 1,
                    alignItems: "flex-end",
                    gap: 2,
                  },
                },
                /*#__PURE__*/ React.createElement("div", {
                  style: {
                    flex: 1,
                    minHeight: 3,
                    borderRadius: "3px 3px 0 0",
                    background: "var(--success)",
                    height: `${(income[i] / peak) * 100}%`,
                  },
                }),
                /*#__PURE__*/ React.createElement("div", {
                  style: {
                    flex: 1,
                    minHeight: 3,
                    borderRadius: "3px 3px 0 0",
                    background: "var(--destructive)",
                    height: `${(expense[i] / peak) * 100}%`,
                  },
                }),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 6,
                display: "flex",
                gap: 8,
              },
            },
            months.map((m, i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    flex: 1,
                    textAlign: "center",
                    fontSize: 10,
                    color: "var(--muted-foreground)",
                    fontWeight: i === months.length - 1 ? 700 : 400,
                  },
                },
                m,
              ),
            ),
          ),
        );
      }
      Object.assign(__ds_scope, { BarChart });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/charts/BarChart.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/charts/Donut.jsx
  try {
    (() => {
      /**
       * WealthMe Donut — SVG ring chart with a centered label. Segments accept CSS
       * vars or hex. Used for wealth allocation. Pair with DonutLegend.
       */
      function Donut({
        segments = [],
        size = 120,
        thickness = 17,
        centerValue,
        centerLabel,
      }) {
        const total = segments.reduce((s, x) => s + x.value, 0) || 1;
        const radius = (size - thickness) / 2;
        const circ = 2 * Math.PI * radius;
        let acc = 0;
        const arcs = segments.map((seg) => {
          const len = (seg.value / total) * circ;
          const offset = acc;
          acc += len;
          return {
            seg,
            len,
            offset,
          };
        });
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: size,
              height: size,
            },
          },
          /*#__PURE__*/ React.createElement(
            "svg",
            {
              width: size,
              height: size,
              viewBox: `0 0 ${size} ${size}`,
              style: {
                transform: "rotate(-90deg)",
              },
            },
            /*#__PURE__*/ React.createElement("circle", {
              cx: size / 2,
              cy: size / 2,
              r: radius,
              fill: "none",
              stroke: "var(--muted)",
              strokeWidth: thickness,
            }),
            arcs.map(({ seg, len, offset }, i) =>
              /*#__PURE__*/ React.createElement("circle", {
                key: i,
                cx: size / 2,
                cy: size / 2,
                r: radius,
                fill: "none",
                stroke: seg.color,
                strokeWidth: thickness,
                strokeDasharray: `${len} ${circ - len}`,
                strokeDashoffset: -offset,
                strokeLinecap: "butt",
              }),
            ),
          ),
          (centerValue || centerLabel) &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  position: "absolute",
                  textAlign: "center",
                  pointerEvents: "none",
                  fontFamily: "var(--font-sans)",
                },
              },
              centerValue &&
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 14,
                      fontWeight: 800,
                      lineHeight: 1.1,
                      color: "var(--foreground)",
                    },
                  },
                  centerValue,
                ),
              centerLabel &&
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 10,
                      color: "var(--muted-foreground)",
                    },
                  },
                  centerLabel,
                ),
            ),
        );
      }

      /** Legend rows for a Donut, sharing the same segment shape. */
      function DonutLegend({ segments = [], total }) {
        const sum = total ?? (segments.reduce((s, x) => s + x.value, 0) || 1);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontFamily: "var(--font-sans)",
            },
          },
          segments.map((seg, i) =>
            /*#__PURE__*/ React.createElement(
              "div",
              {
                key: i,
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                  },
                },
                /*#__PURE__*/ React.createElement("span", {
                  style: {
                    width: 8,
                    height: 8,
                    flexShrink: 0,
                    borderRadius: 999,
                    background: seg.color,
                  },
                }),
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      flex: 1,
                      color: "var(--muted-foreground)",
                    },
                  },
                  seg.label,
                ),
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontWeight: 700,
                      color: "var(--foreground)",
                    },
                  },
                  Math.round((seg.value / sum) * 100),
                  "%",
                ),
              ),
              seg.sub &&
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginLeft: 16,
                      marginTop: -2,
                      fontSize: 10.5,
                      color: "var(--muted-foreground)",
                    },
                  },
                  seg.sub,
                ),
            ),
          ),
        );
      }
      Object.assign(__ds_scope, { Donut, DonutLegend });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/charts/Donut.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/charts/Sparkline.jsx
  try {
    (() => {
      /**
       * WealthMe Sparkline — smoothed area sparkline on a <canvas>, edge-to-edge.
       * Ported from the app's renderSparkline(). White stroke by default (for the
       * indigo hero card); pass stroke/fill for light surfaces.
       */
      function Sparkline({
        points = [],
        height = 60,
        stroke = "rgba(255,255,255,0.75)",
        fill = "rgba(255,255,255,0.22)",
        style,
      }) {
        const canvasRef = React.useRef(null);
        const wrapRef = React.useRef(null);
        React.useEffect(() => {
          const canvas = canvasRef.current;
          const wrap = wrapRef.current;
          if (!canvas || !wrap || points.length < 2) return;
          const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const W = wrap.offsetWidth || 300;
            const H = height;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = W + "px";
            canvas.style.height = H + "px";
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, W, H);
            const min = Math.min(...points) - 5;
            const max = Math.max(...points) + 5;
            const xStep = W / (points.length - 1);
            const toX = (i) => i * xStep;
            const toY = (v) => H - ((v - min) / (max - min || 1)) * (H - 8) - 4;
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, fill);
            grad.addColorStop(1, "rgba(255,255,255,0.01)");
            ctx.beginPath();
            ctx.moveTo(toX(0), toY(points[0]));
            for (let i = 1; i < points.length; i++) {
              const cpx = (toX(i - 1) + toX(i)) / 2;
              ctx.bezierCurveTo(
                cpx,
                toY(points[i - 1]),
                cpx,
                toY(points[i]),
                toX(i),
                toY(points[i]),
              );
            }
            ctx.lineTo(toX(points.length - 1), H);
            ctx.lineTo(0, H);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(toX(0), toY(points[0]));
            for (let i = 1; i < points.length; i++) {
              const cpx = (toX(i - 1) + toX(i)) / 2;
              ctx.bezierCurveTo(
                cpx,
                toY(points[i - 1]),
                cpx,
                toY(points[i]),
                toX(i),
                toY(points[i]),
              );
            }
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 2;
            ctx.stroke();
            const lx = toX(points.length - 1);
            const ly = toY(points[points.length - 1]);
            ctx.beginPath();
            ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = "#fff";
            ctx.fill();
          };
          draw();
          const ro = new ResizeObserver(draw);
          ro.observe(wrap);
          return () => ro.disconnect();
        }, [points, height, stroke, fill]);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            ref: wrapRef,
            style: {
              width: "100%",
              position: "relative",
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement("canvas", {
            ref: canvasRef,
            style: {
              display: "block",
            },
          }),
        );
      }
      Object.assign(__ds_scope, { Sparkline });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/charts/Sparkline.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/Badge.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe Badge — small pill label. Solid for counts/primary, soft-fill for
       * semantic states, outline/ghost for low emphasis. Fully rounded.
       */
      function Badge({
        variant = "default",
        className,
        style,
        children,
        ...props
      }) {
        const variants = {
          default: {
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          },
          secondary: {
            background: "var(--secondary)",
            color: "var(--secondary-foreground)",
          },
          destructive: {
            background:
              "color-mix(in oklab, var(--destructive) 12%, transparent)",
            color: "var(--destructive)",
          },
          success: {
            background: "var(--success-soft)",
            color: "#15803d",
          },
          warning: {
            background: "var(--warning-soft)",
            color: "#b45309",
          },
          purple: {
            background: "var(--brand-purple-soft)",
            color: "#6d28d9",
          },
          outline: {
            background: "transparent",
            color: "var(--foreground)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          },
        };
        const v = variants[variant] || variants.default;
        return /*#__PURE__*/ React.createElement(
          "span",
          _extends(
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 20,
                padding: "0 8px",
                borderRadius: "var(--radius-pill)",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
                ...v,
                ...style,
              },
            },
            props,
          ),
          children,
        );
      }
      Object.assign(__ds_scope, { Badge });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/Badge.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/Button.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe Button — Base-UI-derived button with the brand's variants & sizes.
       * Indigo solid default, soft-fill destructive, restrained ghost/outline.
       * Press nudges 1px down; hover lightens the fill.
       */
      function Button({
        variant = "default",
        size = "default",
        iconStart,
        iconEnd,
        disabled = false,
        className,
        style,
        children,
        ...props
      }) {
        const [hover, setHover] = React.useState(false);
        const [active, setActive] = React.useState(false);
        const sizes = {
          sm: {
            height: 28,
            padding: "0 10px",
            fontSize: 12.5,
            radius: "var(--radius-sm)",
            gap: 6,
          },
          default: {
            height: 34,
            padding: "0 14px",
            fontSize: 13,
            radius: "var(--radius-md)",
            gap: 7,
          },
          lg: {
            height: 40,
            padding: "0 18px",
            fontSize: 14,
            radius: "var(--radius-md)",
            gap: 8,
          },
          icon: {
            height: 36,
            width: 36,
            padding: 0,
            fontSize: 13,
            radius: "var(--radius-md)",
            gap: 0,
          },
        };
        const s = sizes[size] || sizes.default;
        const variants = {
          default: {
            background: hover
              ? "color-mix(in oklab, var(--primary) 86%, black)"
              : "var(--primary)",
            color: "var(--primary-foreground)",
            boxShadow: "none",
            border: "1px solid transparent",
          },
          outline: {
            background: hover ? "var(--muted)" : "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          },
          secondary: {
            background: hover
              ? "color-mix(in oklab, var(--secondary), var(--foreground) 5%)"
              : "var(--secondary)",
            color: "var(--secondary-foreground)",
            border: "1px solid transparent",
          },
          ghost: {
            background: hover ? "var(--muted)" : "transparent",
            color: hover ? "var(--foreground)" : "var(--muted-foreground)",
            border: "1px solid transparent",
          },
          destructive: {
            background: hover
              ? "color-mix(in oklab, var(--destructive) 22%, transparent)"
              : "color-mix(in oklab, var(--destructive) 12%, transparent)",
            color: "var(--destructive)",
            border: "1px solid transparent",
          },
          link: {
            background: "transparent",
            color: "var(--primary)",
            border: "1px solid transparent",
            textDecoration: hover ? "underline" : "none",
            padding: 0,
            height: "auto",
          },
        };
        const v = variants[variant] || variants.default;
        return /*#__PURE__*/ React.createElement(
          "button",
          _extends(
            {
              type: "button",
              disabled: disabled,
              onMouseEnter: () => setHover(true),
              onMouseLeave: () => {
                setHover(false);
                setActive(false);
              },
              onMouseDown: () => setActive(true),
              onMouseUp: () => setActive(false),
              style: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: s.gap,
                height: variant === "link" ? "auto" : s.height,
                width: s.width,
                padding: variant === "link" ? 0 : s.padding,
                borderRadius: s.radius,
                fontFamily: "var(--font-sans)",
                fontSize: s.fontSize,
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                transition: "background .15s, transform .05s, color .15s",
                transform: active && !disabled ? "translateY(1px)" : "none",
                outline: "none",
                ...v,
                ...style,
              },
            },
            props,
          ),
          iconStart,
          children,
          iconEnd,
        );
      }
      Object.assign(__ds_scope, { Button });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/Button.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/ProgressBar.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe ProgressBar — thin rounded track + fill. Color is free-form so it
       * can reflect goal status (primary / success / warning / brand-purple).
       */
      function ProgressBar({
        value = 0,
        color = "var(--primary)",
        height = 7,
        className,
        style,
        ...props
      }) {
        const pct = Math.min(100, Math.max(0, value));
        return /*#__PURE__*/ React.createElement(
          "div",
          _extends(
            {
              style: {
                overflow: "hidden",
                borderRadius: "var(--radius-pill)",
                background: "var(--muted)",
                height,
                ...style,
              },
            },
            props,
          ),
          /*#__PURE__*/ React.createElement("div", {
            style: {
              height: "100%",
              width: pct + "%",
              borderRadius: "var(--radius-pill)",
              background: color,
              transition: "width .7s cubic-bezier(.4,0,.2,1)",
            },
          }),
        );
      }
      Object.assign(__ds_scope, { ProgressBar });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/ProgressBar.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/StatusBadge.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe StatusBadge — soft-fill status pill with an optional leading dot.
       * Used in tables, goal rows, account lists. Larger & friendlier than Badge.
       */
      function StatusBadge({
        variant = "gray",
        dot = false,
        className,
        style,
        children,
        ...props
      }) {
        const variants = {
          success: {
            background: "var(--success-soft)",
            color: "#15803d",
          },
          danger: {
            background: "#fee2e2",
            color: "#b91c1c",
          },
          warning: {
            background: "var(--warning-soft)",
            color: "#b45309",
          },
          info: {
            background: "#dbeafe",
            color: "#1d4ed8",
          },
          purple: {
            background: "var(--brand-purple-soft)",
            color: "#6d28d9",
          },
          gray: {
            background: "var(--secondary)",
            color: "var(--secondary-foreground)",
          },
        };
        const v = variants[variant] || variants.gray;
        return /*#__PURE__*/ React.createElement(
          "span",
          _extends(
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                borderRadius: "var(--radius-pill)",
                padding: "3px 11px",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 600,
                ...v,
                ...style,
              },
            },
            props,
          ),
          dot &&
            /*#__PURE__*/ React.createElement("span", {
              style: {
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "currentColor",
              },
            }),
          children,
        );
      }
      Object.assign(__ds_scope, { StatusBadge });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/StatusBadge.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/forms/Input.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe Input — text field with optional leading icon and label. Focus
       * ring follows --primary. Used across auth, CRUD modals, quick input.
       */
      function Input({
        label,
        iconStart,
        iconEnd,
        error,
        className,
        style,
        id,
        ...props
      }) {
        const [focus, setFocus] = React.useState(false);
        const inputId = id || React.useId();
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 6,
              ...style,
            },
          },
          label &&
            /*#__PURE__*/ React.createElement(
              "label",
              {
                htmlFor: inputId,
                style: {
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--foreground)",
                },
              },
              label,
            ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                position: "relative",
                display: "flex",
                alignItems: "center",
              },
            },
            iconStart &&
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    position: "absolute",
                    left: 12,
                    display: "flex",
                    color: "var(--muted-foreground)",
                    pointerEvents: "none",
                  },
                },
                iconStart,
              ),
            /*#__PURE__*/ React.createElement(
              "input",
              _extends(
                {
                  id: inputId,
                  onFocus: (e) => {
                    setFocus(true);
                    props.onFocus?.(e);
                  },
                  onBlur: (e) => {
                    setFocus(false);
                    props.onBlur?.(e);
                  },
                  style: {
                    width: "100%",
                    height: 38,
                    padding: `0 ${iconEnd ? 38 : 12}px 0 ${iconStart ? 36 : 12}px`,
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${error ? "var(--destructive)" : focus ? "var(--primary)" : "var(--input)"}`,
                    background: "var(--card)",
                    color: "var(--foreground)",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    outline: "none",
                    boxShadow: focus
                      ? `0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent)`
                      : "none",
                    transition: "border-color .15s, box-shadow .15s",
                  },
                },
                props,
              ),
            ),
            iconEnd &&
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    position: "absolute",
                    right: 12,
                    display: "flex",
                    color: "var(--muted-foreground)",
                  },
                },
                iconEnd,
              ),
          ),
          error &&
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-sans)",
                  fontSize: 11,
                  color: "var(--destructive)",
                },
              },
              error,
            ),
        );
      }
      Object.assign(__ds_scope, { Input });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/forms/Input.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/forms/Select.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe Select — native-backed select styled to match Input. Optional
       * label. Chevron drawn with CSS. Focus ring follows --primary.
       */
      function Select({
        label,
        options = [],
        placeholder,
        error,
        style,
        id,
        children,
        ...props
      }) {
        const [focus, setFocus] = React.useState(false);
        const selectId = id || React.useId();
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 6,
              ...style,
            },
          },
          label &&
            /*#__PURE__*/ React.createElement(
              "label",
              {
                htmlFor: selectId,
                style: {
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--foreground)",
                },
              },
              label,
            ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                position: "relative",
                display: "flex",
                alignItems: "center",
              },
            },
            /*#__PURE__*/ React.createElement(
              "select",
              _extends(
                {
                  id: selectId,
                  onFocus: () => setFocus(true),
                  onBlur: () => setFocus(false),
                  style: {
                    width: "100%",
                    height: 38,
                    padding: "0 34px 0 12px",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${error ? "var(--destructive)" : focus ? "var(--primary)" : "var(--input)"}`,
                    background: "var(--card)",
                    color: "var(--foreground)",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    outline: "none",
                    appearance: "none",
                    cursor: "pointer",
                    boxShadow: focus
                      ? `0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent)`
                      : "none",
                    transition: "border-color .15s, box-shadow .15s",
                  },
                },
                props,
              ),
              placeholder &&
                /*#__PURE__*/ React.createElement(
                  "option",
                  {
                    value: "",
                  },
                  placeholder,
                ),
              options.map((o) => {
                const opt =
                  typeof o === "string"
                    ? {
                        value: o,
                        label: o,
                      }
                    : o;
                return /*#__PURE__*/ React.createElement(
                  "option",
                  {
                    key: opt.value,
                    value: opt.value,
                  },
                  opt.label,
                );
              }),
              children,
            ),
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  position: "absolute",
                  right: 12,
                  pointerEvents: "none",
                  color: "var(--muted-foreground)",
                  fontSize: 11,
                },
              },
              "\u25BE",
            ),
          ),
          error &&
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-sans)",
                  fontSize: 11,
                  color: "var(--destructive)",
                },
              },
              error,
            ),
        );
      }
      Object.assign(__ds_scope, { Select });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/forms/Select.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/forms/Switch.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe Switch — compact toggle. On = --primary track. Used in settings,
       * theme toggle, masking balances, notification preferences.
       */
      function Switch({
        checked,
        defaultChecked = false,
        onCheckedChange,
        disabled = false,
        style,
        ...props
      }) {
        const [internal, setInternal] = React.useState(defaultChecked);
        const isOn = checked !== undefined ? checked : internal;
        const toggle = () => {
          if (disabled) return;
          if (checked === undefined) setInternal(!isOn);
          onCheckedChange?.(!isOn);
        };
        return /*#__PURE__*/ React.createElement(
          "button",
          _extends(
            {
              type: "button",
              role: "switch",
              "aria-checked": isOn,
              disabled: disabled,
              onClick: toggle,
              style: {
                position: "relative",
                width: 38,
                height: 22,
                flexShrink: 0,
                borderRadius: "var(--radius-pill)",
                border: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                background: isOn ? "var(--primary)" : "var(--border)",
                transition: "background .2s",
                padding: 0,
                ...style,
              },
            },
            props,
          ),
          /*#__PURE__*/ React.createElement("span", {
            style: {
              position: "absolute",
              top: 2,
              left: isOn ? 18 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,.25)",
              transition: "left .2s",
            },
          }),
        );
      }
      Object.assign(__ds_scope, { Switch });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/forms/Switch.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/surfaces/Card.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe Card — the base surface. White (or tinted dark) panel with a soft
       * 1px foreground ring instead of a heavy shadow. 14px radius. Most app
       * surfaces are built on this.
       */
      function Card({ padding = 16, className, style, children, ...props }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          _extends(
            {
              style: {
                background: "var(--card)",
                color: "var(--card-foreground)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--ring-card)",
                padding,
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                ...style,
              },
            },
            props,
          ),
          children,
        );
      }
      Object.assign(__ds_scope, { Card });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/surfaces/Card.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/surfaces/HeroCard.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe HeroCard — gradient "wealth" surface for net-worth / totals. White
       * text on an indigo gradient with a soft top-right glow ring. Pair with
       * gradient class names (gradient-wealth / gradient-profile / gradient-ai).
       */
      function HeroCard({
        gradient = "gradient-wealth",
        padding = 22,
        className,
        style,
        children,
        ...props
      }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          _extends(
            {
              className: gradient + (className ? " " + className : ""),
              style: {
                position: "relative",
                overflow: "hidden",
                borderRadius: "var(--radius-lg)",
                padding,
                color: "#fff",
                fontFamily: "var(--font-sans)",
                ...style,
              },
            },
            props,
          ),
          /*#__PURE__*/ React.createElement("div", {
            style: {
              position: "absolute",
              top: -48,
              right: -48,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "rgba(255,255,255,.06)",
              pointerEvents: "none",
            },
          }),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                position: "relative",
              },
            },
            children,
          ),
        );
      }
      Object.assign(__ds_scope, { HeroCard });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/surfaces/HeroCard.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/surfaces/MoneyStat.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe MoneyStat — label over an extrabold value. The atomic money
       * read-out used in cashflow rows, account headers, report KPIs.
       */
      function MoneyStat({
        label,
        value,
        valueColor = "var(--foreground)",
        size = 17,
        align = "left",
        style,
        ...props
      }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          _extends(
            {
              style: {
                textAlign: align,
                fontFamily: "var(--font-sans)",
                ...style,
              },
            },
            props,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginBottom: 3,
                fontSize: 11,
                color: "var(--muted-foreground)",
              },
            },
            label,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: size,
                fontWeight: 800,
                color: valueColor,
              },
            },
            value,
          ),
        );
      }
      Object.assign(__ds_scope, { MoneyStat });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/surfaces/MoneyStat.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/surfaces/SectionCard.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe SectionCard — titled content card. Muted bold title on the left,
       * optional action (link / select) on the right, body below. The workhorse
       * dashboard panel.
       */
      function SectionCard({
        title,
        action,
        padding = 20,
        className,
        style,
        bodyStyle,
        children,
        ...props
      }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          _extends(
            {
              style: {
                background: "var(--card)",
                color: "var(--card-foreground)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--ring-card)",
                padding,
                fontFamily: "var(--font-sans)",
                ...style,
              },
            },
            props,
          ),
          (title || action) &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 14,
                },
              },
              title &&
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: "var(--muted-foreground)",
                    },
                  },
                  title,
                ),
              action,
            ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: bodyStyle,
            },
            children,
          ),
        );
      }
      Object.assign(__ds_scope, { SectionCard });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/surfaces/SectionCard.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/surfaces/SummaryCard.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * WealthMe SummaryCard — small KPI tile: tinted icon chip, label, extrabold
       * amount, and an optional up/down delta. The 5-across row on the dashboard.
       */
      function SummaryCard({
        icon,
        iconBg = "var(--secondary)",
        iconColor,
        label,
        amount,
        delta,
        deltaUp = true,
        style,
        ...props
      }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          _extends(
            {
              style: {
                background: "var(--card)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--ring-card)",
                padding: 16,
                fontFamily: "var(--font-sans)",
                ...style,
              },
            },
            props,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                width: 34,
                height: 34,
                marginBottom: 8,
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                background: iconBg,
                color: iconColor,
              },
            },
            icon,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginBottom: 2,
                fontSize: 10.5,
                fontWeight: 500,
                color: "var(--muted-foreground)",
              },
            },
            label,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginBottom: 3,
                fontSize: 15,
                fontWeight: 800,
                color: "var(--foreground)",
              },
            },
            amount,
          ),
          delta != null &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: deltaUp ? "var(--success)" : "var(--destructive)",
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                null,
                deltaUp ? "▲" : "▼",
              ),
              delta,
            ),
        );
      }
      Object.assign(__ds_scope, { SummaryCard });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/surfaces/SummaryCard.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/app.jsx
  try {
    (() => {
      /* WealthMe UI-kit — root app: login gate + shell + screen routing. */
      function App() {
        const { Sidebar, Topbar } = window.WMShell;
        const [authed, setAuthed] = React.useState(true);
        const [active, setActive] = React.useState("beranda");
        const [dark, setDark] = React.useState(false);
        React.useEffect(() => {
          document.documentElement.classList.toggle("dark", dark);
        }, [dark]);
        if (!authed)
          return /*#__PURE__*/ React.createElement(window.ScreenLogin, {
            onLogin: () => setAuthed(true),
          });
        const SCREENS = {
          beranda: window.ScreenBeranda,
          ringkasan: window.ScreenRingkasan,
          laporan: window.ScreenLaporan,
          transaksi: window.ScreenTransaksi,
          anggaran: window.ScreenAnggaran,
          tujuan: window.ScreenTujuan,
          dana: window.ScreenDana,
          rekening: window.ScreenRekening,
          investasi: window.ScreenInvestasi,
          aset: window.ScreenAset,
          liabilitas: window.ScreenLiabilitas,
          asuransi: window.ScreenAsuransi,
          warisan: window.ScreenWarisan,
          donation: window.ScreenDonation,
          tax: window.ScreenTax,
          splitbill: window.ScreenSplitbill,
          rekonsiliasi: window.ScreenRekonsiliasi,
          kalkulator: window.ScreenKalkulator,
          notifikasi: window.ScreenNotifikasi,
          quickinput: window.ScreenQuickinput,
          masterdata: window.ScreenMasterdata,
          akun: window.ScreenAkun,
          ai: window.ScreenAI,
        };
        const Screen = SCREENS[active] || Placeholder;
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              height: "100vh",
              overflow: "hidden",
              background: "var(--background)",
            },
          },
          /*#__PURE__*/ React.createElement(Sidebar, {
            active: active,
            onNavigate: (id) => setActive(id),
            onAddTxn: () => setActive("quickinput"),
          }),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              },
            },
            /*#__PURE__*/ React.createElement(Topbar, {
              active: active,
              dark: dark,
              onToggleTheme: () => setDark((d) => !d),
              onSearch: () => {},
              onLogout: () => setAuthed(false),
            }),
            /*#__PURE__*/ React.createElement(
              "main",
              {
                className: "hide-scrollbar",
                style: {
                  flex: 1,
                  overflowY: "auto",
                  padding: 24,
                },
              },
              /*#__PURE__*/ React.createElement(Screen, {
                onNavigate: (id) => setActive(id),
                onLogout: () => setAuthed(false),
              }),
            ),
          ),
        );
      }
      ReactDOM.createRoot(document.getElementById("root")).render(
        /*#__PURE__*/ React.createElement(App, null),
      );

      /* Friendly placeholder for nav items not recreated in this UI kit. */
      function Placeholder() {
        const Icon = window.WMIcon;
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "80px 24px",
              textAlign: "center",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                width: 64,
                height: 64,
                borderRadius: 18,
                background: "var(--accent)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            /*#__PURE__*/ React.createElement(Icon, {
              name: "LayoutDashboard",
              size: 28,
              color: "var(--primary)",
            }),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: 16,
                fontWeight: 700,
              },
            },
            "Halaman ini belum direkreasi di UI kit",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: 13,
                color: "var(--muted-foreground)",
                maxWidth: 360,
              },
            },
            "Semua menu utama sudah tersedia. Jika kamu melihat ini, halaman tersebut memang sengaja dibiarkan kosong.",
          ),
        );
      }
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/app.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/data.js
  try {
    (() => {
      /* WealthMe UI-kit — mock data + Rupiah formatting (id-ID). Plain globals. */
      (function () {
        function formatRupiah(v) {
          return "Rp " + Math.round(v).toLocaleString("id-ID");
        }
        function formatCompact(v) {
          if (v >= 1e9)
            return "Rp " + (v / 1e9).toFixed(2).replace(".", ",") + " M";
          if (v >= 1e6)
            return "Rp " + (v / 1e6).toFixed(2).replace(".", ",") + " jt";
          if (v >= 1e3) return "Rp " + (v / 1e3).toFixed(0) + " rb";
          return formatRupiah(v);
        }
        window.WM = {
          formatRupiah,
          formatCompact,
          user: {
            name: "Andra Rijaldi",
            email: "andra@wealthme.id",
            initials: "AR",
          },
          netWorth: 2847500000,
          monthNet: 42300000,
          savingsRate: 38,
          sparkline: [
            40, 42, 41, 39, 44, 46, 45, 49, 48, 52, 51, 55, 54, 58, 57, 60, 59,
            63, 62, 66, 65, 68, 67, 71, 70, 73, 72, 76, 78, 82,
          ],
          allocation: [
            {
              label: "Investasi",
              value: 45,
              color: "var(--chart-1)",
              amount: 1281375000,
            },
            {
              label: "Properti",
              value: 30,
              color: "var(--chart-2)",
              amount: 854250000,
            },
            {
              label: "Kas & Bank",
              value: 17,
              color: "var(--chart-3)",
              amount: 484075000,
            },
            {
              label: "Lainnya",
              value: 8,
              color: "var(--chart-4)",
              amount: 227800000,
            },
          ],
          summary: [
            {
              icon: "🏦",
              iconBg: "#DBEAFE",
              label: "Rekening Bank",
              amount: 312000000,
              delta: "4,2%",
              up: true,
            },
            {
              icon: "💵",
              iconBg: "#DCFCE7",
              label: "E-Wallet & Kas",
              amount: 28500000,
              delta: "1,1%",
              up: true,
            },
            {
              icon: "📈",
              iconBg: "#EDE9FE",
              label: "Investasi",
              amount: 1281375000,
              delta: "1,8%",
              up: true,
            },
            {
              icon: "🏠",
              iconBg: "#FEF9C3",
              label: "Properti",
              amount: 854250000,
              delta: "0,4%",
              up: true,
            },
            {
              icon: "💳",
              iconBg: "#FEE2E2",
              label: "Liabilitas",
              amount: 180000000,
              delta: "2,1%",
              up: false,
            },
          ],
          cashflow: {
            months: ["Feb", "Mar", "Apr", "Mei", "Jun"],
            income: [16.2, 17.8, 16.9, 18.4, 17.6],
            expense: [11.4, 10.2, 12.1, 11.2, 9.8],
            max: 20,
          },
          monthIncome: 18400000,
          monthExpense: 11200000,
          activities: [
            {
              icon: "📥",
              iconBg: "#DCFCE7",
              name: "Gaji Bulanan",
              cat: "Pemasukan · BCA Utama",
              amt: 18400000,
              inc: true,
              date: "Hari ini",
            },
            {
              icon: "💳",
              iconBg: "#FEE2E2",
              name: "Belanja Bulanan",
              cat: "Kebutuhan · GoPay",
              amt: 1250000,
              inc: false,
              date: "Kemarin",
            },
            {
              icon: "🔄",
              iconBg: "#EDE9FE",
              name: "Top-up Reksadana",
              cat: "Investasi · Bibit",
              amt: 5000000,
              inc: false,
              date: "12 Jun",
            },
            {
              icon: "💳",
              iconBg: "#FEE2E2",
              name: "Cicilan KPR",
              cat: "Liabilitas · Mandiri",
              amt: 4200000,
              inc: false,
              date: "10 Jun",
            },
          ],
          goals: [
            {
              icon: "🎓",
              iconBg: "#DBEAFE",
              name: "Pendidikan Anak",
              pct: 72,
              color: "var(--primary)",
              now: 720000000,
              target: 1000000000,
              status: "On track",
            },
            {
              icon: "🏖️",
              iconBg: "#DCFCE7",
              name: "Dana Pensiun",
              pct: 44,
              color: "var(--success)",
              now: 880000000,
              target: 2000000000,
              status: "On track",
            },
            {
              icon: "🚗",
              iconBg: "#FEF9C3",
              name: "Ganti Mobil",
              pct: 28,
              color: "var(--warning)",
              now: 140000000,
              target: 500000000,
              status: "Needs boost",
            },
          ],
          assets: [
            {
              name: "Rumah Tinggal — BSD",
              type: "Properti",
              typeColor: "warning",
              value: 1450000000,
              change: 6.2,
              up: true,
              icon: "🏠",
            },
            {
              name: "Reksadana Saham — Bibit",
              type: "Investasi",
              typeColor: "purple",
              value: 642000000,
              change: 12.4,
              up: true,
              icon: "📈",
            },
            {
              name: "Emas Antam 250g",
              type: "Komoditas",
              typeColor: "info",
              value: 312500000,
              change: 3.1,
              up: true,
              icon: "🪙",
            },
            {
              name: "Saham BBCA — 1.200 lot",
              type: "Investasi",
              typeColor: "purple",
              value: 327375000,
              change: -1.8,
              up: false,
              icon: "📊",
            },
            {
              name: "Deposito Berjangka — BCA",
              type: "Kas & Bank",
              typeColor: "success",
              value: 200000000,
              change: 0.5,
              up: true,
              icon: "🏦",
            },
            {
              name: "Apartemen — Sewa",
              type: "Properti",
              typeColor: "warning",
              value: 720000000,
              change: 4.0,
              up: true,
              icon: "🏢",
            },
          ],
          aiChat: [
            {
              role: "ai",
              text: "Halo Andra 👋 Kekayaan bersihmu naik 1,5% bulan ini. Mau aku bantu review alokasi investasi?",
            },
            {
              role: "user",
              text: "Iya, porsi properti kelihatannya terlalu besar ya?",
            },
            {
              role: "ai",
              text: "Betul — properti menyumbang 30% dari total aset. Untuk profil pertumbuhan, idealnya 20–25%. Pertimbangkan menambah reksadana saham atau obligasi ritel agar lebih likuid dan terdiversifikasi.",
            },
          ],
          aiSuggestions: [
            "Bagaimana progres dana pensiun?",
            "Hitung dana darurat ideal",
            "Review pengeluaran bulan ini",
          ],
        };

        /* ── Page-specific mock data ── */
        Object.assign(window.WM, {
          txn: {
            income: 18400000,
            expense: 11250000,
            net: 7150000,
            filters: ["Semua", "Masuk", "Keluar", "Transfer", "Kartu Kredit"],
            groups: [
              {
                day: "Hari ini",
                rows: [
                  {
                    name: "Gaji Bulanan",
                    sub: "Pemasukan · BCA Utama",
                    amt: 18400000,
                    inc: true,
                    type: "income",
                    time: "08:12",
                  },
                  {
                    name: "Kopi & Sarapan",
                    sub: "Makan · GoPay",
                    amt: 78000,
                    inc: false,
                    type: "expense",
                    time: "09:40",
                  },
                ],
              },
              {
                day: "Kemarin",
                rows: [
                  {
                    name: "Belanja Bulanan",
                    sub: "Kebutuhan · Kartu Kredit BCA",
                    amt: 1250000,
                    inc: false,
                    type: "credit",
                    time: "19:05",
                  },
                  {
                    name: "Transfer ke Tabungan",
                    sub: "Transfer · Mandiri",
                    amt: 3000000,
                    inc: false,
                    type: "transfer",
                    time: "14:22",
                  },
                  {
                    name: "Cashback Belanja",
                    sub: "Pemasukan · GoPay",
                    amt: 35000,
                    inc: true,
                    type: "income",
                    time: "19:06",
                  },
                ],
              },
              {
                day: "12 Juni 2026",
                rows: [
                  {
                    name: "Top-up Reksadana",
                    sub: "Investasi · Bibit",
                    amt: 5000000,
                    inc: false,
                    type: "transfer",
                    time: "10:00",
                  },
                  {
                    name: "Cicilan KPR",
                    sub: "Liabilitas · Mandiri",
                    amt: 4200000,
                    inc: false,
                    type: "expense",
                    time: "07:30",
                  },
                  {
                    name: "Langganan Streaming",
                    sub: "Hiburan · Kartu Kredit BCA",
                    amt: 186000,
                    inc: false,
                    type: "credit",
                    time: "00:01",
                  },
                ],
              },
            ],
          },
          invest: {
            totalValue: 1281375000,
            totalReturnPct: 18.4,
            totalReturnRp: 199375000,
            todayRp: 4820000,
            todayPct: 0.38,
            holdings: [
              {
                ticker: "BBCA",
                name: "Bank Central Asia",
                type: "saham",
                badge: "Saham",
                badgeVar: "info",
                logoBg: "#0061AF",
                modal: 280000000,
                nilai: 327375000,
                returnRp: 47375000,
                returnPct: 16.9,
                up: true,
              },
              {
                ticker: "TLKM",
                name: "Telkom Indonesia",
                type: "saham",
                badge: "Saham",
                badgeVar: "info",
                logoBg: "#E60000",
                modal: 95000000,
                nilai: 88200000,
                returnRp: -6800000,
                returnPct: -7.2,
                up: false,
              },
              {
                ticker: "BIBIT",
                name: "Reksa Dana Saham — Bibit",
                type: "reksa_dana",
                badge: "Reksa Dana",
                badgeVar: "purple",
                logoBg: "#7C3AED",
                modal: 420000000,
                nilai: 512400000,
                returnRp: 92400000,
                returnPct: 22.0,
                up: true,
              },
              {
                ticker: "FR0090",
                name: "Obligasi Ritel ORI025",
                type: "obligasi",
                badge: "Obligasi",
                badgeVar: "success",
                logoBg: "#1E3A5F",
                modal: 150000000,
                nilai: 158900000,
                returnRp: 8900000,
                returnPct: 5.9,
                up: true,
              },
              {
                ticker: "ANTM",
                name: "Emas Antam 250g",
                type: "emas",
                badge: "Emas",
                badgeVar: "warning",
                logoBg: "#D97706",
                modal: 137000000,
                nilai: 194500000,
                returnRp: 57500000,
                returnPct: 42.0,
                up: true,
              },
            ],
          },
          liabilities: {
            totalRemaining: 180000000,
            dtaRatio: 6.3,
            dtaLabel: "Sangat Aman",
            dtaColor: "var(--success)",
            items: [
              {
                name: "Kartu Kredit BCA",
                inst: "BCA · Kartu Kredit",
                isCC: true,
                remaining: 8200000,
                total: 30000000,
                minPay: 800000,
                interest: "2,25",
                progress: 27,
                progressLabel: "Penggunaan Limit",
                status: {
                  text: "Jatuh Tempo 25 Jun",
                  variant: "warning",
                },
              },
              {
                name: "KPR Rumah BSD",
                inst: "Mandiri · KPR",
                isCC: false,
                remaining: 142000000,
                total: 320000000,
                minPay: 4200000,
                interest: "7,5",
                progress: 56,
                progressLabel: "Progres Pelunasan",
                status: {
                  text: "Berjalan",
                  variant: "success",
                },
              },
              {
                name: "Kredit Kendaraan",
                inst: "BCA Finance · Kendaraan",
                isCC: false,
                remaining: 29800000,
                total: 85000000,
                minPay: 2350000,
                interest: "5,1",
                progress: 65,
                progressLabel: "Progres Pelunasan",
                status: {
                  text: "Berjalan",
                  variant: "success",
                },
              },
            ],
          },
          budget: {
            month: "Juni 2026",
            totalLimit: 14000000,
            totalSpent: 9180000,
            totalRemaining: 4820000,
            usagePct: 66,
            daysLeft: 10,
            daysInMonth: 30,
            items: [
              {
                name: "Kebutuhan Rumah",
                icon: "Home",
                bg: "#DBEAFE",
                fg: "#2563EB",
                spent: 3850000,
                limit: 4500000,
                pct: 86,
                over: false,
                near: true,
              },
              {
                name: "Makan & Minum",
                icon: "Utensils",
                bg: "#FEF9C3",
                fg: "#CA8A04",
                spent: 2680000,
                limit: 3000000,
                pct: 89,
                over: false,
                near: true,
              },
              {
                name: "Transportasi",
                icon: "Car",
                bg: "#DCFCE7",
                fg: "#16A34A",
                spent: 980000,
                limit: 1500000,
                pct: 65,
                over: false,
                near: false,
              },
              {
                name: "Hiburan",
                icon: "Clapperboard",
                bg: "#EDE9FE",
                fg: "#7C3AED",
                spent: 920000,
                limit: 800000,
                pct: 115,
                over: true,
                near: false,
              },
              {
                name: "Pendidikan Anak",
                icon: "GraduationCap",
                bg: "#E0F2FE",
                fg: "#0284C7",
                spent: 750000,
                limit: 4200000,
                pct: 18,
                over: false,
                near: false,
              },
            ],
          },
          goalsFull: [
            {
              name: "Pendidikan Anak",
              icon: "GraduationCap",
              bg: "#DBEAFE",
              fg: "#2563EB",
              status: "On Track",
              variant: "info",
              color: "var(--primary)",
              pct: 72,
              current: 720000000,
              target: 1000000000,
              remaining: 280000000,
              autoDebit: 5000000,
              targetDate: "Januari 2030",
            },
            {
              name: "Dana Pensiun",
              icon: "Plane",
              bg: "#DCFCE7",
              fg: "#16A34A",
              status: "On Track",
              variant: "success",
              color: "var(--success)",
              pct: 44,
              current: 880000000,
              target: 2000000000,
              remaining: 1120000000,
              autoDebit: 8000000,
              targetDate: "Desember 2045",
            },
            {
              name: "Ganti Mobil",
              icon: "Car",
              bg: "#FEF9C3",
              fg: "#CA8A04",
              status: "Perlu Boost",
              variant: "warning",
              color: "var(--warning)",
              pct: 28,
              current: 140000000,
              target: 500000000,
              remaining: 360000000,
              autoDebit: 2000000,
              targetDate: "Juni 2028",
            },
            {
              name: "Dana Darurat",
              icon: "ShieldCheck",
              bg: "#EDE9FE",
              fg: "#7C3AED",
              status: "Berisiko",
              variant: "purple",
              color: "var(--brand-purple)",
              pct: 15,
              current: 30000000,
              target: 200000000,
              remaining: 170000000,
              autoDebit: null,
              targetDate: "Tanpa target",
            },
          ],
        });

        /* ── Batch 2A data ── */
        Object.assign(window.WM, {
          ringkasan: {
            totalAssets: 3027500000,
            totalLiabilities: 180000000,
            savingsRate: 38,
            trend: [1.92, 2.05, 2.18, 2.34, 2.61, 2.85],
            trendMonths: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"],
            topExpenses: [
              {
                name: "Kebutuhan Rumah",
                icon: "Home",
                bg: "#DBEAFE",
                fg: "#2563EB",
                pct: 34,
                amt: 3850000,
              },
              {
                name: "Makan & Minum",
                icon: "Utensils",
                bg: "#FEF9C3",
                fg: "#CA8A04",
                pct: 24,
                amt: 2680000,
              },
              {
                name: "Transportasi",
                icon: "Car",
                bg: "#DCFCE7",
                fg: "#16A34A",
                pct: 12,
                amt: 1320000,
              },
              {
                name: "Kesehatan",
                icon: "HeartPulse",
                bg: "#FEE2E2",
                fg: "#DC2626",
                pct: 9,
                amt: 980000,
              },
              {
                name: "Utilitas",
                icon: "Zap",
                bg: "#EDE9FE",
                fg: "#7C3AED",
                pct: 8,
                amt: 880000,
              },
            ],
          },
          dana: {
            total: 56500000,
            cash: [
              {
                name: "Dompet Tunai",
                sub: "Cash di tangan",
                balance: 2500000,
                icon: "Wallet",
                bg: "#EEF2FF",
                fg: "#4F46E5",
              },
            ],
            ewallet: [
              {
                name: "GoPay",
                sub: "0812-xxxx-3344",
                balance: 18400000,
                icon: "Smartphone",
                bg: "#DCFCE7",
                fg: "#16A34A",
              },
              {
                name: "OVO",
                sub: "0812-xxxx-3344",
                balance: 12600000,
                icon: "Smartphone",
                bg: "#EDE9FE",
                fg: "#7C3AED",
              },
              {
                name: "DANA",
                sub: "0812-xxxx-3344",
                balance: 23000000,
                icon: "Smartphone",
                bg: "#DBEAFE",
                fg: "#118EEA",
              },
            ],
          },
          rekening: {
            total: 312000000,
            usd: 19200,
            accounts: [
              {
                logo: "BCA",
                logoBg: "#0066AE",
                name: "BCA Tahapan",
                number: "•••• 4821",
                balance: 184000000,
                type: "Tabungan · BCA",
              },
              {
                logo: "MDR",
                logoBg: "#003D79",
                name: "Mandiri Payroll",
                number: "•••• 7733",
                balance: 86000000,
                type: "Tabungan · Mandiri",
              },
              {
                logo: "BNI",
                logoBg: "#F05A22",
                name: "BNI Taplus",
                number: "•••• 1290",
                balance: 42000000,
                type: "Tabungan · BNI",
              },
            ],
          },
          asuransi: {
            activePolicies: 3,
            totalMonthlyPremium: 2350000,
            policies: [
              {
                name: "Asuransi Jiwa Keluarga",
                provider: "Prudential",
                typeLabel: "Asuransi Jiwa",
                icon: "ShieldCheck",
                bg: "#EDE9FE",
                fg: "#7C3AED",
                status: "Aktif",
                statusVar: "success",
                coverage: 2000000000,
                premium: 1200000,
                period: "/bln",
                renewal: "12 Sep 2026",
                days: 84,
                daysVar: "success",
                policyNo: "POL-7781234",
              },
              {
                name: "Asuransi Kesehatan Cashless",
                provider: "AXA Mandiri",
                typeLabel: "Asuransi Kesehatan",
                icon: "HeartPulse",
                bg: "#DCFCE7",
                fg: "#16A34A",
                status: "Aktif",
                statusVar: "success",
                coverage: 750000000,
                premium: 850000,
                period: "/bln",
                renewal: "30 Jun 2026",
                days: 10,
                daysVar: "warning",
                policyNo: "POL-5520988",
              },
              {
                name: "Asuransi Kendaraan All Risk",
                provider: "Allianz",
                typeLabel: "Asuransi Kendaraan",
                icon: "Car",
                bg: "#DBEAFE",
                fg: "#2563EB",
                status: "Aktif",
                statusVar: "success",
                coverage: 420000000,
                premium: 300000,
                period: "/bln",
                renewal: "5 Agu 2026",
                days: 46,
                daysVar: "success",
                policyNo: "POL-3391040",
              },
            ],
          },
        });

        /* ── Batch 2B data ── */
        Object.assign(window.WM, {
          warisan: {
            total: 2855000000,
            assetCount: 6,
            heirs: 2,
            groups: [
              {
                type: "Aset / Properti",
                icon: "House",
                bg: "#FEF9C3",
                fg: "#CA8A04",
                items: [
                  {
                    name: "Rumah Utama — BSD",
                    sub: "SHM No. 1234 · Sarah (50%), Bima (50%)",
                    value: 1450000000,
                    visible: true,
                  },
                  {
                    name: "Ruko Disewakan — BSD",
                    sub: "SHM No. 5521 · Sarah (100%)",
                    value: 720000000,
                    visible: true,
                  },
                ],
              },
              {
                type: "Cash / Tunai",
                icon: "Banknote",
                bg: "#DCFCE7",
                fg: "#16A34A",
                items: [
                  {
                    name: "Deposito Berjangka — BCA",
                    sub: "Bilyet 0098 · Bima (100%)",
                    value: 200000000,
                    visible: true,
                  },
                ],
              },
              {
                type: "Surat Berharga",
                icon: "ScrollText",
                bg: "#DBEAFE",
                fg: "#2563EB",
                items: [
                  {
                    name: "Obligasi Ritel ORI025",
                    sub: "Sarah (50%), Bima (50%)",
                    value: 158000000,
                    visible: false,
                  },
                ],
              },
              {
                type: "Saham",
                icon: "TrendingUp",
                bg: "#EDE9FE",
                fg: "#7C3AED",
                items: [
                  {
                    name: "Portofolio Saham — BCA Sekuritas",
                    sub: "Bima (100%)",
                    value: 327000000,
                    visible: true,
                  },
                ],
              },
            ],
          },
          donation: {
            total: 47787000,
            calc: {
              cash: 339450000,
              gold: 50000000,
              invest: 577200000,
              debt: 15170000,
              nisab: 102000000,
            },
            txns: [
              {
                type: "Zakat Maal",
                recipient: "BAZNAS",
                date: "12 Jun 2026",
                amt: 23787000,
                taxDeduct: true,
                icon: "Landmark",
                bg: "#DCFCE7",
                fg: "#16A34A",
              },
              {
                type: "Sedekah / Infak",
                recipient: "LAZ Masjid Al-Ikhlas",
                date: "1 Jun 2026",
                amt: 2000000,
                taxDeduct: false,
                icon: "HandHeart",
                bg: "#DBEAFE",
                fg: "#2563EB",
              },
              {
                type: "Wakaf",
                recipient: "Dompet Dhuafa",
                date: "20 Mei 2026",
                amt: 20000000,
                taxDeduct: true,
                icon: "School",
                bg: "#EDE9FE",
                fg: "#7C3AED",
              },
              {
                type: "Sedekah",
                recipient: "Yayasan Sosial Peduli",
                date: "8 Mei 2026",
                amt: 2000000,
                taxDeduct: false,
                icon: "Heart",
                bg: "#FEF9C3",
                fg: "#CA8A04",
              },
            ],
          },
          tax: {
            year: 2026,
            calc: {
              gross: 300000000,
              ptkp: 54000000,
              zakat: 23787000,
            },
            ptkpOptions: [
              {
                value: 54000000,
                label: "TK/0 (Lajang)",
              },
              {
                value: 58500000,
                label: "K/0 (Kawin)",
              },
              {
                value: 63000000,
                label: "K/1 (Kawin, 1 anak)",
              },
              {
                value: 67500000,
                label: "K/2 (Kawin, 2 anak)",
              },
              {
                value: 72000000,
                label: "K/3 (Kawin, 3 anak)",
              },
            ],
            docs: [
              {
                name: "Bukti Potong 1721-A1 (2025)",
                meta: "dari pemberi kerja",
                icon: "FileText",
                bg: "#DBEAFE",
                fg: "#2563EB",
              },
              {
                name: "Bukti Lapor SPT 2025 (BPE)",
                meta: "NTTE: 123456789",
                icon: "CircleCheck",
                bg: "#DCFCE7",
                fg: "#16A34A",
              },
              {
                name: "Bukti Setor Zakat (BAZNAS)",
                meta: "Pengurang penghasilan bruto",
                icon: "Receipt",
                bg: "#FEF9C3",
                fg: "#CA8A04",
              },
            ],
          },
        });

        /* ── Batch 2C data ── */
        Object.assign(window.WM, {
          splitbill: {
            totalDitalangin: 4150000,
            totalTerkumpul: 2490000,
            totalBelum: 1660000,
            activeCount: 2,
            belumCount: 3,
            splits: [
              {
                title: "Makan di Sushi Tei",
                date: "14 Jun 2026",
                people: 5,
                total: 1250000,
                paid: 3,
                pct: 60,
                parts: [
                  {
                    name: "Andi",
                    amt: 250000,
                    paid: true,
                  },
                  {
                    name: "Budi",
                    amt: 250000,
                    paid: true,
                  },
                  {
                    name: "Citra",
                    amt: 250000,
                    paid: true,
                  },
                  {
                    name: "Dani",
                    amt: 250000,
                    paid: false,
                  },
                  {
                    name: "Eka",
                    amt: 250000,
                    paid: false,
                  },
                ],
              },
              {
                title: "Trip Bromo Akhir Pekan",
                date: "8 Jun 2026",
                people: 4,
                total: 2900000,
                paid: 2,
                pct: 50,
                parts: [
                  {
                    name: "Fani",
                    amt: 725000,
                    paid: true,
                  },
                  {
                    name: "Gilang",
                    amt: 725000,
                    paid: true,
                  },
                  {
                    name: "Hana",
                    amt: 725000,
                    paid: false,
                  },
                  {
                    name: "Indra",
                    amt: 725000,
                    paid: false,
                  },
                ],
              },
            ],
          },
          rekonBanks: [
            {
              code: "BCA",
              bg: "#0061AF",
              color: "#fff",
            },
            {
              code: "MDR",
              bg: "#F9A01B",
              color: "#000",
            },
            {
              code: "BNI",
              bg: "#FF6600",
              color: "#fff",
            },
            {
              code: "BRI",
              bg: "#E31937",
              color: "#fff",
            },
            {
              code: "CIMB",
              bg: "#C8282E",
              color: "#fff",
            },
            {
              code: "PRM",
              bg: "#E8002D",
              color: "#fff",
            },
          ],
          rekonEntries: [
            {
              date: "12 Jun",
              desc: "TRSF E-BANKING CR — GAJI",
              amt: 18400000,
              status: "ok",
              match: "Gaji Bulanan",
            },
            {
              date: "11 Jun",
              desc: "DEBIT KARTU — TOKOPEDIA",
              amt: -1250000,
              status: "ok",
              match: "Belanja Bulanan",
            },
            {
              date: "10 Jun",
              desc: "BIAYA ADMIN",
              amt: -15000,
              status: "warn",
              match: "Saran: Biaya Bank",
            },
            {
              date: "9 Jun",
              desc: "TRSF — BIBIT REKSADANA",
              amt: -5000000,
              status: "ok",
              match: "Top-up Reksadana",
            },
            {
              date: "8 Jun",
              desc: "QR PAYMENT — KOPI KENANGAN",
              amt: -42000,
              status: "err",
              match: "Tidak ada padanan",
            },
          ],
        });

        /* ── Batch 2D/2E data ── */
        Object.assign(window.WM, {
          notif: {
            unread: 3,
            items: [
              {
                icon: "TrendingUp",
                bg: "#DCFCE7",
                fg: "#16A34A",
                title: "Reksadana naik 2,4%",
                body: "Portofolio Bibit-mu naik Rp 12,3 jt hari ini. Cek performa terbaru.",
                time: "12 menit lalu",
                unread: true,
              },
              {
                icon: "TriangleAlert",
                bg: "#FEF9C3",
                fg: "#CA8A04",
                title: "Anggaran Hiburan terlampaui",
                body: "Kategori Hiburan sudah 115% dari budget bulan ini.",
                time: "2 jam lalu",
                unread: true,
              },
              {
                icon: "CalendarClock",
                bg: "#FEE2E2",
                fg: "#DC2626",
                title: "Premi asuransi jatuh tempo",
                body: "Asuransi Kesehatan AXA jatuh tempo dalam 10 hari (30 Jun).",
                time: "5 jam lalu",
                unread: true,
              },
              {
                icon: "Banknote",
                bg: "#DBEAFE",
                fg: "#2563EB",
                title: "Gaji masuk",
                body: "Pemasukan Rp 18.400.000 tercatat di BCA Utama.",
                time: "Kemarin",
                unread: false,
              },
              {
                icon: "Target",
                bg: "#EDE9FE",
                fg: "#7C3AED",
                title: "Tujuan Pendidikan Anak 72%",
                body: "Tinggal Rp 280 jt lagi untuk mencapai target. Tetap semangat!",
                time: "2 hari lalu",
                unread: false,
              },
            ],
          },
          quickCards: [
            {
              name: "Transaksi",
              desc: "Pemasukan / pengeluaran",
              icon: "ArrowUpDown",
              bg: "#EEF2FF",
              fg: "#4F46E5",
            },
            {
              name: "Scan Struk",
              desc: "Input via foto bon",
              icon: "Camera",
              bg: "#FEF3C7",
              fg: "#D97706",
            },
            {
              name: "Investasi",
              desc: "Saham, reksa dana, emas",
              icon: "BarChart3",
              bg: "#DCFCE7",
              fg: "#16A34A",
            },
            {
              name: "Rekening",
              desc: "Tambah rekening bank",
              icon: "Landmark",
              bg: "#DBEAFE",
              fg: "#1D4ED8",
            },
            {
              name: "E-Wallet",
              desc: "GoPay, OVO, DANA",
              icon: "Wallet",
              bg: "#DCFCE7",
              fg: "#16A34A",
            },
            {
              name: "Aset",
              desc: "Properti, kendaraan",
              icon: "Briefcase",
              bg: "#FEF9C3",
              fg: "#A16207",
            },
            {
              name: "Liabilitas",
              desc: "Utang & cicilan",
              icon: "ReceiptText",
              bg: "#FEE2E2",
              fg: "#DC2626",
            },
            {
              name: "Asuransi",
              desc: "Tambah polis",
              icon: "ShieldCheck",
              bg: "#EDE9FE",
              fg: "#7C3AED",
            },
            {
              name: "Tujuan",
              desc: "Goal keuangan baru",
              icon: "Target",
              bg: "#CFFAFE",
              fg: "#0E7490",
            },
            {
              name: "Anggaran",
              desc: "Kategori budget",
              icon: "ClipboardList",
              bg: "#EEF2FF",
              fg: "#4F46E5",
            },
            {
              name: "Aset Warisan",
              desc: "Catat warisan",
              icon: "Scroll",
              bg: "#EDE9FE",
              fg: "#7C3AED",
            },
            {
              name: "Donasi",
              desc: "Zakat & sumbangan",
              icon: "HeartHandshake",
              bg: "#DCFCE7",
              fg: "#16A34A",
            },
          ],
          masterGroups: [
            {
              title: "🏷️ Kategori",
              items: [
                "🍔 Makan",
                "🏠 Rumah",
                "🚗 Transport",
                "💼 Gaji",
                "📈 Investasi",
              ],
            },
            {
              title: "🏦 Bank",
              items: ["BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Permata"],
            },
            {
              title: "↕️ Jenis Transaksi",
              items: ["Pemasukan", "Pengeluaran", "Transfer", "Kartu Kredit"],
            },
            {
              title: "📈 Jenis Investasi",
              items: ["Saham", "Reksa Dana", "Obligasi", "Emas", "Crypto"],
            },
            {
              title: "💳 E-Wallet",
              items: ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"],
            },
            {
              title: "🤲 Lembaga Donasi",
              items: [
                "BAZNAS",
                "Dompet Dhuafa",
                "Gereja / Paroki",
                "Pura / Vihara",
              ],
            },
            {
              title: "🏠 Kategori Aset",
              items: ["Properti", "Kendaraan", "Elektronik", "Perhiasan"],
            },
            {
              title: "🛡️ Jenis Asuransi",
              items: ["Jiwa", "Kesehatan", "Kendaraan", "Properti"],
            },
          ],
          family: {
            name: "Keluarga Rijaldi",
            role: "Owner",
            members: 4,
          },
          laporan: {
            monthly: [
              {
                month: "Januari",
                income: 16200000,
                expense: 11400000,
              },
              {
                month: "Februari",
                income: 17800000,
                expense: 10200000,
              },
              {
                month: "Maret",
                income: 16900000,
                expense: 12100000,
              },
              {
                month: "April",
                income: 18400000,
                expense: 11200000,
              },
              {
                month: "Mei",
                income: 17600000,
                expense: 9800000,
              },
              {
                month: "Juni",
                income: 18400000,
                expense: 11200000,
              },
            ],
            pnl: {
              income: [
                {
                  k: "Gaji & Tunjangan",
                  v: 18400000,
                },
                {
                  k: "Hasil Investasi",
                  v: 4820000,
                },
                {
                  k: "Sewa Properti",
                  v: 6000000,
                },
              ],
              expense: [
                {
                  k: "Kebutuhan Rumah",
                  v: 3850000,
                },
                {
                  k: "Cicilan KPR",
                  v: 4200000,
                },
                {
                  k: "Makan & Minum",
                  v: 2680000,
                },
                {
                  k: "Transportasi",
                  v: 980000,
                },
                {
                  k: "Lainnya",
                  v: 1840000,
                },
              ],
            },
            balance: {
              assets: [
                {
                  k: "Kas & Bank",
                  v: 312000000,
                },
                {
                  k: "Investasi",
                  v: 1281375000,
                },
                {
                  k: "Properti",
                  v: 2170000000,
                },
                {
                  k: "Lainnya",
                  v: 312500000,
                },
              ],
              liabilities: [
                {
                  k: "KPR Rumah",
                  v: 142000000,
                },
                {
                  k: "Kartu Kredit",
                  v: 8200000,
                },
                {
                  k: "Kredit Kendaraan",
                  v: 29800000,
                },
              ],
            },
          },
          akunMenu: [
            {
              section: "Akun",
              rows: [
                {
                  icon: "User",
                  bg: "#EEF2FF",
                  fg: "#4F46E5",
                  name: "Profil Saya",
                  sub: "Andra Rijaldi · andra@wealthme.id",
                },
                {
                  icon: "Lock",
                  bg: "#DCFCE7",
                  fg: "#16A34A",
                  name: "Keamanan & Password",
                  sub: "Password, PIN, biometrik",
                },
                {
                  icon: "Landmark",
                  bg: "#DBEAFE",
                  fg: "#1D4ED8",
                  name: "Koneksi Bank & E-Wallet",
                  sub: "BCA, Mandiri, BNI, GoPay, LinkAja",
                },
              ],
            },
            {
              section: "Pengaturan",
              rows: [
                {
                  icon: "Settings",
                  bg: "#F3F4F6",
                  fg: "#64748B",
                  name: "Pengaturan Umum",
                  sub: "Mata uang, bahasa, tema",
                },
                {
                  icon: "Bell",
                  bg: "#FEF9C3",
                  fg: "#CA8A04",
                  name: "Notifikasi",
                  sub: "Atur alert transaksi & pengingat",
                },
                {
                  icon: "ShieldHalf",
                  bg: "#EDE9FE",
                  fg: "#7C3AED",
                  name: "Privasi & Data",
                  sub: "Kelola data & izin akses",
                },
              ],
            },
            {
              section: "Bantuan",
              rows: [
                {
                  icon: "CircleQuestionMark",
                  bg: "#FEE2E2",
                  fg: "#DC2626",
                  name: "Pusat Bantuan",
                  sub: "FAQ, panduan fitur, troubleshoot",
                },
                {
                  icon: "Headset",
                  bg: "#DCFCE7",
                  fg: "#16A34A",
                  name: "Hubungi Kami",
                  sub: "Chat, email, atau telepon support",
                },
                {
                  icon: "Info",
                  bg: "#F3F4F6",
                  fg: "#64748B",
                  name: "Tentang Aplikasi",
                  sub: "Versi, lisensi, kebijakan privasi",
                  right: "v1.0.0",
                },
              ],
            },
          ],
        });
      })();
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/data.js",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/icons.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Lucide icon as a React-managed <svg> (re-render safe). */
      function WMIcon({
        name,
        size = 18,
        stroke = 1.75,
        color = "currentColor",
        style,
      }) {
        const html = React.useMemo(() => {
          const lib = window.lucide;
          if (!lib) return "";
          // lucide UMD exposes icons either under `.icons` or as top-level PascalCase nodes
          const node = (lib.icons && lib.icons[name]) || lib[name];
          if (!Array.isArray(node)) return "";
          // Lucide icon node shape: ["svg", attrs, [[tag, attrs], ...]] — take the inner children.
          const children = Array.isArray(node[2]) ? node[2] : node;
          return children
            .filter((c) => Array.isArray(c))
            .map(([tag, attrs]) => {
              const a = Object.entries(attrs || {})
                .map(([k, v]) => `${k}="${v}"`)
                .join(" ");
              return `<${tag} ${a} />`;
            })
            .join("");
        }, [name]);
        return /*#__PURE__*/ React.createElement("svg", {
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: color,
          strokeWidth: stroke,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: {
            display: "block",
            flexShrink: 0,
            ...style,
          },
          dangerouslySetInnerHTML: {
            __html: html,
          },
        });
      }
      window.WMIcon = WMIcon;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/icons.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/kit-helpers.jsx
  try {
    (() => {
      /* WealthMe UI-kit — shared enhanced helpers (window.WMKit). */
      (function () {
        const R = React;

        /* Count-up easing a number from 0 → target on mount. */
        function useCountUp(target, dur = 1200, deps = []) {
          const [v, setV] = R.useState(0);
          R.useEffect(() => {
            let raf, start;
            const step = (t) => {
              if (!start) start = t;
              const p = Math.min(1, (t - start) / dur);
              setV(target * (1 - Math.pow(1 - p, 3)));
              if (p < 1) raf = requestAnimationFrame(step);
            };
            raf = requestAnimationFrame(step);
            return () => cancelAnimationFrame(raf);
          }, deps); // eslint-disable-line
          return v;
        }

        /* ProgressBar that fills from 0 → value on mount. */
        function AnimatedBar({ value, color, height = 8 }) {
          const { ProgressBar } = window.WealthMeDesignSystem_6818de;
          const [v, setV] = R.useState(0);
          R.useEffect(() => {
            const id = setTimeout(() => setV(value), 120);
            return () => clearTimeout(id);
          }, [value]);
          return R.createElement(ProgressBar, {
            value: v,
            color,
            height,
          });
        }

        /* Tinted Lucide chip. */
        function IconChip({
          name,
          bg,
          fg,
          size = 34,
          iconSize = 17,
          radius = 9,
          style,
        }) {
          const Icon = window.WMIcon;
          return R.createElement(
            "div",
            {
              style: {
                width: size,
                height: size,
                borderRadius: radius,
                background: bg,
                color: fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                ...style,
              },
            },
            R.createElement(Icon, {
              name,
              size: iconSize,
              color: fg,
              stroke: 2,
            }),
          );
        }

        /* Stagger entrance style. */
        function rise(i) {
          return {
            animation: "wm-rise .5s cubic-bezier(.22,.61,.36,1) both",
            animationDelay: i * 70 + "ms",
          };
        }

        /* Card hover-lift handlers. */
        function lift(e, on) {
          e.currentTarget.style.transform = on ? "translateY(-4px)" : "none";
          e.currentTarget.style.boxShadow = on
            ? "0 12px 28px rgba(15,23,42,.10)"
            : "var(--ring-card)";
        }

        /* Plain card shell (no title). */
        function panel(extra) {
          return {
            background: "var(--card)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--ring-card)",
            ...extra,
          };
        }
        window.WMKit = {
          useCountUp,
          AnimatedBar,
          IconChip,
          rise,
          lift,
          panel,
        };
      })();
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/kit-helpers.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-ai.jsx
  try {
    (() => {
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
          setMsgs((m) => [
            ...m,
            {
              role: "user",
              text: content,
            },
          ]);
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
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: 14,
              height: "calc(100vh - 64px - 48px)",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                background: "var(--card)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--ring-card)",
                overflow: "hidden",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "gradient-ai",
                  style: {
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "Bot",
                  size: 19,
                  color: "#fff",
                }),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                null,
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 14,
                      fontWeight: 700,
                    },
                  },
                  "AI Advisor",
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--success)",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    },
                  },
                  /*#__PURE__*/ React.createElement("span", {
                    style: {
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: "var(--success)",
                    },
                  }),
                  "Online \xB7 paham datamu",
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                ref: scrollRef,
                className: "hide-scrollbar",
                style: {
                  flex: 1,
                  overflowY: "auto",
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                },
              },
              msgs.map((m, i) =>
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    key: i,
                    style: {
                      display: "flex",
                      justifyContent:
                        m.role === "user" ? "flex-end" : "flex-start",
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        maxWidth: "76%",
                        display: "flex",
                        gap: 10,
                        flexDirection:
                          m.role === "user" ? "row-reverse" : "row",
                      },
                    },
                    m.role === "ai" &&
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          className: "gradient-ai",
                          style: {
                            width: 30,
                            height: 30,
                            flexShrink: 0,
                            borderRadius: 9,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        },
                        /*#__PURE__*/ React.createElement(Icon, {
                          name: "Bot",
                          size: 15,
                          color: "#fff",
                        }),
                      ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          padding: "10px 14px",
                          borderRadius: 14,
                          fontSize: 13,
                          lineHeight: 1.5,
                          background:
                            m.role === "user"
                              ? "var(--primary)"
                              : "var(--secondary)",
                          color:
                            m.role === "user" ? "#fff" : "var(--foreground)",
                          borderTopRightRadius: m.role === "user" ? 4 : 14,
                          borderTopLeftRadius: m.role === "ai" ? 4 : 14,
                        },
                      },
                      m.text,
                    ),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  padding: 16,
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: 10,
                },
              },
              /*#__PURE__*/ React.createElement("input", {
                value: text,
                onChange: (e) => setText(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter") send();
                },
                placeholder: "Tanya apa saja soal keuanganmu...",
                style: {
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
                },
              }),
              /*#__PURE__*/ React.createElement(
                "button",
                {
                  onClick: () => send(),
                  style: {
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
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "Send",
                  size: 17,
                  color: "#fff",
                }),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                className: "gradient-wealth",
                style: {
                  borderRadius: "var(--radius-lg)",
                  padding: 18,
                  color: "#fff",
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                  },
                },
                "Skor Kesehatan Finansial",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 32,
                    fontWeight: 800,
                    marginTop: 4,
                  },
                },
                "82",
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontSize: 16,
                      opacity: 0.7,
                    },
                  },
                  "/100",
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11.5,
                    marginTop: 4,
                    color: "#6ee7b7",
                    fontWeight: 600,
                  },
                },
                "\u25B2 4 poin dari bulan lalu",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  background: "var(--card)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--ring-card)",
                  padding: 16,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                    marginBottom: 12,
                  },
                },
                "Saran Pertanyaan",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  },
                },
                WM.aiSuggestions.map((s) =>
                  /*#__PURE__*/ React.createElement(
                    "button",
                    {
                      key: s,
                      onClick: () => send(s),
                      style: {
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        fontSize: 12.5,
                        color: "var(--foreground)",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                      },
                    },
                    s,
                  ),
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenAI = ScreenAI;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-ai.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-akun.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Akun (account & settings) screen. */
      function ScreenAkun({ onLogout }) {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, StatusBadge } = DS;
        const { rise, IconChip } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const MenuRow = ({ r, last }) =>
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: last ? "none" : "1px solid var(--border)",
                cursor: "pointer",
              },
              onMouseEnter: (e) => (e.currentTarget.style.opacity = "0.7"),
              onMouseLeave: (e) => (e.currentTarget.style.opacity = "1"),
            },
            /*#__PURE__*/ React.createElement(IconChip, {
              name: r.icon,
              bg: r.bg,
              fg: r.fg,
              size: 36,
              iconSize: 16,
              radius: 10,
            }),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  flex: 1,
                  minWidth: 0,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 13.5,
                    fontWeight: 700,
                  },
                },
                r.name,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  },
                },
                r.sub,
              ),
            ),
            r.right &&
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                r.right,
              ),
            /*#__PURE__*/ React.createElement(Icon, {
              name: "ChevronRight",
              size: 16,
              color: "var(--muted-foreground)",
            }),
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "gradient-profile",
              style: {
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderRadius: 18,
                padding: 20,
                color: "#fff",
                ...rise(0),
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.2)",
                  fontSize: 22,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                },
              },
              WM.user.initials,
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 18,
                    fontWeight: 800,
                  },
                },
                WM.user.name,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 13,
                    opacity: 0.9,
                  },
                },
                WM.user.email,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 2,
                    fontSize: 12,
                    opacity: 0.75,
                  },
                },
                "Member sejak Januari 2024",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                background: "var(--card)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--ring-card)",
                padding: 16,
                ...rise(0.4),
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 12,
                },
              },
              "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66 Group Family",
            ),
            /*#__PURE__*/ React.createElement(
              "button",
              {
                style: {
                  width: "100%",
                  borderRadius: 12,
                  border: "1.5px solid var(--border)",
                  background: "transparent",
                  padding: 14,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                },
                onMouseEnter: (e) =>
                  (e.currentTarget.style.borderColor = "var(--primary)"),
                onMouseLeave: (e) =>
                  (e.currentTarget.style.borderColor = "var(--border)"),
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: "var(--accent)",
                    fontSize: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  },
                },
                "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    flex: 1,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 700,
                    },
                  },
                  WM.family.name,
                  " ",
                  /*#__PURE__*/ React.createElement(
                    StatusBadge,
                    {
                      variant: "info",
                    },
                    WM.family.role,
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 2,
                      fontSize: 11.5,
                      color: "var(--muted-foreground)",
                    },
                  },
                  WM.family.members,
                  " anggota",
                ),
              ),
              /*#__PURE__*/ React.createElement(Icon, {
                name: "ChevronRight",
                size: 16,
                color: "var(--muted-foreground)",
              }),
            ),
          ),
          WM.akunMenu.map((sec, si) =>
            /*#__PURE__*/ React.createElement(
              "div",
              {
                key: sec.section,
                style: rise(0.8 + si * 0.3),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: sec.section,
                },
                sec.rows.map((r, i) =>
                  /*#__PURE__*/ React.createElement(MenuRow, {
                    key: r.name,
                    r: r,
                    last: i === sec.rows.length - 1,
                  }),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "button",
            {
              onClick: onLogout,
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                borderRadius: 10,
                border: "1.5px solid #FECACA",
                background: "var(--background)",
                padding: "12px",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--destructive)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                ...rise(1.8),
              },
            },
            /*#__PURE__*/ React.createElement(Icon, {
              name: "LogOut",
              size: 16,
              color: "var(--destructive)",
            }),
            " Keluar dari Akun",
          ),
        );
      }
      window.ScreenAkun = ScreenAkun;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-akun.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-anggaran.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Anggaran (budget) screen. */
      function ScreenAnggaran() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, Button } = DS;
        const { rise, IconChip, AnimatedBar, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const B = WM.budget;
        const overItem = B.items.find((b) => b.over);
        const nearItem = B.items.find((b) => b.near && !b.over);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 15,
                    fontWeight: 700,
                  },
                },
                "Anggaran ",
                B.month,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  },
                },
                "Total budget: ",
                WM.formatRupiah(B.totalLimit),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah Kategori",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid #86EFAC",
                  background: "#DCFCE7",
                  padding: 16,
                  ...rise(0),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "#15803D",
                  },
                },
                "Budget Tersisa",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#15803D",
                  },
                },
                WM.formatRupiah(B.totalRemaining),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "#15803D",
                  },
                },
                100 - B.usagePct,
                "% dari budget",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...panel(),
                  padding: 16,
                  ...rise(0.4),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                "Total Terpakai",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--destructive)",
                  },
                },
                WM.formatRupiah(B.totalSpent),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                B.usagePct,
                "% dari budget",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...panel(),
                  padding: 16,
                  ...rise(0.8),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                "Hari Tersisa",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--primary)",
                  },
                },
                B.daysLeft,
                " Hari",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                "dari ",
                B.daysInMonth,
                " hari",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(1.4),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Rincian Anggaran per Kategori",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  },
                },
                B.items.map((b) => {
                  const color = b.over
                    ? "var(--destructive)"
                    : b.near
                      ? "var(--warning)"
                      : "var(--success)";
                  return /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      key: b.name,
                      style: {
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        padding: 14,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                        },
                      },
                      /*#__PURE__*/ React.createElement(IconChip, {
                        name: b.icon,
                        bg: b.bg,
                        fg: b.fg,
                        size: 34,
                        iconSize: 16,
                        radius: 9,
                      }),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            flex: 1,
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              fontSize: 13.5,
                              fontWeight: 600,
                            },
                          },
                          b.name,
                        ),
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            className: "mono",
                            style: {
                              fontSize: 11.5,
                              color: "var(--muted-foreground)",
                            },
                          },
                          WM.formatRupiah(b.spent),
                          " dari ",
                          WM.formatRupiah(b.limit),
                        ),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 13,
                            fontWeight: 700,
                            color,
                          },
                        },
                        b.pct,
                        "%",
                        b.over ? " ⚠️" : "",
                      ),
                    ),
                    /*#__PURE__*/ React.createElement(AnimatedBar, {
                      value: Math.min(b.pct, 100),
                      color: color,
                    }),
                  );
                }),
              ),
            ),
          ),
          (overItem || nearItem) &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...rise(2),
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  borderRadius: 14,
                  border:
                    "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
                  background: "var(--accent)",
                  padding: 16,
                },
              },
              /*#__PURE__*/ React.createElement(IconChip, {
                name: "TriangleAlert",
                bg: "var(--warning-soft)",
                fg: "#b45309",
                size: 40,
                iconSize: 20,
                radius: 11,
              }),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    flex: 1,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--primary-strong)",
                    },
                  },
                  overItem
                    ? `${overItem.name} melebihi budget ${overItem.pct - 100}%!`
                    : `${nearItem.name} mendekati batas budget (${nearItem.pct}%)`,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 2,
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                    },
                  },
                  "Pantau pengeluaran agar tidak melebihi anggaran bulan ini.",
                ),
              ),
              /*#__PURE__*/ React.createElement(
                Button,
                {
                  variant: "ghost",
                  size: "sm",
                },
                "Tips Hemat \u2192",
              ),
            ),
        );
      }
      window.ScreenAnggaran = ScreenAnggaran;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-anggaran.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-aset.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Aset (assets) screen: KPI strip + sortable-looking table. */
      function ScreenAset() {
        const DS = window.WealthMeDesignSystem_6818de;
        const {
          SummaryCard,
          StatusBadge,
          Button,
          Donut,
          DonutLegend,
          SectionCard,
        } = DS;
        const WM = window.WM;
        const Icon = window.WMIcon;
        const [filter, setFilter] = React.useState("Semua");
        const total = WM.assets.reduce((s, a) => s + a.value, 0);
        const filters = [
          "Semua",
          "Properti",
          "Investasi",
          "Kas & Bank",
          "Komoditas",
        ];
        const rows =
          filter === "Semua"
            ? WM.assets
            : WM.assets.filter((a) => a.type === filter);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 21,
                    fontWeight: 800,
                  },
                },
                "Aset Saya",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "var(--muted-foreground)",
                  },
                },
                WM.assets.length,
                " aset \xB7 total ",
                WM.formatCompact(total),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah Aset",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(SummaryCard, {
              icon: "\uD83C\uDFE0",
              iconBg: "#FEF9C3",
              label: "Properti",
              amount: WM.formatCompact(2170000000),
              delta: "5,1%",
              deltaUp: true,
            }),
            /*#__PURE__*/ React.createElement(SummaryCard, {
              icon: "\uD83D\uDCC8",
              iconBg: "#EDE9FE",
              label: "Investasi",
              amount: WM.formatCompact(969375000),
              delta: "6,8%",
              deltaUp: true,
            }),
            /*#__PURE__*/ React.createElement(SummaryCard, {
              icon: "\uD83E\uDE99",
              iconBg: "#FEF3C7",
              label: "Komoditas",
              amount: WM.formatCompact(312500000),
              delta: "3,1%",
              deltaUp: true,
            }),
            /*#__PURE__*/ React.createElement(SummaryCard, {
              icon: "\uD83C\uDFE6",
              iconBg: "#DBEAFE",
              label: "Kas & Bank",
              amount: WM.formatCompact(200000000),
              delta: "0,5%",
              deltaUp: true,
            }),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr",
                gap: 14,
                alignItems: "start",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  background: "var(--card)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--ring-card)",
                  overflow: "hidden",
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    gap: 6,
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    flexWrap: "wrap",
                  },
                },
                filters.map((f) =>
                  /*#__PURE__*/ React.createElement(
                    "button",
                    {
                      key: f,
                      onClick: () => setFilter(f),
                      style: {
                        borderRadius: 999,
                        padding: "5px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        border:
                          "1px solid " +
                          (filter === f ? "transparent" : "var(--border)"),
                        background:
                          filter === f ? "var(--primary)" : "transparent",
                        color:
                          filter === f ? "#fff" : "var(--muted-foreground)",
                      },
                    },
                    f,
                  ),
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "table",
                {
                  style: {
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: "var(--font-sans)",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "thead",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "tr",
                    {
                      style: {
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: ".05em",
                        color: "var(--muted-foreground)",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          textAlign: "left",
                          padding: "10px 16px",
                          fontWeight: 700,
                        },
                      },
                      "Aset",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          textAlign: "left",
                          padding: "10px 8px",
                          fontWeight: 700,
                        },
                      },
                      "Kategori",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          textAlign: "right",
                          padding: "10px 8px",
                          fontWeight: 700,
                        },
                      },
                      "Nilai",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          textAlign: "right",
                          padding: "10px 16px",
                          fontWeight: 700,
                        },
                      },
                      "Perubahan",
                    ),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "tbody",
                  null,
                  rows.map((a, i) =>
                    /*#__PURE__*/ React.createElement(
                      "tr",
                      {
                        key: a.name,
                        style: {
                          borderTop: "1px solid var(--border)",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          style: {
                            padding: "11px 16px",
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            },
                          },
                          /*#__PURE__*/ React.createElement(
                            "div",
                            {
                              style: {
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: "var(--secondary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 15,
                              },
                            },
                            a.icon,
                          ),
                          /*#__PURE__*/ React.createElement(
                            "span",
                            {
                              style: {
                                fontSize: 13,
                                fontWeight: 600,
                              },
                            },
                            a.name,
                          ),
                        ),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          style: {
                            padding: "11px 8px",
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          StatusBadge,
                          {
                            variant: a.typeColor,
                          },
                          a.type,
                        ),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          style: {
                            padding: "11px 8px",
                            textAlign: "right",
                            fontWeight: 700,
                            fontSize: 13,
                          },
                          className: "mono",
                        },
                        WM.formatCompact(a.value),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          style: {
                            padding: "11px 16px",
                            textAlign: "right",
                            fontWeight: 700,
                            fontSize: 12.5,
                            color: a.up
                              ? "var(--success)"
                              : "var(--destructive)",
                          },
                        },
                        (a.up ? "▲ " : "▼ ") +
                          Math.abs(a.change).toFixed(1) +
                          "%",
                      ),
                    ),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Komposisi Aset",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                  },
                },
                /*#__PURE__*/ React.createElement(Donut, {
                  segments: WM.allocation,
                  size: 150,
                  thickness: 22,
                  centerValue: WM.formatCompact(total),
                  centerLabel: "Total Aset",
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      width: "100%",
                    },
                  },
                  /*#__PURE__*/ React.createElement(DonutLegend, {
                    segments: WM.allocation.map((a) => ({
                      ...a,
                      sub: WM.formatCompact(a.amount),
                    })),
                  }),
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenAset = ScreenAset;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-aset.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-asuransi.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Asuransi (insurance) screen. */
      function ScreenAsuransi() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { StatusBadge, Button } = DS;
        const { rise, IconChip, lift, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const A = WM.asuransi;
        const Field = ({ label, value, sub, color }) =>
          /*#__PURE__*/ React.createElement(
            "div",
            null,
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                  marginBottom: 3,
                },
              },
              label,
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                className: "mono",
                style: {
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: color || "var(--foreground)",
                },
              },
              value,
              sub &&
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontWeight: 400,
                      color: "var(--muted-foreground)",
                    },
                  },
                  sub,
                ),
            ),
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 15,
                    fontWeight: 700,
                  },
                },
                A.activePolicies,
                " Polis Aktif",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  },
                },
                "Total premi: ",
                WM.formatRupiah(A.totalMonthlyPremium),
                "/bln",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah",
            ),
          ),
          A.policies.map((p, i) =>
            /*#__PURE__*/ React.createElement(
              "div",
              {
                key: p.name,
                onMouseEnter: (e) => lift(e, true),
                onMouseLeave: (e) => lift(e, false),
                style: {
                  ...panel(),
                  padding: 18,
                  transition: "transform .18s, box-shadow .18s",
                  ...rise(i * 0.3),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                  },
                },
                /*#__PURE__*/ React.createElement(IconChip, {
                  name: p.icon,
                  bg: p.bg,
                  fg: p.fg,
                  size: 38,
                  iconSize: 18,
                  radius: 10,
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      flex: 1,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 14,
                        fontWeight: 700,
                      },
                    },
                    p.name,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                      },
                    },
                    p.provider,
                    " \xB7 ",
                    p.typeLabel,
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  StatusBadge,
                  {
                    variant: p.statusVar,
                    dot: true,
                  },
                  p.status,
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 14,
                  },
                },
                /*#__PURE__*/ React.createElement(Field, {
                  label: "Uang Pertanggungan",
                  value: WM.formatCompact(p.coverage),
                }),
                /*#__PURE__*/ React.createElement(Field, {
                  label: "Premi",
                  value: WM.formatRupiah(p.premium),
                  sub: p.period,
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginBottom: 3,
                      },
                    },
                    "Jatuh Tempo",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        style: {
                          fontSize: 13.5,
                          fontWeight: 700,
                        },
                      },
                      p.renewal,
                    ),
                    /*#__PURE__*/ React.createElement(
                      StatusBadge,
                      {
                        variant: p.daysVar,
                      },
                      p.days,
                      " hari",
                    ),
                  ),
                ),
                /*#__PURE__*/ React.createElement(Field, {
                  label: "No. Polis",
                  value: p.policyNo,
                }),
              ),
            ),
          ),
        );
      }
      window.ScreenAsuransi = ScreenAsuransi;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-asuransi.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-beranda-enhanced.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Beranda ENHANCED: count-up hero, shadow hierarchy,
   stagger entrance + hover lift, Lucide tinted category icons. */

      function useCountUp(target, dur = 1200, deps = []) {
        const [v, setV] = React.useState(0);
        React.useEffect(() => {
          let raf, start;
          const step = (t) => {
            if (!start) start = t;
            const p = Math.min(1, (t - start) / dur);
            setV(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
          return () => cancelAnimationFrame(raf);
        }, deps); // eslint-disable-line
        return v;
      }

      /* Progress that fills from 0 → value on mount */
      function AnimatedBar({ value, color }) {
        const { ProgressBar } = window.WealthMeDesignSystem_6818de;
        const [v, setV] = React.useState(0);
        React.useEffect(() => {
          const id = setTimeout(() => setV(value), 120);
          return () => clearTimeout(id);
        }, [value]);
        return /*#__PURE__*/ React.createElement(ProgressBar, {
          value: v,
          color: color,
          height: 8,
        });
      }

      /* Tinted Lucide chip */
      function IconChip({
        name,
        bg,
        fg,
        size = 34,
        iconSize = 17,
        radius = 9,
      }) {
        const Icon = window.WMIcon;
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              width: size,
              height: size,
              borderRadius: radius,
              background: bg,
              color: fg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            },
          },
          /*#__PURE__*/ React.createElement(Icon, {
            name: name,
            size: iconSize,
            color: fg,
            stroke: 2,
          }),
        );
      }
      const KPI_ICONS = [
        {
          name: "Landmark",
          bg: "#DBEAFE",
          fg: "#2563EB",
        },
        {
          name: "Wallet",
          bg: "#DCFCE7",
          fg: "#16A34A",
        },
        {
          name: "TrendingUp",
          bg: "#EDE9FE",
          fg: "#7C3AED",
        },
        {
          name: "Home",
          bg: "#FEF9C3",
          fg: "#CA8A04",
        },
        {
          name: "CreditCard",
          bg: "#FEE2E2",
          fg: "#DC2626",
        },
      ];
      const ACT_ICONS = {
        inc: {
          name: "ArrowDownLeft",
          bg: "#DCFCE7",
          fg: "#16A34A",
        },
        exp: {
          name: "CreditCard",
          bg: "#FEE2E2",
          fg: "#DC2626",
        },
        inv: {
          name: "ArrowLeftRight",
          bg: "#EDE9FE",
          fg: "#7C3AED",
        },
      };
      const GOAL_ICONS = [
        {
          name: "GraduationCap",
          bg: "#DBEAFE",
          fg: "#2563EB",
        },
        {
          name: "Plane",
          bg: "#DCFCE7",
          fg: "#16A34A",
        },
        {
          name: "Car",
          bg: "#FEF9C3",
          fg: "#CA8A04",
        },
      ];
      function rise(i) {
        return {
          animation: "wm-rise .5s cubic-bezier(.22,.61,.36,1) both",
          animationDelay: i * 70 + "ms",
        };
      }
      function ScreenBerandaEnhanced() {
        const DS = window.WealthMeDesignSystem_6818de;
        const {
          HeroCard,
          SectionCard,
          Donut,
          DonutLegend,
          Sparkline,
          BarChart,
          Button,
        } = DS;
        const WM = window.WM;
        const Icon = window.WMIcon;
        const [period, setPeriod] = React.useState("1M");
        const PERIODS = ["1M", "3M", "6M", "1Y", "All"];
        const nw = useCountUp(WM.netWorth, 1300, []);
        const softLift = (e, on) => {
          e.currentTarget.style.transform = on ? "translateY(-4px)" : "none";
          e.currentTarget.style.boxShadow = on
            ? "0 12px 28px rgba(15,23,42,.10)"
            : "var(--ring-card)";
        };
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1.05fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(0),
              },
              /*#__PURE__*/ React.createElement(
                HeroCard,
                {
                  gradient: "gradient-wealth",
                  style: {
                    boxShadow: "0 16px 40px rgba(79,70,229,.28)",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.5,
                      fontWeight: 600,
                      opacity: 0.9,
                    },
                  },
                  /*#__PURE__*/ React.createElement(Icon, {
                    name: "Gem",
                    size: 14,
                    color: "#fff",
                  }),
                  " Total Kekayaan",
                  /*#__PURE__*/ React.createElement(Icon, {
                    name: "Eye",
                    size: 13,
                    color: "#fff",
                    style: {
                      opacity: 0.6,
                      marginLeft: 2,
                    },
                  }),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      marginTop: 6,
                      fontSize: 30,
                      fontWeight: 800,
                      letterSpacing: "-.02em",
                      fontVariantNumeric: "tabular-nums",
                    },
                  },
                  WM.formatRupiah(Math.round(nw)),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(110,231,183,.18)",
                      border: "1px solid rgba(110,231,183,.35)",
                      color: "#6ee7b7",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 999,
                    },
                  },
                  /*#__PURE__*/ React.createElement(Icon, {
                    name: "ArrowUp",
                    size: 12,
                    color: "#6ee7b7",
                    stroke: 2.5,
                  }),
                  " ",
                  WM.formatRupiah(WM.monthNet),
                  " bulan ini",
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        opacity: 0.65,
                        fontWeight: 500,
                      },
                    },
                    "\xB7 saving ",
                    WM.savingsRate,
                    "%",
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 14,
                      display: "flex",
                      gap: 6,
                    },
                  },
                  PERIODS.map((p) =>
                    /*#__PURE__*/ React.createElement(
                      "button",
                      {
                        key: p,
                        onClick: () => setPeriod(p),
                        style: {
                          borderRadius: 999,
                          padding: "4px 12px",
                          fontSize: 11,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          transition: "background .15s",
                          background:
                            period === p ? "#fff" : "rgba(255,255,255,.15)",
                          color: period === p ? "var(--primary)" : "#fff",
                        },
                      },
                      p,
                    ),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 12,
                      animation: "wm-pop .8s ease both",
                      animationDelay: "200ms",
                    },
                  },
                  /*#__PURE__*/ React.createElement(Sparkline, {
                    points: WM.sparkline,
                    height: 58,
                  }),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(1),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Rincian Kekayaan",
                  style: {
                    boxShadow: "var(--shadow-card), var(--ring-card)",
                  },
                  action: /*#__PURE__*/ React.createElement(
                    Button,
                    {
                      variant: "link",
                      size: "sm",
                    },
                    "Lihat detail",
                  ),
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap",
                    },
                  },
                  /*#__PURE__*/ React.createElement(Donut, {
                    segments: WM.allocation,
                    size: 116,
                    thickness: 18,
                    centerValue: "Rp 2,4M",
                    centerLabel: "Total",
                  }),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        flex: 1,
                        minWidth: 130,
                      },
                    },
                    /*#__PURE__*/ React.createElement(DonutLegend, {
                      segments: WM.allocation.map((a) => ({
                        ...a,
                        sub: WM.formatCompact(a.amount),
                      })),
                    }),
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 12,
              },
            },
            WM.summary.map((s, i) => {
              const ic = KPI_ICONS[i] || KPI_ICONS[0];
              return /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: s.label,
                  onMouseEnter: (e) => softLift(e, true),
                  onMouseLeave: (e) => softLift(e, false),
                  style: {
                    background: "var(--card)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--ring-card)",
                    padding: 16,
                    cursor: "default",
                    transition: "transform .18s, box-shadow .18s",
                    ...rise(2 + i * 0.4),
                  },
                },
                /*#__PURE__*/ React.createElement(IconChip, {
                  name: ic.name,
                  bg: ic.bg,
                  fg: ic.fg,
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 10,
                      fontSize: 10.5,
                      fontWeight: 500,
                      color: "var(--muted-foreground)",
                    },
                  },
                  s.label,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      marginTop: 2,
                      fontSize: 15,
                      fontWeight: 800,
                    },
                  },
                  WM.formatCompact(s.amount),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: s.up ? "var(--success)" : "var(--destructive)",
                    },
                  },
                  /*#__PURE__*/ React.createElement(Icon, {
                    name: s.up ? "ArrowUp" : "ArrowDown",
                    size: 11,
                    color: "currentColor",
                    stroke: 2.5,
                  }),
                  " ",
                  s.delta,
                ),
              );
            }),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(4),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Arus Kas",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      gap: 18,
                      marginBottom: 10,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    null,
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 10.5,
                          color: "var(--muted-foreground)",
                        },
                      },
                      "Pemasukan",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        className: "mono",
                        style: {
                          fontSize: 15,
                          fontWeight: 800,
                          color: "var(--success)",
                        },
                      },
                      WM.formatCompact(WM.monthIncome),
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    null,
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 10.5,
                          color: "var(--muted-foreground)",
                        },
                      },
                      "Pengeluaran",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        className: "mono",
                        style: {
                          fontSize: 15,
                          fontWeight: 800,
                          color: "var(--destructive)",
                        },
                      },
                      WM.formatCompact(WM.monthExpense),
                    ),
                  ),
                ),
                /*#__PURE__*/ React.createElement(BarChart, {
                  months: WM.cashflow.months,
                  income: WM.cashflow.income,
                  expense: WM.cashflow.expense,
                  max: WM.cashflow.max,
                  height: 86,
                }),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(4.5),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Transaksi Terbaru",
                  action: /*#__PURE__*/ React.createElement(
                    Button,
                    {
                      variant: "link",
                      size: "sm",
                    },
                    "Semua",
                  ),
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  WM.activities.map((a, i) => {
                    const ic = a.inc
                      ? ACT_ICONS.inc
                      : a.cat.includes("Investasi")
                        ? ACT_ICONS.inv
                        : ACT_ICONS.exp;
                    return /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        key: i,
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "9px 0",
                          borderTop: i ? "1px solid var(--border)" : "none",
                        },
                      },
                      /*#__PURE__*/ React.createElement(IconChip, {
                        name: ic.name,
                        bg: ic.bg,
                        fg: ic.fg,
                        size: 34,
                        iconSize: 16,
                        radius: 8,
                      }),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            flex: 1,
                            minWidth: 0,
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              fontSize: 13,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            },
                          },
                          a.name,
                        ),
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                            },
                          },
                          a.cat,
                        ),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            textAlign: "right",
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            className: "mono",
                            style: {
                              fontSize: 13,
                              fontWeight: 700,
                              color: a.inc
                                ? "var(--success)"
                                : "var(--destructive)",
                            },
                          },
                          (a.inc ? "+" : "-") + WM.formatCompact(a.amt),
                        ),
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                            },
                          },
                          a.date,
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(5),
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    background: "var(--card)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--ring-card)",
                    overflow: "hidden",
                  },
                },
                /*#__PURE__*/ React.createElement("div", {
                  style: {
                    height: 3,
                    background:
                      "linear-gradient(90deg,var(--primary),var(--brand-purple))",
                  },
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      padding: 20,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: "var(--muted-foreground)",
                        },
                      },
                      "Tujuan Keuangan",
                    ),
                    /*#__PURE__*/ React.createElement(
                      Button,
                      {
                        variant: "link",
                        size: "sm",
                      },
                      "Semua",
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      },
                    },
                    WM.goals.map((g, i) => {
                      const ic = GOAL_ICONS[i] || GOAL_ICONS[0];
                      return /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          key: g.name,
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 6,
                            },
                          },
                          /*#__PURE__*/ React.createElement(IconChip, {
                            name: ic.name,
                            bg: ic.bg,
                            fg: ic.fg,
                            size: 26,
                            iconSize: 14,
                            radius: 7,
                          }),
                          /*#__PURE__*/ React.createElement(
                            "div",
                            {
                              style: {
                                flex: 1,
                                fontSize: 13,
                                fontWeight: 600,
                              },
                            },
                            g.name,
                          ),
                          /*#__PURE__*/ React.createElement(
                            "div",
                            {
                              className: "mono",
                              style: {
                                fontSize: 13,
                                fontWeight: 700,
                                color: g.color,
                              },
                            },
                            g.pct,
                            "%",
                          ),
                        ),
                        /*#__PURE__*/ React.createElement(AnimatedBar, {
                          value: g.pct,
                          color: g.color,
                        }),
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: 4,
                              fontSize: 10.5,
                              color: "var(--muted-foreground)",
                            },
                          },
                          /*#__PURE__*/ React.createElement(
                            "span",
                            null,
                            WM.formatCompact(g.now),
                          ),
                          /*#__PURE__*/ React.createElement(
                            "span",
                            null,
                            WM.formatCompact(g.target),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                ...rise(6),
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderRadius: 14,
                background: "var(--accent)",
                padding: 16,
                boxShadow: "var(--ring-card)",
              },
            },
            /*#__PURE__*/ React.createElement(IconChip, {
              name: "Sparkles",
              bg: "var(--primary)",
              fg: "#fff",
              size: 40,
              iconSize: 20,
              radius: 11,
            }),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  flex: 1,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--primary-strong)",
                  },
                },
                "Insight dari AI Advisor",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 2,
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  },
                },
                "Porsi properti (30%) sedikit di atas ideal. Pertimbangkan rebalancing ke instrumen yang lebih likuid.",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Sparkles",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tanya AI",
            ),
          ),
        );
      }
      window.ScreenBerandaEnhanced = ScreenBerandaEnhanced;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-beranda-enhanced.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-beranda.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Beranda wrapper: greeting + Klasik/Baru toggle. */
      function ScreenBeranda() {
        const [view, setView] = React.useState("baru");
        const Icon = window.WMIcon;
        const tab = (id, label, icon) =>
          /*#__PURE__*/ React.createElement(
            "button",
            {
              onClick: () => setView(id),
              style: {
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
                fontWeight: 600,
                background: view === id ? "var(--card)" : "transparent",
                color:
                  view === id ? "var(--primary)" : "var(--muted-foreground)",
                boxShadow: view === id ? "var(--ring-card)" : "none",
                transition: "all .15s",
              },
            },
            icon &&
              /*#__PURE__*/ React.createElement(Icon, {
                name: icon,
                size: 13,
                color: "currentColor",
              }),
            label,
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 21,
                    fontWeight: 800,
                  },
                },
                "Selamat pagi, Andra \uD83D\uDC4B",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "var(--muted-foreground)",
                  },
                },
                "Ini ringkasan kekayaanmu hari ini.",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginLeft: "auto",
                  display: "flex",
                  gap: 3,
                  padding: 3,
                  borderRadius: 999,
                  background: "var(--secondary)",
                },
              },
              tab("klasik", "Klasik", null),
              tab("baru", "Baru", "Sparkles"),
            ),
          ),
          view === "baru"
            ? /*#__PURE__*/ React.createElement(
                window.ScreenBerandaEnhanced,
                null,
              )
            : /*#__PURE__*/ React.createElement(BerandaClassic, null),
        );
      }
      window.ScreenBeranda = ScreenBeranda;

      /* Original (classic) dashboard body. */
      function BerandaClassic() {
        const DS = window.WealthMeDesignSystem_6818de;
        const {
          HeroCard,
          SectionCard,
          SummaryCard,
          Donut,
          DonutLegend,
          Sparkline,
          BarChart,
          ProgressBar,
          Button,
        } = DS;
        const WM = window.WM;
        const [period, setPeriod] = React.useState("1M");
        const PERIODS = ["1M", "3M", "6M", "1Y", "All"];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1.05fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              HeroCard,
              {
                gradient: "gradient-wealth",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    opacity: 0.9,
                  },
                },
                "\uD83D\uDC8E Total Kekayaan",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 4,
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: "-.02em",
                  },
                },
                WM.formatRupiah(WM.netWorth),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 6,
                    fontSize: 12.5,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontWeight: 600,
                      color: "#6ee7b7",
                    },
                  },
                  "\u25B2 ",
                  WM.formatRupiah(WM.monthNet),
                  " bulan ini",
                ),
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      opacity: 0.6,
                    },
                  },
                  " \xB7 saving rate ",
                  WM.savingsRate,
                  "%",
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 14,
                    display: "flex",
                    gap: 6,
                  },
                },
                PERIODS.map((p) =>
                  /*#__PURE__*/ React.createElement(
                    "button",
                    {
                      key: p,
                      onClick: () => setPeriod(p),
                      style: {
                        borderRadius: 999,
                        padding: "4px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        background:
                          period === p ? "#fff" : "rgba(255,255,255,.15)",
                        color: period === p ? "var(--primary)" : "#fff",
                      },
                    },
                    p,
                  ),
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 12,
                  },
                },
                /*#__PURE__*/ React.createElement(Sparkline, {
                  points: WM.sparkline,
                  height: 56,
                }),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Rincian Kekayaan",
                action: /*#__PURE__*/ React.createElement(
                  Button,
                  {
                    variant: "link",
                    size: "sm",
                  },
                  "Lihat detail",
                ),
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  },
                },
                /*#__PURE__*/ React.createElement(Donut, {
                  segments: WM.allocation,
                  size: 112,
                  thickness: 17,
                  centerValue: "Rp 2,4M",
                  centerLabel: "Total",
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      flex: 1,
                      minWidth: 130,
                    },
                  },
                  /*#__PURE__*/ React.createElement(DonutLegend, {
                    segments: WM.allocation.map((a) => ({
                      ...a,
                      sub: WM.formatCompact(a.amount),
                    })),
                  }),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 12,
              },
            },
            WM.summary.map((s) =>
              /*#__PURE__*/ React.createElement(SummaryCard, {
                key: s.label,
                icon: s.icon,
                iconBg: s.iconBg,
                label: s.label,
                amount: WM.formatCompact(s.amount),
                delta: s.delta,
                deltaUp: s.up,
              }),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Arus Kas",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    gap: 18,
                    marginBottom: 10,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 10.5,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "Pemasukan",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 15,
                        fontWeight: 800,
                        color: "var(--success)",
                      },
                    },
                    WM.formatCompact(WM.monthIncome),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 10.5,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "Pengeluaran",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 15,
                        fontWeight: 800,
                        color: "var(--destructive)",
                      },
                    },
                    WM.formatCompact(WM.monthExpense),
                  ),
                ),
              ),
              /*#__PURE__*/ React.createElement(BarChart, {
                months: WM.cashflow.months,
                income: WM.cashflow.income,
                expense: WM.cashflow.expense,
                max: WM.cashflow.max,
                height: 86,
              }),
            ),
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Transaksi Terbaru",
                action: /*#__PURE__*/ React.createElement(
                  Button,
                  {
                    variant: "link",
                    size: "sm",
                  },
                  "Semua",
                ),
              },
              /*#__PURE__*/ React.createElement(
                "div",
                null,
                WM.activities.map((a, i) =>
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      key: i,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 0",
                        borderTop: i ? "1px solid var(--border)" : "none",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 15,
                          background: a.iconBg,
                        },
                      },
                      a.icon,
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 13,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          },
                        },
                        a.name,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 11,
                            color: "var(--muted-foreground)",
                          },
                        },
                        a.cat,
                      ),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          textAlign: "right",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 13,
                            fontWeight: 700,
                            color: a.inc
                              ? "var(--success)"
                              : "var(--destructive)",
                          },
                        },
                        (a.inc ? "+" : "-") + WM.formatCompact(a.amt),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 11,
                            color: "var(--muted-foreground)",
                          },
                        },
                        a.date,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Tujuan Keuangan",
                action: /*#__PURE__*/ React.createElement(
                  Button,
                  {
                    variant: "link",
                    size: "sm",
                  },
                  "Semua",
                ),
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  },
                },
                WM.goals.map((g) =>
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      key: g.name,
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            background: g.iconBg,
                          },
                        },
                        g.icon,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 600,
                          },
                        },
                        g.name,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 13,
                            fontWeight: 700,
                            color: g.color,
                          },
                        },
                        g.pct,
                        "%",
                      ),
                    ),
                    /*#__PURE__*/ React.createElement(ProgressBar, {
                      value: g.pct,
                      color: g.color,
                    }),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 4,
                          fontSize: 10.5,
                          color: "var(--muted-foreground)",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "span",
                        null,
                        WM.formatCompact(g.now),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "span",
                        null,
                        WM.formatCompact(g.target),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderRadius: 14,
                background: "var(--accent)",
                padding: 16,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 24,
                },
              },
              "\uD83D\uDCCA",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  flex: 1,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--primary-strong)",
                  },
                },
                "Insight dari AI Advisor",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 2,
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  },
                },
                "Porsi properti (30%) sedikit di atas ideal. Pertimbangkan rebalancing ke instrumen yang lebih likuid.",
              ),
            ),
            /*#__PURE__*/ React.createElement(Button, null, "Tanya AI"),
          ),
        );
      }
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-beranda.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-dana.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Dana (cash & e-wallet) screen. */
      function ScreenDana() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { HeroCard, SectionCard, Button } = DS;
        const { rise, IconChip, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const D = WM.dana;
        const Row = ({ a, border }) =>
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: border ? "1px solid var(--border)" : "none",
              },
            },
            /*#__PURE__*/ React.createElement(IconChip, {
              name: a.icon,
              bg: a.bg,
              fg: a.fg,
              size: 40,
              iconSize: 18,
              radius: 10,
            }),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  flex: 1,
                  minWidth: 0,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 13.5,
                    fontWeight: 600,
                  },
                },
                a.name,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 11.5,
                    color: "var(--muted-foreground)",
                  },
                },
                a.sub,
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                className: "mono",
                style: {
                  fontSize: 15,
                  fontWeight: 800,
                },
              },
              WM.formatRupiah(a.balance),
            ),
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0),
            },
            /*#__PURE__*/ React.createElement(
              HeroCard,
              {
                gradient: "gradient-emerald",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "Banknote",
                  size: 14,
                  color: "#fff",
                }),
                " Total Dana Tunai & E-Wallet",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 28,
                    fontWeight: 900,
                    marginTop: 4,
                  },
                },
                WM.formatRupiah(D.total),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "#bbf7d0",
                    marginTop: 6,
                  },
                },
                D.cash.length + D.ewallet.length,
                " akun terhubung",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0.5),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Dompet & Cash",
              },
              D.cash.map((a, i) =>
                /*#__PURE__*/ React.createElement(Row, {
                  key: a.name,
                  a: a,
                  border: i < D.cash.length - 1,
                }),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0.9),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "E-Wallet",
                action: /*#__PURE__*/ React.createElement(
                  Button,
                  {
                    variant: "secondary",
                    size: "sm",
                    iconStart: /*#__PURE__*/ React.createElement(Icon, {
                      name: "Plus",
                      size: 13,
                    }),
                  },
                  "Tambah",
                ),
              },
              D.ewallet.map((a, i) =>
                /*#__PURE__*/ React.createElement(Row, {
                  key: a.name,
                  a: a,
                  border: i < D.ewallet.length - 1,
                }),
              ),
            ),
          ),
        );
      }
      window.ScreenDana = ScreenDana;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-dana.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-donation.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Donasi & Zakat screen (live zakat calculator). */
      function ScreenDonation() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { HeroCard, SectionCard, StatusBadge, Button, Input } = DS;
        const { rise, IconChip } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const D = WM.donation;
        const [cash, setCash] = React.useState(D.calc.cash);
        const [gold, setGold] = React.useState(D.calc.gold);
        const [invest, setInvest] = React.useState(D.calc.invest);
        const [debt, setDebt] = React.useState(D.calc.debt);
        const harta = cash + gold + invest - debt;
        const reached = harta >= D.calc.nisab;
        const zakat = reached ? Math.round(harta * 0.025) : 0;
        const numField = (label, value, setter) =>
          /*#__PURE__*/ React.createElement(
            "div",
            null,
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 12.5,
                  color: "var(--muted-foreground)",
                  marginBottom: 6,
                },
              },
              label,
            ),
            /*#__PURE__*/ React.createElement("input", {
              type: "text",
              value: value.toLocaleString("id-ID"),
              onChange: (e) =>
                setter(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0),
              className: "mono",
              style: {
                width: "100%",
                height: 38,
                padding: "0 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--input)",
                background: "var(--card)",
                color: "var(--foreground)",
                fontSize: 13,
                outline: "none",
              },
            }),
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0),
            },
            /*#__PURE__*/ React.createElement(
              HeroCard,
              {
                gradient: "gradient-emerald",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "HandHeart",
                  size: 14,
                  color: "#fff",
                }),
                " Total Donasi & Zakat",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 30,
                    fontWeight: 900,
                    letterSpacing: "-1px",
                    marginTop: 4,
                  },
                },
                WM.formatRupiah(D.total),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                    marginTop: 6,
                  },
                },
                D.txns.length,
                " transaksi tercatat",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0.5),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "\uD83D\uDD4C Kalkulator Zakat Maal",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginBottom: 14,
                  },
                },
                "Zakat 2,5% dari total harta yang mencapai nisab & haul (1 tahun)",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  },
                },
                numField("Tabungan & Kas (Rp)", cash, setCash),
                numField("Emas & Perak (Rp)", gold, setGold),
                numField("Investasi & Saham (Rp)", invest, setInvest),
                numField("Utang Jatuh Tempo (Rp)", debt, setDebt),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 16,
                    borderRadius: 12,
                    border:
                      "1px solid color-mix(in oklab, var(--primary) 15%, transparent)",
                    background: "var(--accent)",
                    padding: 16,
                    textAlign: "center",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11.5,
                      color: "var(--muted-foreground)",
                    },
                  },
                  "Zakat yang Wajib Ditunaikan (2,5%)",
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      marginTop: 4,
                      fontSize: 24,
                      fontWeight: 900,
                      color: "var(--primary)",
                    },
                  },
                  WM.formatRupiah(zakat),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 6,
                      fontSize: 12,
                      color: reached ? "var(--success)" : "var(--warning)",
                    },
                  },
                  reached
                    ? "✅ Harta sudah mencapai nisab (≈ Rp 102 jt)"
                    : "⚠️ Harta belum mencapai nisab (Rp 102 jt) — belum wajib zakat",
                ),
              ),
              /*#__PURE__*/ React.createElement(
                Button,
                {
                  style: {
                    marginTop: 14,
                  },
                  iconStart: /*#__PURE__*/ React.createElement(Icon, {
                    name: "HandHeart",
                    size: 14,
                    color: "#fff",
                  }),
                },
                "Tunaikan Zakat Sekarang",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(1),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Riwayat Donasi & Zakat",
              },
              D.txns.map((d, i) =>
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    key: i,
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 0",
                      borderTop: i ? "1px solid var(--border)" : "none",
                    },
                  },
                  /*#__PURE__*/ React.createElement(IconChip, {
                    name: d.icon,
                    bg: d.bg,
                    fg: d.fg,
                    size: 34,
                    iconSize: 16,
                    radius: 9,
                  }),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        flex: 1,
                        minWidth: 0,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 13.5,
                          fontWeight: 600,
                        },
                      },
                      d.type,
                      " \u2014 ",
                      d.recipient,
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 11.5,
                          color: "var(--muted-foreground)",
                        },
                      },
                      d.date,
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        textAlign: "right",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        className: "mono",
                        style: {
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: "var(--destructive)",
                        },
                      },
                      "-",
                      WM.formatRupiah(d.amt),
                    ),
                    d.taxDeduct &&
                      /*#__PURE__*/ React.createElement(
                        StatusBadge,
                        {
                          variant: "success",
                          style: {
                            marginTop: 2,
                            fontSize: 10,
                          },
                        },
                        "Pengurang Pajak",
                      ),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenDonation = ScreenDonation;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-donation.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-investasi.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Investasi (portfolio) screen. */
      function ScreenInvestasi() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, StatusBadge, Button } = DS;
        const { rise, useCountUp, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const I = WM.invest;
        const total = useCountUp(I.totalValue, 1200, []);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...panel(),
                  padding: 20,
                  ...rise(0),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    marginBottom: 4,
                  },
                },
                "Total Nilai Investasi",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 24,
                    fontWeight: 900,
                    color: "var(--primary)",
                  },
                },
                WM.formatRupiah(Math.round(total)),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 4,
                    fontSize: 12,
                    color: "var(--success)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "ArrowUp",
                  size: 12,
                  color: "currentColor",
                  stroke: 2.5,
                }),
                " +",
                I.totalReturnPct.toFixed(2).replace(".", ","),
                "% \xB7 ",
                WM.formatCompact(I.totalReturnRp),
                " total return",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...panel(),
                  padding: 20,
                  ...rise(0.4),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    marginBottom: 4,
                  },
                },
                "Return Hari Ini",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 24,
                    fontWeight: 900,
                    color: "var(--success)",
                  },
                },
                WM.formatRupiah(I.todayRp),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 4,
                    fontSize: 12,
                    color: "var(--success)",
                  },
                },
                "+",
                I.todayPct.toFixed(2).replace(".", ","),
                "% dari kemarin",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0.9),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Portofolio",
                action: /*#__PURE__*/ React.createElement(
                  Button,
                  {
                    variant: "link",
                    size: "sm",
                    iconStart: /*#__PURE__*/ React.createElement(Icon, {
                      name: "Plus",
                      size: 13,
                      color: "var(--primary)",
                    }),
                  },
                  "Tambah Investasi",
                ),
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    overflowX: "auto",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "table",
                  {
                    style: {
                      width: "100%",
                      minWidth: 560,
                      borderCollapse: "collapse",
                      fontFamily: "var(--font-sans)",
                      fontSize: 12.5,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "thead",
                    null,
                    /*#__PURE__*/ React.createElement(
                      "tr",
                      {
                        style: {
                          fontSize: 10.5,
                          textTransform: "uppercase",
                          letterSpacing: ".05em",
                          color: "var(--muted-foreground)",
                          textAlign: "left",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "th",
                        {
                          style: {
                            padding: "8px 12px 8px 0",
                            fontWeight: 700,
                          },
                        },
                        "Nama",
                      ),
                      /*#__PURE__*/ React.createElement(
                        "th",
                        {
                          style: {
                            padding: "8px 12px",
                            fontWeight: 700,
                          },
                        },
                        "Jenis",
                      ),
                      /*#__PURE__*/ React.createElement(
                        "th",
                        {
                          style: {
                            padding: "8px 12px",
                            fontWeight: 700,
                            textAlign: "right",
                          },
                        },
                        "Modal",
                      ),
                      /*#__PURE__*/ React.createElement(
                        "th",
                        {
                          style: {
                            padding: "8px 12px",
                            fontWeight: 700,
                            textAlign: "right",
                          },
                        },
                        "Nilai",
                      ),
                      /*#__PURE__*/ React.createElement(
                        "th",
                        {
                          style: {
                            padding: "8px 12px",
                            fontWeight: 700,
                            textAlign: "right",
                          },
                        },
                        "Return",
                      ),
                      /*#__PURE__*/ React.createElement(
                        "th",
                        {
                          style: {
                            padding: "8px 0",
                            fontWeight: 700,
                            textAlign: "right",
                          },
                        },
                        "%",
                      ),
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "tbody",
                    null,
                    I.holdings.map((h) =>
                      /*#__PURE__*/ React.createElement(
                        "tr",
                        {
                          key: h.ticker,
                          style: {
                            borderTop: "1px solid var(--border)",
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "td",
                          {
                            style: {
                              padding: "11px 12px 11px 0",
                            },
                          },
                          /*#__PURE__*/ React.createElement(
                            "div",
                            {
                              style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              },
                            },
                            /*#__PURE__*/ React.createElement(
                              "div",
                              {
                                style: {
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: h.logoBg,
                                  color: "#fff",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                },
                              },
                              h.ticker.slice(0, 4),
                            ),
                            /*#__PURE__*/ React.createElement(
                              "div",
                              null,
                              /*#__PURE__*/ React.createElement(
                                "div",
                                {
                                  style: {
                                    fontSize: 13,
                                    fontWeight: 600,
                                  },
                                },
                                h.name,
                              ),
                              /*#__PURE__*/ React.createElement(
                                "div",
                                {
                                  className: "mono",
                                  style: {
                                    fontSize: 11,
                                    color: "var(--muted-foreground)",
                                  },
                                },
                                h.ticker,
                              ),
                            ),
                          ),
                        ),
                        /*#__PURE__*/ React.createElement(
                          "td",
                          {
                            style: {
                              padding: "11px 12px",
                            },
                          },
                          /*#__PURE__*/ React.createElement(
                            StatusBadge,
                            {
                              variant: h.badgeVar,
                            },
                            h.badge,
                          ),
                        ),
                        /*#__PURE__*/ React.createElement(
                          "td",
                          {
                            className: "mono",
                            style: {
                              padding: "11px 12px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            },
                          },
                          WM.formatCompact(h.modal),
                        ),
                        /*#__PURE__*/ React.createElement(
                          "td",
                          {
                            className: "mono",
                            style: {
                              padding: "11px 12px",
                              textAlign: "right",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            },
                          },
                          WM.formatCompact(h.nilai),
                        ),
                        /*#__PURE__*/ React.createElement(
                          "td",
                          {
                            className: "mono",
                            style: {
                              padding: "11px 12px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              color: h.up
                                ? "var(--success)"
                                : "var(--destructive)",
                            },
                          },
                          (h.up ? "+" : "−") +
                            WM.formatCompact(Math.abs(h.returnRp)),
                        ),
                        /*#__PURE__*/ React.createElement(
                          "td",
                          {
                            style: {
                              padding: "11px 0",
                              textAlign: "right",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              color: h.up
                                ? "var(--success)"
                                : "var(--destructive)",
                            },
                          },
                          (h.up ? "+" : "") +
                            h.returnPct.toFixed(1).replace(".", ","),
                          "%",
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenInvestasi = ScreenInvestasi;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-investasi.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-kalkulator.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Kalkulator (7 live financial calculators). */
      const KAL_TABS = [
        {
          key: "zakat",
          label: "🌙 Zakat Maal",
        },
        {
          key: "pph21",
          label: "🧾 PPh 21",
        },
        {
          key: "investasi",
          label: "📈 Investasi",
        },
        {
          key: "kredit",
          label: "💳 Kredit",
        },
        {
          key: "pensiun",
          label: "🏖️ Pensiun",
        },
        {
          key: "tabungan",
          label: "🏦 Tabungan",
        },
        {
          key: "splitgroup",
          label: "🧾 Split Group",
        },
      ];
      const KAL_MONTHS = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Ags",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      function KalField({ label, value, set, num, disabled }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          null,
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 6,
              },
            },
            label,
          ),
          /*#__PURE__*/ React.createElement("input", {
            type: "text",
            disabled: disabled,
            value: num ? value : value.toLocaleString("id-ID"),
            onChange: (e) =>
              set &&
              set(
                num
                  ? e.target.value.replace(/[^\d.]/g, "")
                  : parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
              ),
            className: num ? "" : "mono",
            style: {
              width: "100%",
              height: 38,
              padding: "0 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--input)",
              background: "var(--card)",
              color: "var(--foreground)",
              fontSize: 13,
              outline: "none",
              opacity: disabled ? 0.7 : 1,
              fontFamily: "var(--font-sans)",
            },
          }),
        );
      }
      function KalResult({ label, value, detail }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              marginTop: 16,
              borderRadius: 14,
              border:
                "1px solid color-mix(in oklab, var(--primary) 30%, transparent)",
              background: "var(--accent)",
              padding: 18,
              textAlign: "center",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--muted-foreground)",
              },
            },
            label,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "mono",
              style: {
                marginTop: 2,
                fontSize: 26,
                fontWeight: 900,
                color: "var(--primary-strong)",
              },
            },
            value,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 6,
                fontSize: 12,
                color: "var(--muted-foreground)",
              },
            },
            detail,
          ),
        );
      }
      function ScreenKalkulator() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard } = DS;
        const WM = window.WM;
        const fmt = WM.formatRupiah;
        const [tab, setTab] = React.useState("investasi");

        // state for every calculator (hooks must be unconditional)
        const [zk, setZk] = React.useState({
          cash: 50000000,
          invest: 30000000,
          gold: 0,
          liab: 0,
        });
        const [pph, setPph] = React.useState({
          gross: 120000000,
          zakat: 0,
        });
        const [inv, setInv] = React.useState({
          modal: 50000000,
          monthly: 2000000,
          rate: "12",
          years: "10",
        });
        const [kr, setKr] = React.useState({
          pinjaman: 500000000,
          bunga: "7",
          tenor: "20",
          dp: "20",
        });
        const [pn, setPn] = React.useState({
          now: "30",
          retire: "55",
          monthly: 10000000,
          ret: "10",
        });
        const [tb, setTb] = React.useState({
          target: 100000000,
          current: 10000000,
          bunga: "4",
          setor: 3000000,
        });
        const [sg, setSg] = React.useState({
          total: 1250000,
          people: "5",
          tax: "10",
          tip: "0",
        });
        const u = (set) => (k) => (v) =>
          set((s) => ({
            ...s,
            [k]: v,
          }));
        const grid = {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        };

        // computations
        const nisab = 93500000,
          zakatable = zk.cash + zk.invest + zk.gold - zk.liab;
        const zakat = zakatable >= nisab ? Math.round(zakatable * 0.025) : 0;
        const pphJab = Math.min(pph.gross * 0.05, 6000000);
        let pphPkp = Math.max(0, pph.gross - pphJab - 54000000 - pph.zakat);
        pphPkp = Math.floor(pphPkp / 1000) * 1000;
        const PB = [
          [60e6, 0.05],
          [190e6, 0.15],
          [250e6, 0.25],
          [4.5e9, 0.3],
          [Infinity, 0.35],
        ];
        let pphTax = 0,
          ps = pphPkp;
        for (const [lim, r] of PB) {
          if (ps <= 0) break;
          const ken = Math.min(ps, lim);
          pphTax += ken * r;
          ps -= ken;
        }
        pphTax = Math.round(pphTax);
        const ir = Number(inv.rate) / 100 / 12,
          iN = Number(inv.years) * 12,
          iF = Math.pow(1 + ir, iN);
        const iFv =
          ir === 0
            ? inv.modal + inv.monthly * iN
            : inv.modal * iF + (inv.monthly * (iF - 1)) / ir;
        const iTot = inv.modal + inv.monthly * iN;
        const kPokok = kr.pinjaman * (1 - Number(kr.dp) / 100),
          kr_ = Number(kr.bunga) / 100 / 12,
          kN = Number(kr.tenor) * 12,
          kF = Math.pow(1 + kr_, kN);
        const kCic = kr_ === 0 ? kPokok / kN : (kPokok * kr_ * kF) / (kF - 1);
        const pNeeded = pn.monthly * 12 * 20,
          pr = Number(pn.ret) / 100 / 12,
          pN = (Number(pn.retire) - Number(pn.now)) * 12,
          pF = Math.pow(1 + pr, pN);
        const pPmt =
          pN <= 0
            ? 0
            : pr === 0
              ? pNeeded / pN
              : (pNeeded * pr * pF) / (pF - 1);
        let tbSaldo = tb.current,
          tbM = 0,
          tbR = Number(tb.bunga) / 100 / 12;
        while (tbSaldo < tb.target && tbM < 600) {
          tbSaldo = tbSaldo * (1 + tbR) + tb.setor;
          tbM++;
        }
        const tbDate = new Date();
        tbDate.setMonth(tbDate.getMonth() + tbM);
        const sgP = Math.max(1, Number(sg.people) || 1),
          sgGrand =
            sg.total +
            (sg.total * Number(sg.tax)) / 100 +
            (sg.total * Number(sg.tip)) / 100;
        const sgPer = Math.round(sgGrand / sgP);
        const NAMES = [
          "Andi",
          "Budi",
          "Citra",
          "Dani",
          "Eka",
          "Fani",
          "Gilang",
          "Hana",
          "Indra",
          "Joko",
        ];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                gap: 8,
                overflowX: "auto",
              },
              className: "hide-scrollbar",
            },
            KAL_TABS.map((t) =>
              /*#__PURE__*/ React.createElement(
                "button",
                {
                  key: t.key,
                  onClick: () => setTab(t.key),
                  style: {
                    flexShrink: 0,
                    borderRadius: 999,
                    padding: "8px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-sans)",
                    background:
                      tab === t.key ? "var(--primary)" : "var(--secondary)",
                    color: tab === t.key ? "#fff" : "var(--muted-foreground)",
                  },
                },
                t.label,
              ),
            ),
          ),
          tab === "zakat" &&
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Kalkulator Zakat Maal",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginBottom: 14,
                  },
                },
                "Nisab = 85g emas \xD7 Rp 1.100.000 = ",
                /*#__PURE__*/ React.createElement(
                  "strong",
                  {
                    style: {
                      color: "var(--foreground)",
                    },
                  },
                  "Rp 93.500.000",
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: grid,
                },
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Kas & Tabungan (Rp)",
                  value: zk.cash,
                  set: u(setZk)("cash"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Investasi (Rp)",
                  value: zk.invest,
                  set: u(setZk)("invest"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Nilai Emas (Rp)",
                  value: zk.gold,
                  set: u(setZk)("gold"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Hutang / Liabilitas (Rp)",
                  value: zk.liab,
                  set: u(setZk)("liab"),
                }),
              ),
              /*#__PURE__*/ React.createElement(KalResult, {
                label:
                  zakat > 0 ? "Zakat yang Wajib Dibayar" : "Belum Wajib Zakat",
                value: fmt(zakat),
                detail: /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  "Harta zakatable: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--foreground)",
                      },
                    },
                    fmt(zakatable),
                  ),
                  " \xB7 Nisab: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--foreground)",
                      },
                    },
                    fmt(nisab),
                  ),
                ),
              }),
            ),
          tab === "pph21" &&
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Kalkulator PPh 21 (UU HPP)",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginBottom: 14,
                  },
                },
                "PTKP TK/0: Rp 54.000.000 \xB7 Biaya jabatan: 5% maks Rp 6.000.000",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: grid,
                },
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Penghasilan Bruto / Tahun (Rp)",
                  value: pph.gross,
                  set: u(setPph)("gross"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Zakat yang Dibayar (Rp)",
                  value: pph.zakat,
                  set: u(setPph)("zakat"),
                }),
              ),
              /*#__PURE__*/ React.createElement(KalResult, {
                label: "Total PPh 21 Terutang / Tahun",
                value: fmt(pphTax),
                detail: /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  "PKP: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--foreground)",
                      },
                    },
                    fmt(pphPkp),
                  ),
                  " \xB7 Efektif ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--primary)",
                      },
                    },
                    pph.gross > 0 ? ((pphTax / pph.gross) * 100).toFixed(2) : 0,
                    "%",
                  ),
                ),
              }),
            ),
          tab === "investasi" &&
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Kalkulator Investasi",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: grid,
                },
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Modal Awal (Rp)",
                  value: inv.modal,
                  set: u(setInv)("modal"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Setoran Bulanan (Rp)",
                  value: inv.monthly,
                  set: u(setInv)("monthly"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Return per Tahun (%)",
                  value: inv.rate,
                  set: u(setInv)("rate"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Jangka Waktu (Tahun)",
                  value: inv.years,
                  set: u(setInv)("years"),
                  num: true,
                }),
              ),
              /*#__PURE__*/ React.createElement(KalResult, {
                label: "Estimasi Nilai Akhir",
                value: fmt(iFv),
                detail: /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  "Modal total: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--foreground)",
                      },
                    },
                    fmt(iTot),
                  ),
                  " \xB7 Keuntungan: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--success)",
                      },
                    },
                    fmt(iFv - iTot),
                  ),
                ),
              }),
            ),
          tab === "kredit" &&
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Kalkulator Kredit / KPR",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: grid,
                },
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Jumlah Pinjaman (Rp)",
                  value: kr.pinjaman,
                  set: u(setKr)("pinjaman"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Bunga per Tahun (%)",
                  value: kr.bunga,
                  set: u(setKr)("bunga"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Tenor (Tahun)",
                  value: kr.tenor,
                  set: u(setKr)("tenor"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "DP (%)",
                  value: kr.dp,
                  set: u(setKr)("dp"),
                  num: true,
                }),
              ),
              /*#__PURE__*/ React.createElement(KalResult, {
                label: "Cicilan per Bulan",
                value: fmt(kCic),
                detail: /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  "Pokok pinjaman: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--foreground)",
                      },
                    },
                    fmt(kPokok),
                  ),
                  " \xB7 Total bayar: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--destructive)",
                      },
                    },
                    fmt(kCic * kN),
                  ),
                ),
              }),
            ),
          tab === "pensiun" &&
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Kalkulator Dana Pensiun",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: grid,
                },
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Usia Sekarang",
                  value: pn.now,
                  set: u(setPn)("now"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Target Usia Pensiun",
                  value: pn.retire,
                  set: u(setPn)("retire"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Pengeluaran / Bulan (Rp)",
                  value: pn.monthly,
                  set: u(setPn)("monthly"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Return Investasi (%/thn)",
                  value: pn.ret,
                  set: u(setPn)("ret"),
                  num: true,
                }),
              ),
              /*#__PURE__*/ React.createElement(KalResult, {
                label: "Dana Pensiun yang Dibutuhkan",
                value: fmt(pNeeded),
                detail: /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  "Investasi bulanan yang dibutuhkan: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--primary)",
                      },
                    },
                    fmt(pPmt),
                  ),
                ),
              }),
            ),
          tab === "tabungan" &&
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Kalkulator Tabungan",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: grid,
                },
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Target Tabungan (Rp)",
                  value: tb.target,
                  set: u(setTb)("target"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Saldo Saat Ini (Rp)",
                  value: tb.current,
                  set: u(setTb)("current"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Bunga per Tahun (%)",
                  value: tb.bunga,
                  set: u(setTb)("bunga"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Setoran per Bulan (Rp)",
                  value: tb.setor,
                  set: u(setTb)("setor"),
                }),
              ),
              /*#__PURE__*/ React.createElement(KalResult, {
                label: "Estimasi Tercapai",
                value: `±${tbM} Bulan`,
                detail: /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  "Target tercapai sekitar: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--primary)",
                      },
                    },
                    KAL_MONTHS[tbDate.getMonth()],
                    " ",
                    tbDate.getFullYear(),
                  ),
                ),
              }),
            ),
          tab === "splitgroup" &&
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Kalkulator Split Bill Group",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginBottom: 14,
                  },
                },
                "Hitung patungan untuk acara cafe, makan bareng, atau trip rombongan.",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: grid,
                },
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Total Tagihan (Rp)",
                  value: sg.total,
                  set: u(setSg)("total"),
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Jumlah Orang",
                  value: sg.people,
                  set: u(setSg)("people"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Pajak / Service (%)",
                  value: sg.tax,
                  set: u(setSg)("tax"),
                  num: true,
                }),
                /*#__PURE__*/ React.createElement(KalField, {
                  label: "Tip Tambahan (%)",
                  value: sg.tip,
                  set: u(setSg)("tip"),
                  num: true,
                }),
              ),
              /*#__PURE__*/ React.createElement(KalResult, {
                label: "Per Orang Bayar",
                value: fmt(sgPer),
                detail: /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  "Total + pajak/tip: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--primary)",
                      },
                    },
                    fmt(sgGrand),
                  ),
                ),
              }),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  },
                },
                NAMES.slice(0, Math.min(sgP, 10)).map((n) =>
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      key: n,
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        padding: "10px 14px",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        style: {
                          fontSize: 13,
                          fontWeight: 600,
                        },
                      },
                      n,
                    ),
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        className: "mono",
                        style: {
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--primary)",
                        },
                      },
                      fmt(sgPer),
                    ),
                  ),
                ),
              ),
            ),
        );
      }
      window.ScreenKalkulator = ScreenKalkulator;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-kalkulator.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-laporan.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Laporan (reports hub, 16 report tabs). */
      const LAP_TABS = [
        {
          id: "rsum",
          label: "Ringkasan",
        },
        {
          id: "rharian",
          label: "Laporan Harian",
        },
        {
          id: "rbulanan",
          label: "Laporan Bulanan",
        },
        {
          id: "rtahunan",
          label: "Laporan Tahunan",
        },
        {
          id: "rfamily",
          label: "Group Family",
        },
        {
          id: "rbank",
          label: "Laporan Bank",
        },
        {
          id: "rdetail",
          label: "Laporan Detail",
        },
        {
          id: "raliran",
          label: "Aliran Dana",
        },
        {
          id: "rpnl",
          label: "PNL",
        },
        {
          id: "rbalance",
          label: "Balance Sheet",
        },
        {
          id: "rcashflow",
          label: "Cashflow",
        },
        {
          id: "rkas",
          label: "Arus Kas",
        },
        {
          id: "rinv",
          label: "Investasi",
        },
        {
          id: "rasl",
          label: "Aset & Liabilitas",
        },
        {
          id: "rperf",
          label: "Performa",
        },
        {
          id: "rpajak",
          label: "Pajak",
        },
      ];
      function ScreenLaporan() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, BarChart, Button, StatusBadge } = DS;
        const { rise, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const L = WM.laporan;
        const [tab, setTab] = React.useState("rsum");
        const fmt = WM.formatRupiah,
          fc = WM.formatCompact;
        const totIncome = L.monthly.reduce((a, m) => a + m.income, 0);
        const totExpense = L.monthly.reduce((a, m) => a + m.expense, 0);
        const Row = ({ k, v, color, bold }) =>
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                padding: "9px 0",
                borderTop: "1px solid var(--border)",
                fontSize: 13,
                fontWeight: bold ? 800 : 500,
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  color: bold ? "var(--foreground)" : "var(--muted-foreground)",
                },
              },
              k,
            ),
            /*#__PURE__*/ React.createElement(
              "span",
              {
                className: "mono",
                style: {
                  color: color || "var(--foreground)",
                  fontWeight: bold ? 800 : 600,
                },
              },
              fmt(v),
            ),
          );
        function report() {
          if (
            tab === "rbulanan" ||
            tab === "rtahunan" ||
            tab === "rharian" ||
            tab === "rdetail" ||
            tab === "rfamily" ||
            tab === "rbank"
          ) {
            return /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Laporan Bulanan \u2014 2026",
              },
              /*#__PURE__*/ React.createElement(
                "table",
                {
                  style: {
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "thead",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "tr",
                    {
                      style: {
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: ".05em",
                        color: "var(--muted-foreground)",
                        textAlign: "left",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          padding: "8px 0",
                          fontWeight: 700,
                        },
                      },
                      "Bulan",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          padding: "8px 0",
                          fontWeight: 700,
                          textAlign: "right",
                        },
                      },
                      "Pemasukan",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          padding: "8px 0",
                          fontWeight: 700,
                          textAlign: "right",
                        },
                      },
                      "Pengeluaran",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          padding: "8px 0",
                          fontWeight: 700,
                          textAlign: "right",
                        },
                      },
                      "Surplus",
                    ),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "tbody",
                  null,
                  L.monthly.map((m) =>
                    /*#__PURE__*/ React.createElement(
                      "tr",
                      {
                        key: m.month,
                        style: {
                          borderTop: "1px solid var(--border)",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          style: {
                            padding: "10px 0",
                            fontWeight: 600,
                          },
                        },
                        m.month,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          className: "mono",
                          style: {
                            padding: "10px 0",
                            textAlign: "right",
                            color: "var(--success)",
                          },
                        },
                        fc(m.income),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          className: "mono",
                          style: {
                            padding: "10px 0",
                            textAlign: "right",
                            color: "var(--destructive)",
                          },
                        },
                        fc(m.expense),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          className: "mono",
                          style: {
                            padding: "10px 0",
                            textAlign: "right",
                            fontWeight: 700,
                          },
                        },
                        fc(m.income - m.expense),
                      ),
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "tr",
                    {
                      style: {
                        borderTop: "2px solid var(--border)",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "td",
                      {
                        style: {
                          padding: "10px 0",
                          fontWeight: 800,
                        },
                      },
                      "Total",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "td",
                      {
                        className: "mono",
                        style: {
                          padding: "10px 0",
                          textAlign: "right",
                          fontWeight: 800,
                          color: "var(--success)",
                        },
                      },
                      fc(totIncome),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "td",
                      {
                        className: "mono",
                        style: {
                          padding: "10px 0",
                          textAlign: "right",
                          fontWeight: 800,
                          color: "var(--destructive)",
                        },
                      },
                      fc(totExpense),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "td",
                      {
                        className: "mono",
                        style: {
                          padding: "10px 0",
                          textAlign: "right",
                          fontWeight: 800,
                        },
                      },
                      fc(totIncome - totExpense),
                    ),
                  ),
                ),
              ),
            );
          }
          if (tab === "rpnl") {
            const inc = L.pnl.income.reduce((a, x) => a + x.v, 0),
              exp = L.pnl.expense.reduce((a, x) => a + x.v, 0);
            return /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Laporan Laba Rugi (PNL) \u2014 Juni 2026",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    color: "var(--success)",
                    margin: "4px 0",
                  },
                },
                "Pemasukan",
              ),
              L.pnl.income.map((x) =>
                /*#__PURE__*/ React.createElement(Row, {
                  key: x.k,
                  k: x.k,
                  v: x.v,
                  color: "var(--success)",
                }),
              ),
              /*#__PURE__*/ React.createElement(Row, {
                k: "Total Pemasukan",
                v: inc,
                color: "var(--success)",
                bold: true,
              }),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    color: "var(--destructive)",
                    margin: "14px 0 4px",
                  },
                },
                "Pengeluaran",
              ),
              L.pnl.expense.map((x) =>
                /*#__PURE__*/ React.createElement(Row, {
                  key: x.k,
                  k: x.k,
                  v: x.v,
                  color: "var(--destructive)",
                }),
              ),
              /*#__PURE__*/ React.createElement(Row, {
                k: "Total Pengeluaran",
                v: exp,
                color: "var(--destructive)",
                bold: true,
              }),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 14,
                    borderRadius: 12,
                    background: "var(--accent)",
                    padding: 16,
                    textAlign: "center",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11.5,
                      color: "var(--muted-foreground)",
                    },
                  },
                  "Laba Bersih",
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      fontSize: 24,
                      fontWeight: 900,
                      color: "var(--primary)",
                    },
                  },
                  fmt(inc - exp),
                ),
              ),
            );
          }
          if (tab === "rbalance" || tab === "rasl") {
            const a = L.balance.assets.reduce((s, x) => s + x.v, 0),
              li = L.balance.liabilities.reduce((s, x) => s + x.v, 0);
            return /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                },
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Aset",
                },
                L.balance.assets.map((x) =>
                  /*#__PURE__*/ React.createElement(Row, {
                    key: x.k,
                    k: x.k,
                    v: x.v,
                  }),
                ),
                /*#__PURE__*/ React.createElement(Row, {
                  k: "Total Aset",
                  v: a,
                  color: "var(--success)",
                  bold: true,
                }),
              ),
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Liabilitas & Ekuitas",
                },
                L.balance.liabilities.map((x) =>
                  /*#__PURE__*/ React.createElement(Row, {
                    key: x.k,
                    k: x.k,
                    v: x.v,
                    color: "var(--destructive)",
                  }),
                ),
                /*#__PURE__*/ React.createElement(Row, {
                  k: "Total Liabilitas",
                  v: li,
                  color: "var(--destructive)",
                  bold: true,
                }),
                /*#__PURE__*/ React.createElement(Row, {
                  k: "Ekuitas (Net Worth)",
                  v: a - li,
                  color: "var(--primary)",
                  bold: true,
                }),
              ),
            );
          }
          if (tab === "rcashflow" || tab === "rkas" || tab === "raliran") {
            return /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Arus Kas \u2014 6 Bulan Terakhir",
              },
              /*#__PURE__*/ React.createElement(BarChart, {
                months: L.monthly.map((m) => m.month.slice(0, 3)),
                income: L.monthly.map((m) => m.income / 1e6),
                expense: L.monthly.map((m) => m.expense / 1e6),
                max: 20,
                height: 160,
              }),
            );
          }
          // default: Ringkasan + others
          return /*#__PURE__*/ React.createElement(
            React.Fragment,
            null,
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 14,
                },
              },
              [
                {
                  label: "Total Pemasukan",
                  val: totIncome,
                  color: "var(--success)",
                },
                {
                  label: "Total Pengeluaran",
                  val: totExpense,
                  color: "var(--destructive)",
                },
                {
                  label: "Surplus",
                  val: totIncome - totExpense,
                  color: "var(--primary)",
                },
                {
                  label: "Rata-rata / Bulan",
                  val: Math.round((totIncome - totExpense) / 6),
                  color: "var(--foreground)",
                },
              ].map((c) =>
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    key: c.label,
                    style: {
                      ...panel(),
                      padding: 16,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginBottom: 4,
                      },
                    },
                    c.label,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 18,
                        fontWeight: 900,
                        color: c.color,
                      },
                    },
                    fc(c.val),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Tren Pemasukan vs Pengeluaran",
                style: {
                  marginTop: 14,
                },
              },
              /*#__PURE__*/ React.createElement(BarChart, {
                months: L.monthly.map((m) => m.month.slice(0, 3)),
                income: L.monthly.map((m) => m.income / 1e6),
                expense: L.monthly.map((m) => m.expense / 1e6),
                max: 20,
                height: 150,
              }),
            ),
          );
        }
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                },
              },
              "Analisis lengkap keuanganmu \u2014 pilih jenis laporan",
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                variant: "outline",
                size: "sm",
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Download",
                  size: 14,
                }),
              },
              "Unduh PDF",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
              },
              className: "hide-scrollbar",
            },
            LAP_TABS.map((t) =>
              /*#__PURE__*/ React.createElement(
                "button",
                {
                  key: t.id,
                  onClick: () => setTab(t.id),
                  style: {
                    flexShrink: 0,
                    borderRadius: 999,
                    padding: "7px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-sans)",
                    background:
                      tab === t.id ? "var(--primary)" : "var(--secondary)",
                    color: tab === t.id ? "#fff" : "var(--muted-foreground)",
                  },
                },
                t.label,
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0),
              key: tab,
            },
            report(),
          ),
        );
      }
      window.ScreenLaporan = ScreenLaporan;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-laporan.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-liabilitas.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Liabilitas (debts) screen. */
      function ScreenLiabilitas() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { StatusBadge, Button, ProgressBar } = DS;
        const { rise, IconChip, AnimatedBar, lift, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const L = WM.liabilities;
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid #FECACA",
                  background: "#FEE2E2",
                  padding: 16,
                  ...rise(0),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "#B91C1C",
                  },
                },
                "Total Liabilitas",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 22,
                    fontWeight: 900,
                    color: "var(--destructive)",
                  },
                },
                WM.formatRupiah(L.totalRemaining),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "#B91C1C",
                  },
                },
                "Sisa tagihan aktif",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...panel(),
                  padding: 16,
                  ...rise(0.4),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                "Rasio Utang terhadap Aset",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 22,
                    fontWeight: 900,
                    color: L.dtaColor,
                  },
                },
                L.dtaRatio.toFixed(1).replace(".", ","),
                "%",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 500,
                    color: L.dtaColor,
                  },
                },
                L.dtaLabel,
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "flex-end",
              },
            },
            /*#__PURE__*/ React.createElement(
              Button,
              {
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah Liabilitas",
            ),
          ),
          L.items.map((it, i) => {
            const color =
              it.progress >= 80
                ? "var(--destructive)"
                : it.progress >= 50
                  ? "var(--warning)"
                  : "var(--success)";
            return /*#__PURE__*/ React.createElement(
              "div",
              {
                key: it.name,
                onMouseEnter: (e) => lift(e, true),
                onMouseLeave: (e) => lift(e, false),
                style: {
                  ...panel(),
                  padding: 18,
                  transition: "transform .18s, box-shadow .18s",
                  ...rise(0.8 + i * 0.3),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                  },
                },
                /*#__PURE__*/ React.createElement(IconChip, {
                  name: it.isCC ? "CreditCard" : "FileText",
                  bg: "#FEE2E2",
                  fg: "#DC2626",
                  size: 38,
                  iconSize: 18,
                  radius: 10,
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 14,
                        fontWeight: 700,
                      },
                    },
                    it.name,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11.5,
                        color: "var(--muted-foreground)",
                      },
                    },
                    it.inst,
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginLeft: "auto",
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    StatusBadge,
                    {
                      variant: it.status.variant,
                      dot: true,
                    },
                    it.status.text,
                  ),
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 14,
                    marginBottom: 14,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginBottom: 3,
                      },
                    },
                    it.isCC ? "Tagihan Berjalan" : "Sisa Pokok",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "var(--destructive)",
                      },
                    },
                    WM.formatRupiah(it.remaining),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginBottom: 3,
                      },
                    },
                    it.isCC ? "Limit Kredit" : "Total Pinjaman",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 13.5,
                        fontWeight: 700,
                      },
                    },
                    WM.formatRupiah(it.total),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginBottom: 3,
                      },
                    },
                    it.isCC ? "Minimum Bayar" : "Cicilan/Bulan",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 13.5,
                        fontWeight: 700,
                      },
                    },
                    WM.formatRupiah(it.minPay),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginBottom: 3,
                      },
                    },
                    it.isCC ? "Bunga/Bulan" : "Bunga/Tahun",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "var(--destructive)",
                      },
                    },
                    it.interest,
                    "%",
                  ),
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontSize: 11.5,
                      fontWeight: 600,
                    },
                  },
                  it.progressLabel,
                ),
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontSize: 12,
                      fontWeight: 700,
                      color,
                    },
                  },
                  it.progress,
                  "%",
                ),
              ),
              /*#__PURE__*/ React.createElement(AnimatedBar, {
                value: it.progress,
                color: color,
              }),
            );
          }),
        );
      }
      window.ScreenLiabilitas = ScreenLiabilitas;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-liabilitas.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-login.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Login screen (gated entry to the app). */
      function ScreenLogin({ onLogin }) {
        const DS = window.WealthMeDesignSystem_6818de;
        const { Input, Button } = DS;
        const Icon = window.WMIcon;
        const [email, setEmail] = React.useState("demo@wealthme.id");
        const [pw, setPw] = React.useState("demo1234");
        const [show, setShow] = React.useState(false);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "gradient-auth",
            style: {
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                width: "100%",
                maxWidth: 420,
                background: "rgba(255,255,255,.97)",
                borderRadius: 24,
                padding: 40,
                boxShadow: "var(--shadow-modal)",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  marginBottom: 24,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
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
                  },
                },
                "W",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0f172a",
                  },
                },
                "Wealth",
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      color: "var(--primary)",
                    },
                  },
                  "Me",
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "h1",
              {
                style: {
                  margin: 0,
                  textAlign: "center",
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                },
              },
              "Selamat Datang Kembali \uD83D\uDC4B",
            ),
            /*#__PURE__*/ React.createElement(
              "p",
              {
                style: {
                  margin: "6px 0 24px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#94a3b8",
                },
              },
              "Masuk ke Personal Wealth OS kamu",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 12,
                  border: "1.5px solid #c7d2fe",
                  background: "linear-gradient(135deg,#eef2ff,#f5f3ff)",
                  padding: "10px 14px",
                  marginBottom: 20,
                },
              },
              /*#__PURE__*/ React.createElement(Icon, {
                name: "Info",
                size: 16,
                color: "var(--primary)",
              }),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "#3730a3",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "strong",
                  {
                    style: {
                      display: "block",
                    },
                  },
                  "Demo tersedia",
                ),
                "demo@wealthme.id / demo1234",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "form",
              {
                onSubmit: (e) => {
                  e.preventDefault();
                  onLogin();
                },
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                },
              },
              /*#__PURE__*/ React.createElement(Input, {
                label: "Email",
                value: email,
                onChange: (e) => setEmail(e.target.value),
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Mail",
                  size: 14,
                }),
              }),
              /*#__PURE__*/ React.createElement(Input, {
                label: "Password",
                type: show ? "text" : "password",
                value: pw,
                onChange: (e) => setPw(e.target.value),
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Lock",
                  size: 14,
                }),
                iconEnd: /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      cursor: "pointer",
                      display: "flex",
                    },
                    onClick: () => setShow((s) => !s),
                  },
                  /*#__PURE__*/ React.createElement(Icon, {
                    name: show ? "EyeOff" : "Eye",
                    size: 14,
                  }),
                ),
              }),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12.5,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "label",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#475569",
                      cursor: "pointer",
                    },
                  },
                  /*#__PURE__*/ React.createElement("input", {
                    type: "checkbox",
                    defaultChecked: true,
                    style: {
                      accentColor: "#4f46e5",
                    },
                  }),
                  " Ingat saya",
                ),
                /*#__PURE__*/ React.createElement(
                  "a",
                  {
                    style: {
                      fontWeight: 600,
                      color: "var(--primary)",
                      textDecoration: "none",
                    },
                  },
                  "Lupa password?",
                ),
              ),
              /*#__PURE__*/ React.createElement(
                Button,
                {
                  size: "lg",
                  iconStart: /*#__PURE__*/ React.createElement(Icon, {
                    name: "LogIn",
                    size: 16,
                    color: "#fff",
                  }),
                  style: {
                    width: "100%",
                    height: 46,
                  },
                },
                "Masuk",
              ),
            ),
          ),
        );
      }
      window.ScreenLogin = ScreenLogin;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-login.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-masterdata.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Setup Master Data screen. */
      function ScreenMasterdata() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, Button } = DS;
        const { rise } = window.WMKit;
        const WM = window.WM;
        return /*#__PURE__*/ React.createElement(
          "div",
          null,
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginBottom: 18,
                ...rise(0),
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 15,
                  fontWeight: 700,
                },
              },
              "\uD83D\uDDC4\uFE0F Setup Master Data",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                },
              },
              "Kelola data referensi yang dipakai di seluruh aplikasi",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 14,
              },
            },
            WM.masterGroups.map((g, gi) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: g.title,
                  style: rise(gi * 0.2),
                },
                /*#__PURE__*/ React.createElement(
                  SectionCard,
                  {
                    title: g.title,
                    action: /*#__PURE__*/ React.createElement(
                      Button,
                      {
                        variant: "link",
                        size: "sm",
                      },
                      "+ Tambah",
                    ),
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      },
                    },
                    g.items.map((it) =>
                      /*#__PURE__*/ React.createElement(
                        "span",
                        {
                          key: it,
                          style: {
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 20,
                            border: "1px solid var(--border)",
                            background: "var(--background)",
                            padding: "6px 10px",
                            fontSize: 12.5,
                            fontWeight: 600,
                          },
                        },
                        it,
                        /*#__PURE__*/ React.createElement(
                          "span",
                          {
                            style: {
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              color: "var(--muted-foreground)",
                              cursor: "pointer",
                            },
                          },
                          "\xD7",
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 14,
                borderRadius: 12,
                border:
                  "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
                background: "var(--accent)",
                padding: 14,
                fontSize: 12,
                color: "var(--muted-foreground)",
              },
            },
            /*#__PURE__*/ React.createElement("strong", null, "Kategori"),
            " tersimpan ke server dan dipakai di transaksi & laporan. Daftar lain (bank, jenis transaksi, dll.) adalah referensi sistem dan dikelola secara lokal.",
          ),
        );
      }
      window.ScreenMasterdata = ScreenMasterdata;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-masterdata.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-notifikasi.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Notifikasi screen. */
      function ScreenNotifikasi() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, StatusBadge, Button } = DS;
        const { rise, IconChip } = window.WMKit;
        const WM = window.WM;
        const [items, setItems] = React.useState(WM.notif.items);
        const unread = items.filter((i) => i.unread).length;
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: rise(0),
          },
          /*#__PURE__*/ React.createElement(
            SectionCard,
            {
              title: /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  },
                },
                "Notifikasi ",
                unread > 0 &&
                  /*#__PURE__*/ React.createElement(
                    StatusBadge,
                    {
                      variant: "danger",
                    },
                    unread,
                    " Baru",
                  ),
              ),
              action: /*#__PURE__*/ React.createElement(
                Button,
                {
                  variant: "link",
                  size: "sm",
                  onClick: () =>
                    setItems((p) =>
                      p.map((i) => ({
                        ...i,
                        unread: false,
                      })),
                    ),
                },
                "Tandai semua dibaca",
              ),
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                },
              },
              items.map((n, i) =>
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    key: i,
                    style: {
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 0",
                      borderTop: i ? "1px solid var(--border)" : "none",
                      opacity: n.unread ? 1 : 0.6,
                    },
                  },
                  /*#__PURE__*/ React.createElement(IconChip, {
                    name: n.icon,
                    bg: n.bg,
                    fg: n.fg,
                    size: 40,
                    iconSize: 18,
                    radius: 12,
                  }),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        flex: 1,
                        minWidth: 0,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 13.5,
                          fontWeight: 700,
                        },
                      },
                      n.title,
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          marginTop: 2,
                          fontSize: 12.5,
                          color: "var(--muted-foreground)",
                        },
                      },
                      n.body,
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          marginTop: 4,
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                        },
                      },
                      n.time,
                    ),
                  ),
                  n.unread &&
                    /*#__PURE__*/ React.createElement(
                      StatusBadge,
                      {
                        variant: "success",
                      },
                      "Baru",
                    ),
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenNotifikasi = ScreenNotifikasi;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-notifikasi.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-quickinput.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Quick Input screen. */
      function ScreenQuickinput({ onNavigate }) {
        const { rise, IconChip } = window.WMKit;
        const WM = window.WM;
        const MAP = {
          Transaksi: "transaksi",
          Investasi: "investasi",
          Rekening: "rekening",
          "E-Wallet": "dana",
          Aset: "aset",
          Liabilitas: "liabilitas",
          Asuransi: "asuransi",
          Tujuan: "tujuan",
          Anggaran: "anggaran",
          "Aset Warisan": "warisan",
          Donasi: "donation",
        };
        const go = (name) => onNavigate && MAP[name] && onNavigate(MAP[name]);
        return /*#__PURE__*/ React.createElement(
          "div",
          null,
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginBottom: 18,
                ...rise(0),
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 15,
                  fontWeight: 700,
                },
              },
              "\u26A1 Quick Input",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                },
              },
              "Pilih jenis data yang ingin kamu input \u2014 langsung isi via popup",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 12,
              },
            },
            WM.quickCards.map((c, i) =>
              /*#__PURE__*/ React.createElement(
                "button",
                {
                  key: c.name,
                  onClick: () => go(c.name),
                  style: {
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    padding: 18,
                    textAlign: "center",
                    cursor: "pointer",
                    transition:
                      "transform .15s, box-shadow .15s, border-color .15s",
                    ...rise(i * 0.25),
                  },
                  onMouseEnter: (e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px rgba(79,70,229,.14)";
                  },
                  onMouseLeave: (e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      margin: "0 auto 12px",
                    },
                  },
                  /*#__PURE__*/ React.createElement(IconChip, {
                    name: c.icon,
                    bg: c.bg,
                    fg: c.fg,
                    size: 48,
                    iconSize: 22,
                    radius: 14,
                  }),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 13.5,
                      fontWeight: 700,
                    },
                  },
                  c.name,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 3,
                      fontSize: 11,
                      lineHeight: 1.4,
                      color: "var(--muted-foreground)",
                    },
                  },
                  c.desc,
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenQuickinput = ScreenQuickinput;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-quickinput.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-rekening.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Rekening (bank accounts) screen. */
      function ScreenRekening() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { StatusBadge, Button } = DS;
        const { rise, lift, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const RK = WM.rekening;
        const actionBtn = (icon, label) =>
          /*#__PURE__*/ React.createElement(
            "button",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "8px 0",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--background)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--foreground)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              },
              onMouseEnter: (e) =>
                (e.currentTarget.style.background = "var(--accent)"),
              onMouseLeave: (e) =>
                (e.currentTarget.style.background = "var(--background)"),
            },
            /*#__PURE__*/ React.createElement(Icon, {
              name: icon,
              size: 14,
              color: "currentColor",
            }),
            " ",
            label,
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 13,
                    fontWeight: 700,
                  },
                },
                RK.accounts.length,
                " Rekening Terhubung",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                "Total: ",
                WM.formatRupiah(RK.total),
                " ",
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      opacity: 0.7,
                    },
                  },
                  "\u2248 USD ",
                  RK.usd.toLocaleString("en-US"),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah",
            ),
          ),
          RK.accounts.map((a, i) =>
            /*#__PURE__*/ React.createElement(
              "div",
              {
                key: a.name,
                onMouseEnter: (e) => lift(e, true),
                onMouseLeave: (e) => lift(e, false),
                style: {
                  ...panel(),
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  transition: "transform .18s, box-shadow .18s",
                  ...rise(i * 0.3),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      width: 48,
                      height: 36,
                      borderRadius: 8,
                      background: a.logoBg,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    },
                  },
                  a.logo,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      flex: 1,
                      minWidth: 0,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 14,
                        fontWeight: 700,
                      },
                    },
                    a.name,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                      },
                    },
                    a.number,
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  StatusBadge,
                  {
                    variant: "success",
                    dot: true,
                  },
                  "Aktif",
                ),
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "EllipsisVertical",
                  size: 16,
                  color: "var(--muted-foreground)",
                }),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                null,
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                    },
                  },
                  "Saldo",
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      fontSize: 22,
                      fontWeight: 900,
                    },
                  },
                  WM.formatRupiah(a.balance),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11.5,
                      color: "var(--muted-foreground)",
                    },
                  },
                  a.type,
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 8,
                  },
                },
                actionBtn("ArrowUpRight", "Transfer"),
                actionBtn("ArrowDownToLine", "Top Up"),
                actionBtn("ListChecks", "Mutasi"),
              ),
            ),
          ),
        );
      }
      window.ScreenRekening = ScreenRekening;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-rekening.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-rekonsiliasi.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Rekonsiliasi Bank screen (4-step wizard). */
      const REKON_STEPS = [
        {
          num: 1,
          label: "Upload",
          sub: "Upload dokumen",
        },
        {
          num: 2,
          label: "Pindai",
          sub: "AI membaca data",
        },
        {
          num: 3,
          label: "Cocokkan",
          sub: "Samakan transaksi",
        },
        {
          num: 4,
          label: "Selesai",
          sub: "Simpan hasil",
        },
      ];
      function ScreenRekonsiliasi() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, Button, StatusBadge } = DS;
        const { rise, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const [step, setStep] = React.useState(1);
        const [scanning, setScanning] = React.useState(false);
        const goScan = () => {
          setStep(2);
          setScanning(true);
          setTimeout(() => {
            setScanning(false);
            setStep(3);
          }, 2200);
        };
        const matched = WM.rekonEntries.filter((e) => e.status === "ok").length;
        const statusColor = {
          ok: "var(--success)",
          warn: "var(--warning)",
          err: "var(--destructive)",
        };
        const statusIcon = {
          ok: "Check",
          warn: "TriangleAlert",
          err: "X",
        };
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                ...panel(),
                padding: 20,
                ...rise(0),
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "flex-start",
                },
              },
              REKON_STEPS.map((s, i) => {
                const done = step > s.num,
                  active = step === s.num;
                return /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  {
                    key: s.num,
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          background: done
                            ? "var(--success)"
                            : active
                              ? "var(--primary)"
                              : "var(--muted)",
                          color:
                            done || active ? "#fff" : "var(--muted-foreground)",
                          boxShadow: active
                            ? "0 0 0 4px color-mix(in oklab, var(--primary) 20%, transparent)"
                            : "none",
                        },
                      },
                      done
                        ? /*#__PURE__*/ React.createElement(Icon, {
                            name: "Check",
                            size: 18,
                            color: "#fff",
                          })
                        : s.num,
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          marginTop: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            active || done
                              ? "var(--foreground)"
                              : "var(--muted-foreground)",
                        },
                      },
                      s.label,
                      /*#__PURE__*/ React.createElement(
                        "span",
                        {
                          style: {
                            display: "block",
                            fontSize: 10,
                            fontWeight: 400,
                            color: "var(--muted-foreground)",
                          },
                        },
                        s.sub,
                      ),
                    ),
                  ),
                  i < REKON_STEPS.length - 1 &&
                    /*#__PURE__*/ React.createElement("div", {
                      style: {
                        flex: 1,
                        height: 2,
                        marginTop: 17,
                        background:
                          step > s.num ? "var(--success)" : "var(--border)",
                      },
                    }),
                );
              }),
            ),
          ),
          step === 1 &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(0.4),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Upload Mutasi Rekening",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      marginBottom: 14,
                    },
                  },
                  "Format didukung: CSV, PDF, atau XLSX dari bank-bank berikut",
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "grid",
                      gridTemplateColumns: "repeat(6,1fr)",
                      gap: 10,
                      marginBottom: 16,
                    },
                  },
                  WM.rekonBanks.map((b) =>
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        key: b.code,
                        style: {
                          height: 44,
                          borderRadius: 10,
                          background: b.bg,
                          color: b.color,
                          fontSize: 12,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      },
                      b.code,
                    ),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "button",
                  {
                    onClick: goScan,
                    style: {
                      width: "100%",
                      borderRadius: 12,
                      border: "1.5px dashed var(--primary)",
                      background: "var(--accent)",
                      padding: "32px 16px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    },
                  },
                  /*#__PURE__*/ React.createElement(Icon, {
                    name: "CloudUpload",
                    size: 32,
                    color: "var(--primary)",
                  }),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--foreground)",
                      },
                    },
                    "Tarik & lepas file mutasi, atau klik untuk pilih",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11.5,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "CSV / PDF / XLSX \xB7 maks 10MB",
                  ),
                ),
              ),
            ),
          step === 2 &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(0.4),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "AI Sedang Memindai",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 16,
                      padding: "40px 16px",
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "gradient-ai",
                      style: {
                        width: 64,
                        height: 64,
                        borderRadius: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "wm-pop .6s ease both",
                      },
                    },
                    /*#__PURE__*/ React.createElement(Icon, {
                      name: "Bot",
                      size: 30,
                      color: "#fff",
                    }),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 14,
                        fontWeight: 700,
                      },
                    },
                    "Membaca ",
                    WM.rekonEntries.length,
                    " baris transaksi\u2026",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        width: 240,
                        height: 6,
                        borderRadius: 999,
                        background: "var(--muted)",
                        overflow: "hidden",
                      },
                    },
                    /*#__PURE__*/ React.createElement("div", {
                      style: {
                        height: "100%",
                        width: scanning ? "100%" : "0%",
                        background: "var(--primary)",
                        borderRadius: 999,
                        transition: "width 2s linear",
                      },
                    }),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "Mencocokkan otomatis dengan transaksimu\u2026",
                  ),
                ),
              ),
            ),
          step === 3 &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(0.4),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: `Hasil Pencocokan · ${matched}/${WM.rekonEntries.length} cocok otomatis`,
                  action: /*#__PURE__*/ React.createElement(
                    Button,
                    {
                      variant: "link",
                      size: "sm",
                      onClick: () => setStep(4),
                    },
                    "Simpan \u2192",
                  ),
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                    },
                  },
                  WM.rekonEntries.map((e, i) =>
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        key: i,
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "11px 0",
                          borderTop: i ? "1px solid var(--border)" : "none",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: statusColor[e.status],
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          },
                        },
                        /*#__PURE__*/ React.createElement(Icon, {
                          name: statusIcon[e.status],
                          size: 13,
                          color: "#fff",
                          stroke: 3,
                        }),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            flex: 1,
                            minWidth: 0,
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            className: "mono",
                            style: {
                              fontSize: 12.5,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            },
                          },
                          e.desc,
                        ),
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                            },
                          },
                          e.date,
                          " \xB7 ",
                          e.match,
                        ),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          className: "mono",
                          style: {
                            fontSize: 13,
                            fontWeight: 700,
                            color:
                              e.amt > 0
                                ? "var(--success)"
                                : "var(--foreground)",
                          },
                        },
                        (e.amt > 0 ? "+" : "−") +
                          WM.formatRupiah(Math.abs(e.amt)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          step === 4 &&
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(0.4),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Rekonsiliasi Selesai",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 14,
                      padding: "40px 16px",
                      textAlign: "center",
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: "var(--success-soft)",
                        color: "var(--success)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "wm-pop .6s ease both",
                      },
                    },
                    /*#__PURE__*/ React.createElement(Icon, {
                      name: "CircleCheck",
                      size: 34,
                      color: "var(--success)",
                    }),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 16,
                        fontWeight: 700,
                      },
                    },
                    matched,
                    " transaksi berhasil direkonsiliasi",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 13,
                        color: "var(--muted-foreground)",
                        maxWidth: 360,
                      },
                    },
                    "Catatan keuanganmu kini sinkron dengan mutasi bank. Entri yang belum cocok bisa ditinjau manual kapan saja.",
                  ),
                  /*#__PURE__*/ React.createElement(
                    Button,
                    {
                      onClick: () => setStep(1),
                      variant: "outline",
                      iconStart: /*#__PURE__*/ React.createElement(Icon, {
                        name: "RotateCw",
                        size: 14,
                      }),
                    },
                    "Rekonsiliasi Lagi",
                  ),
                ),
              ),
            ),
        );
      }
      window.ScreenRekonsiliasi = ScreenRekonsiliasi;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-rekonsiliasi.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-ringkasan.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Ringkasan screen. */
      function ScreenRingkasan() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, StatusBadge, ProgressBar } = DS;
        const { rise, IconChip, AnimatedBar, panel } = window.WMKit;
        const WM = window.WM;
        const R = WM.ringkasan;

        // net-worth trend → smooth svg path
        const w = 320,
          h = 90,
          min = Math.min(...R.trend) - 0.2,
          max = Math.max(...R.trend) + 0.2;
        const pts = R.trend.map((v, i) => ({
          x: (i / (R.trend.length - 1)) * w,
          y: h - ((v - min) / (max - min)) * (h - 12) - 6,
        }));
        const line = pts
          .map((p, i) =>
            i
              ? `L${p.x.toFixed(1)},${p.y.toFixed(1)}`
              : `M${p.x.toFixed(1)},${p.y.toFixed(1)}`,
          )
          .join(" ");
        const area = `${line} L${w},${h} L0,${h} Z`;
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                className: "gradient-wealth",
                style: {
                  borderRadius: "var(--radius-lg)",
                  padding: 18,
                  color: "#fff",
                  ...rise(0),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    opacity: 0.8,
                    marginBottom: 6,
                  },
                },
                "Total Kekayaan Bersih",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 20,
                    fontWeight: 900,
                  },
                },
                WM.formatCompact(WM.netWorth),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "#6ee7b7",
                    marginTop: 4,
                  },
                },
                "\u25B2 ",
                WM.formatCompact(WM.monthNet),
                " bulan ini",
              ),
            ),
            [
              {
                label: "Total Aset",
                val: WM.formatCompact(R.totalAssets),
                color: "var(--success)",
                sub: "5 jenis akun",
              },
              {
                label: "Total Liabilitas",
                val: WM.formatCompact(R.totalLiabilities),
                color: "var(--muted-foreground)",
                sub: "Kewajiban",
              },
              {
                label: "Savings Rate",
                val: R.savingsRate + "%",
                color: "var(--primary)",
                sub: "Pengeluaran " + WM.formatCompact(WM.monthExpense),
              },
            ].map((c, i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: c.label,
                  style: {
                    ...panel(),
                    padding: 18,
                    ...rise(0.4 + i * 0.3),
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      marginBottom: 6,
                    },
                  },
                  c.label,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      fontSize: 20,
                      fontWeight: 900,
                      color: c.color,
                    },
                  },
                  c.val,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      marginTop: 2,
                    },
                  },
                  c.sub,
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(1.2),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Tren Kekayaan Bersih (6 Bulan)",
                },
                /*#__PURE__*/ React.createElement(
                  "svg",
                  {
                    viewBox: `0 0 ${w} ${h}`,
                    width: "100%",
                    height: h,
                    preserveAspectRatio: "none",
                  },
                  /*#__PURE__*/ React.createElement(
                    "defs",
                    null,
                    /*#__PURE__*/ React.createElement(
                      "linearGradient",
                      {
                        id: "ngs",
                        x1: "0",
                        y1: "0",
                        x2: "0",
                        y2: "1",
                      },
                      /*#__PURE__*/ React.createElement("stop", {
                        offset: "0%",
                        stopColor: "var(--primary)",
                        stopOpacity: "0.18",
                      }),
                      /*#__PURE__*/ React.createElement("stop", {
                        offset: "100%",
                        stopColor: "var(--primary)",
                        stopOpacity: "0.01",
                      }),
                    ),
                  ),
                  /*#__PURE__*/ React.createElement("path", {
                    d: area,
                    fill: "url(#ngs)",
                  }),
                  /*#__PURE__*/ React.createElement("path", {
                    d: line,
                    fill: "none",
                    stroke: "var(--primary)",
                    strokeWidth: "2.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  }),
                  /*#__PURE__*/ React.createElement("circle", {
                    cx: pts[pts.length - 1].x,
                    cy: pts[pts.length - 1].y,
                    r: "4",
                    fill: "var(--primary)",
                  }),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                      fontSize: 10,
                      color: "var(--muted-foreground)",
                    },
                  },
                  R.trendMonths.map((m) =>
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        key: m,
                      },
                      m,
                    ),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(1.5),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Komposisi Aset",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    },
                  },
                  WM.allocation.map((a) =>
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        key: a.label,
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 4,
                            fontSize: 12,
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "span",
                          {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontWeight: 600,
                            },
                          },
                          /*#__PURE__*/ React.createElement("span", {
                            style: {
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: a.color,
                            },
                          }),
                          a.label,
                        ),
                        /*#__PURE__*/ React.createElement(
                          "span",
                          {
                            className: "mono",
                            style: {
                              color: "var(--muted-foreground)",
                            },
                          },
                          WM.formatCompact(a.amount),
                          " \xB7 ",
                          a.value,
                          "%",
                        ),
                      ),
                      /*#__PURE__*/ React.createElement(AnimatedBar, {
                        value: a.value,
                        color: a.color,
                        height: 6,
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(1.8),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Cash Flow Juni",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginBottom: 10,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "Pemasukan",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--success)",
                      },
                    },
                    WM.formatRupiah(WM.monthIncome),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginBottom: 10,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "Pengeluaran",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--destructive)",
                      },
                    },
                    WM.formatRupiah(WM.monthExpense),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      borderTop: "1px solid var(--border)",
                      paddingTop: 10,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "Surplus",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--success)",
                      },
                    },
                    WM.formatRupiah(WM.monthNet),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(2.1),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Top Pengeluaran",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                    },
                  },
                  R.topExpenses.map((t, i) =>
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        key: t.name,
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 0",
                          borderTop: i ? "1px solid var(--border)" : "none",
                        },
                      },
                      /*#__PURE__*/ React.createElement(IconChip, {
                        name: t.icon,
                        bg: t.bg,
                        fg: t.fg,
                        size: 30,
                        iconSize: 15,
                        radius: 8,
                      }),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 600,
                          },
                        },
                        t.name,
                      ),
                      /*#__PURE__*/ React.createElement(
                        StatusBadge,
                        {
                          variant: "gray",
                        },
                        t.pct,
                        "%",
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          className: "mono",
                          style: {
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--destructive)",
                          },
                        },
                        WM.formatCompact(t.amt),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: rise(2.4),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: "Health Score",
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      textAlign: "center",
                      padding: "8px 0",
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "svg",
                    {
                      viewBox: "0 0 120 70",
                      width: "150",
                      height: "86",
                      style: {
                        margin: "0 auto",
                        display: "block",
                      },
                    },
                    /*#__PURE__*/ React.createElement("path", {
                      d: "M10,60 A50,50 0 0,1 110,60",
                      fill: "none",
                      stroke: "var(--muted)",
                      strokeWidth: "12",
                      strokeLinecap: "round",
                    }),
                    /*#__PURE__*/ React.createElement("path", {
                      d: "M10,60 A50,50 0 0,1 110,60",
                      fill: "none",
                      stroke: "var(--primary)",
                      strokeWidth: "12",
                      strokeLinecap: "round",
                      strokeDasharray: "157",
                      strokeDashoffset: Math.round(157 - 0.82 * 157),
                    }),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        marginTop: -16,
                        fontSize: 32,
                        fontWeight: 900,
                        color: "var(--primary)",
                      },
                    },
                    "82",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                      },
                    },
                    "Financial Health Score",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        marginTop: 8,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      StatusBadge,
                      {
                        variant: "success",
                      },
                      "Sehat",
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenRingkasan = ScreenRingkasan;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-ringkasan.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-splitbill.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Split Bill screen (interactive settle). */
      function ScreenSplitbill() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { SectionCard, StatusBadge, Button, ProgressBar } = DS;
        const { rise, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const S = WM.splitbill;
        const [splits, setSplits] = React.useState(S.splits);
        const [openIdx, setOpenIdx] = React.useState(null);
        const AV = [
          "linear-gradient(135deg,#10B981,#06B6D4)",
          "linear-gradient(135deg,#F59E0B,#FBBF24)",
          "linear-gradient(135deg,#6366F1,#8B5CF6)",
          "linear-gradient(135deg,#EC4899,#F43F5E)",
          "linear-gradient(135deg,#06B6D4,#3B82F6)",
        ];
        const settle = (si, pi) =>
          setSplits((prev) =>
            prev.map((s, i) => {
              if (i !== si) return s;
              const parts = s.parts.map((p, j) =>
                j === pi
                  ? {
                      ...p,
                      paid: true,
                    }
                  : p,
              );
              const paid = parts.filter((p) => p.paid).length;
              return {
                ...s,
                parts,
                paid,
                pct: Math.round((paid / parts.length) * 100),
              };
            }),
          );
        const totalDit = splits.reduce((a, s) => a + s.total, 0);
        const totalCol = splits.reduce(
          (a, s) =>
            a + s.parts.filter((p) => p.paid).reduce((b, p) => b + p.amt, 0),
          0,
        );
        const belumCount = splits.reduce(
          (a, s) => a + s.parts.filter((p) => !p.paid).length,
          0,
        );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                },
              },
              "Patungan jadi gampang \u2014 kamu nalangin, mereka bayar balik",
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Buat Split Bill",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 14,
              },
            },
            [
              {
                label: "Total Ditalangin",
                val: totalDit,
                color: "var(--primary)",
                sub: splits.length + " split aktif",
              },
              {
                label: "Sudah Dibayar",
                val: totalCol,
                color: "var(--success)",
                sub: Math.round((totalCol / totalDit) * 100) + "% terkumpul",
              },
              {
                label: "Belum Dibayar",
                val: totalDit - totalCol,
                color: "var(--destructive)",
                sub: belumCount + " orang belum bayar",
              },
            ].map((c, i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: c.label,
                  style: {
                    ...panel(),
                    padding: 16,
                    ...rise(i * 0.3),
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      marginBottom: 4,
                    },
                  },
                  c.label,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      fontSize: 20,
                      fontWeight: 900,
                      color: c.color,
                    },
                  },
                  WM.formatCompact(c.val),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                    },
                  },
                  c.sub,
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(1),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Split Bill Aktif",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  },
                },
                splits.map((s, si) => {
                  const barColor =
                    s.pct >= 75 ? "var(--success)" : "var(--warning)";
                  const open = openIdx === si;
                  return /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      key: si,
                      style: {
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        padding: 14,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 12,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            flex: 1,
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              fontSize: 14,
                              fontWeight: 700,
                            },
                          },
                          s.title,
                        ),
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            style: {
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                            },
                          },
                          s.date,
                          " \xB7 ",
                          s.people,
                          " orang",
                        ),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            textAlign: "right",
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            className: "mono",
                            style: {
                              fontSize: 15,
                              fontWeight: 800,
                            },
                          },
                          WM.formatRupiah(s.total),
                        ),
                        /*#__PURE__*/ React.createElement(
                          "div",
                          {
                            className: "mono",
                            style: {
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                            },
                          },
                          WM.formatCompact(Math.round(s.total / s.people)),
                          "/org",
                        ),
                      ),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          marginBottom: 8,
                        },
                      },
                      /*#__PURE__*/ React.createElement(ProgressBar, {
                        value: s.pct,
                        color: barColor,
                      }),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 12,
                            color: "var(--muted-foreground)",
                          },
                        },
                        /*#__PURE__*/ React.createElement(
                          "span",
                          {
                            style: {
                              fontWeight: 700,
                              color: barColor,
                            },
                          },
                          s.paid,
                          " dari ",
                          s.people,
                        ),
                        " sudah bayar",
                      ),
                      /*#__PURE__*/ React.createElement(
                        "button",
                        {
                          onClick: () => setOpenIdx(open ? null : si),
                          style: {
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 8,
                            border: "none",
                            background: "var(--accent)",
                            color: "var(--primary)",
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "var(--font-sans)",
                          },
                        },
                        /*#__PURE__*/ React.createElement(Icon, {
                          name: "Users",
                          size: 13,
                          color: "currentColor",
                        }),
                        " Detail",
                      ),
                    ),
                    open &&
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "1px solid var(--border)",
                          },
                        },
                        s.parts.map((p, pi) =>
                          /*#__PURE__*/ React.createElement(
                            "div",
                            {
                              key: pi,
                              style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "7px 0",
                              },
                            },
                            /*#__PURE__*/ React.createElement(
                              "div",
                              {
                                style: {
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: AV[pi % AV.length],
                                  color: "#fff",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                },
                              },
                              p.name[0],
                            ),
                            /*#__PURE__*/ React.createElement(
                              "div",
                              {
                                style: {
                                  flex: 1,
                                },
                              },
                              /*#__PURE__*/ React.createElement(
                                "div",
                                {
                                  style: {
                                    fontSize: 13,
                                    fontWeight: 600,
                                  },
                                },
                                p.name,
                              ),
                              /*#__PURE__*/ React.createElement(
                                "div",
                                {
                                  className: "mono",
                                  style: {
                                    fontSize: 11,
                                    color: "var(--muted-foreground)",
                                  },
                                },
                                WM.formatRupiah(p.amt),
                              ),
                            ),
                            p.paid
                              ? /*#__PURE__*/ React.createElement(
                                  StatusBadge,
                                  {
                                    variant: "success",
                                    dot: true,
                                  },
                                  "Lunas",
                                )
                              : /*#__PURE__*/ React.createElement(
                                  "button",
                                  {
                                    onClick: () => settle(si, pi),
                                    style: {
                                      borderRadius: 8,
                                      border: "1px solid var(--border)",
                                      background: "transparent",
                                      color: "var(--muted-foreground)",
                                      padding: "4px 12px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontFamily: "var(--font-sans)",
                                    },
                                  },
                                  "Tandai Lunas",
                                ),
                          ),
                        ),
                      ),
                  );
                }),
              ),
            ),
          ),
        );
      }
      window.ScreenSplitbill = ScreenSplitbill;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-splitbill.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-tax.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Tax Center screen (live PPh 21 progressive calculator). */
      function ScreenTax() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { HeroCard, SectionCard, Button } = DS;
        const { rise, IconChip, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const T = WM.tax;
        const [gross, setGross] = React.useState(T.calc.gross);
        const [ptkp, setPtkp] = React.useState(T.calc.ptkp);
        const [zakat, setZakat] = React.useState(T.calc.zakat);
        const BRACKETS = [
          [60e6, 0.05],
          [190e6, 0.15],
          [250e6, 0.25],
          [4.5e9, 0.3],
          [Infinity, 0.35],
        ];
        const ROWS = [
          {
            label: "0 – 60 jt",
            rate: "5%",
            idx: 0,
          },
          {
            label: "60 – 250 jt",
            rate: "15%",
            idx: 1,
          },
          {
            label: "250 – 500 jt",
            rate: "25%",
            idx: 2,
          },
          {
            label: "> 5 M",
            rate: "35%",
            idx: 4,
          },
        ];
        const jabatan = Math.min(gross * 0.05, 6e6);
        let pkp = Math.max(0, gross - jabatan - ptkp - zakat);
        pkp = Math.floor(pkp / 1000) * 1000;
        const layer = new Array(BRACKETS.length).fill(0);
        let tax = 0,
          sisa = pkp;
        for (let i = 0; i < BRACKETS.length; i++) {
          if (sisa <= 0) break;
          const ken = Math.min(sisa, BRACKETS[i][0]);
          layer[i] = ken * BRACKETS[i][1];
          tax += layer[i];
          sisa -= ken;
        }
        tax = Math.round(tax);
        const effRate =
          gross > 0
            ? ((tax / gross) * 100).toFixed(1).replace(".", ",") + "%"
            : "0%";
        const numField = (label, value, setter, disabled) =>
          /*#__PURE__*/ React.createElement(
            "div",
            null,
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 12.5,
                  color: "var(--muted-foreground)",
                  marginBottom: 6,
                },
              },
              label,
            ),
            /*#__PURE__*/ React.createElement("input", {
              type: "text",
              value: value.toLocaleString("id-ID"),
              disabled: disabled,
              onChange: (e) =>
                setter &&
                setter(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0),
              className: "mono",
              style: {
                width: "100%",
                height: 38,
                padding: "0 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--input)",
                background: "var(--card)",
                color: "var(--foreground)",
                fontSize: 13,
                outline: "none",
                opacity: disabled ? 0.7 : 1,
              },
            }),
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0),
            },
            /*#__PURE__*/ React.createElement(
              HeroCard,
              {
                gradient: "gradient-wealth",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "FileText",
                  size: 14,
                  color: "#fff",
                }),
                " Estimasi Pajak Terutang ",
                T.year,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 30,
                    fontWeight: 900,
                    letterSpacing: "-1px",
                    marginTop: 4,
                  },
                },
                WM.formatRupiah(tax),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                    marginTop: 6,
                  },
                },
                "PPh 21 \xB7 Status: WP Orang Pribadi",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 14,
              },
            },
            [
              {
                label: `Status SPT Tahunan ${T.year - 1}`,
                val: "✅ Sudah Lapor",
                color: "var(--success)",
                sub: "NTTE 123456789",
              },
              {
                label: `SPT ${T.year}`,
                val: "⏳ Belum Lapor",
                color: "var(--warning)",
                sub: `Deadline 31 Mar ${T.year + 1}`,
              },
              {
                label: "Zakat Pengurang Pajak",
                val: WM.formatCompact(zakat),
                color: "var(--primary)",
                sub: "dari donasi tercatat",
              },
            ].map((c, i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    ...panel(),
                    padding: 16,
                    ...rise(0.4 + i * 0.2),
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 10.5,
                      color: "var(--muted-foreground)",
                      marginBottom: 4,
                    },
                  },
                  c.label,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      fontSize: 16,
                      fontWeight: 800,
                      color: c.color,
                    },
                  },
                  c.val,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 10.5,
                      color: "var(--muted-foreground)",
                    },
                  },
                  c.sub,
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(1),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "\uD83E\uDDEE Kalkulator PPh 21 (Pribadi)",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginBottom: 14,
                  },
                },
                "Hitung estimasi pajak penghasilan berdasarkan tarif progresif UU HPP",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  },
                },
                numField("Penghasilan Bruto/Tahun (Rp)", gross, setGross),
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 12.5,
                        color: "var(--muted-foreground)",
                        marginBottom: 6,
                      },
                    },
                    "Status (PTKP)",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "select",
                    {
                      value: ptkp,
                      onChange: (e) => setPtkp(Number(e.target.value)),
                      style: {
                        width: "100%",
                        height: 38,
                        padding: "0 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--input)",
                        background: "var(--card)",
                        color: "var(--foreground)",
                        fontSize: 13,
                        outline: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                      },
                    },
                    T.ptkpOptions.map((o) =>
                      /*#__PURE__*/ React.createElement(
                        "option",
                        {
                          key: o.value,
                          value: o.value,
                        },
                        o.label,
                      ),
                    ),
                  ),
                ),
                numField(
                  "Biaya Jabatan (otomatis)",
                  Math.round(jabatan),
                  null,
                  true,
                ),
                numField("Zakat/Donasi (pengurang)", zakat, setZakat),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 16,
                    borderRadius: 12,
                    border:
                      "1px solid color-mix(in oklab, var(--primary) 15%, transparent)",
                    background: "var(--accent)",
                    padding: 16,
                    textAlign: "center",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11.5,
                      color: "var(--muted-foreground)",
                    },
                  },
                  "Estimasi PPh 21 Terutang/Tahun",
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    className: "mono",
                    style: {
                      marginTop: 4,
                      fontSize: 24,
                      fontWeight: 900,
                      color: "var(--primary)",
                    },
                  },
                  WM.formatRupiah(tax),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginTop: 6,
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                    },
                  },
                  "PKP: ",
                  /*#__PURE__*/ React.createElement(
                    "strong",
                    {
                      style: {
                        color: "var(--primary)",
                      },
                    },
                    WM.formatRupiah(pkp),
                  ),
                  " \xB7 Efektif ",
                  /*#__PURE__*/ React.createElement("strong", null, effRate),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(1.4),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Rincian Tarif Progresif (UU HPP)",
              },
              /*#__PURE__*/ React.createElement(
                "table",
                {
                  style: {
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "thead",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "tr",
                    {
                      style: {
                        borderBottom: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                        fontSize: 11,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          textAlign: "left",
                          padding: "8px 0",
                          fontWeight: 600,
                        },
                      },
                      "Lapisan PKP",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          textAlign: "center",
                          padding: "8px 0",
                          fontWeight: 600,
                        },
                      },
                      "Tarif",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "th",
                      {
                        style: {
                          textAlign: "right",
                          padding: "8px 0",
                          fontWeight: 600,
                        },
                      },
                      "Pajak",
                    ),
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "tbody",
                  null,
                  ROWS.map((r) => {
                    const t = layer[r.idx];
                    const muted = t <= 0;
                    const c = muted
                      ? "var(--muted-foreground)"
                      : "var(--foreground)";
                    return /*#__PURE__*/ React.createElement(
                      "tr",
                      {
                        key: r.label,
                        style: {
                          borderTop: "1px solid var(--border)",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          style: {
                            padding: "9px 0",
                            color: c,
                          },
                        },
                        r.label,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          style: {
                            padding: "9px 0",
                            textAlign: "center",
                            color: c,
                          },
                        },
                        r.rate,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "td",
                        {
                          className: "mono",
                          style: {
                            padding: "9px 0",
                            textAlign: "right",
                            color: c,
                          },
                        },
                        WM.formatRupiah(Math.round(t)),
                      ),
                    );
                  }),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(1.8),
            },
            /*#__PURE__*/ React.createElement(
              SectionCard,
              {
                title: "Dokumen Pajak",
                action: /*#__PURE__*/ React.createElement(
                  Button,
                  {
                    variant: "link",
                    size: "sm",
                  },
                  "+ Upload",
                ),
              },
              T.docs.map((d, i) =>
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    key: i,
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 0",
                      borderTop: i ? "1px solid var(--border)" : "none",
                    },
                  },
                  /*#__PURE__*/ React.createElement(IconChip, {
                    name: d.icon,
                    bg: d.bg,
                    fg: d.fg,
                    size: 34,
                    iconSize: 16,
                    radius: 9,
                  }),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        flex: 1,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 13.5,
                          fontWeight: 600,
                        },
                      },
                      d.name,
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: 11.5,
                          color: "var(--muted-foreground)",
                        },
                      },
                      d.meta,
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(Icon, {
                    name: "Download",
                    size: 16,
                    color: "var(--primary)",
                  }),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                gap: 10,
              },
            },
            /*#__PURE__*/ React.createElement(
              Button,
              {
                size: "lg",
                style: {
                  flex: 1,
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Send",
                  size: 15,
                  color: "#fff",
                }),
              },
              "Lapor SPT Tahunan",
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                size: "lg",
                variant: "outline",
                style: {
                  flex: 1,
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "FileText",
                  size: 15,
                }),
              },
              "Unduh Ringkasan",
            ),
          ),
        );
      }
      window.ScreenTax = ScreenTax;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-tax.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-transaksi.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Transaksi screen (faithful recreation, enhanced). */
      function ScreenTransaksi() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { MoneyStat, Button } = DS;
        const { rise, IconChip, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const [filter, setFilter] = React.useState("Semua");
        const [sort, setSort] = React.useState("Terbaru");
        const groups =
          sort === "Terlama" ? [...WM.txn.groups].reverse() : WM.txn.groups;
        const matches = (r) =>
          filter === "Semua" ||
          (filter === "Masuk" && r.inc) ||
          (filter === "Keluar" && r.type === "expense") ||
          (filter === "Transfer" && r.type === "transfer") ||
          (filter === "Kartu Kredit" && r.type === "credit");
        const ICON = {
          income: {
            name: "ArrowDownLeft",
            bg: "#DCFCE7",
            fg: "#16A34A",
          },
          expense: {
            name: "CreditCard",
            bg: "#FEE2E2",
            fg: "#DC2626",
          },
          transfer: {
            name: "ArrowLeftRight",
            bg: "#EDE9FE",
            fg: "#7C3AED",
          },
          credit: {
            name: "CreditCard",
            bg: "#FEF3C7",
            fg: "#CA8A04",
          },
        };
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                },
              },
              "Catat & kelola semua transaksimu",
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah Transaksi",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                ...panel(),
                padding: 16,
                ...rise(0),
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 12,
                },
              },
              /*#__PURE__*/ React.createElement(MoneyStat, {
                label: "Total Pemasukan",
                value: WM.formatRupiah(WM.txn.income),
                valueColor: "var(--success)",
              }),
              /*#__PURE__*/ React.createElement(MoneyStat, {
                label: "Total Pengeluaran",
                value: WM.formatRupiah(WM.txn.expense),
                valueColor: "var(--destructive)",
              }),
              /*#__PURE__*/ React.createElement(MoneyStat, {
                label: "Selisih",
                value: WM.formatRupiah(WM.txn.net),
                valueColor: "var(--success)",
              }),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                },
              },
              WM.txn.filters.map((f) =>
                /*#__PURE__*/ React.createElement(
                  "button",
                  {
                    key: f,
                    onClick: () => setFilter(f),
                    style: {
                      borderRadius: 999,
                      padding: "6px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      background:
                        filter === f ? "var(--primary)" : "var(--secondary)",
                      color: filter === f ? "#fff" : "var(--muted-foreground)",
                    },
                  },
                  f,
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "select",
              {
                value: sort,
                onChange: (e) => setSort(e.target.value),
                style: {
                  marginLeft: "auto",
                  appearance: "none",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  padding: "7px 28px 7px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                },
              },
              /*#__PURE__*/ React.createElement("option", null, "Terbaru"),
              /*#__PURE__*/ React.createElement("option", null, "Terlama"),
            ),
          ),
          groups.map((g, gi) => {
            const rows = g.rows.filter(matches);
            if (!rows.length) return null;
            return /*#__PURE__*/ React.createElement(
              "div",
              {
                key: g.day,
                style: rise(1 + gi * 0.5),
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginBottom: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                  },
                },
                g.day,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  },
                },
                rows.map((r, i) => {
                  const ic = ICON[r.type] || ICON.expense;
                  return /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      key: i,
                      style: {
                        ...panel(),
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        transition: "background .12s",
                        cursor: "default",
                      },
                      onMouseEnter: (e) =>
                        (e.currentTarget.style.background = "var(--accent)"),
                      onMouseLeave: (e) =>
                        (e.currentTarget.style.background = "var(--card)"),
                    },
                    /*#__PURE__*/ React.createElement(IconChip, {
                      name: ic.name,
                      bg: ic.bg,
                      fg: ic.fg,
                      size: 38,
                      iconSize: 17,
                      radius: 999,
                    }),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 13.5,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          },
                        },
                        r.name,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 11.5,
                            color: "var(--muted-foreground)",
                          },
                        },
                        r.sub,
                      ),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          textAlign: "right",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          className: "mono",
                          style: {
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: r.inc
                              ? "var(--success)"
                              : "var(--destructive)",
                          },
                        },
                        (r.inc ? "+" : "-") + WM.formatRupiah(r.amt),
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 11,
                            color: "var(--muted-foreground)",
                          },
                        },
                        r.time,
                      ),
                    ),
                  );
                }),
              ),
            );
          }),
        );
      }
      window.ScreenTransaksi = ScreenTransaksi;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-transaksi.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-tujuan.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Tujuan Keuangan (goals) screen. */
      function ScreenTujuan() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { StatusBadge, Button } = DS;
        const { rise, IconChip, AnimatedBar, lift, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const goals = WM.goalsFull;
        const onTrack = goals.filter((g) => g.status === "On Track").length;
        const boost = goals.filter((g) => g.status === "Perlu Boost").length;
        const risk = goals.filter((g) => g.status === "Berisiko").length;
        const allocated = goals.reduce((s, g) => s + g.current, 0);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 15,
                    fontWeight: 700,
                  },
                },
                goals.length,
                " Tujuan Aktif",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  },
                },
                "Total dialokasikan: ",
                WM.formatRupiah(allocated),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah Tujuan",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid #86EFAC",
                  background: "#DCFCE7",
                  padding: 16,
                  ...rise(0),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 10.5,
                    color: "#15803D",
                  },
                },
                "On Track",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#15803D",
                  },
                },
                onTrack,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "#15803D",
                  },
                },
                "tujuan berjalan baik",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...panel(),
                  padding: 16,
                  ...rise(0.4),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 10.5,
                    color: "var(--warning)",
                  },
                },
                "Perlu Boost",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--warning)",
                  },
                },
                boost,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                "tujuan perlu percepatan",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  ...panel(),
                  padding: 16,
                  ...rise(0.8),
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 10.5,
                    color: "var(--brand-purple)",
                  },
                },
                "Berisiko",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--brand-purple)",
                  },
                },
                risk,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  },
                },
                "tujuan berisiko tidak tercapai",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              },
            },
            goals.map((g, i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: g.name,
                  onMouseEnter: (e) => lift(e, true),
                  onMouseLeave: (e) => lift(e, false),
                  style: {
                    background: "var(--card)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--ring-card)",
                    overflow: "hidden",
                    transition: "transform .18s, box-shadow .18s",
                    ...rise(1.2 + i * 0.3),
                  },
                },
                /*#__PURE__*/ React.createElement("div", {
                  style: {
                    height: 3,
                    background: g.color,
                  },
                }),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      padding: 18,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 12,
                      },
                    },
                    /*#__PURE__*/ React.createElement(IconChip, {
                      name: g.icon,
                      bg: g.bg,
                      fg: g.fg,
                      size: 40,
                      iconSize: 19,
                      radius: 11,
                    }),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          minWidth: 0,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 14,
                            fontWeight: 700,
                          },
                        },
                        g.name,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 11.5,
                            color: "var(--muted-foreground)",
                          },
                        },
                        "Target: ",
                        g.targetDate,
                      ),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          marginLeft: "auto",
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        StatusBadge,
                        {
                          variant: g.variant,
                        },
                        g.status,
                      ),
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 26,
                        fontWeight: 800,
                        color: g.color,
                        marginBottom: 8,
                      },
                    },
                    g.pct,
                    "%",
                  ),
                  /*#__PURE__*/ React.createElement(AnimatedBar, {
                    value: g.pct,
                    color: g.color,
                    height: 9,
                  }),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      className: "mono",
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 10,
                        fontSize: 11.5,
                        color: "var(--muted-foreground)",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "span",
                      null,
                      WM.formatRupiah(g.current),
                      " terkumpul",
                    ),
                    /*#__PURE__*/ React.createElement(
                      "span",
                      null,
                      "Target ",
                      WM.formatCompact(g.target),
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid var(--border)",
                        fontSize: 12,
                        fontWeight: 600,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        className: "mono",
                      },
                      "Sisa: ",
                      WM.formatCompact(g.remaining),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        style: {
                          color: "var(--muted-foreground)",
                        },
                      },
                      g.autoDebit
                        ? `Auto-debit ${WM.formatCompact(g.autoDebit)}/bln`
                        : "Tanpa auto-debit",
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      window.ScreenTujuan = ScreenTujuan;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-tujuan.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/screen-warisan.jsx
  try {
    (() => {
      /* WealthMe UI-kit — Warisan (inheritance) screen. */
      function ScreenWarisan() {
        const DS = window.WealthMeDesignSystem_6818de;
        const { HeroCard, SectionCard, Switch, Button } = DS;
        const { rise, IconChip, panel } = window.WMKit;
        const Icon = window.WMIcon;
        const WM = window.WM;
        const W = WM.warisan;
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 16,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: rise(0),
            },
            /*#__PURE__*/ React.createElement(
              HeroCard,
              {
                gradient: "gradient-wealth",
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "Scroll",
                  size: 14,
                  color: "#fff",
                }),
                " Total Nilai Warisan",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 30,
                    fontWeight: 900,
                    letterSpacing: "-1px",
                    marginTop: 4,
                  },
                },
                WM.formatRupiah(W.total),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12,
                    opacity: 0.85,
                    marginTop: 6,
                  },
                },
                W.assetCount,
                " aset terdaftar \xB7 ",
                W.heirs,
                " ahli waris",
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                },
              },
              "Catatan aset warisan yang dapat dilihat seluruh ahli waris",
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                style: {
                  marginLeft: "auto",
                },
                iconStart: /*#__PURE__*/ React.createElement(Icon, {
                  name: "Plus",
                  size: 14,
                  color: "#fff",
                }),
              },
              "Tambah Aset Warisan",
            ),
          ),
          W.groups.map((g, gi) =>
            /*#__PURE__*/ React.createElement(
              "div",
              {
                key: g.type,
                style: rise(0.5 + gi * 0.3),
              },
              /*#__PURE__*/ React.createElement(
                SectionCard,
                {
                  title: /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      },
                    },
                    /*#__PURE__*/ React.createElement(IconChip, {
                      name: g.icon,
                      bg: g.bg,
                      fg: g.fg,
                      size: 24,
                      iconSize: 13,
                      radius: 7,
                    }),
                    g.type,
                  ),
                },
                g.items.map((it, i) =>
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      key: it.name,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 0",
                        borderTop: i ? "1px solid var(--border)" : "none",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 13.5,
                            fontWeight: 600,
                          },
                        },
                        it.name,
                      ),
                      /*#__PURE__*/ React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 11.5,
                            color: "var(--muted-foreground)",
                          },
                        },
                        it.sub,
                      ),
                    ),
                    /*#__PURE__*/ React.createElement(
                      "div",
                      {
                        className: "mono",
                        style: {
                          fontSize: 13.5,
                          fontWeight: 700,
                        },
                      },
                      WM.formatRupiah(it.value),
                    ),
                    /*#__PURE__*/ React.createElement(Switch, {
                      defaultChecked: it.visible,
                    }),
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                ...rise(2),
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderRadius: 14,
                border:
                  "1px solid color-mix(in oklab, var(--primary) 20%, transparent)",
                background: "var(--accent)",
                padding: 16,
              },
            },
            /*#__PURE__*/ React.createElement(IconChip, {
              name: "ShieldCheck",
              bg: "var(--primary)",
              fg: "#fff",
              size: 40,
              iconSize: 20,
              radius: 11,
            }),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  flex: 1,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--primary-strong)",
                  },
                },
                "Catatan Warisan Aman & Transparan",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 2,
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  },
                },
                "Seluruh ahli waris dapat melihat daftar ini kapan saja. Tambahkan dokumen pendukung (sertifikat, BPKB, polis) agar lebih lengkap.",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                variant: "ghost",
                size: "sm",
              },
              "Upload Dokumen \u2192",
            ),
          ),
        );
      }
      window.ScreenWarisan = ScreenWarisan;
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/screen-warisan.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/wealthme-app/shell.jsx
  try {
    (() => {
      /* WealthMe UI-kit — app shell: Sidebar + Topbar. */
      const { useState } = React;
      const NAV = [
        {
          section: null,
          items: [
            {
              id: "beranda",
              label: "Beranda",
              icon: "Home",
            },
            {
              id: "ringkasan",
              label: "Ringkasan",
              icon: "PieChart",
            },
            {
              id: "transaksi",
              label: "Transaksi",
              icon: "ArrowUpDown",
            },
            {
              id: "anggaran",
              label: "Anggaran",
              icon: "ClipboardList",
            },
            {
              id: "laporan",
              label: "Laporan",
              icon: "LineChart",
            },
            {
              id: "tujuan",
              label: "Tujuan Keuangan",
              icon: "Target",
            },
            {
              id: "notifikasi",
              label: "Notifikasi",
              icon: "Bell",
            },
          ],
        },
        {
          section: "Keuangan",
          items: [
            {
              id: "dana",
              label: "Dana",
              icon: "Wallet",
            },
            {
              id: "rekening",
              label: "Rekening",
              icon: "Landmark",
            },
            {
              id: "investasi",
              label: "Investasi",
              icon: "BarChart3",
            },
            {
              id: "aset",
              label: "Aset",
              icon: "Briefcase",
            },
            {
              id: "liabilitas",
              label: "Liabilitas",
              icon: "ReceiptText",
            },
            {
              id: "asuransi",
              label: "Asuransi",
              icon: "ShieldCheck",
            },
            {
              id: "warisan",
              label: "Warisan",
              icon: "Scroll",
              badge: "New",
              badgeColor: "var(--brand-purple)",
            },
            {
              id: "donation",
              label: "Donasi & Zakat",
              icon: "HeartHandshake",
              badge: "New",
              badgeColor: "var(--success)",
            },
            {
              id: "tax",
              label: "Tax Center",
              icon: "FileText",
              badge: "New",
              badgeColor: "var(--success)",
            },
          ],
        },
        {
          section: "Alat",
          items: [
            {
              id: "splitbill",
              label: "Split Bill",
              icon: "Receipt",
              badge: "New",
              badgeColor: "var(--success)",
            },
            {
              id: "rekonsiliasi",
              label: "Rekonsiliasi Bank",
              icon: "GitCompareArrows",
            },
            {
              id: "ai",
              label: "AI Advisor",
              icon: "Bot",
            },
            {
              id: "kalkulator",
              label: "Kalkulator",
              icon: "Calculator",
            },
            {
              id: "quickinput",
              label: "Quick Input",
              icon: "Zap",
              badge: "New",
              badgeColor: "var(--success)",
            },
            {
              id: "masterdata",
              label: "Setup Master Data",
              icon: "Database",
            },
          ],
        },
      ];
      const PAGE_TITLES = {
        beranda: "Beranda",
        ringkasan: "Ringkasan",
        transaksi: "Transaksi",
        anggaran: "Anggaran",
        laporan: "Laporan",
        tujuan: "Tujuan Keuangan",
        notifikasi: "Notifikasi",
        dana: "Dana",
        rekening: "Rekening",
        investasi: "Investasi",
        aset: "Aset Saya",
        liabilitas: "Liabilitas",
        asuransi: "Asuransi",
        warisan: "Warisan",
        donation: "Donasi & Zakat",
        tax: "Tax Center",
        splitbill: "Split Bill",
        rekonsiliasi: "Rekonsiliasi Bank",
        ai: "AI Advisor",
        kalkulator: "Kalkulator",
        quickinput: "Quick Input",
        masterdata: "Setup Master Data",
        akun: "Akun",
      };
      function Sidebar({ active, onNavigate, onAddTxn }) {
        const Icon = window.WMIcon;
        return /*#__PURE__*/ React.createElement(
          "aside",
          {
            style: {
              width: 248,
              flexShrink: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "var(--card)",
              borderRight: "1px solid var(--border)",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "16px 18px",
                borderBottom: "1px solid var(--border)",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
              },
              "W",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontSize: 16,
                  fontWeight: 800,
                },
              },
              "Wealth",
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    color: "var(--primary)",
                  },
                },
                "Me",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "button",
              {
                onClick: onAddTxn,
                title: "Tambah Transaksi",
                style: {
                  marginLeft: "auto",
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-primary)",
                },
              },
              /*#__PURE__*/ React.createElement(Icon, {
                name: "Plus",
                size: 15,
                color: "#fff",
              }),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "nav",
            {
              className: "hide-scrollbar",
              style: {
                flex: 1,
                overflowY: "auto",
                padding: "10px 0",
              },
            },
            NAV.map((sec, si) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: si,
                },
                sec.section &&
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        margin: "6px 16px 4px",
                        paddingTop: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        color: "var(--muted-foreground)",
                      },
                    },
                    sec.section,
                  ),
                sec.items.map((it) => {
                  const on = active === it.id;
                  return /*#__PURE__*/ React.createElement(
                    "button",
                    {
                      key: it.id,
                      onClick: () => onNavigate(it.id),
                      style: {
                        margin: "1px 8px",
                        width: "calc(100% - 16px)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 14px",
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        fontWeight: on ? 600 : 500,
                        background: on ? "var(--accent)" : "transparent",
                        color: on
                          ? "var(--primary)"
                          : "var(--muted-foreground)",
                        transition: "background .12s, color .12s",
                      },
                      onMouseEnter: (e) => {
                        if (!on) {
                          e.currentTarget.style.background = "var(--secondary)";
                          e.currentTarget.style.color = "var(--foreground)";
                        }
                      },
                      onMouseLeave: (e) => {
                        if (!on) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color =
                            "var(--muted-foreground)";
                        }
                      },
                    },
                    /*#__PURE__*/ React.createElement(Icon, {
                      name: it.icon,
                      size: 18,
                      color: "currentColor",
                    }),
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        style: {
                          flex: 1,
                        },
                      },
                      it.label,
                    ),
                    it.badge &&
                      /*#__PURE__*/ React.createElement(
                        "span",
                        {
                          style: {
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#fff",
                            background: it.badgeColor,
                            borderRadius: 999,
                            padding: "1px 7px",
                          },
                        },
                        it.badge,
                      ),
                  );
                }),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                borderTop: "1px solid var(--border)",
                padding: 12,
              },
            },
            /*#__PURE__*/ React.createElement(
              "button",
              {
                onClick: () => onNavigate("akun"),
                style: {
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg,var(--primary),var(--brand-purple))",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                },
                window.WM.user.initials,
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    minWidth: 0,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 12.5,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  },
                  window.WM.user.name,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  },
                  window.WM.user.email,
                ),
              ),
            ),
          ),
        );
      }
      function Topbar({ active, onSearch, onToggleTheme, dark, onLogout }) {
        const Icon = window.WMIcon;
        const btn = {
          width: 36,
          height: 36,
          borderRadius: 8,
          border: "none",
          background: "var(--secondary)",
          color: "var(--muted-foreground)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        };
        return /*#__PURE__*/ React.createElement(
          "header",
          {
            style: {
              position: "sticky",
              top: 0,
              zIndex: 20,
              height: 64,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "0 24px",
              background: "var(--card)",
              borderBottom: "1px solid var(--border)",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: 18,
                fontWeight: 800,
              },
            },
            PAGE_TITLES[active] || "WealthMe",
          ),
          /*#__PURE__*/ React.createElement("div", {
            style: {
              flex: 1,
            },
          }),
          /*#__PURE__*/ React.createElement(
            "button",
            {
              onClick: onSearch,
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                maxWidth: 260,
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--muted-foreground)",
                fontSize: 12.5,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              },
            },
            /*#__PURE__*/ React.createElement(Icon, {
              name: "Search",
              size: 13,
              color: "currentColor",
            }),
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  flex: 1,
                  textAlign: "left",
                },
              },
              "Cari transaksi, rekening...",
            ),
            /*#__PURE__*/ React.createElement(
              "span",
              {
                className: "mono",
                style: {
                  fontSize: 10,
                  background: "var(--border)",
                  borderRadius: 4,
                  padding: "1px 6px",
                },
              },
              "\u2318K",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                gap: 6,
              },
            },
            /*#__PURE__*/ React.createElement(
              "button",
              {
                style: btn,
                onClick: onToggleTheme,
                title: "Ganti tema",
              },
              /*#__PURE__*/ React.createElement(Icon, {
                name: dark ? "Sun" : "Moon",
                size: 15,
                color: "currentColor",
              }),
            ),
            /*#__PURE__*/ React.createElement(
              "button",
              {
                style: btn,
                title: "Notifikasi",
              },
              /*#__PURE__*/ React.createElement(Icon, {
                name: "Bell",
                size: 15,
                color: "currentColor",
              }),
            ),
            /*#__PURE__*/ React.createElement(
              "button",
              {
                style: btn,
                onClick: onLogout,
                title: "Keluar",
              },
              /*#__PURE__*/ React.createElement(Icon, {
                name: "LogOut",
                size: 15,
                color: "currentColor",
              }),
            ),
          ),
        );
      }
      window.WMShell = {
        Sidebar,
        Topbar,
      };
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/wealthme-app/shell.jsx",
      error: String((e && e.message) || e),
    });
  }

  __ds_ns.BarChart = __ds_scope.BarChart;

  __ds_ns.Donut = __ds_scope.Donut;

  __ds_ns.DonutLegend = __ds_scope.DonutLegend;

  __ds_ns.Sparkline = __ds_scope.Sparkline;

  __ds_ns.Badge = __ds_scope.Badge;

  __ds_ns.Button = __ds_scope.Button;

  __ds_ns.ProgressBar = __ds_scope.ProgressBar;

  __ds_ns.StatusBadge = __ds_scope.StatusBadge;

  __ds_ns.Input = __ds_scope.Input;

  __ds_ns.Select = __ds_scope.Select;

  __ds_ns.Switch = __ds_scope.Switch;

  __ds_ns.Card = __ds_scope.Card;

  __ds_ns.HeroCard = __ds_scope.HeroCard;

  __ds_ns.MoneyStat = __ds_scope.MoneyStat;

  __ds_ns.SectionCard = __ds_scope.SectionCard;

  __ds_ns.SummaryCard = __ds_scope.SummaryCard;
})();
