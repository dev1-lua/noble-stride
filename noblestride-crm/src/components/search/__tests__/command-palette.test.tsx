// @vitest-environment jsdom
//
// command-palette.test.tsx — component test for the global search palette
// (Task D). This repo has no prior React component-test infra (no jsdom/
// testing-library dependency, vitest.config.ts runs `environment: "node"`
// globally) — see the deviation note in the task report. This file opts
// into jsdom per-file via the `@vitest-environment` docblock above (Vitest's
// documented per-test-file override) and mocks the GraphQL transport
// (`@urql/next`) the same way `next/navigation` is already mocked elsewhere
// in this repo's server-action smoke tests (e.g. express-interest.smoke.test.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { pushMock, queryMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@urql/next", () => ({
  useClient: () => ({ query: queryMock }),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, s, i) => acc + s + (values[i] !== undefined ? String(values[i]) : ""), ""),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { CommandPalette } from "../command-palette";

interface FakeResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  href: string;
}

function mockSearchResponse(results: FakeResult[]) {
  queryMock.mockReturnValue({
    toPromise: () => Promise.resolve({ data: { globalSearch: results } }),
  });
}

const SAMPLE_RESULTS: FakeResult[] = [
  { id: "inv-1", type: "Investor", title: "Acme Capital", subtitle: "Private Equity", href: "/investors/inv-1" },
  { id: "txn-1", type: "Transaction", title: "Project Baobab", subtitle: "Acme Agri Ltd", href: "/transactions/txn-1" },
  { id: "txn-2", type: "Transaction", title: "Project Cedar", subtitle: "Cedar Foods", href: "/transactions/txn-2" },
];

beforeEach(() => {
  pushMock.mockReset();
  queryMock.mockReset();
  mockSearchResponse([]);
});

afterEach(() => {
  cleanup();
});

describe("CommandPalette", () => {
  it("is closed by default and opens when the trigger is clicked", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open global search/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens on Ctrl-K / Cmd-K even without clicking the trigger", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("debounces typing before issuing the globalSearch query", async () => {
    mockSearchResponse(SAMPLE_RESULTS);
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: /open global search/i }));

    const input = screen.getByLabelText(/global search input/i);
    fireEvent.change(input, { target: { value: "Ac" } });
    fireEvent.change(input, { target: { value: "Acm" } });
    fireEvent.change(input, { target: { value: "Acme" } });

    // Not called immediately — only after the debounce window settles once.
    expect(queryMock).not.toHaveBeenCalled();

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(expect.anything(), { query: "Acme", limit: 8 });
  });

  it("renders results grouped by entity type", async () => {
    mockSearchResponse(SAMPLE_RESULTS);
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: /open global search/i }));
    fireEvent.change(screen.getByLabelText(/global search input/i), { target: { value: "Project" } });

    await waitFor(() => expect(screen.getByText("Acme Capital")).toBeInTheDocument());

    expect(screen.getByText("Investors")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
    expect(screen.getByText("Project Baobab")).toBeInTheDocument();
    expect(screen.getByText("Project Cedar")).toBeInTheDocument();
  });

  it("navigates to the result href on click and closes the palette", async () => {
    mockSearchResponse(SAMPLE_RESULTS);
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: /open global search/i }));
    fireEvent.change(screen.getByLabelText(/global search input/i), { target: { value: "Project" } });

    await waitFor(() => expect(screen.getByText("Project Baobab")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Project Baobab"));

    expect(pushMock).toHaveBeenCalledWith("/transactions/txn-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates on Enter after arrow-key navigation", async () => {
    mockSearchResponse(SAMPLE_RESULTS);
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: /open global search/i }));
    fireEvent.change(screen.getByLabelText(/global search input/i), { target: { value: "Project" } });

    await waitFor(() => expect(screen.getByText("Acme Capital")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    // activeIndex starts at 0 (Acme Capital) — move down twice to "Project Cedar".
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/transactions/txn-2");
  });

  it("shows a no-results state when the query matches nothing", async () => {
    mockSearchResponse([]);
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: /open global search/i }));
    fireEvent.change(screen.getByLabelText(/global search input/i), { target: { value: "zzz-no-match" } });

    await waitFor(() => expect(queryMock).toHaveBeenCalled());
    expect(await screen.findByText(/no results for/i)).toBeInTheDocument();
  });
});
