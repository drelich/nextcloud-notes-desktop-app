import { useState, useEffect, useRef } from 'react';
import { categoryColorsSync } from '../services/categoryColorsSync';

const EDITOR_FONTS = [
  { name: 'Source Code Pro', value: 'Source Code Pro' },
  { name: 'Roboto Mono', value: 'Roboto Mono' },
  { name: 'Inconsolata', value: 'Inconsolata' },
  { name: 'System Mono', value: 'ui-monospace, monospace' },
];

const PREVIEW_FONTS = [
  { name: 'Merriweather', value: 'Merriweather' },
  { name: 'Crimson Pro', value: 'Crimson Pro' },
  { name: 'Roboto Serif', value: 'Roboto Serif' },
  { name: 'Average', value: 'Average' },
  { name: 'System Serif', value: 'ui-serif, Georgia, serif' },
];

interface CategoriesSidebarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  username: string;
  onLogout: () => void;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  editorFont: string;
  onEditorFontChange: (font: string) => void;
  editorFontSize: number;
  onEditorFontSizeChange: (size: number) => void;
  previewFont: string;
  onPreviewFontChange: (font: string) => void;
  previewFontSize: number;
  onPreviewFontSizeChange: (size: number) => void;
}

const CATEGORY_COLORS = [
  { name: 'Blue', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', preview: '#dbeafe', dot: '#3b82f6' },
  { name: 'Green', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', preview: '#dcfce7', dot: '#22c55e' },
  { name: 'Purple', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', preview: '#f3e8ff', dot: '#a855f7' },
  { name: 'Pink', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', preview: '#fce7f3', dot: '#ec4899' },
  { name: 'Yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', preview: '#fef9c3', dot: '#eab308' },
  { name: 'Red', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', preview: '#fee2e2', dot: '#ef4444' },
  { name: 'Orange', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', preview: '#ffedd5', dot: '#f97316' },
  { name: 'Teal', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', preview: '#ccfbf1', dot: '#14b8a6' },
  { name: 'Indigo', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', preview: '#e0e7ff', dot: '#6366f1' },
  { name: 'Cyan', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', preview: '#cffafe', dot: '#06b6d4' },
];

export function CategoriesSidebar({ 
  categories, 
  selectedCategory, 
  onSelectCategory,
  onCreateCategory,
  onRenameCategory,
  isCollapsed,
  onToggleCollapse,
  username,
  onLogout,
  theme,
  onThemeChange,
  editorFont,
  onEditorFontChange,
  editorFontSize,
  onEditorFontSizeChange,
  previewFont,
  onPreviewFontChange,
  previewFontSize,
  onPreviewFontSizeChange,
}: CategoriesSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState('');
  const [categoryColors, setCategoryColors] = useState<Record<string, number>>(() => categoryColorsSync.getAllColors());
  const [colorPickerCategory, setColorPickerCategory] = useState<string | null>(null);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleColorChange = () => {
      setCategoryColors(categoryColorsSync.getAllColors());
    };
    
    categoryColorsSync.setChangeCallback(handleColorChange);
    window.addEventListener('categoryColorChanged', handleColorChange);
    
    return () => {
      window.removeEventListener('categoryColorChanged', handleColorChange);
    };
  }, []);

  const setCategoryColor = async (category: string, colorIndex: number | null) => {
    await categoryColorsSync.setColor(category, colorIndex);
    setColorPickerCategory(null);
  };

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    if (renamingCategory && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingCategory]);

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      onCreateCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCreating(false);
    }
  };

  const handleRenameCategory = () => {
    if (renameCategoryValue.trim() && renamingCategory && renameCategoryValue.trim() !== renamingCategory) {
      onRenameCategory(renamingCategory, renameCategoryValue.trim());
    }
    setRenamingCategory(null);
    setRenameCategoryValue('');
  };

  const startRenaming = (category: string) => {
    setRenamingCategory(category);
    setRenameCategoryValue(category);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateCategory();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewCategoryName('');
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameCategory();
    } else if (e.key === 'Escape') {
      setRenamingCategory(null);
      setRenameCategoryValue('');
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 border-r border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors group relative"
        title="Show Categories"
      >
        <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Categories</h2>
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Collapse"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Category
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          <button
            onClick={() => onSelectCategory('')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center ${
              selectedCategory === '' 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm font-medium">All Notes</span>
          </button>

          {categories.map((category) => (
            renamingCategory === category ? (
              <div key={category} className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-blue-500">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameCategoryValue}
                    onChange={(e) => setRenameCategoryValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleRenameCategory}
                    className="flex-1 text-sm px-2 py-1 border-none bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                  />
                </div>
                <div className="px-3 text-xs text-gray-500 dark:text-gray-400">
                  Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">Enter</kbd> to save, <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">Esc</kbd> to cancel
                </div>
              </div>
            ) : (
              <div key={category} className="relative">
                <div
                  className={`group w-full px-3 py-2 rounded-lg transition-colors flex items-center ${
                    selectedCategory === category 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <button
                    onClick={() => onSelectCategory(category)}
                    className="flex items-center flex-1 min-w-0 text-left"
                  >
                    {(() => {
                      const colorIndex = categoryColors[category];
                      const color = colorIndex !== undefined ? CATEGORY_COLORS[colorIndex] : null;
                      return (
                        <svg 
                          className="w-4 h-4 mr-2 flex-shrink-0" 
                          fill={color ? color.dot : "currentColor"}
                          viewBox="0 0 24 24"
                        >
                          <path d="M3 7c0-1.1.9-2 2-2h4l2 2h6c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7z" />
                        </svg>
                      );
                    })()}
                    <span className="text-sm truncate">{category}</span>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColorPickerCategory(colorPickerCategory === category ? null : category);
                      }}
                      className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded flex-shrink-0"
                      title="Change color"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenaming(category);
                      }}
                      className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded flex-shrink-0"
                      title="Rename category"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                </div>
                {colorPickerCategory === category && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-2 z-10">
                    <div className="grid grid-cols-5 gap-1.5 mb-2">
                      {CATEGORY_COLORS.map((color, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCategoryColor(category, idx)}
                          className="w-7 h-7 rounded hover:scale-110 transition-transform border-2 border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: color.preview }}
                          title={color.name}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setCategoryColor(category, null)}
                      className="w-full text-xs py-1.5 px-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200 transition-colors"
                    >
                      Remove Color
                    </button>
                  </div>
                )}
              </div>
            )
          ))}

          {isCreating && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (newCategoryName.trim()) {
                    handleCreateCategory();
                  } else {
                    setIsCreating(false);
                  }
                }}
                placeholder="Category name..."
                className="flex-1 text-sm px-0 py-0 border-none bg-transparent text-gray-900 dark:text-gray-100 focus:ring-0 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* User Info and Settings */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate font-medium">{username}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              title={isSettingsCollapsed ? "Show Settings" : "Hide Settings"}
            >
              <svg className={`w-4 h-4 text-gray-600 dark:text-gray-300 transition-transform ${isSettingsCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              title="Logout"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
        
        {!isSettingsCollapsed && (
          <div className="px-4 pb-4">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Theme</span>
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => onThemeChange('light')}
              className={`p-1.5 rounded transition-colors ${
                theme === 'light' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Light mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className={`p-1.5 rounded transition-colors ${
                theme === 'dark' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Dark mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
            <button
              onClick={() => onThemeChange('system')}
              className={`p-1.5 rounded transition-colors ${
                theme === 'system' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="System theme"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

            {/* Font Settings */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fonts</span>
          
              {/* Editor Font */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Editor</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={editorFont}
                    onChange={(e) => onEditorFontChange(e.target.value)}
                    className="flex-1 min-w-0 text-sm px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    style={{ fontFamily: editorFont }}
                  >
                    {EDITOR_FONTS.map((font) => (
                      <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editorFontSize}
                    onChange={(e) => onEditorFontSizeChange(parseInt(e.target.value, 10))}
                    className="w-16 flex-shrink-0 text-sm px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer text-center"
                  >
                    {[12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview Font */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Preview</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={previewFont}
                    onChange={(e) => onPreviewFontChange(e.target.value)}
                    className="flex-1 min-w-0 text-sm px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    style={{ fontFamily: previewFont }}
                  >
                    {PREVIEW_FONTS.map((font) => (
                      <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={previewFontSize}
                    onChange={(e) => onPreviewFontSizeChange(parseInt(e.target.value, 10))}
                    className="w-16 flex-shrink-0 text-sm px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer text-center"
                  >
                    {[12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
