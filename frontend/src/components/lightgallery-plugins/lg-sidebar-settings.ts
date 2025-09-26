export interface SidebarSettings {
  /**
   * Enable sidebar plugin
   */
  sidebar: boolean;

  /**
   * Position of the sidebar
   */
  sidebarPosition: "left" | "right";

  /**
   * Width of the sidebar in pixels
   */
  sidebarWidth: number;

  /**
   * Auto-show sidebar on gallery open
   */
  sidebarAutoShow: boolean;

  /**
   * Show sidebar toggle button in toolbar
   */
  sidebarToggleBtn: boolean;

  /**
   * Keyboard shortcut to toggle sidebar (default: 'i' for info)
   */
  sidebarToggleKey: string;

  /**
   * Custom CSS class for sidebar container
   */
  sidebarClass: string;

  /**
   * Animation duration for sidebar show/hide in ms
   */
  sidebarAnimationDuration: number;
}

export const sidebarSettings: SidebarSettings = {
  sidebar: true,
  sidebarPosition: "right",
  sidebarWidth: 400,
  sidebarAutoShow: false,
  sidebarToggleBtn: true,
  sidebarToggleKey: "i",
  sidebarClass: "",
  sidebarAnimationDuration: 300,
};
