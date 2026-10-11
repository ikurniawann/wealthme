import { fireEvent, render } from "@testing-library/react";
import {
  NativeValidationBridge,
  nativeValidationMessage,
} from "./native-validation";

type Field = Parameters<typeof nativeValidationMessage>[0];

function field(
  validity: Partial<ValidityState>,
  attrs: Partial<Omit<Field, "validity">> = {},
): Field {
  return {
    validity: { valid: false, ...validity } as ValidityState,
    type: "text",
    min: "",
    max: "",
    minLength: -1,
    title: "",
    ...attrs,
  };
}

describe("nativeValidationMessage", () => {
  it("says a required field is required, in Indonesian by default", () => {
    expect(nativeValidationMessage(field({ valueMissing: true }))).toBe(
      "Wajib diisi",
    );
  });

  it("names the bound for range errors", () => {
    expect(
      nativeValidationMessage(
        field({ rangeOverflow: true }, { type: "number", max: "100" }),
      ),
    ).toBe("Maksimal 100");
    expect(
      nativeValidationMessage(
        field({ rangeUnderflow: true }, { type: "number", min: "1" }),
      ),
    ).toBe("Minimal 1");
  });

  it("explains a date in the past against a min date", () => {
    expect(
      nativeValidationMessage(
        field({ rangeUnderflow: true }, { type: "date", min: "2026-10-12" }),
      ),
    ).toBe("Tanggal paling cepat 12/10/2026");
  });

  it("uses the field's own title for a pattern and English when asked", () => {
    expect(
      nativeValidationMessage(
        field({ patternMismatch: true }, { title: "5 digit angka" }),
      ),
    ).toBe("5 digit angka");
    expect(nativeValidationMessage(field({ valueMissing: true }), "en")).toBe(
      "Required",
    );
  });

  it("returns null for a valid field", () => {
    expect(nativeValidationMessage(field({ valid: true }))).toBeNull();
  });
});

describe("NativeValidationBridge", () => {
  it("replaces the browser bubble with an inline message and clears it on edit", () => {
    const { container } = render(
      <div>
        <NativeValidationBridge />
        <form>
          <label className="field">
            Nama
            <input name="nama" required />
          </label>
        </form>
      </div>,
    );
    const input = container.querySelector("input")!;
    const host = container.querySelector(".field")!;

    const event = new Event("invalid", { cancelable: true });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(host.getAttribute("data-native-error")).toBe("Wajib diisi");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();

    fireEvent.input(input, { target: { value: "Dana Darurat" } });
    expect(host.hasAttribute("data-native-error")).toBe(false);
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});
