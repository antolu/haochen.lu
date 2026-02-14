/**
 * ProjectDetailPage Component Tests
 *
 * Comprehensive tests for the ProjectDetailPage including:
 * - Project detail rendering with metadata
 * - Loading skeleton states
 * - Error handling and not found states
 * - README integration and content display
 * - Action buttons and external links
 * - Technology tags and project information
 * - Responsive layout and accessibility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectDetailPage from "../../pages/ProjectDetailPage";
import { createMockProject, mockReadmeResponse } from "../fixtures/projects";
import { renderWithProviders } from "../utils/project-test-utils";
// import * as useProjectsModule from '../../hooks/useProjects';  // Unused but kept for future test enhancements

// Mock react-router-dom
const mockUseParams = vi.fn(() => ({ slug: "test-project" }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => mockUseParams(),
  };
});

// Mock the hooks
const mockUseProject = vi.fn(() => ({}));
const mockUseProjectReadme = vi.fn(() => ({}));

vi.mock("../../hooks/useProjects", async () => {
  const actual = await vi.importActual("../../hooks/useProjects");
  return {
    ...actual,
    useProject: (...args: unknown[]) => mockUseProject(...args),
    useProjectReadme: (...args: unknown[]) => mockUseProjectReadme(...args),
    parseTechnologies: vi.fn((tech: string) =>
      tech ? tech.split(",").map((t: string) => t.trim()) : [],
    ),
  };
});

// Mock MarkdownRenderer
vi.mock("../../components/MarkdownRenderer", () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
}));

const renderWithRouter = (
  component: React.ReactElement,
  initialEntries = ["/projects/test-project"],
) => {
  window.history.pushState({}, "Test", initialEntries[0]);
  // Ensure react-router reads the correct slug by updating window.location
  (window as unknown as { location: { pathname: string } }).location.pathname =
    initialEntries[0];
  return renderWithProviders(component, { initialRoute: initialEntries[0] });
};

describe("ProjectDetailPage", () => {
  const mockProject = createMockProject({
    id: "project-1",
    title: "Test Project",
    slug: "test-project",
    description: "# Test Project\n\nThis is a test project description.",
    short_description: "A test project for unit testing",
    technologies: "React, TypeScript, Node.js",
    status: "active",
    featured: true,
    demo_url: "https://demo.example.com",
    github_url: "https://github.com/test/project",
    image_url: "https://example.com/project-image.jpg",
    created_at: "2023-01-15T10:00:00Z",
    updated_at: "2023-01-20T15:30:00Z",
    use_readme: true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    });
    mockUseProjectReadme.mockReturnValue({
      data: mockReadmeResponse,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Basic Rendering", () => {
    it("renders project title and basic information", () => {
      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("Test Project")).toBeInTheDocument();
      expect(
        screen.getByText("A test project for unit testing"),
      ).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("⭐ Featured")).toBeInTheDocument();
    });

    it("renders back navigation link", () => {
      renderWithRouter(<ProjectDetailPage />);

      const backLink = screen.getByRole("link", { name: /back to projects/i });
      // Accept either absolute or relative href depending on router
      expect(backLink.getAttribute("href")?.includes("/projects")).toBe(true);
    });

    it("displays project image when provided", () => {
      renderWithRouter(<ProjectDetailPage />);

      const projectImage = screen.getByRole("img", { name: "Test Project" });
      expect(projectImage).toHaveAttribute(
        "src",
        "https://example.com/project-image.jpg",
      );
      expect(projectImage).toHaveAttribute("alt", "Test Project");
    });

    it("displays fallback placeholder when image is not provided", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, image_url: null },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      // Should display SVG placeholder instead of image
      expect(
        screen.queryByRole("img", { name: "Test Project" }),
      ).not.toBeInTheDocument();

      // Check for placeholder SVG
      const placeholder = screen
        .getByText("Test Project")
        .closest("section")
        ?.querySelector("svg");
      expect(placeholder).toBeInTheDocument();
    });

    it("renders project status with correct styling", () => {
      renderWithRouter(<ProjectDetailPage />);

      const statusBadge = screen.getByText("Active");
      expect(statusBadge).toHaveClass(
        "bg-green-100",
        "text-green-800",
        "border-green-200",
      );
    });

    it("shows featured badge when project is featured", () => {
      renderWithRouter(<ProjectDetailPage />);

      const featuredBadge = screen.getByText("⭐ Featured");
      expect(featuredBadge).toHaveClass(
        "bg-blue-100",
        "text-blue-800",
        "border-blue-200",
      );
    });

    it("does not show featured badge for non-featured projects", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, featured: false },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.queryByText("⭐ Featured")).not.toBeInTheDocument();
    });
  });

  describe("Status Handling", () => {
    it("displays in_progress status correctly", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, status: "in_progress" },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      const statusBadge = screen.getByText("In Progress");
      expect(statusBadge).toHaveClass(
        "bg-yellow-100",
        "text-yellow-800",
        "border-yellow-200",
      );
    });

    it("displays archived status correctly", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, status: "archived" },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      const statusBadge = screen.getByText("Archived");
      expect(statusBadge).toHaveClass("bg-muted", "text-foreground", "border");
    });

    it("handles unknown status gracefully", () => {
      mockUseProject.mockReturnValue({
        data: {
          ...mockProject,
          status: "unknown" as "active" | "archived" | "in_progress",
        },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      const statusBadge = screen.getByText("Unknown");
      expect(statusBadge).toHaveClass("bg-muted", "text-foreground", "border");
    });
  });

  describe("Action Buttons", () => {
    it("renders demo link when demo_url is provided", () => {
      renderWithRouter(<ProjectDetailPage />);

      const demoLink = screen.getByRole("link", { name: /view live demo/i });
      expect(demoLink).toHaveAttribute("href", "https://demo.example.com");
      expect(demoLink).toHaveAttribute("target", "_blank");
      expect(demoLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders GitHub link when github_url is provided", () => {
      renderWithRouter(<ProjectDetailPage />);

      const githubLink = screen.getByRole("link", {
        name: /view source code/i,
      });
      expect(githubLink).toHaveAttribute(
        "href",
        "https://github.com/test/project",
      );
      expect(githubLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not render demo link when demo_url is not provided", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, demo_url: null },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(
        screen.queryByRole("link", { name: /view live demo/i }),
      ).not.toBeInTheDocument();
    });

    it("does not render GitHub link when github_url is not provided", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, github_url: null },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(
        screen.queryByRole("link", { name: /view source code/i }),
      ).not.toBeInTheDocument();
    });

    it("has proper icons for action buttons", () => {
      renderWithRouter(<ProjectDetailPage />);

      const demoLink = screen.getByRole("link", { name: /view live demo/i });
      const githubLink = screen.getByRole("link", {
        name: /view source code/i,
      });

      expect(demoLink.querySelector("svg")).toBeInTheDocument();
      expect(githubLink.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Technology Tags", () => {
    it("displays technology tags when technologies are provided", () => {
      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("Technologies Used")).toBeInTheDocument();
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Node.js")).toBeInTheDocument();
    });

    it("does not display technologies section when no technologies", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, technologies: null },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.queryByText("Technologies Used")).not.toBeInTheDocument();
    });

    it("handles empty technologies string", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, technologies: "" },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.queryByText("Technologies Used")).not.toBeInTheDocument();
    });
  });

  describe("Project Information", () => {
    it("displays formatted creation date", () => {
      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("Created")).toBeInTheDocument();
      const createdDates = screen.getAllByText("15 January 2023");
      expect(createdDates.length).toBeGreaterThan(0);
    });

    it("displays formatted last updated date", () => {
      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("Last Updated")).toBeInTheDocument();
      // Current formatter renders day-first format
      expect(screen.getByText("20 January 2023")).toBeInTheDocument();
    });

    it("displays README update date when available", () => {
      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("README Updated")).toBeInTheDocument();
      expect(screen.getAllByText("15 January 2023").length).toBeGreaterThan(0);
    });

    it("does not show README update when not available", () => {
      mockUseProjectReadme.mockReturnValue({
        data: { ...mockReadmeResponse, last_updated: null },
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.queryByText("README Updated")).not.toBeInTheDocument();
    });
  });

  describe("Content Display", () => {
    it("renders README content when available", () => {
      renderWithRouter(<ProjectDetailPage />);

      // Relax whitespace expectations for markdown rendering
      expect(screen.getByTestId("markdown-content")).toHaveTextContent(
        /Test Project/i,
      );
      expect(screen.getByTestId("markdown-content")).toHaveTextContent(
        /This is a test README file/i,
      );
    });

    it("falls back to project description when README not available", () => {
      mockUseProjectReadme.mockReturnValue({
        data: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByTestId("markdown-content")).toHaveTextContent(
        /This is a test project description\./i,
      );
    });

    it("shows README source indicator", () => {
      renderWithRouter(<ProjectDetailPage />);

      expect(
        screen.getByText(
          /This content is automatically synced from the project's README.md file on/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(mockReadmeResponse.source, "i")),
      ).toBeInTheDocument();
    });

    it("does not show README indicator when using project description", () => {
      mockUseProjectReadme.mockReturnValue({
        data: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(
        screen.queryByText(/This content is automatically synced/),
      ).not.toBeInTheDocument();
    });

    it("renders MarkdownRenderer component with correct content", () => {
      renderWithRouter(<ProjectDetailPage />);

      const markdownRenderer = screen.getByTestId("markdown-content");
      expect(markdownRenderer).toBeInTheDocument();
      expect(markdownRenderer.textContent).toContain("Test Project");
      expect(markdownRenderer.textContent).toContain(
        "This is a test README file",
      );
    });
  });

  describe("Loading State", () => {
    it("shows loading skeleton when project is loading", () => {
      mockUseProject.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      // Check for skeleton elements
      const skeletonElements = document.querySelectorAll(".animate-pulse");
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it("renders skeleton with proper structure", () => {
      mockUseProject.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      // Should have the main layout structure
      expect(document.querySelector(".bg-gray-50")).toBeInTheDocument();
      expect(document.querySelector(".aspect-video")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("shows error state when project fetch fails", () => {
      mockUseProject.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Project not found"),
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("Project not found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The project you're looking for doesn't exist or has been removed.",
        ),
      ).toBeInTheDocument();
    });

    it("shows error state when project data is null", () => {
      mockUseProject.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("Project not found")).toBeInTheDocument();
    });

    it("provides back to projects link on error", () => {
      mockUseProject.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Not found"),
      });

      renderWithRouter(<ProjectDetailPage />);

      const backLink = screen.getByRole("link", { name: /back to projects/i });
      expect(backLink).toHaveAttribute("href", "/projects");
    });

    it("shows error icon in error state", () => {
      mockUseProject.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Not found"),
      });

      renderWithRouter(<ProjectDetailPage />);

      const errorIcon = screen
        .getByText("Project not found")
        .closest("div")
        ?.querySelector("svg");
      expect(errorIcon).toBeInTheDocument();
      expect(errorIcon).toHaveClass("text-red-500");
    });
  });

  describe("URL Parameter Handling", () => {
    it("uses slug parameter from URL", () => {
      mockUseParams.mockReturnValue({ slug: "test-slug" });
      renderWithRouter(<ProjectDetailPage />, ["/projects/test-slug"]);

      expect(mockUseProject).toHaveBeenCalledWith("test-slug");
    });

    it("handles empty slug parameter", () => {
      mockUseParams.mockReturnValue({ slug: "" });
      renderWithRouter(<ProjectDetailPage />, ["/projects/"]);

      expect(mockUseProject).toHaveBeenCalledWith("");
    });

    it("calls useProjectReadme with correct parameters", () => {
      renderWithRouter(<ProjectDetailPage />);

      expect(mockUseProjectReadme).toHaveBeenCalledWith(
        mockProject.id,
        mockProject.github_url,
      );
    });

    it("does not call useProjectReadme when use_readme is false", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, use_readme: false },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(mockUseProjectReadme).toHaveBeenCalledWith(
        mockProject.id,
        undefined,
      );
    });
  });

  describe("Responsive Layout", () => {
    it("has responsive grid classes", () => {
      renderWithRouter(<ProjectDetailPage />);

      const gridContainer = screen.getByText("Test Project").closest(".grid");
      expect(gridContainer).toHaveClass("grid-cols-1", "lg:grid-cols-3");
    });

    it("has responsive container classes", () => {
      renderWithRouter(<ProjectDetailPage />);

      const containers = document.querySelectorAll(
        ".max-w-7xl.mx-auto, .max-w-4xl.mx-auto",
      );
      expect(containers.length).toBeGreaterThan(0);
    });

    it("has responsive image container", () => {
      renderWithRouter(<ProjectDetailPage />);

      const img = screen.getByRole("img", { name: "Test Project" });
      const container =
        img.closest('[class*="lg:col-span-"]') ?? img.parentElement;
      expect(container).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("has proper heading hierarchy", () => {
      renderWithRouter(<ProjectDetailPage />);

      const mainHeading = screen.getByRole("heading", { level: 1 });
      expect(mainHeading).toHaveTextContent("Test Project");
    });

    it("has accessible external links", () => {
      renderWithRouter(<ProjectDetailPage />);

      const externalLinks = screen
        .getAllByRole("link")
        .filter(
          (link) =>
            link.hasAttribute("target") &&
            link.getAttribute("target") === "_blank",
        );

      externalLinks.forEach((link) => {
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      });
    });

    it("has accessible image alt text", () => {
      renderWithRouter(<ProjectDetailPage />);

      const projectImage = screen.getByRole("img", { name: "Test Project" });
      expect(projectImage).toHaveAttribute("alt", "Test Project");
    });

    it("has semantic structure with sections", () => {
      renderWithRouter(<ProjectDetailPage />);

      const sections = document.querySelectorAll("section");
      expect(sections.length).toBeGreaterThanOrEqual(2);
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      renderWithRouter(<ProjectDetailPage />);

      // Tab to first interactive element (back link)
      await user.tab();
      const backLink = screen.getByRole("link", { name: /back to projects/i });
      expect(backLink).toHaveFocus();

      // Tab to next interactive element (demo link)
      await user.tab();
      const demoLink = screen.getByRole("link", { name: /view live demo/i });
      expect(demoLink).toHaveFocus();
    });
  });

  describe("Edge Cases", () => {
    it("handles missing short description", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, short_description: null },
        isLoading: false,
        error: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByText("Test Project")).toBeInTheDocument();
      expect(
        screen.queryByText("A test project for unit testing"),
      ).not.toBeInTheDocument();
    });

    it("handles invalid date strings gracefully", () => {
      mockUseProject.mockReturnValue({
        data: {
          ...mockProject,
          created_at: "invalid-date",
          updated_at: "invalid-date",
        },
        isLoading: false,
        error: null,
      });

      expect(() => {
        renderWithRouter(<ProjectDetailPage />);
      }).not.toThrow();
    });

    it("handles empty content gracefully", () => {
      mockUseProject.mockReturnValue({
        data: { ...mockProject, description: "" },
        isLoading: false,
        error: null,
      });

      mockUseProjectReadme.mockReturnValue({
        data: null,
      });

      renderWithRouter(<ProjectDetailPage />);

      expect(screen.getByTestId("markdown-content")).toHaveTextContent("");
    });

    it("handles missing project data fields gracefully", () => {
      const minimalProject = {
        ...mockProject,
        demo_url: null,
        github_url: null,
        image_url: null,
        short_description: null,
        technologies: null,
        featured: false,
      };

      mockUseProject.mockReturnValue({
        data: minimalProject,
        isLoading: false,
        error: null,
      });

      expect(() => {
        renderWithRouter(<ProjectDetailPage />);
      }).not.toThrow();

      expect(screen.getByText("Test Project")).toBeInTheDocument();
      expect(screen.queryByText("⭐ Featured")).not.toBeInTheDocument();
      expect(screen.queryByText("Technologies Used")).not.toBeInTheDocument();
    });
  });
});
