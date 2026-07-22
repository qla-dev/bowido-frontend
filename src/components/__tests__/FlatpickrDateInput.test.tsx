import { useState } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlatpickrDateInput } from "../FlatpickrDateInput";

describe("FlatpickrDateInput", () => {
  it("updates its localized display when the app language changes", () => {
    const onChange = vi.fn();
    const { container, rerender, unmount } = render(
      <FlatpickrDateInput
        value="2026-06-28"
        onChange={onChange}
        language="bs"
      />,
    );

    const getVisibleInput = () =>
      container.querySelector<HTMLInputElement>("input.flatpickr-date-input");

    expect(getVisibleInput()?.value).toBe("28.06.2026.");
    expect(document.querySelector(".trackpal-flatpickr")).not.toBeNull();
    fireEvent.click(getVisibleInput() as HTMLInputElement);
    expect(document.querySelector(".trackpal-flatpickr.open")).not.toBeNull();

    rerender(
      <FlatpickrDateInput
        value="2026-06-28"
        onChange={onChange}
        language="nl"
      />,
    );

    expect(getVisibleInput()?.value).toBe("28-06-2026");

    unmount();
    expect(document.querySelector(".trackpal-flatpickr")).toBeNull();
  });

  it("opens from the calendar button", () => {
    const { container, unmount } = render(
      <FlatpickrDateInput value="" onChange={vi.fn()} language="bs" ariaLabel="Od" />,
    );

    fireEvent.click(
      container.querySelector('button[aria-label="Otvori kalendar: Od"]') as HTMLButtonElement,
    );

    expect(document.querySelector(".trackpal-flatpickr.open")).not.toBeNull();
    unmount();
  });

  it("opens when any empty part of the field is clicked", () => {
    const { container, unmount } = render(
      <FlatpickrDateInput
        value=""
        onChange={vi.fn()}
        language="bs"
        prefix={<span>Od</span>}
      />,
    );

    fireEvent.click(container.firstElementChild as HTMLDivElement);

    expect(document.querySelector(".trackpal-flatpickr.open")).not.toBeNull();
    unmount();
  });

  it("allows an intentionally empty placeholder", () => {
    const { container, unmount } = render(
      <FlatpickrDateInput value="" onChange={vi.fn()} language="bs" placeholder="" />,
    );

    expect(
      container.querySelector<HTMLInputElement>("input.flatpickr-date-input")?.placeholder,
    ).toBe("");
    unmount();
  });

  it("keeps the selected value inside the pill after a controlled rerender", () => {
    function ControlledDateInput() {
      const [value, setValue] = useState("");
      return (
        <FlatpickrDateInput
          value={value}
          onChange={setValue}
          language="bs"
          placeholder="Početni datum"
        />
      );
    }

    const { container, unmount } = render(<ControlledDateInput />);
    fireEvent.click(container.firstElementChild as HTMLDivElement);

    const availableDay = document.querySelector<HTMLElement>(
      ".trackpal-flatpickr.open .flatpickr-day:not(.flatpickr-disabled)",
    );
    fireEvent.click(availableDay as HTMLElement);

    const sourceInput = container.querySelector<HTMLInputElement>(
      "input[data-flatpickr-source]",
    );
    const displayInputs = container.querySelectorAll<HTMLInputElement>(
      "input.flatpickr-date-input",
    );
    expect(sourceInput).toHaveStyle({ display: "none" });
    expect(displayInputs).toHaveLength(1);
    expect(displayInputs[0].value).not.toBe("");
    unmount();
  });
});
