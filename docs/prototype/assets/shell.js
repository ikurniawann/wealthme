/*
 * WealthMe prototype — app shell + interaction helpers
 *
 * Every prototype page includes this and calls WM.shell({ active: "<navId>" }).
 * The sidebar, topbar, mobile nav, theme toggle, dialogs and toasts are built
 * here so a page file contains only its own content — the same split the real
 * app gets from the (app) route group.
 *
 * Nav data mirrors apps/web/src/lib/nav.ts, with the EPIC-024 changes applied:
 *   K1  "Tunai" -> "Cash & E-Wallet",  "Rekening" -> "Bank & Account"
 *   A5  new "Persetujuan" entry (owner / co-master only)
 *   I1  "Donasi" -> "Donasi"
 */

const WM = (() => {
  document.addEventListener(
    "keydown",
    () => {
      document.body.dataset.wmInputMode = "keyboard";
    },
    { once: true },
  );
  document.addEventListener("pointerdown", () => {
    document.body.dataset.wmInputMode = "pointer";
  });
  const NAV = [
    {
      items: [
        {
          id: "beranda",
          href: "beranda.html",
          icon: "house",
          label: "Beranda",
        },
        {
          id: "ringkasan",
          href: "ringkasan.html",
          icon: "chart-pie",
          label: "Ringkasan",
        },
        {
          id: "transaksi",
          href: "transaksi.html",
          icon: "arrow-up-down",
          label: "Transaksi",
        },
        {
          id: "anggaran",
          href: "anggaran.html",
          icon: "clipboard-list",
          label: "Anggaran",
        },
        {
          id: "laporan",
          href: "laporan.html",
          icon: "chart-line",
          label: "Laporan",
        },
        { id: "tujuan", href: "tujuan.html", icon: "target", label: "Tujuan" },
        {
          id: "persetujuan",
          href: "persetujuan.html",
          icon: "check-check",
          label: "Persetujuan",
          badge: "2",
          badgeVariant: "danger",
        },
        {
          id: "notifikasi",
          href: "notifikasi.html",
          icon: "bell",
          label: "Notifikasi",
        },
      ],
    },
    {
      header: "Keuangan",
      items: [
        {
          id: "dana",
          href: "dana.html",
          icon: "wallet",
          label: "Cash & E-Wallet",
        },
        {
          id: "rekening",
          href: "rekening.html",
          icon: "landmark",
          label: "Bank & Account",
        },
        {
          id: "investasi",
          href: "investasi.html",
          icon: "chart-column",
          label: "Investasi",
        },
        { id: "aset", href: "aset.html", icon: "briefcase", label: "Aset" },
        {
          id: "liabilitas",
          href: "liabilitas.html",
          icon: "receipt-text",
          label: "Liabilitas",
        },
        {
          id: "asuransi",
          href: "asuransi.html",
          icon: "shield-check",
          label: "Asuransi",
        },
        {
          id: "warisan",
          href: "warisan.html",
          icon: "scroll",
          label: "Warisan",
        },
        {
          id: "donation",
          href: "donation.html",
          icon: "heart-handshake",
          label: "Donasi",
        },
        { id: "tax", href: "tax.html", icon: "file-text", label: "Pajak" },
      ],
    },
    {
      header: "Alat",
      items: [
        {
          id: "splitbill",
          href: "splitbill.html",
          icon: "receipt",
          label: "Split Bill",
        },
        {
          id: "rekonsiliasi",
          href: "rekonsiliasi.html",
          icon: "git-compare",
          label: "Rekonsiliasi",
        },
        { id: "ai", href: "ai.html", icon: "bot", label: "AI Advisor" },
        {
          id: "kalkulator",
          href: "kalkulator.html",
          icon: "calculator",
          label: "Kalkulator",
        },
        {
          id: "quickinput",
          href: "quickinput.html",
          icon: "zap",
          label: "Quick Input",
        },
        {
          id: "mastercoa",
          href: "mastercoa.html",
          icon: "book-open",
          label: "Master COA",
        },
        {
          id: "masterdata",
          href: "masterdata.html",
          icon: "database",
          label: "Master Data",
        },
        {
          id: "panduan",
          href: "panduan.html",
          icon: "circle-help",
          label: "Panduan",
        },
      ],
    },
  ];

  const MOBILE = [
    { id: "beranda", href: "beranda.html", icon: "house", label: "Beranda" },
    {
      id: "transaksi",
      href: "transaksi.html",
      icon: "arrow-up-down",
      label: "Transaksi",
    },
    {
      id: "laporan",
      href: "laporan.html",
      icon: "chart-line",
      label: "Laporan",
    },
    { id: "akun", href: "akun.html", icon: "user", label: "Akun" },
  ];

  const titleOf = (id) => {
    for (const section of NAV) {
      const hit = section.items.find((i) => i.id === id);
      if (hit) return hit.label;
    }
    return { akun: "Akun & Keluarga" }[id] ?? "WealthMe";
  };

  /* ── Formatting (mirrors @/lib/format) ── */
  const formatRupiah = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const formatNumber = (n) => n.toLocaleString("id-ID");
  const formatCompact = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1e12)
      return "Rp " + (n / 1e12).toFixed(2).replace(".", ",") + " T";
    if (abs >= 1e9)
      return "Rp " + (n / 1e9).toFixed(2).replace(".", ",") + " M";
    if (abs >= 1e6)
      return "Rp " + (n / 1e6).toFixed(1).replace(".", ",") + " jt";
    if (abs >= 1e3) return "Rp " + Math.round(n / 1e3) + " rb";
    return formatRupiah(n);
  };

  /* ── Theme ── */
  const applyTheme = (mode) => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    try {
      localStorage.setItem("wm.proto.theme", mode);
    } catch {
      /* file:// with storage disabled — theme just won't persist */
    }
    document.dispatchEvent(new CustomEvent("wm:theme", { detail: { mode } }));
  };

  const currentTheme = () => {
    try {
      const saved = localStorage.getItem("wm.proto.theme");
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const toggleTheme = () =>
    applyTheme(currentTheme() === "dark" ? "light" : "dark");

  /* ── Dialogs ── */
  const openDialog = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.open = "true";
    document.body.style.overflow = "hidden";
    // Do not force a field focus on pointer-open. It left a misleading active
    // field ring after clicking outside a form. Keyboard users still receive
    // a sensible first control when the dialog was opened from the keyboard.
    if (document.body.dataset.wmInputMode === "keyboard") {
      el.querySelector("input, select, textarea, button")?.focus();
    }
  };

  const closeDialog = (id) => {
    const el = id
      ? document.getElementById(id)
      : document.querySelector('.dialog-backdrop[data-open="true"]');
    if (!el) return;
    el.dataset.open = "false";
    document.body.style.overflow = "";
  };

  /* ── Toasts ── */
  const toast = (message, variant = "info") => {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const el = document.createElement("div");
    el.className = `toast toast--${variant}`;
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  };

  /* ── Receipt scan (EPIC-024 item 33/36) ──
     Prototype only: no real OCR. Picking a photo (native camera via
     `capture="environment"` on mobile) simulates a scan and fills the
     surrounding dialog's Jumlah/Tanggal/Deskripsi fields so the flow can be
     clicked through end to end. Real OCR is implementation-wave work. */
  const scanReceipt = (inputEl) => {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    const dialog = inputEl.closest(".dialog");
    toast("Memindai struk…", "info");
    setTimeout(() => {
      const amountInput = dialog?.querySelector("input.input.mono");
      const dateInput = dialog?.querySelector('input[type="date"]');
      const descInput = dialog?.querySelector(
        ".field-row input.input:not([type])",
      );
      if (amountInput)
        amountInput.value = formatNumber(
          Math.round((50000 + Math.random() * 200000) / 500) * 500,
        );
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
      if (descInput) descInput.value = `Scan struk — ${file.name}`;
      const preview = dialog?.querySelector("#wm-receipt-preview");
      const previewText = dialog?.querySelector("#wm-receipt-preview-text");
      if (preview) preview.style.display = "inline-flex";
      if (previewText)
        previewText.textContent = `Struk terpindai — ${file.name}`;
      if (window.lucide) window.lucide.createIcons();
      toast(
        "Struk terbaca — nominal, tanggal & deskripsi terisi otomatis",
        "success",
      );
    }, 700);
  };

  const clearReceiptScan = () => {
    const input = document.getElementById("wm-receipt-scan");
    if (input) input.value = "";
    const preview = document.getElementById("wm-receipt-preview");
    if (preview) preview.style.display = "none";
  };

  /* ── Shell markup ── */
  const navItemHtml = (item, active) => {
    const badge = item.badge
      ? `<span class="badge badge--${item.badgeVariant ?? "info"}">${item.badge}</span>`
      : "";
    return `<a class="nav-item${item.id === active ? " nav-item--active" : ""}" href="${item.href}" title="${item.label}"${
      item.id === active ? ' aria-current="page"' : ""
    }>
      <i class="nav-item__icon" data-lucide="${item.icon}"></i>
      <span class="nav-item__label">${item.label}</span>${badge}
    </a>`;
  };

  const sidebarHtml = (active) => `
    <aside class="sidebar" id="wm-sidebar">
      <div class="sidebar__brand">
        <div class="sidebar__logo gradient-wealth">W</div>
        <div class="sidebar__brand-text">
          <div class="sidebar__name">WealthMe</div>
          <div class="t-xs t-muted">Arsandi Family</div>
        </div>
        <button class="sidebar__collapse-btn" type="button" onclick="WM.toggleSidebarCollapse()" aria-label="Ciutkan sidebar" aria-pressed="false">
          <i data-lucide="chevron-left" style="width:16px;height:16px"></i>
        </button>
      </div>
      <nav class="sidebar__nav hide-scrollbar" aria-label="Navigasi utama">
        ${NAV.map(
          (section) => `
          ${section.header ? `<div class="sidebar__section-header">${section.header}</div>` : ""}
          ${section.items.map((i) => navItemHtml(i, active)).join("")}
        `,
        ).join("")}
      </nav>
      <div class="sidebar__footer">
        <a class="sidebar__user" href="akun.html" title="Irfan Arsandi · Master">
          <span class="avatar">IA</span>
          <span style="flex:1;min-width:0">
            <span class="t-md t-bold" style="display:block">Irfan Arsandi</span>
            <span class="t-xs t-muted">Master</span>
          </span>
          <i data-lucide="chevron-right" style="width:15px;height:15px"></i>
        </a>
      </div>
    </aside>`;

  /* Mobile drawer — same nav content as the sidebar, since the sidebar itself
     is hidden below the tablet breakpoint. Opened by the topbar hamburger. */
  const sheetHtml = (active) => `
    <div class="sheet-backdrop" id="wm-sheet-backdrop" data-open="false"></div>
    <aside class="sheet" id="wm-sheet" data-open="false" aria-hidden="true" aria-label="Menu navigasi">
      <div class="sidebar__brand">
        <div class="sidebar__logo gradient-wealth">W</div>
        <div class="sidebar__brand-text">
          <div class="sidebar__name">WealthMe</div>
          <div class="t-xs t-muted">Arsandi Family</div>
        </div>
        <button class="sidebar__collapse-btn" type="button" onclick="WM.closeSheet()" aria-label="Tutup menu">
          <i data-lucide="x" style="width:17px;height:17px"></i>
        </button>
      </div>
      <nav class="sidebar__nav hide-scrollbar" aria-label="Navigasi utama (mobile)">
        ${NAV.map(
          (section) => `
          ${section.header ? `<div class="sidebar__section-header">${section.header}</div>` : ""}
          ${section.items.map((i) => navItemHtml(i, active)).join("")}
        `,
        ).join("")}
      </nav>
      <div class="sidebar__footer">
        <a class="sidebar__user" href="akun.html">
          <span class="avatar">IA</span>
          <span style="flex:1;min-width:0">
            <span class="t-md t-bold" style="display:block">Irfan Arsandi</span>
            <span class="t-xs t-muted">Master</span>
          </span>
        </a>
      </div>
    </aside>`;

  const topbarHtml = (title) => `
    <header class="topbar">
      <button class="topbar__menu-btn" type="button" onclick="WM.openSheet()" aria-label="Buka menu navigasi" aria-controls="wm-sheet" aria-expanded="false">
        <i data-lucide="menu" style="width:19px;height:19px"></i>
      </button>
      <h1 class="topbar__title">${title}</h1>
      <div class="topbar__spacer"></div>
      <button class="topbar__search" onclick="WM.openDialog('dlg-search')" aria-label="Cari">
        <i data-lucide="search" style="width:15px;height:15px"></i>
        <span>Cari apa saja…</span>
        <span class="kbd">⌘K</span>
      </button>
      <button class="btn btn--ghost btn--icon btn--sm" onclick="WM.toggleTheme()" aria-label="Ganti tema">
        <i data-lucide="sun-moon" style="width:17px;height:17px"></i>
      </button>
      <button class="btn btn--primary btn--sm" onclick="WM.openDialog('dlg-transaksi')">
        <i data-lucide="plus" style="width:15px;height:15px"></i> Transaksi
      </button>
    </header>`;

  const mobileNavHtml = (active) => `
    <nav class="mobile-nav" aria-label="Navigasi mobile">
      ${MOBILE.map(
        (
          i,
        ) => `<a class="mobile-nav__item${i.id === active ? " mobile-nav__item--active" : ""}" href="${i.href}">
          <i data-lucide="${i.icon}" style="width:18px;height:18px"></i><span>${i.label}</span>
        </a>`,
      ).join("")}
    </nav>`;

  /* Global dialogs every page gets: quick transaction + command search.
     These are the two the real app mounts in the shell, not per page. */
  const globalDialogsHtml = () => `
    <div class="dialog-backdrop" id="dlg-transaksi" data-open="false" role="dialog" aria-modal="true"
         aria-labelledby="dlg-transaksi-title">
      <div class="dialog">
        <h2 class="dialog__title" id="dlg-transaksi-title">Tambah Transaksi</h2>
        <p class="dialog__desc">Catat pemasukan, pengeluaran, transfer, atau belanja kartu kredit.</p>
        <div class="dialog__body">
          <div class="segmented" style="margin-bottom:14px" role="tablist">
            <button class="segmented__item" role="tab" aria-selected="false">Pemasukan</button>
            <button class="segmented__item" role="tab" aria-selected="true">Pengeluaran</button>
            <button class="segmented__item" role="tab" aria-selected="false">Transfer</button>
            <button class="segmented__item" role="tab" aria-selected="false">Kartu Kredit</button>
          </div>
          <label class="field">
            <span class="label">Jumlah</span>
            <input class="input mono" value="250.000" inputmode="numeric" />
          </label>
          <label class="field">
            <span class="label">Akun</span>
            <select class="select">
              <option>BCA Tahapan ···9010</option>
              <option>Mandiri ···5586</option>
              <option>GoPay</option>
              <option>Kas Tunai</option>
            </select>
            <span class="hint">Master &amp; co-master melihat seluruh rekening keluarga (EPIC-024 D4).</span>
          </label>
          <label class="field">
            <span class="label">Kategori</span>
            <select class="select">
              <option>Belanja Harian</option>
              <option>Transportasi</option>
              <option>Makan &amp; Minum</option>
            </select>
          </label>
          <div class="field-row" style="margin-top:12px">
            <label class="field" style="margin-top:0">
              <span class="label">Tanggal</span>
              <input class="input" type="date" value="2026-08-07" />
            </label>
            <label class="field" style="margin-top:0">
              <span class="label">Deskripsi</span>
              <input class="input" placeholder="cth. Belanja mingguan" />
            </label>
          </div>
          <div class="field">
            <span class="label">Lampiran <span class="t-muted" style="font-weight:500">(opsional)</span></span>
            <div class="row row--wrap" style="gap:8px">
              <label class="notice" style="cursor:pointer;align-items:center;flex:1;min-width:150px;margin:0">
                <i data-lucide="paperclip" style="width:16px;height:16px;flex-shrink:0"></i>
                <span>Unggah foto struk atau PDF — maks 5 MB<input type="file" hidden /></span>
              </label>
              <label class="notice notice--info" for="wm-receipt-scan" style="cursor:pointer;align-items:center;flex:1;min-width:150px;margin:0">
                <i data-lucide="camera" style="width:16px;height:16px;flex-shrink:0"></i>
                <span>Scan Struk (Kamera) — nominal &amp; tanggal terisi otomatis</span>
              </label>
              <input id="wm-receipt-scan" type="file" accept="image/*" capture="environment" hidden onchange="WM.scanReceipt(this)" />
            </div>
            <span id="wm-receipt-preview" class="badge badge--success" style="display:none;margin-top:8px">
              <i data-lucide="check" style="width:12px;height:12px"></i>
              <span id="wm-receipt-preview-text">Struk terpindai</span>
              <button type="button" class="btn btn--ghost btn--icon" style="width:16px;height:16px;margin-left:2px" onclick="WM.clearReceiptScan()" aria-label="Hapus hasil scan">
                <i data-lucide="x" style="width:11px;height:11px"></i>
              </button>
            </span>
            <span class="hint">EPIC-024 item 33 &amp; 36 · scan struk memakai kamera perangkat — hasil di sini adalah simulasi prototipe, OCR nyata menyusul di implementasi.</span>
          </div>
        </div>
        <div class="dialog__footer">
          <button class="btn btn--outline" onclick="WM.closeDialog('dlg-transaksi')">Batal</button>
          <button class="btn btn--primary"
                  onclick="WM.closeDialog('dlg-transaksi');WM.toast('Transaksi tersimpan','success')">Simpan</button>
        </div>
      </div>
    </div>

    <div class="dialog-backdrop" id="dlg-search" data-open="false" role="dialog" aria-modal="true"
         aria-labelledby="dlg-search-title">
      <div class="dialog" style="align-self:start;margin-top:8vh">
        <h2 class="dialog__title" id="dlg-search-title">Pencarian</h2>
        <div class="dialog__body">
          <input class="input" placeholder="Cari halaman, transaksi, rekening…" />
          <div class="t-xs t-muted" style="margin:14px 0 6px;font-weight:700;letter-spacing:.06em">HALAMAN</div>
          <div class="stack" style="gap:2px">
            <a class="nav-item" href="transaksi.html"><i class="nav-item__icon" data-lucide="arrow-up-down"></i>
              <span class="nav-item__label">Transaksi</span></a>
            <a class="nav-item" href="laporan.html"><i class="nav-item__icon" data-lucide="chart-line"></i>
              <span class="nav-item__label">Laporan</span></a>
            <a class="nav-item" href="investasi.html"><i class="nav-item__icon" data-lucide="chart-column"></i>
              <span class="nav-item__label">Investasi</span></a>
          </div>
        </div>
        <div class="dialog__footer">
          <button class="btn btn--outline" onclick="WM.closeDialog('dlg-search')">Tutup</button>
        </div>
      </div>
    </div>`;

  /* ── Sidebar collapse (desktop/tablet) ── */
  const currentSidebarCollapsed = () => {
    try {
      return localStorage.getItem("wm.proto.sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  };
  let sidebarCollapsed = currentSidebarCollapsed();
  const applySidebarCollapsed = (collapsed) => {
    sidebarCollapsed = Boolean(collapsed);
    document.documentElement.style.setProperty(
      "--sidebar-w",
      sidebarCollapsed ? "72px" : "248px",
    );
    const sidebar = document.getElementById("wm-sidebar");
    sidebar?.setAttribute("data-collapsed", String(sidebarCollapsed));
    const toggle = sidebar?.querySelector(".sidebar__collapse-btn");
    toggle?.setAttribute("aria-pressed", String(sidebarCollapsed));
    toggle?.setAttribute(
      "aria-label",
      sidebarCollapsed ? "Lebarkan sidebar" : "Ciutkan sidebar",
    );
    try {
      localStorage.setItem(
        "wm.proto.sidebarCollapsed",
        String(sidebarCollapsed),
      );
    } catch {
      /* file:// with storage disabled — collapse state just won't persist */
    }
  };
  const toggleSidebarCollapse = () => applySidebarCollapsed(!sidebarCollapsed);

  /* ── Mobile drawer (hamburger sheet) ── */
  const openSheet = () => {
    const sheet = document.getElementById("wm-sheet");
    const backdrop = document.getElementById("wm-sheet-backdrop");
    if (!sheet || !backdrop) return;
    sheet.dataset.open = "true";
    sheet.setAttribute("aria-hidden", "false");
    backdrop.dataset.open = "true";
    document
      .querySelector(".topbar__menu-btn")
      ?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    sheet.querySelector("a, button")?.focus();
  };
  const closeSheet = () => {
    const sheet = document.getElementById("wm-sheet");
    const backdrop = document.getElementById("wm-sheet-backdrop");
    if (sheet) {
      sheet.dataset.open = "false";
      sheet.setAttribute("aria-hidden", "true");
    }
    if (backdrop) backdrop.dataset.open = "false";
    document
      .querySelector(".topbar__menu-btn")
      ?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  /**
   * Build the shell around the page content already in <main class="page">.
   * @param {{active: string, title?: string}} opts
   */
  const shell = (opts) => {
    const active = opts.active;
    const title = opts.title ?? titleOf(active);
    document.title = `${title} · WealthMe`;

    const page = document.querySelector(".page");
    const app = document.createElement("div");
    app.className = "app";
    app.innerHTML = `${sidebarHtml(active)}<div class="main">${topbarHtml(title)}</div>`;
    app.querySelector(".main").appendChild(page);
    document.body.prepend(app);

    document.body.insertAdjacentHTML(
      "beforeend",
      mobileNavHtml(active) + globalDialogsHtml() + sheetHtml(active),
    );

    applyTheme(currentTheme());
    applySidebarCollapsed(currentSidebarCollapsed());

    // Close dialogs/sheet on backdrop click and Escape — the two behaviours a
    // reviewer will reflexively try.
    document.addEventListener("click", (e) => {
      if (e.target.classList?.contains("dialog-backdrop"))
        closeDialog(e.target.id);
      if (e.target.id === "wm-sheet-backdrop") closeSheet();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDialog();
        closeSheet();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openDialog("dlg-search");
      }
    });

    // Navigating (tapping a link in the mobile drawer) should close the
    // drawer immediately rather than leaving it open behind the new page.
    document.getElementById("wm-sheet")?.addEventListener("click", (e) => {
      if (e.target.closest("a[href]")) closeSheet();
    });

    // Segmented controls and pill tabs behave for real, so the prototype can be
    // clicked through rather than described.
    document.addEventListener("click", (e) => {
      const seg = e.target.closest(".segmented__item, .tab");
      if (!seg) return;
      const group = seg.closest(".segmented, .tabs");
      group
        ?.querySelectorAll(".segmented__item, .tab")
        .forEach((n) => n.setAttribute("aria-selected", "false"));
      seg.setAttribute("aria-selected", "true");
      document.dispatchEvent(
        new CustomEvent("wm:tab", {
          detail: { group, value: seg.dataset.value ?? seg.textContent.trim() },
        }),
      );
    });

    if (window.lucide) window.lucide.createIcons();
  };

  /* ── Date-range picker ──
     A minimal single-month calendar popover — click a start day, then an end
     day; Terapkan commits, Batal/Escape/outside-click reverts. Built once
     here so laporan.html and transaksi.html don't each hand-roll a pair of
     unrelated native date inputs (EPIC-024 item 9). */
  const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const MONTH_LABELS_LONG = [
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
  const pad2 = (n) => String(n).padStart(2, "0");
  const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const fromISO = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return { y, m: m - 1, d };
  };
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const fmtRange = (lo, hi) => {
    const a = fromISO(lo);
    const b = fromISO(hi);
    if (lo === hi) return `${a.d} ${MONTH_LABELS_LONG[a.m]} ${a.y}`;
    if (a.y === b.y && a.m === b.m)
      return `${a.d} – ${b.d} ${MONTH_LABELS_LONG[b.m]} ${b.y}`;
    if (a.y === b.y)
      return `${a.d} ${MONTH_LABELS_LONG[a.m]} – ${b.d} ${MONTH_LABELS_LONG[b.m]} ${b.y}`;
    return `${a.d} ${MONTH_LABELS_LONG[a.m]} ${a.y} – ${b.d} ${MONTH_LABELS_LONG[b.m]} ${b.y}`;
  };

  /**
   * Mount a date-range control into an empty container.
   * @param {HTMLElement} el
   * @param {{from: string, to: string, onApply: (from: string, to: string) => void}} opts
   */
  const mountDateRange = (el, opts) => {
    let applied = { from: opts.from, to: opts.to };
    let draft = { ...applied };
    let awaitingEnd = false;
    let view = fromISO(applied.to);

    el.classList.add("date-range");
    el.innerHTML = `
      <button type="button" class="date-range__trigger" aria-haspopup="dialog">
        <i data-lucide="calendar-range" style="width:15px;height:15px;flex-shrink:0"></i>
        <span class="date-range__label"></span>
      </button>
      <div class="date-range__pop" role="dialog" aria-label="Pilih rentang tanggal"></div>`;
    const trigger = el.querySelector(".date-range__trigger");
    const label = el.querySelector(".date-range__label");
    const pop = el.querySelector(".date-range__pop");
    if (window.lucide) window.lucide.createIcons();

    const renderPop = () => {
      const { y, m } = view;
      const firstWeekday = new Date(y, m, 1).getDay();
      const total = daysInMonth(y, m);
      const prevTotal = daysInMonth(y, m - 1 < 0 ? 11 : m - 1);
      const cells = [];
      for (let i = firstWeekday - 1; i >= 0; i -= 1)
        cells.push({ d: prevTotal - i, muted: true });
      for (let d = 1; d <= total; d += 1) cells.push({ d, muted: false });
      while (cells.length % 7 !== 0)
        cells.push({ d: 0, muted: true, trail: true });

      const lo = draft.from < draft.to ? draft.from : draft.to;
      const hi = draft.from < draft.to ? draft.to : draft.from;

      pop.innerHTML = `
        <div class="dr-head">
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-dr-nav="-1" aria-label="Bulan sebelumnya">
            <i data-lucide="chevron-left" style="width:15px;height:15px"></i>
          </button>
          <span class="t-sm t-bold">${MONTH_LABELS_LONG[m]} ${y}</span>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-dr-nav="1" aria-label="Bulan berikutnya">
            <i data-lucide="chevron-right" style="width:15px;height:15px"></i>
          </button>
        </div>
        <div class="dr-grid dr-grid--head">${DAY_LABELS.map((l) => `<span>${l}</span>`).join("")}</div>
        <div class="dr-grid">
          ${cells
            .map((c) => {
              if (c.muted)
                return `<span class="dr-day dr-day--muted">${c.trail ? "" : c.d}</span>`;
              const iso = toISO(y, m, c.d);
              const cls = ["dr-day"];
              if (iso === lo || iso === hi) cls.push("dr-day--edge");
              else if (iso > lo && iso < hi) cls.push("dr-day--in-range");
              return `<button type="button" class="${cls.join(" ")}" data-dr-day="${iso}">${c.d}</button>`;
            })
            .join("")}
        </div>
        <div class="dr-foot">
          <span class="t-xs t-muted mono">${
            awaitingEnd
              ? `${fromISO(draft.from).d} ${MONTH_LABELS_LONG[fromISO(draft.from).m]} ${fromISO(draft.from).y} — pilih tanggal akhir`
              : fmtRange(lo, hi)
          }</span>
          <div class="row" style="gap:6px">
            <button type="button" class="btn btn--outline btn--sm" data-dr-cancel>Batal</button>
            <button type="button" class="btn btn--primary btn--sm" data-dr-apply${awaitingEnd ? " disabled" : ""}>Terapkan</button>
          </div>
        </div>`;
      if (window.lucide) window.lucide.createIcons();
    };

    const updateLabel = () => {
      label.textContent = fmtRange(applied.from, applied.to);
    };

    const open = () => {
      draft = { ...applied };
      awaitingEnd = false;
      view = fromISO(applied.to);
      pop.dataset.open = "true";
      renderPop();
    };
    const close = () => {
      pop.dataset.open = "false";
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pop.dataset.open === "true") close();
      else open();
    });

    pop.addEventListener("click", (e) => {
      e.stopPropagation();
      const nav = e.target.closest("[data-dr-nav]");
      if (nav) {
        let { y, m } = view;
        m += Number(nav.dataset.drNav);
        if (m < 0) {
          m = 11;
          y -= 1;
        }
        if (m > 11) {
          m = 0;
          y += 1;
        }
        view = { y, m };
        renderPop();
        return;
      }
      const day = e.target.closest("[data-dr-day]");
      if (day) {
        const iso = day.dataset.drDay;
        if (!awaitingEnd) {
          draft = { from: iso, to: iso };
          awaitingEnd = true;
        } else {
          draft =
            iso < draft.from
              ? { from: iso, to: draft.from }
              : { from: draft.from, to: iso };
          awaitingEnd = false;
        }
        renderPop();
        return;
      }
      if (e.target.closest("[data-dr-cancel]")) {
        close();
        return;
      }
      if (e.target.closest("[data-dr-apply]") && !awaitingEnd) {
        applied = { ...draft };
        updateLabel();
        opts.onApply?.(applied.from, applied.to);
        close();
      }
    });

    document.addEventListener("click", (e) => {
      if (!el.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && pop.dataset.open === "true") close();
    });

    updateLabel();
    return {
      setRange: (from, to) => {
        applied = { from, to };
        updateLabel();
      },
    };
  };

  return {
    NAV,
    shell,
    toast,
    scanReceipt,
    clearReceiptScan,
    openDialog,
    closeDialog,
    openSheet,
    closeSheet,
    toggleSidebarCollapse,
    toggleTheme,
    currentTheme,
    formatRupiah,
    formatNumber,
    formatCompact,
    mountDateRange,
  };
})();

window.WM = WM;
