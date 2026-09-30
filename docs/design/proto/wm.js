/* WealthMe bento prototype runtime.
   Load after the page markup: <script src="wm.js"></script>, then the page script.
   Everything lives on window.WM. Data persists in localStorage, so the prototype stays
   consistent across pages (a transaction added on Beranda shows up in Transaksi). */
(function () {
  "use strict";
  var WM = (window.WM = {});
  var LS = "wm-proto-v1:";
  function ls(k, v) {
    try {
      if (v === undefined) {
        var s = localStorage.getItem(LS + k);
        return s == null ? null : JSON.parse(s);
      }
      localStorage.setItem(LS + k, JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  WM.esc = esc;
  WM.uid = function (p) {
    return (
      (p || "id") +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6)
    );
  };
  WM.today = "2026-09-30";

  /* ---------- icons (24px stroke, 1.8) ---------- */
  var P = {
    home: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>',
    grid: '<rect x="3" y="3" width="7" height="8" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="15" width="7" height="6" rx="2"/>',
    pie: '<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>',
    swap: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4"/>',
    bell: '<path d="M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20a2 2 0 004 0"/>',
    clipboard:
      '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    chart: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',
    target:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    wallet:
      '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h2M3 10h18"/>',
    landmark:
      '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    briefcase:
      '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
    shield:
      '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    scroll:
      '<path d="M8 3h11v14a3 3 0 01-3 3H6a3 3 0 01-3-3v-1h11v1a3 3 0 003 3M8 3a3 3 0 00-3 3v10M11 8h5M11 12h5"/>',
    heart:
      '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    file: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    split: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM12 7v8M9 10h6"/>',
    compare:
      '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V15a3 3 0 003 3h6.5M18 15.5V9a3 3 0 00-3-3H8.5"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="4"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 17h5"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4"/>',
    zap: '<path d="M13 3L4 14h7l-1 7 9-11h-7z"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M8 7h7"/>',
    db: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 4M12 17h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c0-2.2 1-4 3-4s3 1.8 3 4"/>',
    usercheck:
      '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M16 11l2 2 4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    chevd: '<path d="M6 9l6 6 6-6"/>',
    chevl: '<path d="M15 6l-6 6 6 6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    download: '<path d="M12 4v11m-4-4l4 4 4-4M5 20h14"/>',
    upload: '<path d="M12 16V5m-4 4l4-4 4 4M5 20h14"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    alert: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff:
      '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.1 6.1C3.6 7.8 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1M9.9 9.9a3 3 0 004.2 4.2"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    share:
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    camera:
      '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2.1-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2.1 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 002.1 1.2l.4 2.6h4l.4-2.6a7 7 0 002.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    food: '<path d="M7 3v8m-3-8v5a3 3 0 006 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11"/>',
    car: '<path d="M5 16h14M6 16l1.5-6h9L18 16M7 16v3M17 16v3"/><circle cx="8" cy="13.5" r=".6"/><circle cx="16" cy="13.5" r=".6"/>',
    bag: '<path d="M5 8h14l-1 12H6zM9 8a3 3 0 016 0"/>',
    health:
      '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/><path d="M9 11h6M12 8v6"/>',
    school: '<path d="M3 9l9-4 9 4-9 4zM7 11v5c3 2 7 2 10 0v-5"/>',
    gift: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-4 0M12 7c2-4 6-3 4 0"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    trend: '<path d="M4 17l5-5 4 3 7-8M15 7h5v5"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
    phone:
      '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    gold: '<path d="M3 18l3-7h5l3 7zM10 18l3-7h5l3 7zM7 11l2.5-5h5L17 11"/>',
    building:
      '<path d="M4 21V5l8-3v19M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01M2 21h20"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    attach:
      '<path d="M20 11l-8.5 8.5a5 5 0 01-7-7L13 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L14 7"/>',
    sparkle:
      '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    refresh:
      '<path d="M20 11a8 8 0 00-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.3 4.9L20 16M20 20v-4h-4"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flow: '<path d="M3 7h6c4 0 4 10 8 10h4M3 17h6c1.5 0 2.5-1.4 3.3-3M21 7h-4c-1.5 0-2.5 1.4-3.3 3"/>',
    tax: '<path d="M6 3h9l4 4v14H6zM9 12l6-4M9.5 8.5h.01M14.5 12.5h.01"/>',
    scale:
      '<path d="M12 4v16M5 8h14M5 8l-3 6a3 3 0 006 0zM19 8l-3 6a3 3 0 006 0z"/>',
    tree: '<path d="M4 5h6v6H4zM14 13h6v6h-6zM7 11v5h7M17 13V8h-7"/>',
    drag: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  };
  WM.icons = P;
  WM.icon = function (n, s, sw) {
    return (
      '<svg width="' +
      (s || 18) +
      '" height="' +
      (s || 18) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      (sw || 1.8) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (P[n] || P.more) +
      "</svg>"
    );
  };

  /* ---------- formatting ---------- */
  WM.rp = function (n, sign) {
    n = Math.round(+n || 0);
    var s = n < 0 ? "−" : sign && n > 0 ? "+" : "";
    return s + "Rp " + Math.abs(n).toLocaleString("id-ID");
  };
  WM.short = function (n, sign) {
    n = +n || 0;
    var a = Math.abs(n),
      s = n < 0 ? "−" : sign && n > 0 ? "+" : "";
    if (a >= 1e9)
      return (
        s +
        "Rp " +
        (a / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) +
        " M"
      );
    if (a >= 1e6)
      return (
        s +
        "Rp " +
        (a / 1e6).toLocaleString("id-ID", {
          maximumFractionDigits: a >= 1e8 ? 0 : 2,
        }) +
        " jt"
      );
    if (a >= 1e3)
      return s + "Rp " + Math.round(a / 1e3).toLocaleString("id-ID") + " rb";
    return s + "Rp " + Math.round(a);
  };
  WM.pct = function (x, d) {
    return (
      (+x || 0).toLocaleString("id-ID", {
        maximumFractionDigits: d == null ? 1 : d,
      }) + "%"
    );
  };
  var MON = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ],
    MONL = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
  WM.months = MON;
  WM.monthsLong = MONL;
  WM.date = function (iso, long) {
    if (!iso) return "–";
    var d = new Date(iso + "T00:00:00");
    return (
      d.getDate() +
      " " +
      (long ? MONL : MON)[d.getMonth()] +
      " " +
      d.getFullYear()
    );
  };
  WM.dayLabel = function (iso) {
    if (iso === WM.today) return "Hari ini";
    var t = new Date(WM.today + "T00:00:00"),
      d = new Date(iso + "T00:00:00");
    var diff = Math.round((t - d) / 864e5);
    if (diff === 1) return "Kemarin";
    return WM.date(iso);
  };
  WM.parseMoney = function (s) {
    var n = String(s == null ? "" : s).replace(/[^\d-]/g, "");
    return n ? parseInt(n, 10) : 0;
  };

  /* ---------- data store ---------- */
  var SEED = {
    members: [
      {
        id: "m1",
        name: "Christian Rizaldi",
        short: "Christian",
        init: "CR",
        role: "master",
        bg: "var(--lime-soft)",
        fg: "var(--ink)",
        email: "christian@rizaldi.id",
        phone: "0812-1100-2233",
      },
      {
        id: "m2",
        name: "Vallencya Rizaldi",
        short: "Vallencya",
        init: "VA",
        role: "spouse",
        bg: "#F6E7C9",
        fg: "#5A3D07",
        email: "vallencya@rizaldi.id",
        phone: "0812-4455-6677",
      },
      {
        id: "m3",
        name: "Hima Rizaldi",
        short: "Hima",
        init: "HM",
        role: "child",
        bg: "#DCE9F7",
        fg: "#123B63",
        email: "hima@rizaldi.id",
        phone: "",
      },
      {
        id: "m4",
        name: "Arka Rizaldi",
        short: "Arka",
        init: "AR",
        role: "child",
        bg: "#EBDDF3",
        fg: "#472062",
        email: "arka@rizaldi.id",
        phone: "",
      },
      {
        id: "m5",
        name: "Pak Udin",
        short: "Pak Udin",
        init: "PU",
        role: "staff",
        bg: "var(--card-2)",
        fg: "var(--ink)",
        email: "udin@rizaldi.id",
        phone: "0813-9988-7766",
        job: "Sopir",
      },
    ],
    accounts: [
      {
        id: "a1",
        bank: "BCA",
        name: "Tabungan bersama",
        type: "bank",
        owner: "m1",
        vis: "shared",
        balance: 84320500,
        no: "7890",
        color: "lime",
      },
      {
        id: "a2",
        bank: "BRI",
        name: "Pribadi Vallencya",
        type: "bank",
        owner: "m2",
        vis: "private",
        balance: 12480000,
        no: "4412",
        color: "soft",
      },
      {
        id: "a3",
        bank: "Mandiri",
        name: "Kartu kredit",
        type: "cc",
        owner: "m1",
        vis: "shared",
        balance: -4610000,
        limit: 25000000,
        no: "3321",
        color: "dark",
      },
      {
        id: "a6",
        bank: "Jago",
        name: "Tabungan pendidikan",
        type: "bank",
        owner: "m1",
        vis: "shared",
        balance: 18500000,
        no: "0921",
        color: "soft",
      },
      {
        id: "a4",
        bank: "GoPay",
        name: "E-wallet Hima",
        type: "ewallet",
        owner: "m3",
        vis: "shared",
        balance: 845200,
        no: "8812",
        color: "soft",
      },
      {
        id: "a5",
        bank: "Tunai",
        name: "Dompet rumah",
        type: "cash",
        owner: "m1",
        vis: "shared",
        balance: 1250000,
        no: "",
        color: "soft",
      },
    ],
    categories: [
      { id: "c-makan", name: "Makan", kind: "out", icon: "food" },
      { id: "c-transport", name: "Transport", kind: "out", icon: "car" },
      { id: "c-rumah", name: "Rumah & KPR", kind: "out", icon: "home" },
      { id: "c-belanja", name: "Belanja", kind: "out", icon: "bag" },
      { id: "c-kesehatan", name: "Kesehatan", kind: "out", icon: "health" },
      { id: "c-pendidikan", name: "Pendidikan", kind: "out", icon: "school" },
      { id: "c-zakat", name: "Zakat & Donasi", kind: "out", icon: "heart" },
      { id: "c-lain-out", name: "Lainnya", kind: "out", icon: "more" },
      { id: "c-gaji", name: "Gaji", kind: "in", icon: "wallet" },
      { id: "c-bonus", name: "Bonus", kind: "in", icon: "gift" },
      { id: "c-invest", name: "Investasi", kind: "in", icon: "trend" },
      { id: "c-lain-in", name: "Lainnya", kind: "in", icon: "more" },
    ],
    tx: [
      {
        id: "t1",
        date: "2026-09-30",
        type: "out",
        amount: 185000,
        acc: "a1",
        cat: "c-makan",
        member: "m1",
        by: "m1",
        note: "Makan siang tim",
      },
      {
        id: "t2",
        date: "2026-09-29",
        type: "out",
        amount: 320000,
        acc: "a4",
        cat: "c-transport",
        member: "m3",
        by: "m3",
        note: "Ojek ke kampus",
      },
      {
        id: "t3",
        date: "2026-09-28",
        type: "out",
        amount: 1250000,
        acc: "a2",
        cat: "c-belanja",
        member: "m2",
        by: "m2",
        note: "Belanja bulanan pribadi",
      },
      {
        id: "t4",
        date: "2026-09-27",
        type: "tf",
        amount: 1500000,
        acc: "a1",
        to: "a4",
        member: "m1",
        by: "m1",
        note: "Uang saku Hima",
      },
      {
        id: "t5",
        date: "2026-09-26",
        type: "out",
        amount: 450000,
        acc: "a5",
        cat: "c-transport",
        member: "m5",
        by: "m5",
        note: "Bensin Innova",
      },
      {
        id: "t6",
        date: "2026-09-25",
        type: "in",
        amount: 32500000,
        acc: "a1",
        cat: "c-gaji",
        member: "m1",
        by: "m1",
        note: "Gaji September",
      },
      {
        id: "t7",
        date: "2026-09-24",
        type: "out",
        amount: 4500000,
        acc: "a1",
        cat: "c-rumah",
        member: "m1",
        by: "m1",
        note: "Cicilan KPR ke-26",
      },
      {
        id: "t8",
        date: "2026-09-22",
        type: "out",
        amount: 1900000,
        acc: "a1",
        cat: "c-lain-out",
        member: "m1",
        by: "m1",
        note: "Beli BBCA 2 lot",
      },
      {
        id: "t9",
        date: "2026-09-20",
        type: "out",
        amount: 2500000,
        acc: "a1",
        cat: "c-zakat",
        member: "m1",
        by: "m1",
        note: "Zakat maal",
      },
      {
        id: "t10",
        date: "2026-09-19",
        type: "out",
        amount: 1800000,
        acc: "a3",
        cat: "c-makan",
        member: "m2",
        by: "m2",
        note: "Belanja bulanan",
      },
      {
        id: "t11",
        date: "2026-09-18",
        type: "in",
        amount: 640000,
        acc: "a1",
        cat: "c-invest",
        member: "m1",
        by: "m1",
        note: "Dividen BBRI",
      },
      {
        id: "t12",
        date: "2026-09-16",
        type: "out",
        amount: 2300000,
        acc: "a6",
        cat: "c-pendidikan",
        member: "m2",
        by: "m2",
        note: "SPP Arka",
      },
      {
        id: "t13",
        date: "2026-09-14",
        type: "out",
        amount: 1300000,
        acc: "a1",
        cat: "c-kesehatan",
        member: "m2",
        by: "m2",
        note: "Dokter gigi",
      },
      {
        id: "t14",
        date: "2026-09-12",
        type: "in",
        amount: 6000000,
        acc: "a2",
        cat: "c-lain-in",
        member: "m2",
        by: "m2",
        note: "Hasil usaha kue",
      },
      {
        id: "t15",
        date: "2026-09-10",
        type: "out",
        amount: 610000,
        acc: "a1",
        cat: "c-makan",
        member: "m1",
        by: "m1",
        note: "Makan keluarga",
      },
      {
        id: "t16",
        date: "2026-09-08",
        type: "out",
        amount: 275000,
        acc: "a4",
        cat: "c-makan",
        member: "m3",
        by: "m3",
        note: "Jajan",
      },
      {
        id: "t17",
        date: "2026-09-05",
        type: "out",
        amount: 520000,
        acc: "a5",
        cat: "c-rumah",
        member: "m1",
        by: "m1",
        note: "Listrik & air",
      },
      {
        id: "t18",
        date: "2026-09-03",
        type: "out",
        amount: 890000,
        acc: "a3",
        cat: "c-belanja",
        member: "m1",
        by: "m1",
        note: "Sepatu Arka",
      },
      {
        id: "t19",
        date: "2026-08-25",
        type: "in",
        amount: 32500000,
        acc: "a1",
        cat: "c-gaji",
        member: "m1",
        by: "m1",
        note: "Gaji Agustus",
      },
      {
        id: "t20",
        date: "2026-08-24",
        type: "out",
        amount: 4500000,
        acc: "a1",
        cat: "c-rumah",
        member: "m1",
        by: "m1",
        note: "Cicilan KPR ke-25",
      },
    ],
    budgets: [
      { id: "b1", cat: "c-makan", limit: 4000000 },
      { id: "b2", cat: "c-transport", limit: 2000000 },
      { id: "b3", cat: "c-rumah", limit: 6000000 },
      { id: "b4", cat: "c-belanja", limit: 2500000 },
      { id: "b5", cat: "c-pendidikan", limit: 3000000 },
      { id: "b6", cat: "c-kesehatan", limit: 1500000 },
    ],
    goals: [
      {
        id: "g1",
        name: "Dana darurat",
        icon: "shield",
        target: 120000000,
        saved: 78000000,
        due: "2027-06-30",
        acc: "a1",
        color: "var(--lime)",
      },
      {
        id: "g2",
        name: "Liburan Jepang",
        icon: "globe",
        target: 45000000,
        saved: 18500000,
        due: "2027-04-01",
        acc: "a6",
        color: "var(--yellow)",
      },
      {
        id: "g3",
        name: "Mobil keluarga",
        icon: "car",
        target: 250000000,
        saved: 62000000,
        due: "2028-12-31",
        acc: "a1",
        color: "var(--orange)",
      },
      {
        id: "g4",
        name: "Kuliah Hima",
        icon: "school",
        target: 300000000,
        saved: 96000000,
        due: "2029-07-01",
        acc: "a6",
        color: "var(--sky)",
      },
    ],
    investments: [
      {
        id: "i1",
        name: "BBCA",
        kind: "saham",
        qty: 2000,
        unit: "lembar",
        cost: 42260000,
        value: 47500000,
        ticker: "BBCA",
      },
      {
        id: "i2",
        name: "BBRI",
        kind: "saham",
        qty: 6500,
        unit: "lembar",
        cost: 32900000,
        value: 34900000,
        ticker: "BBRI",
      },
      {
        id: "i3",
        name: "RD Pasar Uang Sucorinvest",
        kind: "reksadana",
        qty: 28400,
        unit: "unit",
        cost: 39650000,
        value: 41200000,
      },
      {
        id: "i4",
        name: "Emas Antam",
        kind: "emas",
        qty: 0.015,
        unit: "kg",
        cost: 33800000,
        value: 38800000,
        src: "emasantam.id",
      },
      {
        id: "i5",
        name: "Deposito BCA 12 bln",
        kind: "deposito",
        qty: 1,
        unit: "bilyet",
        cost: 19140000,
        value: 20000000,
      },
      {
        id: "i6",
        name: "Bitcoin",
        kind: "kripto",
        qty: 0.0024,
        unit: "BTC",
        cost: 3250000,
        value: 4000000,
        ticker: "BTC",
      },
    ],
    assets: [
      {
        id: "s1",
        name: "Rumah Bintaro",
        kind: "properti",
        value: 850000000,
        cost: 620000000,
        since: "2020-03-01",
        owner: "m1",
        note: "SHM atas nama Christian",
      },
      {
        id: "s2",
        name: "Toyota Innova 2022",
        kind: "kendaraan",
        value: 210000000,
        cost: 365000000,
        since: "2022-01-15",
        owner: "m1",
        note: "B 1234 RZL",
      },
      {
        id: "s3",
        name: "Jam tangan Seiko",
        kind: "barang",
        value: 8500000,
        cost: 9000000,
        since: "2023-11-10",
        owner: "m2",
        note: "",
      },
    ],
    liabilities: [
      {
        id: "l1",
        name: "KPR BCA Bintaro",
        kind: "kpr",
        principal: 520000000,
        outstanding: 80100000,
        rate: 7.25,
        scheme: "anuitas",
        tenor: 180,
        paid: 26,
        installment: 4500000,
        dueDay: 24,
        acc: "a1",
      },
      {
        id: "l2",
        name: "Kartu kredit Mandiri",
        kind: "kartu",
        principal: 4610000,
        outstanding: 4610000,
        rate: 1.75,
        scheme: "revolving",
        tenor: 0,
        paid: 0,
        installment: 461000,
        dueDay: 15,
        acc: "a3",
      },
      {
        id: "l3",
        name: "Pinjaman koperasi",
        kind: "pinjaman",
        principal: 6000000,
        outstanding: 3800000,
        rate: 9,
        scheme: "flat",
        tenor: 12,
        paid: 5,
        installment: 545000,
        dueDay: 5,
        acc: "a1",
      },
    ],
    insurances: [
      {
        id: "n1",
        name: "Prudential PRUPrime Healthcare",
        kind: "kesehatan",
        insured: "Keluarga",
        premium: 1250000,
        period: "bulanan",
        cover: 1000000000,
        due: "2026-10-05",
        status: "aktif",
      },
      {
        id: "n2",
        name: "Allianz Life Protection",
        kind: "jiwa",
        insured: "Christian",
        premium: 750000,
        period: "bulanan",
        cover: 2000000000,
        due: "2026-10-12",
        status: "aktif",
      },
      {
        id: "n3",
        name: "BPJS Kesehatan Kelas 1",
        kind: "kesehatan",
        insured: "5 anggota",
        premium: 750000,
        period: "bulanan",
        cover: 0,
        due: "2026-10-10",
        status: "aktif",
      },
    ],
    requests: [
      {
        id: "r1",
        member: "m3",
        amount: 350000,
        reason: "Beli buku kuliah",
        date: "2026-09-29",
        status: "pending",
        acc: "a4",
      },
      {
        id: "r2",
        member: "m4",
        amount: 150000,
        reason: "Iuran kelas",
        date: "2026-09-28",
        status: "pending",
        acc: "a5",
      },
      {
        id: "r3",
        member: "m5",
        amount: 450000,
        reason: "Servis ringan mobil",
        date: "2026-09-21",
        status: "approved",
        acc: "a5",
      },
    ],
    notifications: [
      {
        id: "o1",
        date: "2026-09-29",
        kind: "approval",
        title: "Hima minta dana Rp 350.000",
        body: "Beli buku kuliah",
        href: "persetujuan.html",
        read: false,
      },
      {
        id: "o2",
        date: "2026-09-28",
        kind: "approval",
        title: "Arka minta dana Rp 150.000",
        body: "Iuran kelas",
        href: "persetujuan.html",
        read: false,
      },
      {
        id: "o3",
        date: "2026-09-26",
        kind: "budget",
        title: "Anggaran Belanja tinggal 12%",
        body: "Rp 310.000 lagi sampai akhir bulan",
        href: "anggaran.html",
        read: false,
      },
      {
        id: "o4",
        date: "2026-09-24",
        kind: "bill",
        title: "Cicilan KPR ke-26 tercatat",
        body: "Sisa pokok Rp 80,1 jt",
        href: "liabilitas.html",
        read: true,
      },
      {
        id: "o5",
        date: "2026-09-20",
        kind: "goal",
        title: "Dana darurat sudah 65%",
        body: "Tambah Rp 42 jt lagi untuk capai target",
        href: "tujuan.html",
        read: true,
      },
    ],
    profile: { step: 3, of: 5 },
  };
  var cache = {};
  WM.store = {
    get: function (k) {
      if (!(k in cache)) {
        var v = ls(k);
        cache[k] =
          v != null
            ? v
            : SEED[k] != null
              ? JSON.parse(JSON.stringify(SEED[k]))
              : null;
      }
      return cache[k] == null ? null : JSON.parse(JSON.stringify(cache[k]));
    },
    set: function (k, v) {
      cache[k] = JSON.parse(JSON.stringify(v));
      ls(k, v);
      window.dispatchEvent(
        new CustomEvent("wm:change", { detail: { key: k } }),
      );
    },
    ensure: function (k, seed) {
      if (this.get(k) == null) {
        cache[k] = JSON.parse(JSON.stringify(seed));
      }
      return this.get(k);
    },
    find: function (k, id) {
      return (
        (this.get(k) || []).filter(function (x) {
          return x.id === id;
        })[0] || null
      );
    },
    add: function (k, o) {
      var a = this.get(k) || [];
      o = Object.assign({ id: WM.uid(k.slice(0, 2)) }, o);
      a.unshift(o);
      this.set(k, a);
      return o;
    },
    update: function (k, id, patch) {
      var a = (this.get(k) || []).map(function (x) {
        return x.id === id ? Object.assign({}, x, patch) : x;
      });
      this.set(k, a);
      return this.find(k, id);
    },
    remove: function (k, id) {
      this.set(
        k,
        (this.get(k) || []).filter(function (x) {
          return x.id !== id;
        }),
      );
    },
    reset: function () {
      try {
        Object.keys(localStorage).forEach(function (x) {
          if (x.indexOf(LS) === 0) localStorage.removeItem(x);
        });
      } catch (e) {}
      cache = {};
      location.reload();
    },
  };
  WM.member = function (id) {
    return (
      WM.store.find("members", id) || {
        id: id,
        name: "Anggota",
        short: "Anggota",
        init: "?",
        role: "child",
        bg: "var(--card-2)",
        fg: "var(--ink)",
      }
    );
  };
  WM.account = function (id) {
    return WM.store.find("accounts", id);
  };
  WM.cat = function (id) {
    return (
      WM.store.find("categories", id) || { name: "Transfer", icon: "swap" }
    );
  };
  WM.roleLabel = function (r) {
    return (
      {
        master: "Master",
        spouse: "Co-Master",
        child: "Anak",
        staff: "Operasional",
      }[r] || r
    );
  };
  WM.avatar = function (m, size) {
    m = typeof m === "string" ? WM.member(m) : m;
    size = size || 32;
    return (
      '<span class="avatar" style="width:' +
      size +
      "px;height:" +
      size +
      "px;background:" +
      m.bg +
      ";color:" +
      m.fg +
      ";font-size:" +
      Math.round(size * 0.36) +
      'px" title="' +
      esc(m.name) +
      '">' +
      esc(m.init) +
      "</span>"
    );
  };

  /* role / session */
  WM.meId = function () {
    return ls("me") || "m1";
  };
  WM.me = function () {
    return WM.member(WM.meId());
  };
  WM.setMe = function (id) {
    ls("me", id);
    location.reload();
  };
  WM.isOwner = function () {
    var r = WM.me().role;
    return r === "master" || r === "spouse";
  };
  WM.visibleAccounts = function () {
    var me = WM.me();
    return WM.store.get("accounts").filter(function (a) {
      if (a.vis === "private") return WM.isOwner() || a.owner === me.id;
      return WM.isOwner() || a.vis === "shared";
    });
  };
  /* Edit rule: the recorder, or the owner of a private account used by the transaction. */
  WM.canModifyTx = function (t) {
    var me = WM.meId();
    if (t.by === me) return true;
    var legs = [t.acc, t.to].filter(Boolean).map(WM.account).filter(Boolean);
    return legs.some(function (a) {
      return a.vis === "private" && a.owner === me;
    });
  };

  /* money movement */
  function applyTx(t, dir) {
    var acc = WM.store.get("accounts");
    acc.forEach(function (a) {
      if (t.type === "in" && a.id === t.acc) a.balance += dir * t.amount;
      if (t.type === "out" && a.id === t.acc) a.balance -= dir * t.amount;
      if (t.type === "tf" && a.id === t.acc) a.balance -= dir * t.amount;
      if (t.type === "tf" && a.id === t.to) a.balance += dir * t.amount;
    });
    WM.store.set("accounts", acc);
  }
  WM.addTx = function (t) {
    t = WM.store.add(
      "tx",
      Object.assign({ by: WM.meId(), member: WM.meId(), date: WM.today }, t),
    );
    applyTx(t, 1);
    return t;
  };
  WM.updateTx = function (id, patch) {
    var old = WM.store.find("tx", id);
    applyTx(old, -1);
    var t = WM.store.update("tx", id, patch);
    applyTx(t, 1);
    return t;
  };
  WM.removeTx = function (id) {
    var old = WM.store.find("tx", id);
    applyTx(old, -1);
    WM.store.remove("tx", id);
    return old;
  };
  WM.restoreTx = function (t) {
    var a = WM.store.get("tx");
    a.push(t);
    a.sort(function (x, y) {
      return x.date < y.date ? 1 : -1;
    });
    WM.store.set("tx", a);
    applyTx(t, 1);
  };
  WM.monthTx = function (ym) {
    ym = ym || WM.today.slice(0, 7);
    return WM.store.get("tx").filter(function (t) {
      return t.date.slice(0, 7) === ym;
    });
  };
  WM.spent = function (catId, ym) {
    return WM.monthTx(ym)
      .filter(function (t) {
        return t.type === "out" && (!catId || t.cat === catId);
      })
      .reduce(function (s, t) {
        return s + t.amount;
      }, 0);
  };
  WM.income = function (ym) {
    return WM.monthTx(ym)
      .filter(function (t) {
        return t.type === "in";
      })
      .reduce(function (s, t) {
        return s + t.amount;
      }, 0);
  };
  WM.totals = function () {
    var S = WM.store,
      cash = S.get("accounts").reduce(function (s, a) {
        return s + a.balance;
      }, 0),
      inv = S.get("investments").reduce(function (s, i) {
        return s + i.value;
      }, 0),
      ast = S.get("assets").reduce(function (s, a) {
        return s + a.value;
      }, 0),
      lia = S.get("liabilities").reduce(function (s, l) {
        return s + l.outstanding;
      }, 0);
    var ccDebt = S.get("accounts")
      .filter(function (a) {
        return a.type === "cc";
      })
      .reduce(function (s, a) {
        return s + Math.min(0, a.balance);
      }, 0);
    /* card debt already sits in the account balance; avoid counting it twice */
    var liaNoCard = S.get("liabilities")
      .filter(function (l) {
        return l.kind !== "kartu";
      })
      .reduce(function (s, l) {
        return s + l.outstanding;
      }, 0);
    return {
      cash: cash,
      investments: inv,
      assets: ast,
      liabilities: lia,
      netWorth: cash + inv + ast - liaNoCard,
      cardDebt: -ccDebt,
    };
  };

  /* ---------- navigation ---------- */
  /* Concept-style nav: a short list of hubs; the active hub unfolds its pages as a sub list. */
  WM.NAV = [
    ["beranda", "index.html", "Beranda", "grid", []],
    [
      "rekening",
      "rekening.html",
      "Rekening",
      "landmark",
      [
        ["rekening", "rekening.html", "Bank & kartu"],
        ["dana", "dana.html", "Cash & e-wallet"],
      ],
    ],
    [
      "transaksi",
      "transaksi.html",
      "Transaksi",
      "swap",
      [
        ["transaksi", "transaksi.html", "Riwayat"],
        ["rekonsiliasi", "rekonsiliasi.html", "Rekonsiliasi"],
        ["quickinput", "quickinput.html", "Input cepat"],
        ["splitbill", "splitbill.html", "Split bill"],
      ],
    ],
    [
      "ringkasan",
      "ringkasan.html",
      "Arus Kas",
      "wallet",
      [
        ["ringkasan", "ringkasan.html", "Ringkasan"],
        ["laporan", "laporan.html", "Laporan"],
      ],
    ],
    [
      "anggaran",
      "anggaran.html",
      "Anggaran",
      "clipboard",
      [
        ["anggaran", "anggaran.html", "Anggaran"],
        ["tujuan", "tujuan.html", "Tujuan"],
      ],
    ],
    [
      "investasi",
      "investasi.html",
      "Kekayaan",
      "trend",
      [
        ["investasi", "investasi.html", "Investasi"],
        ["aset", "aset.html", "Aset"],
        ["liabilitas", "liabilitas.html", "Liabilitas"],
        ["asuransi", "asuransi.html", "Asuransi"],
      ],
    ],
    [
      "tax",
      "tax.html",
      "Pajak & Zakat",
      "shield",
      [
        ["tax", "tax.html", "Pajak"],
        ["donation", "donation.html", "Donasi & zakat"],
        ["warisan", "warisan.html", "Warisan"],
      ],
    ],
    ["persetujuan", "persetujuan.html", "Persetujuan", "checkc", []],
  ];
  WM.NAV2 = [
    ["ai", "ai.html", "AI Advisor", "sparkle", []],
    ["kalkulator", "kalkulator.html", "Kalkulator", "calc", []],
    [
      "masterdata",
      "masterdata.html",
      "Pengaturan",
      "gear",
      [
        ["masterdata", "masterdata.html", "Master data"],
        ["mastercoa", "mastercoa.html", "Master COA"],
        ["iam", "iam.html", "IAM & akses"],
      ],
    ],
    ["panduan", "panduan.html", "Panduan", "book", []],
  ];
  var RESTRICTED = [
    ["akses-saya", "akses-saya.html", "Akses Saya", "usercheck", []],
    ["transaksi", "transaksi.html", "Transaksi", "swap", []],
    ["notifikasi", "notifikasi.html", "Notifikasi", "bell", []],
    ["panduan", "panduan.html", "Panduan", "book", []],
  ];
  WM.allowedPage = function (id) {
    var r = WM.me().role;
    if (id === "akun") return true;
    if (r === "child" || r === "staff")
      return RESTRICTED.some(function (x) {
        return x[0] === id;
      });
    if (id === "akses-saya") return false;
    if (id === "iam") return r === "master";
    return true;
  };
  function allItems() {
    var o = [];
    WM.NAV.concat(WM.NAV2, RESTRICTED, [
      ["notifikasi", "notifikasi.html", "Notifikasi", "bell", []],
    ]).forEach(function (i) {
      o.push(i);
      i[4].forEach(function (s) {
        o.push([s[0], s[1], s[2], i[3], []]);
      });
    });
    return o;
  }
  WM.pageTitle = function (id) {
    var t = null;
    allItems()
      .concat([["akun", "akun.html", "Akun", "user", []]])
      .forEach(function (i) {
        if (i[0] === id && !t) t = i[2];
      });
    return t;
  };
  function navModel() {
    var r = WM.me().role;
    if (r === "child" || r === "staff") return [RESTRICTED, []];
    var f = function (list) {
      return list
        .map(function (i) {
          return [
            i[0],
            i[1],
            i[2],
            i[3],
            i[4].filter(function (s) {
              return WM.allowedPage(s[0]);
            }),
          ];
        })
        .filter(function (i) {
          return WM.allowedPage(i[0]);
        });
    };
    return [f(WM.NAV), f(WM.NAV2)];
  }
  function navHTML(active, forSheet) {
    var pend = WM.store.get("requests").filter(function (r) {
        return r.status === "pending";
      }).length,
      txc = WM.monthTx().length;
    function grp(list) {
      return (
        '<nav class="nav">' +
        list
          .map(function (i) {
            var inGrp =
              i[0] === active ||
              i[4].some(function (s) {
                return s[0] === active;
              });
            var b = i[0] === "persetujuan" && pend ? pend : 0;
            var h =
              '<a href="' +
              i[1] +
              '" title="' +
              i[2] +
              '"' +
              (inGrp && !i[4].length
                ? ' aria-current="page"'
                : inGrp
                  ? ' class="open"'
                  : "") +
              ">" +
              WM.icon(i[3]) +
              '<span class="lbl">' +
              i[2] +
              "</span>" +
              (b ? '<span class="badge">' + b + "</span>" : "") +
              "</a>";
            if (i[4].length && (inGrp || forSheet))
              h +=
                '<div class="sub">' +
                i[4]
                  .map(function (s) {
                    return (
                      '<a href="' +
                      s[1] +
                      '"' +
                      (s[0] === active ? ' aria-current="page"' : "") +
                      ">" +
                      s[2] +
                      (s[0] === "transaksi"
                        ? ' <span class="badge num">' + txc + "</span>"
                        : "") +
                      "</a>"
                    );
                  })
                  .join("") +
                "</div>";
            return h;
          })
          .join("") +
        "</nav>"
      );
    }
    var m = navModel();
    return (
      grp(m[0]) + (m[1].length ? '<div class="sep"></div>' + grp(m[1]) : "")
    );
  }

  WM.shell = function (opts) {
    opts = opts || {};
    var page = opts.page || document.body.dataset.page || "",
      main = document.querySelector("main") || document.createElement("main");
    main.classList.add("main");
    main.id = main.id || "main";
    var me = WM.me(),
      brand =
        '<span class="brand-mark" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l4.5 12L12 8l4.5 10L21 6"/></svg></span>';
    var prof = WM.store.get("profile");
    var side =
      '<aside class="side" aria-label="Menu utama"><a class="brand" href="' +
      (WM.isOwner() ? "index.html" : "akses-saya.html") +
      '">' +
      brand +
      "WealthMe</a>" +
      navHTML(page) +
      '<div class="side-foot">' +
      (WM.isOwner()
        ? '<div class="promo"><h3>Lengkapi profil</h3><div class="steps">' +
          [1, 2, 3, 4, 5]
            .map(function (i) {
              return '<i class="' + (i <= prof.step ? "on" : "") + '"></i>';
            })
            .join("") +
          "</div><p>" +
          prof.step +
          " dari " +
          prof.of +
          ' langkah selesai.</p><a class="btn dark sm" href="akun.html">Lanjutkan</a></div>'
        : "") +
      "</div></aside>";
    var unread = WM.store.get("notifications").filter(function (n) {
      return !n.read;
    }).length;
    var top =
      '<header class="top no-print"><a class="mbrand" href="index.html">' +
      brand +
      "WealthMe</a>" +
      '<button class="search" type="button" id="wmSearch" aria-label="Cari">' +
      WM.icon("search", 16, 2) +
      '<span class="lbl">Cari halaman, transaksi…</span><kbd>Ctrl K</kbd></button>' +
      '<span class="chip-demo">Data contoh</span><span class="spacer"></span>' +
      '<button class="icon-btn" type="button" id="wmMenu" aria-label="Menu" hidden>' +
      WM.icon("menu") +
      "</button>" +
      '<button class="icon-btn theme" type="button" id="wmTheme" aria-label="Ganti tema">' +
      WM.icon(isDark() ? "sun" : "moon") +
      "</button>" +
      '<button class="icon-btn" type="button" id="wmBell" aria-label="Notifikasi' +
      (unread ? ", " + unread + " belum dibaca" : "") +
      '" aria-haspopup="true">' +
      WM.icon("bell") +
      (unread ? '<span class="dot"></span>' : "") +
      "</button>" +
      '<button class="me" type="button" id="wmMe" aria-haspopup="true" aria-label="Akun ' +
      esc(me.name) +
      '">' +
      WM.avatar(me) +
      "<div><b>" +
      esc(me.name) +
      "</b><small>" +
      WM.roleLabel(me.role) +
      " · Keluarga Rizaldi</small></div></button>" +
      (opts.noAdd
        ? ""
        : '<button class="btn-primary" type="button" id="wmAdd">' +
          WM.icon("plus", 16, 2.4) +
          "<span>" +
          (WM.isOwner() ? "Tambah transaksi" : "Catat transaksi") +
          "</span></button>") +
      "</header>";
    var mItems = WM.isOwner()
      ? [
          ["beranda", "index.html", "Beranda", "grid"],
          ["transaksi", "transaksi.html", "Transaksi", "swap"],
          null,
          ["laporan", "laporan.html", "Laporan", "chart"],
          "menu",
        ]
      : [
          ["akses-saya", "akses-saya.html", "Akses", "usercheck"],
          ["transaksi", "transaksi.html", "Transaksi", "swap"],
          null,
          ["notifikasi", "notifikasi.html", "Notifikasi", "bell"],
          "menu",
        ];
    var inDock = mItems.some(function (i) {
      return i && i !== "menu" && i[0] === page;
    });
    var mnav =
      '<nav class="mnav no-print" aria-label="Navigasi bawah">' +
      mItems
        .map(function (i) {
          if (i === "menu")
            return (
              '<button type="button" data-wm-menu aria-label="Semua menu"' +
              (inDock ? "" : ' aria-current="page"') +
              ">" +
              WM.icon("menu", 20) +
              "</button>"
            );
          if (!i)
            return (
              '<button class="fab" type="button" data-wm-add aria-label="Tambah transaksi">' +
              WM.icon("plus", 22, 2.2) +
              "</button>"
            );
          return (
            '<a href="' +
            i[1] +
            '"' +
            (i[0] === page ? ' aria-current="page"' : "") +
            ' aria-label="' +
            i[2] +
            '">' +
            WM.icon(i[3], 20) +
            (i[0] === page ? "<span>" + i[2] + "</span>" : "") +
            "</a>"
          );
        })
        .join("") +
      "</nav>";
    var app = document.createElement("div");
    app.className = "app";
    app.innerHTML = side;
    main.parentNode.insertBefore(app, main);
    app.appendChild(main);
    main.insertAdjacentHTML("afterbegin", top);
    /* phone-only page title, reference style: small greeting + big two-line title */
    var hour = new Date().getHours(),
      greet =
        hour < 11
          ? "Selamat pagi"
          : hour < 15
            ? "Selamat siang"
            : hour < 19
              ? "Selamat sore"
              : "Selamat malam";
    var ptitle =
      page === "beranda"
        ? "Selamat datang kembali!"
        : WM.pageTitle(page) || document.title.split(" · ")[0];
    main
      .querySelector(".top")
      .insertAdjacentHTML(
        "afterend",
        '<div class="mtitle-wrap"><small>' +
          greet +
          ", " +
          esc(me.short) +
          '</small><h1 class="mtitle-h">' +
          esc(ptitle) +
          "</h1></div>",
      );
    document.body.insertAdjacentHTML(
      "beforeend",
      mnav +
        (WM.isOwner() && page !== "ai"
          ? '<a class="fai no-print" href="ai.html" aria-label="Tanya AI" title="Tanya AI"><i>' +
            WM.icon("sparkle", 18) +
            "</i>Tanya AI</a>"
          : "") +
        '<div class="toasts" aria-live="polite" id="wmToasts"></div>',
    );
    WM.allowed = WM.allowedPage(page);
    if (!WM.allowed) {
      [].slice.call(main.children).forEach(function (c) {
        if (!c.classList.contains("top")) c.remove();
      });
      main.insertAdjacentHTML(
        "beforeend",
        '<section class="card"><div class="empty"><span class="ic">' +
          WM.icon("lock", 24) +
          "</span><b>Halaman ini tidak tersedia untuk peranmu</b><p>Peran " +
          WM.roleLabel(me.role) +
          " tidak punya akses ke " +
          esc(WM.pageTitle(page) || "halaman ini") +
          '. Minta Master keluarga menambah aksesmu.</p><a class="btn" href="' +
          (WM.isOwner() ? "index.html" : "akses-saya.html") +
          '">Kembali</a></div></section>',
      );
    }
    if (opts.title) document.title = opts.title + " · WealthMe";
    bindShell(page);
  };

  function isDark() {
    var t = ls("theme");
    if (t) return t === "dark";
    return (
      window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches
    );
  }
  (function () {
    var t = ls("theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  })();

  function bindShell(page) {
    var q = function (id) {
      return document.getElementById(id);
    };
    q("wmTheme").addEventListener("click", function () {
      var d = !isDark();
      ls("theme", d ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", d ? "dark" : "light");
      q("wmTheme").innerHTML = WM.icon(d ? "sun" : "moon");
      window.dispatchEvent(new CustomEvent("wm:theme"));
    });
    q("wmSearch").addEventListener("click", palette);
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        palette();
      }
    });
    q("wmBell").addEventListener("click", function (e) {
      bellPop(q("wmBell"));
    });
    q("wmMe").addEventListener("click", function () {
      mePop(q("wmMe"));
    });
    var add = q("wmAdd");
    if (add)
      add.addEventListener("click", function () {
        WM.openTx();
      });
    document.querySelectorAll("[data-wm-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        WM.openTx();
      });
    });
    var mm = q("wmMenu");
    function mq() {
      mm.hidden = window.innerWidth > 900 || window.innerWidth <= 720;
    }
    mq();
    window.addEventListener("resize", mq);
    function openMenu() {
      var m = navModel(),
        hubs = m[0].concat(m[1]);
      var d = WM.modal({
        title: "Semua menu",
        size: "sm",
        body:
          '<button type="button" class="search" data-msearch style="max-width:none;width:100%;box-shadow:none;background:var(--card-2);flex:none;min-height:46px">' +
          WM.icon("search", 16, 2) +
          "<span>Cari halaman, transaksi…</span></button>" +
          launcher(hubs, page),
        onOpen: function (dd, body) {
          body.querySelector("[data-msearch]").onclick = function () {
            dd.close();
            palette();
          };
        },
        noFoot: true,
      });
    }
    mm.addEventListener("click", openMenu);
    document.querySelectorAll("[data-wm-menu]").forEach(function (b) {
      b.addEventListener("click", openMenu);
    });
  }

  var SUBICON = {
    rekening: "landmark",
    dana: "wallet",
    transaksi: "swap",
    rekonsiliasi: "compare",
    quickinput: "zap",
    splitbill: "split",
    ringkasan: "pie",
    laporan: "chart",
    anggaran: "clipboard",
    tujuan: "target",
    investasi: "trend",
    aset: "briefcase",
    liabilitas: "receipt",
    asuransi: "shield",
    tax: "file",
    donation: "heart",
    warisan: "scroll",
    masterdata: "db",
    mastercoa: "book",
    iam: "key",
  };
  function launcher(hubs, page) {
    var loose = [],
      secs = [];
    hubs.forEach(function (h) {
      if (h[4].length)
        secs.push([
          h[2],
          h[4].map(function (x) {
            return [x[0], x[1], x[2], SUBICON[x[0]] || h[3]];
          }),
        ]);
      else loose.push(h);
    });
    var main = [
      ["beranda", "index.html", "Beranda", "grid"],
      ["notifikasi", "notifikasi.html", "Notifikasi", "bell"],
      ["akun", "akun.html", "Akun", "user"],
    ].concat(
      loose.filter(function (h) {
        return h[0] !== "beranda";
      }),
    );
    secs.unshift(["Utama", main]);
    return secs
      .map(function (sc) {
        return (
          '<section class="lsec"><h3>' +
          sc[0] +
          '</h3><div class="lgrid">' +
          sc[1]
            .map(function (i) {
              return (
                '<a class="lapp" href="' +
                i[1] +
                '"' +
                (i[0] === page ? ' aria-current="page"' : "") +
                "><span>" +
                WM.icon(i[3], 20) +
                "</span>" +
                i[2] +
                "</a>"
              );
            })
            .join("") +
          "</div></section>"
        );
      })
      .join("");
  }

  /* ---------- popover ---------- */
  var openPop = null;
  WM.popover = function (anchor, html, opts) {
    WM.closePop();
    var p = document.createElement("div");
    p.className = "pop";
    p.setAttribute("role", (opts && opts.role) || "dialog");
    p.innerHTML = html;
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect(),
      w = p.offsetWidth,
      left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w)),
      top = r.bottom + 8;
    if (top + p.offsetHeight > window.innerHeight - 12)
      top = Math.max(12, r.top - p.offsetHeight - 8);
    p.style.left = left + "px";
    p.style.top = top + "px";
    openPop = { el: p, anchor: anchor };
    anchor.setAttribute("aria-expanded", "true");
    var f = p.querySelector("button,a,input");
    if (f) f.focus();
    setTimeout(function () {
      document.addEventListener("pointerdown", outside);
    }, 0);
    document.addEventListener("keydown", escPop);
    return p;
  };
  function outside(e) {
    if (
      openPop &&
      !openPop.el.contains(e.target) &&
      !openPop.anchor.contains(e.target)
    )
      WM.closePop();
  }
  function escPop(e) {
    if (e.key === "Escape" && openPop) {
      var a = openPop.anchor;
      WM.closePop();
      a.focus();
    }
  }
  WM.closePop = function () {
    if (!openPop) return;
    openPop.el.remove();
    openPop.anchor.setAttribute("aria-expanded", "false");
    openPop = null;
    document.removeEventListener("pointerdown", outside);
    document.removeEventListener("keydown", escPop);
  };

  function bellPop(a) {
    var ns = WM.store.get("notifications").slice(0, 5);
    var p = WM.popover(
      a,
      '<div style="display:flex;align-items:center;justify-content:space-between;padding-right:6px"><h3>Notifikasi</h3><button class="btn ghost sm" type="button" data-all>Tandai dibaca</button></div>' +
        (ns.length
          ? ns
              .map(function (n) {
                return (
                  '<a class="mi" href="' +
                  n.href +
                  '" data-id="' +
                  n.id +
                  '" style="align-items:flex-start">' +
                  '<span class="ic' +
                  (n.read ? "" : " lime") +
                  '" style="width:34px;height:34px">' +
                  WM.icon(
                    {
                      approval: "checkc",
                      budget: "clipboard",
                      bill: "receipt",
                      goal: "target",
                    }[n.kind] || "bell",
                    16,
                  ) +
                  '</span><span style="min-width:0"><b style="display:block;font-weight:' +
                  (n.read ? 500 : 600) +
                  '">' +
                  esc(n.title) +
                  '</b><small class="muted">' +
                  esc(n.body) +
                  " · " +
                  WM.dayLabel(n.date) +
                  "</small></span></a>"
                );
              })
              .join("")
          : '<div class="empty"><b>Belum ada notifikasi</b></div>') +
        '<div class="sepl"></div><a class="mi" href="notifikasi.html" style="justify-content:center;font-weight:600">Lihat semua</a>',
    );
    p.querySelector("[data-all]").addEventListener("click", function () {
      WM.store.set(
        "notifications",
        WM.store.get("notifications").map(function (n) {
          n.read = true;
          return n;
        }),
      );
      WM.closePop();
      WM.toast("Semua notifikasi ditandai dibaca");
      var d = document.querySelector("#wmBell .dot");
      if (d) d.remove();
    });
    p.querySelectorAll("[data-id]").forEach(function (x) {
      x.addEventListener("click", function () {
        WM.store.update("notifications", x.dataset.id, { read: true });
      });
    });
  }
  function mePop(a) {
    var me = WM.me(),
      ms = WM.store.get("members");
    var p = WM.popover(
      a,
      '<div style="display:flex;gap:12px;align-items:center;padding:10px 12px">' +
        WM.avatar(me, 40) +
        "<div><b>" +
        esc(me.name) +
        '</b><small class="muted" style="display:block">' +
        esc(me.email) +
        '</small></div></div><div class="sepl"></div>' +
        '<a class="mi" href="akun.html">' +
        WM.icon("user") +
        'Profil & akun</a><button class="mi" type="button" data-reset>' +
        WM.icon("refresh") +
        'Reset data contoh</button><a class="mi" href="login.html">' +
        WM.icon("logout") +
        'Keluar</a><div class="sepl"></div>' +
        '<h3 style="font-size:12px;color:var(--muted);font-weight:600">Lihat sebagai (demo peran)</h3>' +
        ms
          .map(function (m) {
            return (
              '<button class="mi" type="button" role="menuitemradio" aria-checked="' +
              (m.id === me.id) +
              '" data-me="' +
              m.id +
              '">' +
              WM.avatar(m, 28) +
              "<span>" +
              esc(m.short) +
              ' <small class="muted">' +
              WM.roleLabel(m.role) +
              "</small></span></button>"
            );
          })
          .join(""),
    );
    p.querySelectorAll("[data-me]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.me,
          m = WM.member(id);
        ls("me", id);
        location.href =
          m.role === "child" || m.role === "staff"
            ? "akses-saya.html"
            : "index.html";
      });
    });
    p.querySelector("[data-reset]").addEventListener("click", function () {
      WM.confirm({
        title: "Reset data contoh?",
        text: "Semua perubahan yang kamu buat di prototipe ini akan hilang.",
        confirm: "Reset",
        danger: true,
      }).then(function (ok) {
        if (ok) WM.store.reset();
      });
    });
  }

  /* ---------- command palette ---------- */
  function palette() {
    var pages = allItems()
      .filter(function (i) {
        return WM.allowedPage(i[0]);
      })
      .filter(function (i, k, arr) {
        return (
          arr.findIndex(function (x) {
            return x[1] === i[1];
          }) === k
        );
      });
    pages.push(["akun", "akun.html", "Profil & akun", "user"]);
    var d = document.createElement("dialog");
    d.className = "sheet";
    d.setAttribute("aria-label", "Cari");
    d.innerHTML =
      '<div class="sheet-in"><label class="pal-in">' +
      WM.icon("search", 18, 2) +
      '<input type="search" placeholder="Cari halaman atau transaksi" aria-label="Kata kunci"></label><div class="pal-list" role="listbox"></div></div>';
    document.body.appendChild(d);
    var inp = d.querySelector("input"),
      list = d.querySelector(".pal-list"),
      sel = 0;
    function draw() {
      var q = inp.value.trim().toLowerCase(),
        ps = pages.filter(function (p) {
          return !q || p[2].toLowerCase().indexOf(q) >= 0;
        }),
        tx = q
          ? WM.store
              .get("tx")
              .filter(function (t) {
                return (
                  (t.note || "").toLowerCase().indexOf(q) >= 0 ||
                  WM.cat(t.cat).name.toLowerCase().indexOf(q) >= 0
                );
              })
              .slice(0, 6)
          : [];
      var h =
        (ps.length
          ? "<h4>Halaman</h4>" +
            ps
              .map(function (p) {
                return (
                  '<a href="' +
                  p[1] +
                  '" role="option"><span class="ic" style="width:32px;height:32px">' +
                  WM.icon(p[3], 16) +
                  "</span>" +
                  p[2] +
                  "</a>"
                );
              })
              .join("")
          : "") +
        (tx.length
          ? "<h4>Transaksi</h4>" +
            tx
              .map(function (t) {
                return (
                  '<a href="transaksi.html#' +
                  t.id +
                  '" role="option"><span class="ic" style="width:32px;height:32px">' +
                  WM.icon(WM.cat(t.cat).icon, 16) +
                  '</span><span style="flex:1;min-width:0">' +
                  esc(t.note) +
                  '<small class="muted" style="display:block">' +
                  WM.date(t.date) +
                  '</small></span><span class="num">' +
                  WM.rp(t.type === "in" ? t.amount : -t.amount) +
                  "</span></a>"
                );
              })
              .join("")
          : "") +
        (!ps.length && !tx.length
          ? '<div class="empty"><b>Tidak ketemu</b><p>Coba kata lain, misalnya "gaji" atau "anggaran".</p></div>'
          : "");
      list.innerHTML = h;
      sel = 0;
      mark();
    }
    function mark() {
      var a = list.querySelectorAll("a");
      a.forEach(function (x, i) {
        x.setAttribute("aria-selected", i === sel);
      });
    }
    inp.addEventListener("input", draw);
    inp.addEventListener("keydown", function (e) {
      var a = list.querySelectorAll("a");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        sel = Math.min(a.length - 1, sel + 1);
        mark();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        sel = Math.max(0, sel - 1);
        mark();
      }
      if (e.key === "Enter" && a[sel]) {
        location.href = a[sel].getAttribute("href");
      }
    });
    d.addEventListener("close", function () {
      d.remove();
    });
    d.addEventListener("click", function (e) {
      if (e.target === d) d.close();
    });
    draw();
    d.showModal();
    inp.focus();
  }

  /* ---------- toast ---------- */
  WM.toast = function (msg, o) {
    o = o || {};
    var box = document.getElementById("wmToasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "toasts";
      box.id = "wmToasts";
      document.body.appendChild(box);
    }
    var t = document.createElement("div");
    t.className = "toast" + (o.bad ? " bad" : "");
    t.setAttribute("role", "status");
    t.innerHTML =
      "<span>" +
      esc(msg) +
      "</span>" +
      (o.undo ? '<button type="button">Urungkan</button>' : "");
    box.appendChild(t);
    var timer = setTimeout(
      function () {
        t.remove();
      },
      o.undo ? 6000 : 3200,
    );
    if (o.undo)
      t.querySelector("button").addEventListener("click", function () {
        clearTimeout(timer);
        t.remove();
        o.undo();
      });
  };

  /* ---------- modal / confirm ---------- */
  /* WM.modal({title, sub, body (html or node), size:"sm"|"lg", submit:"Simpan", cancel:"Batal", danger, onSubmit(form,data,dialog)->string error|false to keep open, onOpen(dialog), noFoot}) */
  WM.modal = function (o) {
    var d = document.createElement("dialog");
    d.className =
      "sheet" +
      (o.size ? " " + o.size : "") +
      (!o.center && o.size !== "sm" && window.innerWidth > 900 ? " side" : "");
    d.setAttribute("aria-labelledby", "mt" + ++mid);
    d.innerHTML =
      '<form method="dialog" novalidate><div class="sheet-head"><div><h2 id="mt' +
      mid +
      '">' +
      o.title +
      "</h2>" +
      (o.sub ? "<p>" + o.sub + "</p>" : "") +
      '</div><button class="x" type="button" data-x aria-label="Tutup">' +
      WM.icon("x", 16, 2) +
      '</button></div><div class="sheet-body"></div>' +
      (o.noFoot
        ? ""
        : '<div class="sheet-foot"><div class="form-err" role="alert"></div><button class="btn" type="button" data-x>' +
          (o.cancel || "Batal") +
          "</button>" +
          (o.submit === false
            ? ""
            : '<button class="btn ' +
              (o.danger ? "danger" : "primary") +
              '" type="submit">' +
              (o.submit || "Simpan") +
              "</button>") +
          "</div>") +
      "</form>";
    var body = d.querySelector(".sheet-body");
    if (typeof o.body === "string") body.innerHTML = o.body;
    else if (o.body) body.appendChild(o.body);
    document.body.appendChild(d);
    var f = d.querySelector("form");
    d.querySelectorAll("[data-x]").forEach(function (b) {
      b.addEventListener("click", function () {
        d.close();
      });
    });
    d.addEventListener("click", function (e) {
      if (e.target === d) d.close();
    });
    d.addEventListener("close", function () {
      setTimeout(function () {
        d.remove();
      }, 10);
      if (o.onClose) o.onClose();
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var fe = d.querySelector(".form-err");
      if (fe) fe.textContent = "";
      if (!WM.validate(f)) return;
      var r = o.onSubmit ? o.onSubmit(f, WM.readForm(f), d) : true;
      if (typeof r === "string") {
        if (fe) fe.textContent = r;
        return;
      }
      if (r !== false) d.close();
    });
    wireMoney(d);
    d.showModal();
    if (o.onOpen) o.onOpen(d, body);
    var first = body.querySelector("input:not([type=hidden]),select,textarea");
    if (first && !o.noAutofocus) first.focus();
    return d;
  };
  var mid = 0;
  WM.confirm = function (o) {
    return new Promise(function (res) {
      var done = false;
      WM.modal({
        title: o.title,
        size: "sm",
        center: true,
        body:
          '<p style="margin:0;color:var(--muted)">' + (o.text || "") + "</p>",
        submit: o.confirm || "Ya, lanjutkan",
        danger: o.danger,
        onSubmit: function () {
          done = true;
          res(true);
        },
        onClose: function () {
          if (!done) res(false);
        },
      });
    });
  };

  /* ---------- forms ---------- */
  /* WM.field({name,label,type:text|money|number|date|select|textarea|email|password|tel|percent, required, optional, value, options:[[v,l]], hint, placeholder, min, max, attrs}) */
  WM.field = function (f) {
    var id = "f_" + f.name + "_" + ++mid,
      req = f.required ? " required" : "",
      val = f.value == null ? "" : f.value,
      ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "",
      at = f.attrs || "";
    var lab =
        '<label for="' +
        id +
        '">' +
        f.label +
        (f.optional ? ' <span class="opt">(opsional)</span>' : "") +
        "</label>",
      ctl;
    if (f.type === "select")
      ctl =
        '<select id="' +
        id +
        '" name="' +
        f.name +
        '"' +
        req +
        " " +
        at +
        ">" +
        (f.placeholder
          ? '<option value="">' + esc(f.placeholder) + "</option>"
          : "") +
        (f.options || [])
          .map(function (o) {
            o = Array.isArray(o) ? o : [o, o];
            return (
              '<option value="' +
              esc(o[0]) +
              '"' +
              (String(o[0]) === String(val) ? " selected" : "") +
              ">" +
              esc(o[1]) +
              "</option>"
            );
          })
          .join("") +
        "</select>";
    else if (f.type === "textarea")
      ctl =
        '<textarea id="' +
        id +
        '" name="' +
        f.name +
        '"' +
        req +
        ph +
        " " +
        at +
        ">" +
        esc(val) +
        "</textarea>";
    else if (f.type === "money")
      ctl =
        '<div class="affix"><span>Rp</span><input id="' +
        id +
        '" name="' +
        f.name +
        '" inputmode="numeric" data-money autocomplete="off"' +
        req +
        ph +
        (f.min != null ? ' data-min="' + f.min + '"' : "") +
        (f.max != null ? ' data-max="' + f.max + '"' : "") +
        ' value="' +
        (val !== "" ? (+val).toLocaleString("id-ID") : "") +
        '" ' +
        at +
        "></div>";
    else if (f.type === "percent")
      ctl =
        '<div class="affix"><input id="' +
        id +
        '" name="' +
        f.name +
        '" inputmode="decimal" data-num' +
        req +
        ph +
        (f.min != null ? ' data-min="' + f.min + '"' : "") +
        (f.max != null ? ' data-max="' + f.max + '"' : "") +
        ' value="' +
        esc(val) +
        '" ' +
        at +
        "><span>%</span></div>";
    else
      ctl =
        '<input id="' +
        id +
        '" name="' +
        f.name +
        '" type="' +
        (f.type === "number" ? "text" : f.type || "text") +
        '"' +
        (f.type === "number" ? ' inputmode="decimal" data-num' : "") +
        req +
        ph +
        (f.min != null ? ' data-min="' + f.min + '"' : "") +
        (f.max != null ? ' data-max="' + f.max + '"' : "") +
        ' value="' +
        esc(val) +
        '" ' +
        at +
        ">";
    return (
      '<div class="field' +
      (f.cls ? " " + f.cls : "") +
      '" data-field="' +
      f.name +
      '">' +
      lab +
      ctl +
      (f.hint ? '<span class="hint">' + f.hint + "</span>" : "") +
      '<span class="err" id="' +
      id +
      '_e" aria-live="polite"></span></div>'
    );
  };
  function wireMoney(root) {
    root.querySelectorAll("[data-money]").forEach(function (i) {
      if (i._wm) return;
      i._wm = 1;
      i.addEventListener("input", function () {
        var n = WM.parseMoney(i.value);
        var pos = i.value.length - i.selectionStart;
        i.value = n ? n.toLocaleString("id-ID") : "";
        try {
          i.setSelectionRange(i.value.length - pos, i.value.length - pos);
        } catch (e) {}
      });
    });
    root.querySelectorAll("input,select,textarea").forEach(function (i) {
      if (i._wv) return;
      i._wv = 1;
      i.addEventListener("input", function () {
        var fl = i.closest(".field");
        if (fl && fl.classList.contains("invalid")) {
          fl.classList.remove("invalid");
          var e = fl.querySelector(".err");
          if (e) e.textContent = "";
        }
      });
    });
  }
  WM.wire = wireMoney;
  WM.setError = function (form, name, msg) {
    var fl = form.querySelector('[data-field="' + name + '"]');
    if (!fl) return;
    fl.classList.toggle("invalid", !!msg);
    var e = fl.querySelector(".err");
    if (e) e.textContent = msg || "";
    var c = fl.querySelector("input,select,textarea");
    if (c) c.setAttribute("aria-invalid", msg ? "true" : "false");
  };
  WM.validate = function (form) {
    var ok = true,
      first = null;
    form.querySelectorAll(".field").forEach(function (fl) {
      var c = fl.querySelector("input,select,textarea");
      if (!c || c.disabled || fl.closest("[hidden]")) return;
      var v = c.value.trim(),
        msg = "",
        name = (fl.querySelector("label") || {}).textContent || "Kolom ini";
      name = name.replace(/\(opsional\)/, "").trim();
      if (c.required && !v) msg = name + " wajib diisi.";
      else if (v && c.hasAttribute("data-money")) {
        var n = WM.parseMoney(v);
        if (n <= 0 && !c.hasAttribute("data-allow-zero"))
          msg = "Masukkan nominal lebih dari 0.";
        else if (c.dataset.max && n > +c.dataset.max)
          msg = "Maksimal " + WM.rp(+c.dataset.max) + ".";
        else if (c.dataset.min && n < +c.dataset.min)
          msg = "Minimal " + WM.rp(+c.dataset.min) + ".";
      } else if (v && c.hasAttribute("data-num")) {
        var x = parseFloat(v.replace(",", "."));
        if (isNaN(x)) msg = "Masukkan angka.";
        else if (c.dataset.min && x < +c.dataset.min)
          msg = "Minimal " + c.dataset.min + ".";
        else if (c.dataset.max && x > +c.dataset.max)
          msg = "Maksimal " + c.dataset.max + ".";
      } else if (
        v &&
        c.type === "email" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      )
        msg = "Format email belum benar.";
      if (fl.dataset.field && msg) WM.setError(form, fl.dataset.field, msg);
      if (msg) {
        ok = false;
        if (!first) first = c;
      }
    });
    form.querySelectorAll("[data-required-group]").forEach(function (g) {
      if (!g.querySelector('[aria-checked="true"]')) {
        ok = false;
        g.classList.add("invalid");
        var e = document.getElementById(g.dataset.requiredGroup);
        if (e) e.textContent = g.dataset.msg || "Pilih salah satu.";
        if (!first) first = g.querySelector("button");
      }
    });
    if (first) first.focus();
    return ok;
  };
  WM.readForm = function (form) {
    var o = {};
    form
      .querySelectorAll("input[name],select[name],textarea[name]")
      .forEach(function (c) {
        if (c.type === "checkbox") o[c.name] = c.checked;
        else if (c.type === "radio") {
          if (c.checked) o[c.name] = c.value;
        } else if (c.hasAttribute("data-money"))
          o[c.name] = WM.parseMoney(c.value);
        else if (c.hasAttribute("data-num"))
          o[c.name] =
            c.value === "" ? null : parseFloat(c.value.replace(",", "."));
        else o[c.name] = c.value.trim();
      });
    form.querySelectorAll("[data-radio]").forEach(function (g) {
      var s = g.querySelector('[aria-checked="true"]');
      o[g.dataset.radio] = s ? s.dataset.v : "";
    });
    return o;
  };
  /* radio groups of buttons: <div data-radio="name" role="radiogroup"> <button data-v=".." role="radio"> */
  WM.radio = function (root) {
    (root || document).querySelectorAll("[data-radio]").forEach(function (g) {
      if (g._r) return;
      g._r = 1;
      var items = function () {
        return [].slice.call(g.querySelectorAll('[role="radio"]'));
      };
      function pick(b, fire) {
        items().forEach(function (x) {
          x.setAttribute("aria-checked", x === b ? "true" : "false");
          x.tabIndex = x === b ? 0 : -1;
        });
        g.classList.remove("invalid");
        if (g.dataset.requiredGroup) {
          var e = document.getElementById(g.dataset.requiredGroup);
          if (e) e.textContent = "";
        }
        if (fire)
          g.dispatchEvent(new CustomEvent("change", { detail: b.dataset.v }));
      }
      g.addEventListener("click", function (e) {
        var b = e.target.closest('[role="radio"]');
        if (b && g.contains(b) && !b.disabled) pick(b, true);
      });
      g.addEventListener("keydown", function (e) {
        var a = items(),
          i = a.indexOf(document.activeElement);
        if (i < 0) return;
        var n =
          e.key === "ArrowRight" || e.key === "ArrowDown"
            ? 1
            : e.key === "ArrowLeft" || e.key === "ArrowUp"
              ? -1
              : 0;
        if (!n) return;
        e.preventDefault();
        var t = a[(i + n + a.length) % a.length];
        t.focus();
        pick(t, true);
      });
      var s = g.querySelector('[aria-checked="true"]');
      items().forEach(function (x, i) {
        x.tabIndex = (s ? x === s : i === 0) ? 0 : -1;
      });
    });
  };

  /* horizontal scroller with arrows, wheel and drag */
  WM.hscroll = function (wrap) {
    var track =
      wrap.querySelector(".acc-row,.hs-track") || wrap.firstElementChild;
    if (!track || wrap._h) return;
    wrap._h = 1;
    wrap.classList.add("hscroll");
    var l = document.createElement("button"),
      r = document.createElement("button");
    l.type = r.type = "button";
    l.className = "hs-btn l";
    r.className = "hs-btn r";
    l.setAttribute("aria-label", "Geser kiri");
    r.setAttribute("aria-label", "Geser kanan");
    l.tabIndex = r.tabIndex = -1;
    l.innerHTML = WM.icon("chevl", 14, 2.4);
    r.innerHTML = WM.icon("chev", 14, 2.4);
    wrap.appendChild(l);
    wrap.appendChild(r);
    function upd() {
      var m = track.scrollWidth - track.clientWidth;
      l.hidden = track.scrollLeft < 4;
      r.hidden = track.scrollLeft > m - 4;
      wrap.classList.toggle("more-l", !l.hidden);
      wrap.classList.toggle("more-r", !r.hidden);
    }
    l.onclick = function () {
      track.scrollBy({ left: -track.clientWidth * 0.7, behavior: "smooth" });
    };
    r.onclick = function () {
      track.scrollBy({ left: track.clientWidth * 0.7, behavior: "smooth" });
    };
    track.addEventListener("scroll", upd, { passive: true });
    track.addEventListener(
      "wheel",
      function (e) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          var b = track.scrollLeft;
          track.scrollLeft += e.deltaY;
          if (track.scrollLeft !== b) e.preventDefault();
        }
      },
      { passive: false },
    );
    var down = false,
      sx = 0,
      sl = 0,
      moved = false;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      down = true;
      moved = false;
      sx = e.clientX;
      sl = track.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      if (Math.abs(e.clientX - sx) > 4) moved = true;
      track.scrollLeft = sl - (e.clientX - sx);
    });
    window.addEventListener("pointerup", function () {
      down = false;
    });
    track.addEventListener(
      "click",
      function (e) {
        if (moved) {
          e.stopPropagation();
          e.preventDefault();
          moved = false;
        }
      },
      true,
    );
    new ResizeObserver(upd).observe(track);
    upd();
    return upd;
  };

  /* ---------- transactions: add / edit / detail ---------- */
  function accTiles(list, sel, skip) {
    return list
      .filter(function (a) {
        return a.id !== skip;
      })
      .map(function (a) {
        return (
          '<button type="button" class="acc" role="radio" data-v="' +
          a.id +
          '" aria-checked="' +
          (a.id === sel) +
          '"><small>' +
          esc(a.name) +
          "</small><b>" +
          esc(a.bank) +
          '</b><span class="num">' +
          (a.type === "cc"
            ? "Tagihan " + WM.short(-a.balance)
            : WM.short(a.balance)) +
          "</span></button>"
        );
      })
      .join("");
  }
  WM.openTx = function (edit, preset) {
    var me = WM.me(),
      t = edit
        ? WM.store.find("tx", edit)
        : Object.assign(
            { type: "out", date: WM.today, member: me.id },
            preset || {},
          );
    var accs = WM.visibleAccounts(),
      type = t.type,
      ms = WM.store.get("members");
    if (!WM.isOwner())
      ms = ms.filter(function (m) {
        return m.id === me.id;
      });
    var html =
      '<div class="seg full" data-radio="type" role="radiogroup" aria-label="Jenis transaksi">' +
      [
        ["out", "Pengeluaran"],
        ["in", "Pemasukan"],
        ["tf", "Transfer"],
      ]
        .map(function (x) {
          return (
            '<button type="button" role="radio" data-v="' +
            x[0] +
            '" aria-checked="' +
            (type === x[0]) +
            '">' +
            x[1] +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="field" data-field="amount"><label for="txAmt">Nominal</label><div class="amount"><span>Rp</span><input id="txAmt" name="amount" data-money inputmode="numeric" autocomplete="off" required placeholder="0" value="' +
      (t.amount ? t.amount.toLocaleString("id-ID") : "") +
      '"></div><span class="err" aria-live="polite"></span></div>' +
      '<details class="more-opts"><summary>' +
      WM.icon("chev", 14, 2.2) +
      'Mata uang asing (opsional)</summary><div><div class="two">' +
      WM.field({
        name: "cur",
        label: "Mata uang",
        type: "select",
        value: "IDR",
        options: [
          ["IDR", "IDR, Rupiah"],
          ["USD", "USD"],
          ["SGD", "SGD"],
          ["EUR", "EUR"],
          ["JPY", "JPY"],
          ["MYR", "MYR"],
        ],
      }) +
      WM.field({
        name: "rate",
        label: "Kurs ke Rupiah",
        type: "number",
        placeholder: "Misal 16250",
        min: 0.0001,
        hint: "Isi dari kurs bankmu. Nominal di atas diisi dalam mata uang ini.",
      }) +
      '</div><div class="note" data-fx hidden></div></div></details>' +
      '<div><div class="flabel"><span id="accL">' +
      (type === "in" ? "Masuk ke rekening" : "Dari rekening") +
      '</span></div><div class="acc-wrap"><div class="acc-row" data-radio="acc" role="radiogroup" aria-labelledby="accL">' +
      accTiles(accs, t.acc || accs[0].id) +
      "</div></div></div>" +
      '<div data-to><div class="flabel"><span id="toL">Ke rekening</span></div><div class="acc-wrap"><div class="acc-row" data-radio="to" role="radiogroup" aria-labelledby="toL"></div></div></div>' +
      '<div data-cat><div class="flabel"><span id="catL">Kategori</span></div><div class="cgrid" data-radio="cat" role="radiogroup" aria-labelledby="catL" data-required-group="catE" data-msg="Pilih kategori dulu."></div><span class="err" id="catE" aria-live="polite"></span></div>' +
      '<div class="two">' +
      WM.field({
        name: "date",
        label: "Tanggal",
        type: "date",
        required: true,
        value: t.date,
        attrs: 'max="' + WM.today + '"',
      }) +
      '<div class="field"><label>Untuk anggota</label><div class="members" data-radio="member" role="radiogroup" aria-label="Anggota">' +
      ms
        .map(function (m) {
          return (
            '<button type="button" class="member" role="radio" data-v="' +
            m.id +
            '" aria-checked="' +
            (m.id === (t.member || me.id)) +
            '" aria-label="' +
            esc(m.short) +
            '" title="' +
            esc(m.short) +
            '">' +
            WM.avatar(m, 42) +
            "</button>"
          );
        })
        .join("") +
      "</div></div></div>" +
      WM.field({
        name: "note",
        label: "Catatan",
        optional: true,
        value: t.note || "",
        placeholder: "Misal: makan siang tim",
      }) +
      '<div class="budget-hint" data-bh hidden><span>Sisa anggaran <b data-bl></b></span><span class="track"><i data-bb></i></span></div>' +
      (edit
        ? ""
        : '<button type="button" class="btn ghost sm" data-scan style="align-self:flex-start">' +
          WM.icon("camera", 16) +
          "Scan struk</button>");
    WM.modal({
      title: edit ? "Ubah transaksi" : "Catat transaksi",
      center: true,
      body: html,
      submit: edit ? "Simpan perubahan" : "Simpan",
      noAutofocus: true,
      onOpen: function (d, b) {
        WM.radio(b);
        WM.hscroll(b.querySelectorAll(".acc-wrap")[0]);
        WM.hscroll(b.querySelectorAll(".acc-wrap")[1]);
        var amt = b.querySelector("#txAmt");
        function cats() {
          var g = b.querySelector('[data-radio="cat"]'),
            list = WM.store.get("categories").filter(function (c) {
              return c.kind === (type === "in" ? "in" : "out");
            });
          g.innerHTML = list
            .map(function (c) {
              return (
                '<button type="button" class="ctile" role="radio" data-v="' +
                c.id +
                '" aria-checked="' +
                (c.id === t.cat) +
                '"><span class="ci">' +
                WM.icon(c.icon, 17) +
                "</span><span>" +
                esc(c.name) +
                "</span></button>"
              );
            })
            .join("");
          g._r = 0;
          WM.radio(b);
        }
        function to() {
          var from =
            (b.querySelector('[data-radio="acc"] [aria-checked="true"]') || {})
              .dataset || {};
          var g = b.querySelector('[data-radio="to"]');
          var cur = (g.querySelector('[aria-checked="true"]') || {}).dataset;
          var sel =
            cur && cur.v !== from.v
              ? cur.v
              : t.to && t.to !== from.v
                ? t.to
                : null;
          var list = accs.filter(function (a) {
            return a.id !== from.v;
          });
          g.innerHTML = accTiles(list, sel || list[0].id);
          g._r = 0;
          WM.radio(b);
        }
        function budget() {
          var bh = b.querySelector("[data-bh]"),
            c = (
              b.querySelector('[data-radio="cat"] [aria-checked="true"]') || {}
            ).dataset;
          var bud =
            c &&
            WM.store.get("budgets").filter(function (x) {
              return x.cat === c.v;
            })[0];
          if (type !== "out" || !bud) {
            bh.hidden = true;
            return;
          }
          var left =
            bud.limit -
            WM.spent(bud.cat) -
            WM.parseMoney(amt.value) +
            (edit && t.cat === bud.cat ? t.amount : 0);
          bh.hidden = false;
          bh.classList.toggle("over", left < 0);
          b.querySelector("[data-bl]").textContent =
            (left < 0 ? "lewat " : "") +
            WM.rp(Math.abs(left)) +
            " · " +
            WM.cat(bud.cat).name;
          b.querySelector("[data-bb]").style.width =
            Math.max(0, Math.min(100, (left / bud.limit) * 100)) + "%";
        }
        function setType(v) {
          type = v;
          b.querySelector("[data-to]").hidden = v !== "tf";
          b.querySelector("[data-cat]").hidden = v === "tf";
          b.querySelector("#accL").textContent =
            v === "in" ? "Masuk ke rekening" : "Dari rekening";
          if (v === "tf") to();
          else cats();
          budget();
        }
        b.querySelector('[data-radio="type"]').addEventListener(
          "change",
          function (e) {
            setType(e.detail);
          },
        );
        b.querySelector('[data-radio="acc"]').addEventListener(
          "change",
          function () {
            if (type === "tf") to();
          },
        );
        b.querySelector('[data-radio="cat"]').addEventListener(
          "change",
          budget,
        );
        amt.addEventListener("input", budget);
        var sc = b.querySelector("[data-scan]");
        if (sc)
          sc.addEventListener("click", function () {
            WM.modal({
              title: "Scan struk",
              size: "sm",
              body:
                '<label class="drop">' +
                WM.icon("camera", 26) +
                '<b>Foto atau pilih struk</b><span>JPG, PNG atau PDF. Maks 5 MB.</span><input type="file" accept="image/*,application/pdf" hidden></label><p class="muted" style="margin:0;font-size:13px">Di prototipe, hasil scan diisi dengan contoh struk Indomaret Rp 86.500.</p>',
              submit: "Pakai hasil scan",
              onSubmit: function () {
                amt.value = (86500).toLocaleString("id-ID");
                setType("out");
                var mk = b.querySelector('[data-v="c-makan"]');
                if (mk) mk.click();
                b.querySelector('[name="note"]').value =
                  "Indomaret (hasil scan)";
                budget();
              },
            });
          });
        var cur = b.querySelector('[name="cur"]'),
          rate = b.querySelector('[name="rate"]'),
          fx = b.querySelector("[data-fx]");
        function fxu() {
          var on = cur.value !== "IDR";
          rate.required = on;
          rate.closest(".field").hidden = !on;
          var r = parseFloat((rate.value || "").replace(",", "."));
          fx.hidden = !(on && r > 0 && WM.parseMoney(amt.value));
          if (!fx.hidden)
            fx.textContent =
              "≈ " +
              WM.rp(Math.round(WM.parseMoney(amt.value) * r)) +
              " disimpan dalam Rupiah, kurs dicatat untuk audit.";
        }
        cur.addEventListener("change", fxu);
        rate.addEventListener("input", fxu);
        amt.addEventListener("input", fxu);
        fxu();
        setType(type);
        setTimeout(function () {
          amt.focus({ preventScroll: true });
        }, 30);
      },
      onSubmit: function (f, v) {
        if (v.cur && v.cur !== "IDR") {
          v.fx = { cur: v.cur, orig: v.amount, rate: v.rate };
          v.amount = Math.round(v.amount * v.rate);
        }
        if (v.type === "tf" && v.acc === v.to)
          return "Rekening asal dan tujuan harus berbeda.";
        if (v.date > WM.today) {
          WM.setError(f, "date", "Tanggal tidak boleh di masa depan.");
          return false;
        }
        var a = WM.account(v.acc);
        if (
          v.type !== "in" &&
          a &&
          a.type !== "cc" &&
          a.balance +
            (edit && t.acc === v.acc && t.type !== "in" ? t.amount : 0) <
            v.amount
        ) {
          WM.setError(
            f,
            "amount",
            "Saldo " + a.bank + " tidak cukup (" + WM.short(a.balance) + ").",
          );
          return false;
        }
        var rec = {
          type: v.type,
          amount: v.amount,
          acc: v.acc,
          to: v.type === "tf" ? v.to : undefined,
          cat: v.type === "tf" ? undefined : v.cat,
          date: v.date,
          member: v.member || me.id,
          fx: v.fx,
          note: v.note || (v.type === "tf" ? "Transfer" : WM.cat(v.cat).name),
        };
        if (edit) {
          WM.updateTx(edit, rec);
          WM.toast("Perubahan disimpan");
        } else {
          var n = WM.addTx(rec);
          WM.toast(
            (v.type === "in"
              ? "Pemasukan"
              : v.type === "tf"
                ? "Transfer"
                : "Pengeluaran") +
              " " +
              WM.rp(v.amount) +
              " tersimpan",
            {
              undo: function () {
                WM.removeTx(n.id);
                WM.toast("Dibatalkan");
              },
            },
          );
        }
      },
    });
  };
  WM.openTxDetail = function (id) {
    var t = WM.store.find("tx", id);
    if (!t) return;
    var a = WM.account(t.acc),
      to = t.to && WM.account(t.to),
      c = WM.cat(t.cat),
      can = WM.canModifyTx(t),
      by = WM.member(t.by),
      mem = WM.member(t.member);
    var inn = t.type === "in",
      kind = { in: "Pemasukan", out: "Pengeluaran", tf: "Transfer" }[t.type];
    var d0 = new Date(t.date + "T00:00:00"),
      hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
        d0.getDay()
      ];
    var ym = t.date.slice(0, 7),
      same = WM.store.get("tx").filter(function (x) {
        return (
          x.id !== t.id &&
          x.type === t.type &&
          (t.type === "tf" ? true : x.cat === t.cat)
        );
      });
    var monthSum =
      same
        .filter(function (x) {
          return x.date.slice(0, 7) === ym;
        })
        .reduce(function (s2, x) {
          return s2 + x.amount;
        }, 0) + t.amount;
    var bud =
      t.type === "out" &&
      WM.store.get("budgets").filter(function (x) {
        return x.cat === t.cat;
      })[0];
    function accChip(x, lbl) {
      return x
        ? '<div class="td-acc"><small>' +
            lbl +
            "</small><b>" +
            esc(x.bank) +
            "</b><span>" +
            esc(x.name) +
            (x.no ? " · " + x.no : "") +
            "</span>" +
            (x.vis === "private" ? '<i class="pill">Pribadi</i>' : "") +
            "</div>"
        : "";
    }
    var body =
      '<div class="card dark td-hero"><span class="td-ic">' +
      WM.icon(t.type === "tf" ? "swap" : c.icon, 22) +
      '</span><div class="td-amt num">' +
      (t.type === "tf" ? "" : inn ? "+" : "−") +
      "Rp " +
      t.amount.toLocaleString("id-ID") +
      "</div>" +
      '<div class="td-note">' +
      esc(t.note || c.name) +
      '</div><div class="td-tags"><span>' +
      kind +
      "</span><span>" +
      hari +
      ", " +
      WM.date(t.date, true) +
      "</span>" +
      (t.fx
        ? "<span>" +
          t.fx.cur +
          " " +
          (+t.fx.orig).toLocaleString("id-ID") +
          "</span>"
        : "") +
      "</div></div>" +
      '<div class="td-flow">' +
      accChip(a, t.type === "in" ? "Masuk ke" : "Dari") +
      '<span class="td-arrow">' +
      WM.icon("chev", 16, 2.2) +
      "</span>" +
      (to
        ? accChip(to, "Ke")
        : '<div class="td-acc"><small>' +
          (inn ? "Sumber" : "Kategori") +
          "</small><b>" +
          esc(c.name) +
          "</b><span>" +
          (inn ? "Pemasukan" : "Pengeluaran") +
          "</span></div>") +
      "</div>" +
      '<dl class="kv"><dt>Untuk</dt><dd>' +
      WM.avatar(mem, 22) +
      " " +
      esc(mem.short) +
      "</dd><dt>Dicatat oleh</dt><dd>" +
      esc(by.short) +
      " · " +
      WM.roleLabel(by.role) +
      "</dd>" +
      (t.fx
        ? "<dt>Kurs</dt><dd>1 " +
          t.fx.cur +
          " = Rp " +
          (+t.fx.rate).toLocaleString("id-ID") +
          "</dd>"
        : "") +
      '<dt>No. referensi</dt><dd class="mono" style="font-size:12px">' +
      esc(t.id.toUpperCase()) +
      "</dd></dl>" +
      (t.type !== "tf"
        ? '<div class="td-ctx"><div class="head"><div><b>' +
          esc(c.name) +
          " bulan ini</b><small>" +
          (same.filter(function (x) {
            return x.date.slice(0, 7) === ym;
          }).length +
            1) +
          ' transaksi</small></div><b class="num">' +
          WM.short(monthSum) +
          "</b></div>" +
          (bud
            ? '<div class="track" style="margin-top:10px"><i class="' +
              (monthSum > bud.limit
                ? "fill-bad"
                : monthSum / bud.limit > 0.8
                  ? "fill-orange"
                  : "fill-lime") +
              '" style="width:' +
              Math.min(100, (monthSum / bud.limit) * 100) +
              '%"></i></div><small>' +
              Math.round((monthSum / bud.limit) * 100) +
              "% dari anggaran " +
              WM.short(bud.limit) +
              "</small>"
            : "") +
          "</div>"
        : "") +
      (same.length
        ? '<div><div class="flabel"><span>Transaksi serupa</span></div><ul class="mini-list" style="margin:0">' +
          same
            .slice(0, 3)
            .map(function (x) {
              return (
                '<li data-tx="' +
                x.id +
                '" style="cursor:pointer"><span class="ic">' +
                WM.icon(x.type === "tf" ? "swap" : WM.cat(x.cat).icon, 16) +
                "</span><div><b>" +
                esc(x.note || WM.cat(x.cat).name) +
                "</b><small>" +
                WM.date(x.date) +
                '</small></div><span class="amt">' +
                WM.short(x.amount) +
                "</span></li>"
              );
            })
            .join("") +
          "</ul></div>"
        : "") +
      (can
        ? ""
        : '<div class="note">' +
          WM.icon("lock", 16) +
          "<span>Hanya " +
          esc(by.short) +
          " atau pemilik rekening pribadi yang bisa mengubah ini.</span></div>");
    WM.modal({
      title: "Detail transaksi",
      body: body,
      submit: false,
      cancel: "Tutup",
      onOpen: function (d) {
        var foot = d.querySelector(".sheet-foot");
        foot.insertAdjacentHTML(
          "afterbegin",
          '<button class="btn" type="button" data-dup>' +
            WM.icon("copy", 16) +
            "Duplikat</button>" +
            (t.type === "out"
              ? '<a class="btn" href="splitbill.html">' +
                WM.icon("split", 16) +
                "Split</a>"
              : ""),
        );
        foot.querySelector("[data-dup]").onclick = function () {
          d.close();
          WM.openTx(null, {
            type: t.type,
            amount: t.amount,
            acc: t.acc,
            to: t.to,
            cat: t.cat,
            note: t.note,
            member: t.member,
          });
        };
        d.querySelectorAll(".mini-list [data-tx]").forEach(function (li) {
          li.addEventListener("click", function (e) {
            e.preventDefault();
            d.close();
            setTimeout(function () {
              WM.openTxDetail(li.dataset.tx);
            }, 60);
          });
        });
        if (!can) return;
        foot.insertAdjacentHTML(
          "beforeend",
          '<button class="btn" type="button" data-del style="color:var(--bad)">' +
            WM.icon("trash", 16) +
            'Hapus</button><button class="btn primary" type="button" data-edit>' +
            WM.icon("edit", 16) +
            "Ubah</button>",
        );
        foot.querySelector("[data-edit]").onclick = function () {
          d.close();
          WM.openTx(id);
        };
        foot.querySelector("[data-del]").onclick = function () {
          d.close();
          var old = WM.removeTx(id);
          WM.toast("Transaksi dihapus, saldo dikembalikan", {
            undo: function () {
              WM.restoreTx(old);
              WM.toast("Transaksi dikembalikan");
            },
          });
        };
      },
    });
  };
  WM.txRow = function (t) {
    var c = WM.cat(t.cat),
      a = WM.account(t.acc),
      sign = t.type === "in";
    return (
      '<button type="button" class="row" data-tx="' +
      t.id +
      '"><span class="ic ' +
      (sign ? "lime" : "") +
      '">' +
      WM.icon(t.type === "tf" ? "swap" : c.icon, 18) +
      '</span><span style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      esc(t.note || c.name) +
      "</b><small>" +
      (t.type === "tf" ? "Transfer" : esc(c.name)) +
      " · " +
      esc(a ? a.bank : "") +
      " · " +
      esc(WM.member(t.member).short) +
      '</small></span><span class="r ' +
      (sign ? "pos" : "") +
      '">' +
      (t.type === "tf"
        ? WM.rp(t.amount)
        : WM.rp(sign ? t.amount : -t.amount, true)) +
      "</span></button>"
    );
  };
  document.addEventListener("click", function (e) {
    var r = e.target.closest("[data-tx]");
    if (r && !e.defaultPrevented) WM.openTxDetail(r.dataset.tx);
  });

  /* ---------- charts (read colours from CSS vars on the box: works on .card and .cover) ---------- */
  var NS = "http://www.w3.org/2000/svg",
    pid = 0;
  function mk(t, a, txt) {
    var e = document.createElementNS(NS, t);
    for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (txt != null) e.textContent = txt;
    return e;
  }
  function cv(box, n) {
    return getComputedStyle(box).getPropertyValue(n).trim();
  }
  function frame(box) {
    var W = Math.max(240, box.clientWidth),
      H = Math.max(140, box.clientHeight);
    var svg = mk("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    box.innerHTML = "";
    box.appendChild(svg);
    return { svg: svg, W: W, H: H, c: W < 480, box: box };
  }
  function hatch(f, cols) {
    var d = mk("defs", {}),
      ids = {};
    cols.forEach(function (c) {
      var id = "wh" + ++pid;
      var p = mk("pattern", {
        id: id,
        width: 8,
        height: 8,
        patternUnits: "userSpaceOnUse",
        patternTransform: "rotate(45)",
      });
      p.appendChild(mk("rect", { width: 8, height: 8, fill: c }));
      p.appendChild(
        mk("rect", { width: 2, height: 8, fill: "rgba(255,255,255,.26)" }),
      );
      d.appendChild(p);
      ids[c] = "url(#" + id + ")";
    });
    f.svg.appendChild(d);
    return ids;
  }
  function nice(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))),
      n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function grid(f, y, top, bot, L, R, fmt) {
    if (f.c) return;
    [bot, (top + bot) / 2, top].forEach(function (t) {
      f.svg.appendChild(
        mk("line", {
          x1: L,
          x2: f.W - R,
          y1: y(t),
          y2: y(t),
          stroke: cv(f.box, "--cgrid"),
          "stroke-dasharray": t === 0 ? null : "3 5",
        }),
      );
      f.svg.appendChild(
        mk(
          "text",
          { x: L - 8, y: y(t) + 3.5, "text-anchor": "end" },
          typeof fmt === "function"
            ? fmt(t)
            : Math.abs(top) >= 1e5
              ? WM.short(t).replace("Rp ", "")
              : Math.round(t),
        ),
      );
    });
  }
  function pill(f, cx, y, txt) {
    var w = Math.max(58, txt.length * 6.6 + 18),
      x = Math.max(0, Math.min(f.W - w, cx - w / 2)),
      g = mk("g", {});
    g.appendChild(
      mk("rect", {
        x: x,
        y: y - 26,
        width: w,
        height: 22,
        rx: 11,
        fill: cv(f.box, "--cstrong"),
      }),
    );
    g.appendChild(
      mk(
        "text",
        {
          x: x + w / 2,
          y: y - 11,
          "text-anchor": "middle",
          style:
            "fill:" +
            cv(f.box, "--cbg") +
            ";font-family:var(--font);font-size:11px;font-weight:600",
        },
        txt,
      ),
    );
    f.svg.appendChild(g);
  }
  function col(f, c) {
    return c && c.indexOf("var(") === 0 ? cv(f.box, c.slice(4, -1)) : c;
  }
  WM.chart = {
    /* bars(box,{labels,series:[{d:[],c:"var(--lime)",n:"Nama"}],hi:index,fmt,axis,wide}) */
    bars: function (box, o) {
      var f = frame(box),
        L = f.c ? 2 : 44,
        R = 4,
        T = o.fmt && o.hi != null ? 36 : 12,
        B = 24,
        ghost = cv(box, "--cghost");
      var cols = o.series.map(function (s) {
          return col(f, s.c);
        }),
        H = hatch(f, cols.concat([ghost]));
      var all = [];
      o.series.forEach(function (s) {
        all = all.concat(s.d);
      });
      var top = nice(Math.max.apply(null, all.concat([1]))),
        bot = Math.min(0, Math.min.apply(null, all));
      if (bot < 0) bot = -nice(-bot);
      var y = function (v) {
        return T + ((top - v) / (top - bot)) * (f.H - T - B);
      };
      grid(f, y, top, bot, L, R, o.axis);
      var n = o.labels.length,
        band = (f.W - L - R) / n,
        ns = o.series.length,
        bw = Math.min(o.wide ? 64 : 32, (band * 0.72) / ns),
        gap = ns > 1 ? 4 : 0;
      o.labels.forEach(function (lab, i) {
        var on = o.hi == null || i === o.hi,
          x0 = L + band * i + band / 2 - (bw * ns + gap * (ns - 1)) / 2;
        o.series.forEach(function (s, j) {
          var v = s.d[i] || 0,
            x = x0 + j * (bw + gap),
            yt = Math.min(y(v), y(0)),
            h = Math.max(3, Math.abs(y(v) - y(0)));
          var r = mk("rect", {
            class: "gb",
            x: x,
            y: yt,
            width: bw,
            height: h,
            rx: Math.min(8, bw / 3),
            fill: on ? H[cols[j]] : H[ghost],
            style: "animation-delay:" + i * 35 + "ms",
            tabindex: 0,
          });
          r.appendChild(
            mk(
              "title",
              {},
              lab + " · " + (s.n || "") + ": " + (o.fmt ? o.fmt(v) : v),
            ),
          );
          f.svg.appendChild(r);
        });
        if (lab !== "")
          f.svg.appendChild(
            mk(
              "text",
              {
                x: L + band * i + band / 2,
                y: f.H - 6,
                "text-anchor": "middle",
                style:
                  on && o.hi != null
                    ? "fill:" + cv(box, "--cstrong") + ";font-weight:500"
                    : null,
              },
              lab,
            ),
          );
      });
      if (o.hi != null && o.fmt) {
        var v = Math.max.apply(
          null,
          o.series.map(function (s) {
            return s.d[o.hi];
          }),
        );
        pill(
          f,
          L + band * o.hi + band / 2,
          y(v) - 4,
          o.fmt(o.series[0].d[o.hi]),
        );
      }
    },
    /* area(box,{labels,a:[],b:[] optional dashed,fmt,axis,floor}) */
    area: function (box, o) {
      var f = frame(box),
        L = f.c ? 2 : 48,
        R = f.c ? 2 : 12,
        T = 36,
        B = 24,
        lime = cv(box, "--lime"),
        H = hatch(f, [lime]);
      var all = o.a.concat(o.b || []),
        top = nice(Math.max.apply(null, all) * 1.05),
        bot = o.floor || 0;
      var y = function (v) {
          return T + ((top - v) / (top - bot)) * (f.H - T - B);
        },
        n = o.labels.length,
        x = function (i) {
          return L + (f.W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
        };
      grid(f, y, top, bot, L, R, o.axis);
      var p = o.a
        .map(function (v, i) {
          return (i ? "L" : "M") + x(i) + " " + y(v);
        })
        .join(" ");
      f.svg.appendChild(
        mk("path", {
          d:
            p +
            " L" +
            x(n - 1) +
            " " +
            y(bot) +
            " L" +
            x(0) +
            " " +
            y(bot) +
            "Z",
          fill: H[lime],
          opacity: 0.45,
        }),
      );
      if (o.b)
        f.svg.appendChild(
          mk("path", {
            d: o.b
              .map(function (v, i) {
                return (i ? "L" : "M") + x(i) + " " + y(v);
              })
              .join(" "),
            fill: "none",
            stroke: cv(box, "--ctext"),
            "stroke-width": 1.5,
            "stroke-dasharray": "5 5",
          }),
        );
      f.svg.appendChild(
        mk("path", {
          d: p,
          fill: "none",
          stroke: lime,
          "stroke-width": 2.5,
          "stroke-linejoin": "round",
          class: "gl",
        }),
      );
      o.labels.forEach(function (l, i) {
        f.svg.appendChild(
          mk(
            "text",
            {
              x: x(i),
              y: f.H - 6,
              "text-anchor":
                i === 0 && f.c
                  ? "start"
                  : i === n - 1 && f.c
                    ? "end"
                    : "middle",
            },
            l,
          ),
        );
        var c = mk("circle", {
          cx: x(i),
          cy: y(o.a[i]),
          r: i === n - 1 ? 5 : 3,
          fill: i === n - 1 ? lime : cv(box, "--cbg"),
          stroke: lime,
          "stroke-width": 2,
        });
        c.appendChild(
          mk("title", {}, l + ": " + (o.fmt ? o.fmt(o.a[i]) : o.a[i])),
        );
        f.svg.appendChild(c);
      });
      if (o.fmt) pill(f, x(n - 1), y(o.a[n - 1]) - 6, o.fmt(o.a[n - 1]));
    },
    /* waterfall(box,{steps:[[label,value,"t"(total)|null,short]],fmt,axis}) */
    waterfall: function (box, o) {
      var f = frame(box),
        L = f.c ? 2 : 48,
        R = 4,
        T = 34,
        B = 24,
        lime = cv(box, "--lime"),
        org = cv(box, "--orange"),
        H = hatch(f, [lime, org]),
        fmt = o.fmt || WM.short;
      var run = 0,
        pts = o.steps.map(function (s) {
          var a, b;
          if (s[2] === "t") {
            a = 0;
            b = s[1];
            run = s[1];
          } else {
            a = run;
            b = run + s[1];
            run = b;
          }
          return { l: s[0], a: a, b: b, v: s[1], t: s[2], s: s[3] };
        });
      var top = nice(
          Math.max.apply(
            null,
            pts.map(function (p) {
              return Math.max(p.a, p.b);
            }),
          ),
        ),
        bot = 0,
        y = function (v) {
          return T + ((top - v) / (top - bot)) * (f.H - T - B);
        };
      grid(f, y, top, bot, L, R, o.axis);
      var n = pts.length,
        band = (f.W - L - R) / n,
        bw = Math.min(58, band * 0.62);
      pts.forEach(function (p, i) {
        var x = L + band * i + band / 2 - bw / 2,
          y1 = y(Math.max(p.a, p.b)),
          h = Math.max(3, Math.abs(y(p.a) - y(p.b)));
        var r = mk("rect", {
          class: "gb",
          x: x,
          y: y1,
          width: bw,
          height: h,
          rx: 7,
          fill:
            p.t === "t" ? cv(box, "--cstrong") : p.v >= 0 ? H[lime] : H[org],
          style: "animation-delay:" + i * 60 + "ms",
        });
        r.appendChild(mk("title", {}, p.l + ": " + fmt(p.v)));
        f.svg.appendChild(r);
        if (i < n - 1)
          f.svg.appendChild(
            mk("line", {
              x1: x + bw,
              x2: x + band,
              y1: y(p.b),
              y2: y(p.b),
              stroke: cv(box, "--ctext"),
              "stroke-dasharray": "2 3",
            }),
          );
        f.svg.appendChild(
          mk(
            "text",
            {
              x: x + bw / 2,
              y: y1 - 8,
              "text-anchor": "middle",
              style: "fill:" + cv(box, "--cstrong") + ";font-weight:500",
            },
            (p.t === "t" ? "" : p.v >= 0 ? "+" : "") +
              fmt(p.v).replace("Rp ", ""),
          ),
        );
        f.svg.appendChild(
          mk(
            "text",
            {
              x: x + bw / 2,
              y: f.H - 6,
              "text-anchor": "middle",
              style: f.c ? "font-size:11px" : null,
            },
            f.c ? p.s || p.l : p.l,
          ),
        );
      });
    },
    /* donut(box,{items:[[label,value,color]],center:"text",sub:"text"}) */
    /* Composition stack (replaces the old donut; same call signature):
       headline value, one hatched segmented bar, then a ranked share list. */
    donut: function (box, o) {
      var items = o.items
          .filter(function (i) {
            return i[1] > 0;
          })
          .sort(function (x, y) {
            return y[1] - x[1];
          }),
        tot =
          items.reduce(function (s2, i) {
            return s2 + i[1];
          }, 0) || 1;
      function val(v) {
        return Math.abs(v) >= 1000 ? WM.short(v) : v.toLocaleString("id-ID");
      }
      box.style.height = "auto";
      box.innerHTML =
        '<div class="cstack">' +
        (o.center
          ? '<div class="cs-head"><b>' +
            esc(o.center) +
            "</b>" +
            (o.sub ? "<small>" + esc(o.sub) + "</small>" : "") +
            "</div>"
          : "") +
        '<div class="cs-bar" role="img" aria-label="Komposisi">' +
        items
          .map(function (i, k) {
            return (
              '<i style="flex:' +
              i[1] +
              ";--c:" +
              i[2] +
              ";animation-delay:" +
              k * 60 +
              'ms" title="' +
              esc(i[0]) +
              " " +
              Math.round((i[1] / tot) * 100) +
              '%"></i>'
            );
          })
          .join("") +
        '</div><div class="cs-list">' +
        items
          .map(function (i) {
            var pc = (i[1] / tot) * 100;
            return (
              '<div class="cs-row"><span class="cs-dot" style="background:' +
              i[2] +
              '"></span><span class="cs-l">' +
              esc(i[0]) +
              '</span><span class="cs-v">' +
              val(i[1]) +
              '</span><span class="cs-p">' +
              (pc < 1 ? "<1" : Math.round(pc)) +
              "%</span></div>"
            );
          })
          .join("") +
        "</div></div>";
    },
  };
  WM.strip = function (items) {
    return (
      '<div class="strip">' +
      items
        .map(function (i) {
          return (
            '<i style="flex:' +
            i[1] +
            ";background:" +
            i[2] +
            '" title="' +
            esc(i[0]) +
            '"></i>'
          );
        })
        .join("") +
      "</div>"
    );
  };
  WM.legend = function (items) {
    return (
      '<div class="legend">' +
      items
        .map(function (l) {
          return (
            '<span><i style="background:' +
            l[1] +
            '"></i>' +
            esc(l[0]) +
            (l[2] != null ? " <b>" + l[2] + "</b>" : "") +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  };
  /* redraw charts on resize/theme: WM.onResize(el, fn) */
  WM.onResize = function (el, fn) {
    var w = el.clientWidth,
      t;
    new ResizeObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (Math.abs(el.clientWidth - w) > 2) {
          w = el.clientWidth;
          fn();
        }
      }, 120);
    }).observe(el);
    window.addEventListener("wm:theme", fn);
  };
  WM.onChange = function (keys, fn) {
    window.addEventListener("wm:change", function (e) {
      if (!keys || keys.indexOf(e.detail.key) >= 0) fn(e.detail.key);
    });
  };
  WM.download = function (name, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([text], { type: type || "text/plain;charset=utf-8" }),
    );
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };
  WM.csv = function (rows) {
    return (
      "﻿" +
      rows
        .map(function (r) {
          return r
            .map(function (c) {
              c = String(c == null ? "" : c);
              return /[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
            })
            .join(";");
        })
        .join("\n")
    );
  };
  WM.copy = function (text, label) {
    (navigator.clipboard
      ? navigator.clipboard.writeText(text)
      : Promise.reject()
    ).then(
      function () {
        WM.toast((label || "Teks") + " disalin");
      },
      function () {
        WM.toast("Tidak bisa menyalin otomatis. Salin manual: " + text);
      },
    );
  };
})();
