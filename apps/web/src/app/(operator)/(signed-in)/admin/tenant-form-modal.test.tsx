import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const onClose = vi.fn();
let createOptions: { onSuccess?: () => Promise<void>; onError?: () => void } = {};
let updateOptions: { onSuccess?: () => Promise<void>; onError?: () => void } = {};

vi.mock("~/lib/trpc-client", () => ({
  api: {
    useUtils: () => ({
      admin: { tenants: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } },
    }),
    admin: {
      tenants: {
        create: {
          useMutation: (options: typeof createOptions) => {
            createOptions = options;
            return { mutate: createMutate, isPending: false };
          },
        },
        update: {
          useMutation: (options: typeof updateOptions) => {
            updateOptions = options;
            return { mutate: updateMutate, isPending: false };
          },
        },
      },
    },
  },
}));

const { TenantFormModal } = await import("./tenant-form-modal");

const aTenant = {
  id: "clabc123abc123abc123abc12",
  name: "株式会社サンプル",
  defaultLanguage: "JA" as const,
  createdAt: new Date(),
  userCount: 3,
  conversationCount: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  createOptions = {};
  updateOptions = {};
});

describe("registering", () => {
  it("offers exactly Japanese and English", () => {
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["日本語", "英語"]);
  });

  it("refuses an empty display name with a message, and calls nothing", async () => {
    const user = userEvent.setup();
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "登録" }));

    expect(screen.getByRole("alert")).toHaveTextContent("表示名を入力してください。");
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("refuses a display name that is only whitespace", async () => {
    const user = userEvent.setup();
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    await user.type(screen.getByLabelText("表示名"), "   ");
    await user.click(screen.getByRole("button", { name: "登録" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("submits the name and the chosen language", async () => {
    const user = userEvent.setup();
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    await user.type(screen.getByLabelText("表示名"), "株式会社サンプル");
    await user.selectOptions(screen.getByLabelText("デフォルト言語"), "EN");
    await user.click(screen.getByRole("button", { name: "登録" }));

    expect(createMutate).toHaveBeenCalledWith({
      name: "株式会社サンプル",
      defaultLanguage: "EN",
    });
  });

  it("closes once the tenant exists, leaving the list behind it to say so", async () => {
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    // Awaited, because the handler invalidates the list before it closes.
    await act(async () => await createOptions.onSuccess?.());

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open and says so when registration fails", () => {
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    act(() => createOptions.onError?.());

    expect(screen.getByRole("alert")).toHaveTextContent("予期しないエラーが発生しました。");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows no identifier, because there is not one yet", () => {
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    expect(screen.queryByText("この項目は変更できません。")).not.toBeInTheDocument();
  });

  it("is a POST, so an un-hydrated native submit cannot leak the fields", () => {
    const { container } = render(<TenantFormModal tenant={null} onClose={onClose} />);

    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("marks its required fields, and says what the marker means", () => {
    render(<TenantFormModal tenant={null} onClose={onClose} />);

    expect(screen.getByLabelText("表示名")).toBeRequired();
    expect(screen.getByLabelText("デフォルト言語")).toBeRequired();
    expect(screen.getByText("* は必須項目です。")).toBeInTheDocument();
  });
});

describe("editing", () => {
  it("carries the counts and the identifier as text, never as fields", () => {
    render(<TenantFormModal tenant={aTenant} onClose={onClose} />);

    expect(screen.getByText(aTenant.id)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    const editable = screen
      .getAllByRole("textbox")
      .map((field) => (field as HTMLInputElement).value);
    expect(editable).not.toContain(aTenant.id);
  });

  it("submits an update rather than a second registration", async () => {
    const user = userEvent.setup();
    render(<TenantFormModal tenant={aTenant} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(updateMutate).toHaveBeenCalledWith({
      tenantId: aTenant.id,
      name: aTenant.name,
      defaultLanguage: "JA",
    });
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("refuses to save an emptied display name", async () => {
    const user = userEvent.setup();
    render(<TenantFormModal tenant={aTenant} onClose={onClose} />);

    await user.clear(screen.getByLabelText("表示名"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent("表示名を入力してください。");
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("closes once the edit lands", async () => {
    render(<TenantFormModal tenant={aTenant} onClose={onClose} />);

    await act(async () => await updateOptions.onSuccess?.());

    expect(onClose).toHaveBeenCalled();
  });
});
