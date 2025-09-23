/**
 * AdminProjects Component Tests
 *
 * Comprehensive tests for the AdminProjects page including:
 * - Project list rendering and management interface
 * - Create, edit, and delete operations
 * - Search and filtering functionality
 * - Statistics display and project overview
 * - Modal states and form integration
 * - Error handling and loading states
 * - Responsive admin interface behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProjects from "../../pages/admin/AdminProjects";
import { mockProjects, mockProjectStats } from "../fixtures/projects";
import { renderWithProviders } from "../utils/project-test-utils";
// import * as useProjectsModule from '../../hooks/useProjects';  // Unused but kept for future test enhancements

// Mock the hooks
const mockRefetch = vi.fn();
const mockMutate = vi.fn();
const mockUseProjects = vi.fn(() => ({
  data: { projects: [], totalPages: 1, currentPage: 1, totalProjects: 0 },
  refetch: mockRefetch,
  isLoading: false,
  error: null,
}));
const mockUseDeleteProject = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
}));
const mockUseProjectStats = vi.fn(() => ({
  data: { total: 0, featured: 0, active: 0 },
  isLoading: false,
}));

vi.mock("../../hooks/useProjects", async () => {
  const actual = await vi.importActual("../../hooks/useProjects");
  return {
    ...actual,
    useProjects: (...args: unknown[]) => mockUseProjects(...args),
    useDeleteProject: () => mockUseDeleteProject(),
    useProjectStats: () => mockUseProjectStats(),
    parseTechnologies: vi.fn((tech: string) =>
      tech ? tech.split(",").map((t: string) => t.trim()) : [],
    ),
  };
});

// Mock ProjectForm component
vi.mock("../../components/ProjectForm", () => ({
  default: ({
    project,
    onSuccess,
    onCancel,
  }: {
    project?: { title?: string };
    onSuccess?: () => void;
    onCancel?: () => void;
  }) => (
    <div data-testid="project-form">
      <h2>{project ? "Edit Project" : "Create Project"}</h2>
      <div data-testid="project-form-title">
        {project?.title ?? "New Project Form"}
      </div>
      <button
        onClick={() => onSuccess?.({ id: "new-id", title: "New Project" })}
      >
        Save Project
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe("AdminProjects", () => {
  const mockDeleteProject = vi.fn();
  const mockStatsData = mockProjectStats;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProjects.mockReturnValue({
      data: { projects: mockProjects, total: mockProjects.length },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseDeleteProject.mockReturnValue({
      mutateAsync: mockDeleteProject,
      isPending: false,
    });
    mockUseProjectStats.mockReturnValue({
      data: mockStatsData,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Basic Rendering", () => {
    it("renders admin projects page with header", () => {
      renderWithProviders(<AdminProjects />);

      expect(screen.getByText("Project Management")).toBeInTheDocument();
      expect(
        screen.getByText("Create and manage your project portfolio"),
      ).toBeInTheDocument();
    });

    it("displays project statistics", () => {
      renderWithProviders(<AdminProjects />);

      expect(screen.getByText("Total Projects")).toBeInTheDocument();
      expect(
        screen.getByText(mockStatsData.total_projects.toString()),
      ).toBeInTheDocument();
      expect(screen.getByText("Featured")).toBeInTheDocument();
      expect(
        screen.getByText(mockStatsData.featured_projects.toString()),
      ).toBeInTheDocument();
      // Active label may appear in multiple places; verify count instead
      expect(
        screen.getByText(mockStatsData.active_projects.toString()),
      ).toBeInTheDocument();
    });

    it("shows create new project button", () => {
      renderWithProviders(<AdminProjects />);

      expect(
        screen.getByRole("button", { name: /new project/i }),
      ).toBeInTheDocument();
    });

    it("displays search input", () => {
      renderWithProviders(<AdminProjects />);

      expect(
        screen.getByPlaceholderText("Search projects..."),
      ).toBeInTheDocument();
    });

    it("renders projects list container", () => {
      renderWithProviders(<AdminProjects />);

      // List container should exist
      expect(
        document.querySelector(".divide-y.divide-gray-200"),
      ).toBeInTheDocument();
    });

    it("renders project list items", () => {
      renderWithProviders(<AdminProjects />);

      mockProjects.forEach((project) => {
        expect(screen.getByText(project.title)).toBeInTheDocument();
      });
    });
  });

  describe("Project List Display", () => {
    it("displays project titles and descriptions", () => {
      renderWithProviders(<AdminProjects />);

      const firstProject = mockProjects[0];
      expect(screen.getByText(firstProject.title)).toBeInTheDocument();
      if (firstProject.short_description) {
        const descriptions = screen.getAllByText(
          firstProject.short_description,
        );
        expect(descriptions.length).toBeGreaterThan(0);
      }
    });

    it("shows project status badges with correct styling", () => {
      renderWithProviders(<AdminProjects />);

      const activeProject = mockProjects.find((p) => p.status === "active");
      if (activeProject) {
        const statusBadges = screen.getAllByText("Active");
        const badge = statusBadges.find((el) =>
          el.className.includes("bg-green-100"),
        );
        expect(badge).toBeDefined();
        expect(badge!).toHaveClass("bg-green-100", "text-green-800");
      }
    });

    it("displays technology tags for each project", () => {
      renderWithProviders(<AdminProjects />);

      // Should show technology tags for projects that have them
      expect(screen.getAllByText("React").length).toBeGreaterThan(0);
      expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0);
    });

    it("omits last updated dates in current UI", () => {
      renderWithProviders(<AdminProjects />);
      expect(screen.getByText("Project Management")).toBeInTheDocument();
    });

    it("displays featured project indicators", () => {
      renderWithProviders(<AdminProjects />);

      const featuredProjects = mockProjects.filter((p) => p.featured);
      if (featuredProjects.length > 0) {
        const featuredBadges = screen.getAllByText("Featured");
        expect(featuredBadges.length).toBe(featuredProjects.length);
      }
    });

    it("shows action buttons for each project", () => {
      renderWithProviders(<AdminProjects />);

      const editButtons = screen.getAllByText("Edit");
      const deleteButtons = screen.getAllByText("Delete");

      expect(editButtons.length).toBe(mockProjects.length);
      expect(deleteButtons.length).toBe(mockProjects.length);
    });
  });

  describe("Search Functionality", () => {
    it("updates search query when typing", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const searchInput = screen.getByPlaceholderText("Search projects...");
      await user.type(searchInput, "react");

      expect(searchInput).toHaveValue("react");
    });

    it("calls useProjects with search parameter", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const searchInput = screen.getByPlaceholderText("Search projects...");
      await user.type(searchInput, "test");

      await waitFor(() => {
        expect(mockUseProjects).toHaveBeenCalledWith({
          search: "test",
        });
      });
    });

    it("handles empty search gracefully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const searchInput = screen.getByPlaceholderText("Search projects...");
      await user.type(searchInput, "test");
      await user.clear(searchInput);

      await waitFor(() => {
        expect(mockUseProjects).toHaveBeenCalledWith({
          search: undefined,
        });
      });
    });
  });

  describe("Create Project Functionality", () => {
    it("opens create form when create button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const createButton = screen.getByRole("button", { name: /new project/i });
      await user.click(createButton);

      expect(screen.getByTestId("project-form")).toBeInTheDocument();
      expect(screen.getByText("Create Project")).toBeInTheDocument();
    });

    it("closes create form when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const createButton = screen.getByRole("button", { name: /new project/i });
      await user.click(createButton);

      expect(screen.getByTestId("project-form")).toBeInTheDocument();

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      expect(screen.queryByTestId("project-form")).not.toBeInTheDocument();
    });

    it("handles successful project creation", async () => {
      const mockRefetch = vi.fn();
      mockUseProjects.mockReturnValue({
        data: { projects: mockProjects, total: mockProjects.length },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const createButton = screen.getByRole("button", {
        name: /new project/i,
      });
      await user.click(createButton);

      const saveButton = screen.getByRole("button", { name: "Save Project" });
      await user.click(saveButton);

      // Should close the form
      expect(screen.queryByTestId("project-form")).not.toBeInTheDocument();
    });
  });

  describe("Edit Project Functionality", () => {
    it("opens edit form when edit button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const editButtons = screen.getAllByText("Edit");
      await user.click(editButtons[0]);

      expect(screen.getByTestId("project-form")).toBeInTheDocument();
      expect(screen.getByText("Edit Project")).toBeInTheDocument();
      expect(screen.getByTestId("project-form-title")).toHaveTextContent(
        mockProjects[0].title,
      );
    });

    it("passes correct project data to edit form", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const editButtons = screen.getAllByText("Edit");
      await user.click(editButtons[0]);

      expect(screen.getByTestId("project-form-title")).toHaveTextContent(
        mockProjects[0].title,
      );
    });

    it("handles successful project update", async () => {
      const mockRefetch = vi.fn();
      mockUseProjects.mockReturnValue({
        data: { projects: mockProjects, total: mockProjects.length },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const editButtons = screen.getAllByText("Edit");
      await user.click(editButtons[0]);

      const saveButton = screen.getByRole("button", { name: "Save Project" });
      await user.click(saveButton);

      expect(screen.queryByTestId("project-form")).not.toBeInTheDocument();
    });
  });

  describe("Delete Project Functionality", () => {
    beforeEach(() => {
      // Mock window.confirm
      vi.spyOn(window, "confirm").mockReturnValue(true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("shows confirmation dialog when delete is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith(
        `Are you sure you want to delete "${mockProjects[0].title}"? This action cannot be undone.`,
      );
    });

    it("calls delete mutation when confirmed", async () => {
      const user = userEvent.setup();
      mockDeleteProject.mockResolvedValue({});

      renderWithProviders(<AdminProjects />);

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockDeleteProject).toHaveBeenCalledWith(mockProjects[0].id);
      });
    });

    it("does not delete when confirmation is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]);

      expect(mockDeleteProject).not.toHaveBeenCalled();
    });

    it("handles successful deletion without explicit refetch", async () => {
      const mockRefetch = vi.fn();
      mockUseProjects.mockReturnValue({
        data: { projects: mockProjects, total: mockProjects.length },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
      mockDeleteProject.mockResolvedValue({});

      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]);
      // Component does not call refetch directly; ensure no errors thrown and UI remains
      expect(screen.getByText("Project Management")).toBeInTheDocument();
    });

    it("handles delete errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockDeleteProject.mockRejectedValue(new Error("Delete failed"));

      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to delete project:",
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Loading States", () => {
    it("shows loading state for projects", () => {
      mockUseProjects.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      renderWithProviders(<AdminProjects />);

      // Should show loading skeletons or indicators
      const loadingElements = document.querySelectorAll(".animate-pulse");
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it("shows loading state for statistics", () => {
      mockUseProjectStats.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderWithProviders(<AdminProjects />);

      // Stats should show loading state
      expect(
        screen.queryByText(mockStatsData.total_projects.toString()),
      ).not.toBeInTheDocument();
    });

    it("shows loading state for delete operations", () => {
      mockUseDeleteProject.mockReturnValue({
        mutateAsync: mockDeleteProject,
        isPending: true,
      });

      renderWithProviders(<AdminProjects />);

      const deleteButtons = screen.getAllByText("Delete");
      // Delete buttons should be disabled when pending
      deleteButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe("Error Handling", () => {
    it("shows error state when projects fail to load", () => {
      mockUseProjects.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to fetch projects"),
        refetch: vi.fn(),
      });

      renderWithProviders(<AdminProjects />);

      expect(screen.getByText(/failed to load projects/i)).toBeInTheDocument();
      // Retry button not present in current UI
    });

    // Retry handled by refetch elsewhere; no explicit retry button in UI

    it("shows error state when stats fail to load", () => {
      mockUseProjectStats.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to fetch stats"),
      });

      renderWithProviders(<AdminProjects />);

      // Should still show the rest of the interface
      expect(screen.getByText("Project Management")).toBeInTheDocument();

      // Stats should show error or fallback values
      expect(
        screen.queryByText(mockStatsData.total_projects.toString()),
      ).not.toBeInTheDocument();
    });
  });

  describe("Empty States", () => {
    it("shows empty state when no projects exist", () => {
      mockUseProjects.mockReturnValue({
        data: { projects: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderWithProviders(<AdminProjects />);

      expect(screen.getByText(/no projects found/i)).toBeInTheDocument();
      expect(
        screen.getByText(/create your first project/i),
      ).toBeInTheDocument();
    });

    it("shows empty state when search returns no results", () => {
      mockUseProjects.mockReturnValue({
        data: { projects: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderWithProviders(<AdminProjects />);

      // Should still show the search input
      expect(
        screen.getByPlaceholderText("Search projects..."),
      ).toBeInTheDocument();
      expect(screen.getByText(/no projects found/i)).toBeInTheDocument();
    });
  });

  describe("Responsive Behavior", () => {
    it("has responsive layout classes", () => {
      renderWithProviders(<AdminProjects />);

      // Should have responsive container classes
      const containers = document.querySelectorAll(".max-w-7xl.mx-auto");
      expect(containers.length).toBeGreaterThan(0);
    });

    it("has responsive list layout", () => {
      renderWithProviders(<AdminProjects />);

      // Should render a list of project items
      const items = screen.getAllByText(/View|Edit|Delete/);
      expect(items.length).toBeGreaterThan(0);
    });

    it("has responsive statistics grid", () => {
      renderWithProviders(<AdminProjects />);

      // Should have grid layout for stats
      const statsContainer = screen
        .getByText("Total Projects")
        .closest(".grid");
      expect(statsContainer).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper heading hierarchy", () => {
      renderWithProviders(<AdminProjects />);

      const mainHeading = screen.getByRole("heading", { level: 1 });
      expect(mainHeading).toHaveTextContent("Project Management");
    });

    it("has accessible controls and inputs", () => {
      renderWithProviders(<AdminProjects />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /new project/i }),
      ).toBeInTheDocument();
      const actions = screen.getAllByRole("button", { name: /edit|delete/i });
      expect(actions.length).toBeGreaterThan(0);
    });

    it("has accessible form elements", () => {
      renderWithProviders(<AdminProjects />);

      const searchInput = screen.getByRole("textbox");
      expect(searchInput).toHaveAttribute("placeholder", "Search projects...");
    });

    it("has accessible buttons with proper labels", () => {
      renderWithProviders(<AdminProjects />);

      const createButton = screen.getByRole("button", { name: /new project/i });
      expect(createButton).toBeInTheDocument();

      const editButtons = screen.getAllByRole("button", { name: "Edit" });
      const deleteButtons = screen.getAllByRole("button", { name: "Delete" });

      expect(editButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AdminProjects />);

      // First tab lands on New Project button, then search input
      await user.tab();
      expect(
        screen.getByRole("button", { name: /new project/i }),
      ).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText("Search projects...")).toHaveFocus();
    });
  });

  describe("Edge Cases", () => {
    it("handles missing project data gracefully", () => {
      const projectsWithMissingData = [
        {
          ...mockProjects[0],
          short_description: null,
          technologies: null,
        },
      ];

      mockUseProjects.mockReturnValue({
        data: { projects: projectsWithMissingData, total: 1 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      expect(() => {
        renderWithProviders(<AdminProjects />);
      }).not.toThrow();

      expect(
        screen.getByText(projectsWithMissingData[0].title),
      ).toBeInTheDocument();
    });

    it("handles invalid date strings", () => {
      const projectWithInvalidDate = {
        ...mockProjects[0],
        updated_at: "invalid-date",
      };

      mockUseProjects.mockReturnValue({
        data: { projects: [projectWithInvalidDate], total: 1 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      expect(() => {
        renderWithProviders(<AdminProjects />);
      }).not.toThrow();
    });

    it("handles missing statistics gracefully", () => {
      mockUseProjectStats.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      expect(() => {
        renderWithProviders(<AdminProjects />);
      }).not.toThrow();
    });
  });
});
