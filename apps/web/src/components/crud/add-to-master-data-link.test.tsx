import { render, screen } from "@testing-library/react";

import { id as mockDictionary } from "../../i18n/id";

const mockUseCanManage = jest.fn();
jest.mock("../../hooks/use-role-permissions", () => ({
  useCanManage: (...args: unknown[]) => mockUseCanManage(...args),
}));

import { AddToMasterDataLink } from "./add-to-master-data-link";

describe("AddToMasterDataLink", () => {
  beforeEach(() => jest.resetAllMocks());

  it("links a Master Data manager to that group's add dialog in a new tab", () => {
    mockUseCanManage.mockReturnValue({ canManage: true });
    render(<AddToMasterDataLink group="lembaga" />);

    const link = screen.getByRole("link", {
      name: mockDictionary.crud.addToMasterData,
    });
    expect(link).toHaveAttribute("href", "/masterdata#lembaga");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(mockUseCanManage).toHaveBeenCalledWith("ReferenceItem");
  });

  it.each([false, undefined])(
    "renders nothing when canManage is %s",
    (canManage) => {
      mockUseCanManage.mockReturnValue({ canManage });
      const { container } = render(<AddToMasterDataLink group="bank" />);
      expect(container).toBeEmptyDOMElement();
    },
  );
});
