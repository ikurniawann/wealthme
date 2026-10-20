/**
 * Asuransi v3 copy — the policy list / schedule / payments page (Task 24).
 * Lives in its own module (wired into id.ts / en.ts as `asuransi.v3`); the
 * dictionary parity test still checks both locales key by key.
 */
export interface AsuransiV3Copy {
  title: string;
}

export const asuransiV3Id: AsuransiV3Copy = {
  title: "Asuransi",
};

export const asuransiV3En: AsuransiV3Copy = {
  title: "Insurance",
};
