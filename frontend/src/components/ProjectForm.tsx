import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import MDEditor from "@uiw/react-md-editor";
import { motion } from "framer-motion";
import RepositoryConnector from "./RepositoryConnector";
import ProjectImagesManager from "./admin/ProjectImagesManager";
import TagMultiSelect from "./admin/TagMultiSelect";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  useCreateProject,
  useUpdateProject,
  usePreviewReadme,
  parseTechnologies,
  formatTechnologies,
  generateSlug,
  useProjectTechnologies,
  type Project,
  type ProjectCreate,
  type ProjectUpdate,
} from "../hooks/useProjects";

interface ProjectFormProps {
  project?: Project;
  onSuccess?: (project: Project) => void;
  onCancel?: () => void;
}

interface FormData {
  title: string;
  slug: string;
  description: string;
  short_description: string;
  github_url: string;
  demo_url: string;
  technologies: string;
  featured: boolean;
  status: "active" | "archived" | "in_progress";
  use_readme: boolean;
  repository_type?: string;
  repository_owner?: string;
  repository_name?: string;
}

const ProjectForm: React.FC<ProjectFormProps> = ({
  project,
  onSuccess,
  onCancel,
}) => {
  const isEditing = !!project;
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const previewReadmeMutation = usePreviewReadme();

  const [technologiesInput, setTechnologiesInput] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [useReadme, setUseReadme] = useState(false);
  const [readmePreview, setReadmePreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { data: distinctTechnologies = [] } = useProjectTechnologies();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      short_description: "",
      github_url: "",
      demo_url: "",
      technologies: "",
      featured: false,
      status: "active",
      use_readme: false,
      repository_type: undefined,
      repository_owner: undefined,
      repository_name: undefined,
    },
  });

  // Initialize form with project data
  useEffect(() => {
    if (project) {
      const technologies = parseTechnologies(project.technologies);
      setTechnologiesInput(technologies.join(", "));
      setMarkdownContent(project.description);
      setUseReadme(project.use_readme ?? false);

      reset({
        title: project.title,
        slug: project.slug,
        description: project.description,
        short_description: project.short_description ?? "",
        github_url: project.github_url ?? "",
        demo_url: project.demo_url ?? "",
        technologies: technologies.join(", "),
        featured: project.featured,
        status: project.status,
        use_readme: project.use_readme ?? false,
        repository_type: project.repository_type ?? undefined,
        repository_owner: project.repository_owner ?? undefined,
        repository_name: project.repository_name ?? undefined,
      });
    }
  }, [project, reset]);

  // Watch fields for dynamic updates
  const watchedTitle = watch("title");
  const watchedGithubUrl = watch("github_url");

  // Auto-generate slug from title
  useEffect(() => {
    if (watchedTitle && !isEditing) {
      setValue("slug", generateSlug(watchedTitle));
    }
  }, [watchedTitle, setValue, isEditing]);

  // Handle repository connector changes
  const handleRepositoryChange = (repoData: {
    url: string;
    type?: string;
    owner?: string;
    name?: string;
  }) => {
    setValue("github_url", repoData.url);
    setValue("repository_type", repoData.type);
    setValue("repository_owner", repoData.owner);
    setValue("repository_name", repoData.name);

    // Auto-enable use_readme when repository is connected (for new projects only)
    if (repoData.url && !isEditing) {
      // Use setTimeout to ensure this happens after any potential form resets
      setTimeout(() => {
        setValue("use_readme", true);
        setUseReadme(true);
      }, 0);
    }
  };

  // Handle technologies input
  const handleTechnologiesChange = (value: string) => {
    setTechnologiesInput(value);
    setValue("technologies", value);
  };

  // Preview README
  const handlePreviewReadme = async () => {
    if (!watchedGithubUrl) return;

    setIsLoadingPreview(true);
    try {
      const result = (await previewReadmeMutation.mutateAsync(
        watchedGithubUrl,
      )) as {
        content: string;
      };
      setReadmePreview(result.content);
      setMarkdownContent(result.content);
    } catch (error) {
      console.error("Failed to preview README:", error);
      setReadmePreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    try {
      const technologies = data.technologies
        .split(",")
        .map((tech) => tech.trim())
        .filter(Boolean);

      const projectData = {
        title: data.title,
        slug: isEditing ? undefined : data.slug,
        description:
          useReadme && readmePreview ? readmePreview : markdownContent,
        short_description: data.short_description || undefined,
        github_url: data.github_url || undefined,
        demo_url: data.demo_url || undefined,
        technologies: formatTechnologies(technologies),
        featured: data.featured,
        status: data.status,
        use_readme: data.use_readme,
        repository_type: data.repository_type,
        repository_owner: data.repository_owner,
        repository_name: data.repository_name,
      };

      let result: Project;
      if (isEditing) {
        result = await updateMutation.mutateAsync({
          id: project.id,
          data: projectData as ProjectUpdate,
        });
      } else {
        result = await createMutation.mutateAsync(projectData as ProjectCreate);
      }

      onSuccess?.(result);
    } catch (error) {
      console.error("Failed to save project:", error);
    }
  };

  const isLoading =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <motion.div
      className="max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {isEditing ? "Edit Project" : "Create New Project"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isEditing
                ? "Update project information and content"
                : "Add a new project to your portfolio"}
            </p>
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading} size="sm">
              {isLoading
                ? "Saving..."
                : isEditing
                  ? "Update Project"
                  : "Create Project"}
            </Button>
          </div>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="md:col-span-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  {...register("title", { required: "Title is required" })}
                  placeholder="Enter project title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Slug */}
              <div>
                <Label htmlFor="slug">URL Slug {!isEditing && "*"}</Label>
                <Input
                  id="slug"
                  {...register("slug", {
                    required: !isEditing ? "Slug is required" : false,
                  })}
                  disabled={isEditing}
                  placeholder="project-url-slug"
                />
                {errors.slug && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.slug.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {isEditing
                    ? "Slug cannot be changed after creation"
                    : "Auto-generated from title"}
                </p>
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  {...register("status")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="active">Active</option>
                  <option value="in_progress">In Progress</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Short Description */}
              <div className="md:col-span-2">
                <Label htmlFor="short_description">Short Description</Label>
                <Input
                  id="short_description"
                  {...register("short_description")}
                  placeholder="Brief description for project cards"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional: Used in project cards and meta descriptions
                </p>
              </div>

              {/* Technologies */}
              <div className="md:col-span-2">
                <Label>Technologies</Label>
                <TagMultiSelect
                  value={technologiesInput
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)}
                  options={distinctTechnologies}
                  onChange={(vals) => handleTechnologiesChange(vals.join(", "))}
                  placeholder="Search or create technologies..."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Type to search or press Enter to create a new technology
                </p>
              </div>

              {/* Removed Featured project toggle */}
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Links & Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GitHub URL */}
              <div className="md:col-span-2">
                <RepositoryConnector
                  value={watch("github_url")}
                  onChange={handleRepositoryChange}
                  disabled={isSubmitting}
                />
              </div>

              {/* Demo URL - spans full width now that image URL is removed */}
              <div className="md:col-span-2">
                <Label htmlFor="demo_url">Demo URL</Label>
                <Input
                  id="demo_url"
                  {...register("demo_url")}
                  type="url"
                  placeholder="https://project-demo.com"
                />
              </div>

              {/* Removed Image URL: project uses gallery images */}
            </div>
          </CardContent>
        </Card>

        {/* Content Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Description</CardTitle>
          </CardHeader>
          <CardContent>
            {/* README Integration */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                {watchedGithubUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void handlePreviewReadme();
                    }}
                    disabled={isLoadingPreview || !watchedGithubUrl}
                  >
                    {isLoadingPreview ? "Loading..." : "Preview README"}
                  </Button>
                )}
              </div>

              {/* Show toggle when a repo is provided or preview is available */}
              {watchedGithubUrl && (
                <div className="mb-2">
                  <label className="flex items-center">
                    <input
                      {...register("use_readme")}
                      type="checkbox"
                      checked={useReadme}
                      onChange={(e) => {
                        setUseReadme(e.target.checked);
                        setValue("use_readme", e.target.checked);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm font-medium">
                      Use README.md from repository
                    </span>
                  </label>
                </div>
              )}

              {readmePreview && (
                <div className="mb-4 p-4 bg-muted border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">README Preview</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReadmePreview(null)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                    {readmePreview.substring(0, 300)}...
                  </div>
                </div>
              )}
            </div>

            {/* Description: start as single-line, expand to advanced editor on focus */}
            <div>
              <Label>
                {useReadme
                  ? "Custom Description (overrides README)"
                  : "Project Description *"}
              </Label>
              {!isEditorExpanded ? (
                <Input
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  onFocus={() => setIsEditorExpanded(true)}
                  placeholder={
                    useReadme
                      ? "Click to expand editor to override README"
                      : "Click to expand editor"
                  }
                />
              ) : (
                <div data-color-mode="auto">
                  <MDEditor
                    value={markdownContent}
                    onChange={(val) => setMarkdownContent(val ?? "")}
                    preview="edit"
                    height={400}
                    visibleDragbar={false}
                  />
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {useReadme
                  ? "Leave empty to use README content, or add custom description to override"
                  : "Supports Markdown formatting including code blocks, links, and images"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Images Manager */}
        {project && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Images</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectImagesManager projectId={project.id} />
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          {onCancel && (
            <Button type="button" onClick={onCancel} variant="outline">
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading}
            className="flex items-center"
          >
            {isLoading && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                />
                <path
                  fill="currentColor"
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isLoading
              ? "Saving..."
              : isEditing
                ? "Update Project"
                : "Create Project"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
};

export default ProjectForm;
