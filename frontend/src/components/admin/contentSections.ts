import type { ContentCategory } from "./CategoryTabs";
import type { Content } from "../../types";

export interface ContentSectionConfig {
  id: string;
  title: string;
  description: string;
  categories: ContentCategory[];
  keywords?: string[];
  defaultExpanded: boolean;
}

export const CONTENT_SECTIONS: ContentSectionConfig[] = [
  {
    id: "hero",
    title: "Hero Section",
    description: "Main landing page header content and call-to-action elements",
    categories: ["hero"],
    keywords: ["hero", "landing", "main", "header", "banner", "welcome"],
    defaultExpanded: true,
  },
  {
    id: "about",
    title: "About Page",
    description: "Personal bio, skills, experience, and background information",
    categories: ["about"],
    keywords: [
      "about",
      "bio",
      "biography",
      "skills",
      "experience",
      "background",
      "personal",
    ],
    defaultExpanded: true,
  },
  {
    id: "contact",
    title: "Contact Information",
    description: "Contact details, forms, and communication-related content",
    categories: ["contact"],
    keywords: [
      "contact",
      "email",
      "phone",
      "address",
      "form",
      "reach",
      "get in touch",
    ],
    defaultExpanded: true,
  },
  {
    id: "navigation",
    title: "Navigation & Menus",
    description: "Site navigation, menu labels, and footer content",
    categories: ["navigation"],
    keywords: ["nav", "menu", "navigation", "footer", "breadcrumb", "link"],
    defaultExpanded: false,
  },
  {
    id: "general",
    title: "General Content",
    description: "Site-wide content, meta information, and miscellaneous text",
    categories: ["general"],
    keywords: [
      "general",
      "site",
      "meta",
      "title",
      "description",
      "error",
      "message",
    ],
    defaultExpanded: false,
  },
];

export const groupContentBySections = (
  content: Content[],
): Record<string, Content[]> => {
  const grouped: Record<string, Content[]> = {};

  // Initialize all sections
  CONTENT_SECTIONS.forEach((section) => {
    grouped[section.id] = [];
  });

  // Group content items by section
  content.forEach((item) => {
    const section = CONTENT_SECTIONS.find((s) =>
      s.categories.includes(item.category as ContentCategory),
    );

    if (section) {
      grouped[section.id].push(item);
    } else {
      // Fallback to general section for unmatched categories
      grouped.general.push(item);
    }
  });

  return grouped;
};

export const getSectionConfig = (
  sectionId: string,
): ContentSectionConfig | undefined => {
  return CONTENT_SECTIONS.find((section) => section.id === sectionId);
};
