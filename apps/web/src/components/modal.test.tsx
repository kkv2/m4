import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Modal } from "./modal";

const onClose = vi.fn();

function renderModal() {
  return render(
    <Modal title="ユーザーを登録" closeLabel="閉じる" onClose={onClose}>
      <p>本文</p>
      <input aria-label="どこかの入力欄" />
    </Modal>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("what it is", () => {
  it("is a dialog named by its own title", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "ユーザーを登録" })).toBeInTheDocument();
  });

  it("is modal, so what is behind it is out of reach", () => {
    renderModal();

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("takes the focus, so the keyboard is already inside it", () => {
    renderModal();

    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("stops the page behind it from scrolling, and lets it again on close", () => {
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("the ways out", () => {
  it("closes on the close control", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on a click outside the panel", async () => {
    const user = userEvent.setup();
    const { container } = renderModal();

    await user.click(container.firstElementChild as HTMLElement);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open when the click is on its own content", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("本文"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("stops listening for Escape once it is gone", async () => {
    const user = userEvent.setup();
    const { unmount } = renderModal();

    unmount();
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});
