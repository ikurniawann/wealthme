/**
 * Phone chrome copy (2026-10-20 references): the /menu page and the phone
 * variant of the Tambah transaksi sheet. Wired into id.ts / en.ts as
 * `shell.phone`. Labels that already exist elsewhere in `shell` (nav
 * sections, hubs) are reused there rather than repeated here.
 */
export interface PhoneChromeCopy {
  menu: {
    title: string;
    search: string;
    searchLabel: string;
    noResults: string;
    familySpace: string;
    sections: {
      finance: string;
      shared: string;
      tools: string;
      more: string;
    };
    items: {
      accounts: string;
      members: string;
      ai: string;
      settings: string;
      help: string;
    };
    /** Accessible suffix for the Persetujuan badge; `{n}` = pending count. */
    pendingCount: string;
  };
  tx: {
    saveLong: string;
    detailTitle: string;
    detailToggle: string;
    scanTitle: string;
    scanBody: string;
  };
}

export const phoneChromeId: PhoneChromeCopy = {
  menu: {
    title: "Menu",
    search: "Cari fitur…",
    searchLabel: "Cari fitur",
    noResults: "Tidak ada fitur yang cocok.",
    familySpace: "Ruang keluarga",
    sections: {
      finance: "Keuangan",
      shared: "Kelola bersama",
      tools: "Alat & pengaturan",
      more: "Fitur lainnya",
    },
    items: {
      accounts: "Rekening",
      members: "Anggota & akses",
      ai: "AI Advisor",
      settings: "Pengaturan",
      help: "Bantuan & panduan",
    },
    pendingCount: "{n} menunggu persetujuan",
  },
  tx: {
    saveLong: "Simpan transaksi",
    detailTitle: "Detail tambahan",
    detailToggle: "Deskripsi & lampiran (opsional)",
    scanTitle: "Scan struk",
    scanBody: "Isi otomatis, lalu periksa hasilnya.",
  },
};

export const phoneChromeEn: PhoneChromeCopy = {
  menu: {
    title: "Menu",
    search: "Search features…",
    searchLabel: "Search features",
    noResults: "No feature matches.",
    familySpace: "Family space",
    sections: {
      finance: "Finance",
      shared: "Manage together",
      tools: "Tools & settings",
      more: "More features",
    },
    items: {
      accounts: "Accounts",
      members: "Members & access",
      ai: "AI Advisor",
      settings: "Settings",
      help: "Help & guides",
    },
    pendingCount: "{n} awaiting approval",
  },
  tx: {
    saveLong: "Save transaction",
    detailTitle: "More details",
    detailToggle: "Description & attachment (optional)",
    scanTitle: "Scan receipt",
    scanBody: "Fill it in automatically, then check the result.",
  },
};
