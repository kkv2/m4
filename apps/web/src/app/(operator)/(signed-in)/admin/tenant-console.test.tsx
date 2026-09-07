import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutate = vi.fn();
const listQuery = vi.fn();
const invalidate = vi.fn();

vi.mock("~/lib/trpc-client", () => ({
  FRESH: { staleTime: 0, refetchOnMount: "always" },
  api: {
    useUtils: () => ({ admin: { tenants: { list: { invalidate } } } }),
    admin: {
      tenants: {
        list: { useQuery: () => listQuery() as unknown },
        create: {
          useMutation: () => ({ mutate: createMutate, isPending: false }),
        },
      },
    },
  },
}));

const { TenantConsole } = await import("./tenant-console");

function withTenants(tenants: unknown[]) {
  listQuery.mockReturnValue({ isPending: false, data: tenants });
}

beforeEach(() => {
  vi.clearAllMocks();
  withTenants([]);
});

describe("the registration form", () => {
  it("pre-selects Japanese as the default language", () => {
    render(<TenantConsole />);

    expect(screen.getByLabelText("デフォルト言語")).toHaveValue("JA");
  });

  it("offers exactly Japanese and English", () => {
    render(<TenantConsole />);

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["日本語", "英語"]);
  });

  it("refuses an empty display name with a message, and calls nothing", async () => {
    const user = userEvent.setup();
    render(<TenantConsole />);

    await user.click(screen.getByRole("button", { name: "登録" }));

    expect(screen.getByRole("alert")).toHaveTextContent("表示名を入力してください。");
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("refuses a display name that is only whitespace", async () => {
    const user = userEvent.setup();
    render(<TenantConsole />);

    await user.type(screen.getByLabelText("表示名"), "   ");
    await user.click(screen.getByRole("button", { name: "登録" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("submits the name and the chosen language", async () => {
    const user = userEvent.setup();
    render(<TenantConsole />);

    await user.type(screen.getByLabelText("表示名"), "株式会社サンプル");
    await user.selectOptions(screen.getByLabelText("デフォルト言語"), "EN");
    await user.click(screen.getByRole("button", { name: "登録" }));

    expect(createMutate).toHaveBeenCalledWith({
      name: "株式会社サンプル",
      defaultLanguage: "EN",
    });
  });
});

describe("the tenant list", () => {
  it("shows an empty state rather than an error when there are no tenants", () => {
    render(<TenantConsole />);

    expect(screen.getByText("登録されているテナントはまだありません。")).toBeInTheDocument();
  });

  it("shows each tenant's identifier, user count and chat count", () => {
    withTenants([
      {
        id: "clabc123abc123abc123abc12",
        name: "株式会社サンプル",
        defaultLanguage: "JA",
        createdAt: new Date(),
        userCount: 3,
        conversationCount: 0,
      },
    ]);
    render(<TenantConsole />);

    expect(screen.getByText("株式会社サンプル")).toBeInTheDocument();
    expect(screen.getByText("clabc123abc123abc123abc12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows a zero chat count as a number, not a blank", () => {
    withTenants([
      {
        id: "clabc123abc123abc123abc12",
        name: "Zero",
        defaultLanguage: "EN",
        createdAt: new Date(),
        userCount: 0,
        conversationCount: 0,
      },
    ]);
    render(<TenantConsole />);

    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toContain("0");
  });

  it("is written entirely in Japanese, per FR-006", () => {
    withTenants([
      {
        id: "clabc123abc123abc123abc12",
        name: "Acme",
        defaultLanguage: "EN",
        createdAt: new Date(),
        userCount: 1,
        conversationCount: 0,
      },
    ]);
    render(<TenantConsole />);

    for (const heading of ["テナント", "テナントを登録"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    for (const column of ["表示名", "テナント ID", "デフォルト言語", "ユーザー数", "チャット数"]) {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
    // An English-default tenant still has its language rendered in Japanese.
    expect(screen.getByRole("cell", { name: "英語" })).toBeInTheDocument();
  });
});
