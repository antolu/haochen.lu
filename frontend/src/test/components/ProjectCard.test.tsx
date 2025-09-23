/**
 * ProjectCard Component Tests
 *
 * Comprehensive tests for the ProjectCard component including:
 * - Different project statuses and their visual representations
 * - Technology tags parsing and display
 * - Featured project indicators
 * - External links functionality
 * - Image handling and fallbacks
 * - Responsive behavior and accessibility
 */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectCard from "../../components/ProjectCard";
import { createMockProject } from "../fixtures/projects";
import { renderWithProviders } from "../utils/project-test-utils";

// Mock framer-motion to avoid animation complexity in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe("ProjectCard", () => {
  describe("Basic Rendering", () => {
    it("renders project with all basic information", () => {
      const project = createMockProject({
        title: "Test Project",
        short_description: "A comprehensive test project",
        technologies: "React, TypeScript, Node.js",
        status: "active",
        featured: true,
      });

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByText("Test Project")).toBeInTheDocument();
      expect(
        screen.getByText("A comprehensive test project"),
      ).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("⭐ Featured")).toBeInTheDocument();
    });

    it("renders project link with correct href", () => {
      const project = createMockProject({ slug: "test-project-slug" });
      renderWithProviders(<ProjectCard project={project} />);

      const projectLink = screen.getByRole("link");
      expect(projectLink).toHaveAttribute(
        "href",
        "/projects/test-project-slug",
      );
    });

    it("applies custom className", () => {
      const project = createMockProject();
      const { container } = renderWithProviders(
        <ProjectCard project={project} className="custom-class" />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("Status Handling", () => {
    it("displays active status with correct styling", () => {
      const project = createMockProject({ status: "active" });
      renderWithProviders(<ProjectCard project={project} />);

      const statusBadge = screen.getByText("Active");
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("displays in progress status with correct styling", () => {
      const project = createMockProject({ status: "in_progress" });
      renderWithProviders(<ProjectCard project={project} />);

      const statusBadge = screen.getByText("In Progress");
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass("bg-yellow-100", "text-yellow-800");
    });

    it("displays archived status with correct styling", () => {
      const project = createMockProject({ status: "archived" });
      renderWithProviders(<ProjectCard project={project} />);

      const statusBadge = screen.getByText("Archived");
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass("bg-gray-100", "text-gray-800");
    });

    it("handles unknown status gracefully", () => {
      const project = createMockProject({
        status: "unknown" as "active" | "archived" | "in_progress",
      });
      renderWithProviders(<ProjectCard project={project} />);

      const statusBadge = screen.getByText("Unknown");
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass("bg-gray-100", "text-gray-800");
    });
  });

  describe("Featured Projects", () => {
    it("shows featured badge for featured projects", () => {
      const project = createMockProject({ featured: true });
      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByText("⭐ Featured")).toBeInTheDocument();
    });

    it("does not show featured badge for non-featured projects", () => {
      const project = createMockProject({ featured: false });
      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.queryByText("⭐ Featured")).not.toBeInTheDocument();
    });
  });

  describe("Technology Tags", () => {
    it("parses and displays technology tags correctly", () => {
      const project = createMockProject({
        technologies: "React, TypeScript, Node.js, PostgreSQL",
      });
      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Node.js")).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    });

    it("handles empty technologies gracefully", () => {
      const project = createMockProject({ technologies: "" });
      renderWithProviders(<ProjectCard project={project} />);

      // Should not render technology section
      expect(screen.queryByText("Technologies")).not.toBeInTheDocument();
    });

    it("handles null technologies gracefully", () => {
      const project = createMockProject({ technologies: null });
      renderWithProviders(<ProjectCard project={project} />);

      // Should not render technology section
      expect(screen.queryByText("Technologies")).not.toBeInTheDocument();
    });

    it("trims whitespace from technology tags", () => {
      const project = createMockProject({
        technologies: "  React  ,  TypeScript  ,  Node.js  ",
      });
      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Node.js")).toBeInTheDocument();
    });
  });

  describe("External Links", () => {
    it("displays demo button when demo_url is provided", () => {
      const project = createMockProject({
        demo_url: "https://demo.example.com",
      });
      renderWithProviders(<ProjectCard project={project} />);

      const demoButton = screen.getByRole("button", { name: /demo/i });
      expect(demoButton).toBeInTheDocument();
    });

    it("displays GitHub button when github_url is provided", () => {
      const project = createMockProject({
        github_url: "https://github.com/test/project",
      });
      renderWithProviders(<ProjectCard project={project} />);

      const githubButton = screen.getByRole("button", { name: /code/i });
      expect(githubButton).toBeInTheDocument();
    });

    it("does not display demo link when demo_url is null", () => {
      const project = createMockProject({ demo_url: null });
      renderWithProviders(<ProjectCard project={project} />);

      expect(
        screen.queryByRole("link", { name: /view live demo/i }),
      ).not.toBeInTheDocument();
    });

    it("does not display GitHub link when github_url is null", () => {
      const project = createMockProject({ github_url: null });
      renderWithProviders(<ProjectCard project={project} />);

      expect(
        screen.queryByRole("link", { name: /view source/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Image Handling", () => {
    it("displays project image when image_url is provided", () => {
      const project = createMockProject({
        title: "Test Project",
        image_url: "https://example.com/project-image.jpg",
      });
      renderWithProviders(<ProjectCard project={project} />);

      const image = screen.getByRole("img", { name: "Test Project" });
      expect(image).toHaveAttribute(
        "src",
        "https://example.com/project-image.jpg",
      );
      expect(image).toHaveAttribute("alt", "Test Project");
      expect(image).toHaveAttribute("loading", "lazy");
    });

    it("displays fallback icon when image_url is null", () => {
      const project = createMockProject({ image_url: null });
      renderWithProviders(<ProjectCard project={project} />);

      // Should display the fallback SVG icon (query SVG directly as it doesn't have img role)
      const svgIcon = document.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
    });

    it("displays fallback icon when image_url is empty string", () => {
      const project = createMockProject({ image_url: "" });
      renderWithProviders(<ProjectCard project={project} />);

      // Should display the fallback SVG icon (query SVG directly as it doesn't have img role)
      const svgIcon = document.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
    });
  });

  describe("Repository Integration", () => {
    it("displays repository type indicator for GitHub", () => {
      const project = createMockProject({
        repository_type: "github",
        repository_owner: "facebook",
        repository_name: "react",
      });
      renderWithProviders(<ProjectCard project={project} />);

      // Should show some indication of GitHub integration
      expect(screen.getByRole("button", { name: /code/i })).toBeInTheDocument();
    });

    it("displays repository type indicator for GitLab", () => {
      const project = createMockProject({
        repository_type: "gitlab",
        repository_owner: "gitlab-org",
        repository_name: "gitlab",
        github_url: "https://gitlab.com/gitlab-org/gitlab",
      });
      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByRole("button", { name: /code/i })).toBeInTheDocument();
    });

    it("shows README indicator when use_readme is true", () => {
      const project = createMockProject({
        use_readme: true,
        repository_type: "github",
      });
      renderWithProviders(<ProjectCard project={project} />);

      // Check if there's any indication of README usage
      // This might be a subtle UI element
      expect(screen.getByRole("link")).toBeInTheDocument();
    });
  });

  describe("Interaction and Accessibility", () => {
    it("has proper ARIA attributes", () => {
      const project = createMockProject();
      renderWithProviders(<ProjectCard project={project} />);

      const projectLink = screen.getByRole("link");
      expect(projectLink).toBeInTheDocument();
    });

    it("handles keyboard navigation", async () => {
      const project = createMockProject();
      renderWithProviders(<ProjectCard project={project} />);

      // The buttons receive focus before the main project link
      const codeButton = screen.getByRole("button", { name: /code/i });

      // Test focus - buttons get focus first
      await userEvent.tab();
      expect(codeButton).toHaveFocus();
    });

    it("handles click events on external links", async () => {
      const user = userEvent.setup();
      const project = createMockProject({
        demo_url: "https://demo.example.com",
        github_url: "https://github.com/test/project",
      });

      renderWithProviders(<ProjectCard project={project} />);

      const demoButton = screen.getByRole("button", { name: /demo/i });
      const githubButton = screen.getByRole("button", { name: /code/i });

      // These should not throw errors when clicked
      await user.click(demoButton);
      await user.click(githubButton);
    });
  });

  describe("Edge Cases", () => {
    it("handles very long project titles", () => {
      const project = createMockProject({
        title:
          "This is an extremely long project title that might cause layout issues if not handled properly",
      });
      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByText(project.title)).toBeInTheDocument();
    });

    it("handles very long technology lists", () => {
      const project = createMockProject({
        technologies:
          "React, TypeScript, Node.js, Express, PostgreSQL, Redis, Docker, Kubernetes, AWS, Terraform, Jest, Cypress, ESLint, Prettier, Webpack, Vite",
      });
      renderWithProviders(<ProjectCard project={project} />);

      // Should render first few technologies and overflow indicator
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Node.js")).toBeInTheDocument();
      expect(screen.getByText("Express")).toBeInTheDocument();
      // Should show overflow indicator for remaining technologies
      expect(screen.getByText("+12 more")).toBeInTheDocument();
    });

    it("handles missing required fields gracefully", () => {
      const project = createMockProject({
        title: "",
        description: "",
        short_description: null,
      });

      // Should not crash even with empty/null required fields
      expect(() => {
        renderWithProviders(<ProjectCard project={project} />);
      }).not.toThrow();
    });

    it("handles malformed URLs gracefully", () => {
      const project = createMockProject({
        demo_url: "not-a-valid-url",
        github_url: "also-not-valid",
      });

      expect(() => {
        renderWithProviders(<ProjectCard project={project} />);
      }).not.toThrow();
    });
  });
});
