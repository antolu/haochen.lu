import { LightGallery } from "lightgallery/lightgallery";
import { LgQuery } from "lightgallery/lgQuery";
import { sidebarSettings, SidebarSettings } from "./lg-sidebar-settings";
import type { Photo } from "../../types";

/**
 * Custom LightGallery Sidebar Plugin
 * Displays photo metadata and information in a collapsible sidebar
 */
export default class LgSidebar {
  core: LightGallery;
  settings: SidebarSettings;
  private sidebarEl: HTMLElement | null = null;
  private sidebarContentEl: HTMLElement | null = null;
  private toggleBtnEl: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentPhotoData: Photo | null = null;

  constructor(instance: LightGallery, _LG: LgQuery) {
    this.core = instance;
    this.settings = { ...sidebarSettings, ...this.core.settings };
    return this;
  }

  init(): void {
    if (!this.settings.sidebar) return;

    // Create sidebar DOM elements
    this.createSidebar();

    // Set up event listeners
    this.addEventListeners();

    // Add toggle button to toolbar
    if (this.settings.sidebarToggleBtn) {
      this.addToggleButton();
    }

    console.log("[LgSidebar] Plugin initialized");
  }

  private createSidebar(): void {
    const galleryEl = this.core.outer;
    if (!galleryEl) return;

    // Create sidebar container
    this.sidebarEl = document.createElement("div");
    this.sidebarEl.className = [
      "lg-sidebar",
      `lg-sidebar--${this.settings.sidebarPosition}`,
      this.settings.sidebarClass,
    ]
      .filter(Boolean)
      .join(" ");

    // Set initial position based on visibility
    if (this.settings.sidebarPosition === "right") {
      this.sidebarEl.style.right = this.isVisible
        ? "0"
        : `-${this.settings.sidebarWidth}px`;
    } else {
      this.sidebarEl.style.left = this.isVisible
        ? "0"
        : `-${this.settings.sidebarWidth}px`;
    }

    // Set width if different from default
    if (this.settings.sidebarWidth !== 400) {
      this.sidebarEl.style.width = `${this.settings.sidebarWidth}px`;
    }

    // Create sidebar header
    const header = document.createElement("div");
    header.className = "lg-sidebar-header";

    const title = document.createElement("h3");
    title.textContent = "Photo Information";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.className = "lg-sidebar-close";
    closeBtn.addEventListener("click", () => this.hideSidebar());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create sidebar content
    this.sidebarContentEl = document.createElement("div");
    this.sidebarContentEl.className = "lg-sidebar-content";

    this.sidebarEl.appendChild(header);
    this.sidebarEl.appendChild(this.sidebarContentEl);

    // Add to document body
    document.body.appendChild(this.sidebarEl);
  }

  private addToggleButton(): void {
    console.log("[LgSidebar] Adding toggle button to toolbar");

    // Use the same approach as rotate plugin - directly append to core.$toolbar
    const toggleButtonHtml = `<button type="button" id="lg-sidebar-toggle" aria-label="Toggle photo information" title="Photo Info (i)" class="lg-icon lg-sidebar-toggle"></button>`;

    this.core.$toolbar.append(toggleButtonHtml);

    this.core.outer
      .find("#lg-sidebar-toggle")
      .first()
      .on("click.lg", this.toggleSidebar.bind(this));

    // Get reference to the created button for event handling
    this.toggleBtnEl = this.core.$toolbar
      .get()
      .querySelector("#lg-sidebar-toggle") as HTMLButtonElement;

    console.log("[LgSidebar] Toggle button added successfully");
  }

