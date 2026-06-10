import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SortableProjectList from "../../../src/components/admin/SortableProjectList";
import type { Project } from "../../../src/hooks/useProjects";

// Mock dnd-kit to simulate a drag end event
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: any) => (
      <div
        data-testid="mock-dnd-context"
        onClick={() => {
          if (onDragEnd) {
            onDragEnd({
              active: { id: "proj-1" },
              over: { id: "proj-2" },
            });
          }
        }}
      >
        {children}
      </div>
    ),
  };
});

const mockProjects: Project[] = [
  {
    id: "proj-1",
    title: "Project 1",
    slug: "proj-1",
    description: "Desc 1",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    featured: false,
  },
  {
    id: "proj-2",
    title: "Project 2",
    slug: "proj-2",
    description: "Desc 2",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    featured: false,
  },
];

describe("SortableProjectList Optimistic Updates", () => {
  it("optimistically updates the list order when drag ends", () => {
    const onReorder = vi.fn();

    render(
      <SortableProjectList
        projects={mockProjects}
        reorderEnabled={true}
        onReorder={onReorder}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Check initial order using the h4 headings
    let headings = screen.getAllByRole("heading", { level: 4 });
    expect(headings[0]).toHaveTextContent("Project 1");
    expect(headings[1]).toHaveTextContent("Project 2");

    // Trigger mock drag end
    fireEvent.click(screen.getByTestId("mock-dnd-context"));

    // Check that onReorder was called with the new order
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith([mockProjects[1], mockProjects[0]]);

    // Check that the DOM optimistically updated its local state
    headings = screen.getAllByRole("heading", { level: 4 });
    expect(headings[0]).toHaveTextContent("Project 2");
    expect(headings[1]).toHaveTextContent("Project 1");
  });
});
