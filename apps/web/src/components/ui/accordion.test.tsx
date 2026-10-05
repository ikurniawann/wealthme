import { fireEvent, render, screen } from "@testing-library/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";

describe("Accordion — Arc interaction adapter", () => {
  it("keeps the Base UI disclosure behavior with Arc-sized trigger and markers", () => {
    render(
      <Accordion>
        <AccordionItem value="faq">
          <AccordionTrigger>How does it work?</AccordionTrigger>
          <AccordionContent>The details are here.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const root = document.querySelector('[data-uiarc="accordion"]');
    const trigger = screen.getByRole("button", {
      name: "How does it work?",
    });
    expect(root).toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-uiarc", "accordion-trigger");
    expect(trigger).toHaveClass("min-h-11", "duration-200");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The details are here.")).toBeVisible();
    expect(
      document.querySelector('[data-uiarc="accordion-content"]'),
    ).toBeInTheDocument();
  });
});
