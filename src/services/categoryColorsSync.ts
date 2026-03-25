import { NextcloudAPI } from '../api/nextcloud';

export class CategoryColorsSync {
  private api: NextcloudAPI | null = null;
  private colors: Record<string, number> = {};
  private syncInProgress: boolean = false;
  private changeCallback: (() => void) | null = null;

  constructor() {
    this.loadFromLocalStorage();
  }

  setAPI(api: NextcloudAPI | null) {
    this.api = api;
    if (api) {
      this.syncFromServer();
    }
  }

  setChangeCallback(callback: () => void) {
    this.changeCallback = callback;
  }

  private loadFromLocalStorage() {
    const saved = localStorage.getItem('categoryColors');
    if (saved) {
      try {
        this.colors = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse category colors from localStorage:', e);
        this.colors = {};
      }
    }
  }

  private saveToLocalStorage() {
    localStorage.setItem('categoryColors', JSON.stringify(this.colors));
  }

  private notifyChange() {
    if (this.changeCallback) {
      this.changeCallback();
    }
    window.dispatchEvent(new Event('categoryColorChanged'));
  }

  async syncFromServer(): Promise<void> {
    if (!this.api || this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      const serverColors = await this.api.fetchCategoryColors();
      
      // Merge: server wins for conflicts
      const hasChanges = JSON.stringify(this.colors) !== JSON.stringify(serverColors);
      
      if (hasChanges) {
        this.colors = serverColors;
        this.saveToLocalStorage();
        this.notifyChange();
      }
    } catch (error) {
      console.error('Failed to sync category colors from server:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async setColor(category: string, colorIndex: number | null): Promise<void> {
    if (colorIndex === null) {
      delete this.colors[category];
    } else {
      this.colors[category] = colorIndex;
    }

    this.saveToLocalStorage();
    this.notifyChange();

    // Sync to server if online
    if (this.api) {
      try {
        await this.api.saveCategoryColors(this.colors);
      } catch (error) {
        console.error('Failed to save category colors to server:', error);
      }
    }
  }

  getColor(category: string): number | undefined {
    return this.colors[category];
  }

  getAllColors(): Record<string, number> {
    return { ...this.colors };
  }
}

export const categoryColorsSync = new CategoryColorsSync();
