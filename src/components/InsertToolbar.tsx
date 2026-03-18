import { useEffect, useState, useRef, RefObject } from 'react';

interface InsertToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInsertLink: (text: string, url: string) => void;
  onInsertFile: () => void;
  isUploading?: boolean;
}

interface LinkModalState {
  isOpen: boolean;
  text: string;
  url: string;
}

export function InsertToolbar({ textareaRef, onInsertLink, onInsertFile, isUploading }: InsertToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [linkModal, setLinkModal] = useState<LinkModalState>({ isOpen: false, text: '', url: '' });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const updatePosition = () => {
      const textarea = textareaRef.current;
      if (!textarea || linkModal.isOpen) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Only show when cursor is placed (no selection)
      if (start !== end) {
        setIsVisible(false);
        return;
      }

      const textareaRect = textarea.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const fontSize = parseFloat(computedStyle.fontSize) || 16;
      
      const textBeforeCursor = textarea.value.substring(0, start);
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      const currentLineText = lines[currentLineIndex];
      
      const charWidth = fontSize * 0.6;
      const scrollTop = textarea.scrollTop;
      
      // Position to the right of cursor
      const top = textareaRect.top + paddingTop + (currentLineIndex * lineHeight) - scrollTop + lineHeight / 2;
      const left = textareaRect.left + paddingLeft + (currentLineText.length * charWidth) + 20;

      // Keep toolbar within viewport
      const toolbarWidth = 100;
      const adjustedLeft = Math.min(left, window.innerWidth - toolbarWidth - 20);
      let adjustedTop = top - 16; // Center vertically with cursor line
      
      if (adjustedTop < 10) {
        adjustedTop = 10;
      }

      setPosition({ top: adjustedTop, left: adjustedLeft });
      setIsVisible(true);
    };

    const handleClick = () => {
      setTimeout(updatePosition, 10);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Update on arrow keys or other navigation
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        updatePosition();
      }
    };

    const handleInput = () => {
      // Hide briefly during typing, show after a pause
      setIsVisible(false);
    };

    const handleBlur = () => {
      // Don't hide if clicking on toolbar or modal
      setTimeout(() => {
        const activeElement = document.activeElement;
        if (
          activeElement !== textarea && 
          !toolbarRef.current?.contains(activeElement) &&
          !modalRef.current?.contains(activeElement)
        ) {
          setIsVisible(false);
        }
      }, 150);
    };

    textarea.addEventListener('click', handleClick);
    textarea.addEventListener('keyup', handleKeyUp);
    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('blur', handleBlur);

    return () => {
      textarea.removeEventListener('click', handleClick);
      textarea.removeEventListener('keyup', handleKeyUp);
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('blur', handleBlur);
    };
  }, [textareaRef, linkModal.isOpen]);

  const handleLinkClick = () => {
    setLinkModal({ isOpen: true, text: '', url: '' });
    setTimeout(() => urlInputRef.current?.focus(), 50);
  };

  const handleLinkSubmit = () => {
    if (linkModal.url) {
      onInsertLink(linkModal.text || linkModal.url, linkModal.url);
      setLinkModal({ isOpen: false, text: '', url: '' });
      setIsVisible(false);
      textareaRef.current?.focus();
    }
  };

  const handleLinkCancel = () => {
    setLinkModal({ isOpen: false, text: '', url: '' });
    textareaRef.current?.focus();
  };

  const handleFileClick = () => {
    onInsertFile();
    setIsVisible(false);
  };

  if (!isVisible || !position) return null;

  // Link Modal
  if (linkModal.isOpen) {
    return (
      <div
        ref={modalRef}
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-72"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Insert Link</div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
            <input
              ref={urlInputRef}
              type="url"
              value={linkModal.url}
              onChange={(e) => setLinkModal({ ...linkModal, url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLinkSubmit();
                if (e.key === 'Escape') handleLinkCancel();
              }}
              placeholder="https://example.com"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Text (optional)</label>
            <input
              type="text"
              value={linkModal.text}
              onChange={(e) => setLinkModal({ ...linkModal, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLinkSubmit();
                if (e.key === 'Escape') handleLinkCancel();
              }}
              placeholder="Link text"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleLinkCancel}
            className="px-3 py-1.5 text-sm rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleLinkSubmit}
            disabled={!linkModal.url}
            className="px-3 py-1.5 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert
          </button>
        </div>
      </div>
    );
  }

  // Insert Toolbar
  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-gray-800 dark:bg-gray-700 rounded-lg shadow-xl px-1 py-1 flex items-center gap-0.5"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <button
        onClick={handleLinkClick}
        className="p-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600 text-white transition-colors"
        title="Insert Link"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>
      
      <button
        onClick={handleFileClick}
        disabled={isUploading}
        className={`p-2 rounded transition-colors ${
          isUploading 
            ? 'text-gray-500 cursor-not-allowed' 
            : 'hover:bg-gray-700 dark:hover:bg-gray-600 text-white'
        }`}
        title="Insert Image/File"
      >
        {isUploading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
