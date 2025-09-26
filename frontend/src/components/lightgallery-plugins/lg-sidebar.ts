import { LightGallery } from "lightgallery/lightgallery";
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

  constructor(instance: LightGallery) {
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
    this.sidebarEl.className =
      `lg-sidebar ${this.settings.sidebarClass}`.trim();
    this.sidebarEl.style.cssText = `
            position: fixed;
            top: 0;
            ${this.settings.sidebarPosition}: ${this.isVisible ? "0" : `-${this.settings.sidebarWidth}px`};
            width: ${this.settings.sidebarWidth}px;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            z-index: 10000;
            transition: ${this.settings.sidebarPosition} ${this.settings.sidebarAnimationDuration}ms ease-in-out;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

    // Create sidebar header
    const header = document.createElement("div");
    header.className = "lg-sidebar-header";
    header.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

    const title = document.createElement("h3");
    title.textContent = "Photo Information";
    title.style.cssText = "margin: 0; font-size: 18px; font-weight: 600;";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.className = "lg-sidebar-close";
    closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: background 0.2s;
        `;
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.background = "rgba(255, 255, 255, 0.1)";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.background = "none";
    });
    closeBtn.addEventListener("click", () => this.hideSidebar());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create sidebar content
    this.sidebarContentEl = document.createElement("div");
    this.sidebarContentEl.className = "lg-sidebar-content";
    this.sidebarContentEl.style.cssText = `
            padding: 20px;
            line-height: 1.6;
        `;

    this.sidebarEl.appendChild(header);
    this.sidebarEl.appendChild(this.sidebarContentEl);

    // Add to document body
    document.body.appendChild(this.sidebarEl);
  }

  private addToggleButton(): void {
    console.log("[LgSidebar] Adding toggle button to toolbar");

    // Use the same approach as rotate plugin - directly append to core.$toolbar
    const toggleButtonHtml = `<button type="button" id="lg-sidebar-toggle" aria-label="Toggle photo information" title="Photo Info (i)" class="lg-icon lg-sidebar-toggle">
            <span style="font-weight:600;font-family:system-ui">i</span>
        </button>`;

    this.core.$toolbar.append(toggleButtonHtml);

    // Get reference to the created button for event handling
    this.toggleBtnEl = this.core.$toolbar
      .get()
      .querySelector("#lg-sidebar-toggle") as HTMLButtonElement;

    if (this.toggleBtnEl) {
      this.toggleBtnEl.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
      console.log("[LgSidebar] Toggle button added successfully");
    } else {
      console.log("[LgSidebar] Failed to get reference to toggle button");
    }
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

    // Build content HTML
    const content = `
            <div class="lg-sidebar-section">
                <h4 style="margin: 0 0 10px; font-size: 16px; color: #fff;">${photo.title || "Untitled"}</h4>
                ${photo.description ? `<p style="margin: 0 0 15px; color: #ccc; font-size: 14px;">${photo.description}</p>` : ""}
            </div>

            ${
              photo.location_name
                ? `
            <div class="lg-sidebar-section" style="margin-bottom: 20px;">
                <h5 style="margin: 0 0 5px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Location</h5>
                <p style="margin: 0; color: #fff;">${photo.location_name}</p>
            </div>
            `
                : ""
            }

            ${
              photo.date_taken
                ? `
            <div class="lg-sidebar-section" style="margin-bottom: 20px;">
                <h5 style="margin: 0 0 5px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Date Taken</h5>
                <p style="margin: 0; color: #fff;">${new Date(photo.date_taken).toLocaleDateString()}</p>
            </div>
            `
                : ""
            }

            ${
              photo.camera_make || photo.camera_model
                ? `
            <div class="lg-sidebar-section" style="margin-bottom: 20px;">
                <h5 style="margin: 0 0 5px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Camera</h5>
                <p style="margin: 0; color: #fff;">${[photo.camera_make, photo.camera_model].filter(Boolean).join(" ")}</p>
            </div>
            `
                : ""
            }

            ${
              photo.lens || photo.lens_display_name
                ? `
            <div class="lg-sidebar-section" style="margin-bottom: 20px;">
                <h5 style="margin: 0 0 5px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Lens</h5>
                <p style="margin: 0; color: #fff;">${photo.lens_display_name || photo.lens}</p>
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
            <div class="lg-sidebar-section" style="margin-bottom: 20px;">
                <h5 style="margin: 0 0 5px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Camera Settings</h5>
                <div style="display: grid; grid-template-columns: auto auto; gap: 5px 15px; color: #fff; font-size: 14px;">
                    ${photo.focal_length ? `<span style="color: #999;">Focal Length:</span><span>${photo.focal_length}mm</span>` : ""}
                    ${photo.aperture ? `<span style="color: #999;">Aperture:</span><span>f/${photo.aperture}</span>` : ""}
                    ${photo.shutter_speed ? `<span style="color: #999;">Shutter:</span><span>${photo.shutter_speed}s</span>` : ""}
                    ${photo.iso ? `<span style="color: #999;">ISO:</span><span>${photo.iso}</span>` : ""}
                </div>
            </div>
            `
                : ""
            }

            ${
              photo.tags
                ? `
            <div class="lg-sidebar-section" style="margin-bottom: 20px;">
                <h5 style="margin: 0 0 10px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Tags</h5>
                <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                    ${photo.tags
                      .split(",")
                      .map(
                        (tag: string) => `
                        <span style="background: rgba(255, 255, 255, 0.1); padding: 4px 8px; border-radius: 12px; font-size: 12px; color: #fff;">
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
    this.sidebarEl.style[this.settings.sidebarPosition as any] = "0";

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
    this.sidebarEl.style[this.settings.sidebarPosition as any] =
      `-${this.settings.sidebarWidth}px`;

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