  private addEventListeners(): void {
    // Handle gallery slide changes
    (this.core.outer as any).addEventListener("lgAfterSlide", (e: any) => {
      this.onSlideChange(e.detail.index);
    });

    // Handle gallery open
    (this.core.outer as any).addEventListener("lgAfterOpen", () => {
      this.onGalleryOpen();
    });

    // Handle gallery close
    (this.core.outer as any).addEventListener("lgBeforeClose", () => {
      this.hideSidebar();
    });

    // Handle keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (
        e.key === this.settings.sidebarToggleKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // Only handle if gallery is open and not in input
        if (
          this.core.lgOpened &&
          !(e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/)
        ) {
          e.preventDefault();
          this.toggleSidebar();
        }
      }
    });

    // Handle escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isVisible) {
        this.hideSidebar();
      }
    });
  }

  private onGalleryOpen(): void {
    // Get initial photo data
    const currentIndex = this.core.index;
    this.onSlideChange(currentIndex);

    // Auto-show sidebar if enabled
    if (this.settings.sidebarAutoShow) {
      this.showSidebar();
    }
  }

  private onSlideChange(index: number): void {
    // Get photo data from dynamic elements
    const dynamicEl = this.core.galleryItems[index];
    if (dynamicEl?.photoData) {
      this.currentPhotoData = dynamicEl.photoData as Photo;
      this.updateSidebarContent();
    }
  }

  private updateSidebarContent(): void {
    if (!this.sidebarContentEl || !this.currentPhotoData) return;

    const photo = this.currentPhotoData;

    // Build content HTML using CSS classes
    const content = `
            <div class="lg-sidebar-section">
                <h4>${photo.title || "Untitled"}</h4>
                ${photo.description ? `<p class="description">${photo.description}</p>` : ""}
            </div>

            ${
              photo.location_name
                ? `
            <div class="lg-sidebar-section">
                <h5>Location</h5>
                <p>${photo.location_name}</p>
            </div>
            `
                : ""
            }

            ${
              photo.date_taken
                ? `
            <div class="lg-sidebar-section">
                <h5>Date Taken</h5>
                <p>${new Date(photo.date_taken).toLocaleDateString()}</p>
            </div>
            `
                : ""
            }

            ${
              photo.camera_make || photo.camera_model
                ? `
            <div class="lg-sidebar-section">
                <h5>Camera</h5>
                <p>${[photo.camera_make, photo.camera_model].filter(Boolean).join(" ")}</p>
            </div>
            `
                : ""
            }

            ${
              photo.lens || photo.lens_display_name
                ? `
            <div class="lg-sidebar-section">
                <h5>Lens</h5>
                <p>${photo.lens_display_name || photo.lens}</p>
            </div>
            `
                : ""
            }

            ${
              photo.focal_length ||
              photo.aperture ||
              photo.shutter_speed ||
              photo.iso
                ? `
            <div class="lg-sidebar-section">
                <h5>Camera Settings</h5>
                <div class="lg-sidebar-settings-grid">
                    ${photo.focal_length ? `<span class="label">Focal Length:</span><span class="value">${photo.focal_length}mm</span>` : ""}
                    ${photo.aperture ? `<span class="label">Aperture:</span><span class="value">f/${photo.aperture}</span>` : ""}
                    ${photo.shutter_speed ? `<span class="label">Shutter:</span><span class="value">${photo.shutter_speed}s</span>` : ""}
                    ${photo.iso ? `<span class="label">ISO:</span><span class="value">${photo.iso}</span>` : ""}
                </div>
            </div>
            `
                : ""
            }

            ${
              photo.tags
                ? `
            <div class="lg-sidebar-section">
                <h5>Tags</h5>
                <div class="lg-sidebar-tags">
                    ${photo.tags
                      .split(",")
                      .map(
                        (tag: string) => `
                        <span class="lg-sidebar-tag">
                            ${tag.trim()}
                        </span>
                    `,
                      )
                      .join("")}
                </div>
            </div>
            `
                : ""
            }
        `;

    this.sidebarContentEl.innerHTML = content;
  }

  showSidebar(): void {
    if (!this.sidebarEl || this.isVisible) return;

    this.isVisible = true;
    this.sidebarEl.classList.add("lg-sidebar--visible");

    // Update toggle button state
    if (this.toggleBtnEl) {
      this.toggleBtnEl.setAttribute("aria-pressed", "true");
      this.toggleBtnEl.setAttribute("aria-label", "Hide photo information");
      this.toggleBtnEl.classList.add("lg-sidebar-toggle--active");
    }

    console.log("[LgSidebar] Sidebar shown");
  }

  hideSidebar(): void {
    if (!this.sidebarEl || !this.isVisible) return;

    this.isVisible = false;
    this.sidebarEl.classList.remove("lg-sidebar--visible");

    // Update toggle button state
    if (this.toggleBtnEl) {
      this.toggleBtnEl.setAttribute("aria-pressed", "false");
      this.toggleBtnEl.setAttribute("aria-label", "Show photo information");
      this.toggleBtnEl.classList.remove("lg-sidebar-toggle--active");
    }

    console.log("[LgSidebar] Sidebar hidden");
  }

  toggleSidebar(): void {
    if (this.isVisible) {
      this.hideSidebar();
    } else {
      this.showSidebar();
    }
  }

  // Method to programmatically update photo data
  setPhotoData(photoData: Photo): void {
    this.currentPhotoData = photoData;
    this.updateSidebarContent();
  }

  destroy(): void {
    // Remove sidebar from DOM
    if (this.sidebarEl && this.sidebarEl.parentNode) {
      this.sidebarEl.parentNode.removeChild(this.sidebarEl);
    }

    // Remove toggle button
    if (this.toggleBtnEl && this.toggleBtnEl.parentNode) {
      this.toggleBtnEl.parentNode.removeChild(this.toggleBtnEl);
    }

    // Clean up references
    this.sidebarEl = null;
    this.sidebarContentEl = null;
    this.toggleBtnEl = null;
    this.currentPhotoData = null;

    console.log("[LgSidebar] Plugin destroyed");
  }
}
