import { useEffect, useState, useRef, RefObject } from 'react';

type FormatType = 'bold' | 'italic' | 'strikethrough' | 'code' | 'codeblock' | 'quote' | 'ul' | 'ol' | 'link' | 'h1' | 'h2' | 'h3';

interface FloatingToolbarProps {
  onFormat: (format: FormatType) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function FloatingToolbar({ onFormat, textareaRef }: FloatingToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<FormatType>>(new Set());
  const toolbarRef = useRef<HTMLDivElement>(null);

  const detectActiveFormats = (text: string, fullContent: string, selectionStart: number): Set<FormatType> => {
    const formats = new Set<FormatType>();
    
    // Check inline formats
    if (/\*\*[^*]+\*\*/.test(text) || /__[^_]+__/.test(text)) formats.add('bold');
    if (/(?<!\*)\*[^*]+\*(?!\*)/.test(text) || /(?<!_)_[^_]+_(?!_)/.test(text)) formats.add('italic');
    if (/~~[^~]+~~/.test(text)) formats.add('strikethrough');
    if (/`[^`]+`/.test(text)) formats.add('code');
    if (/```[\s\S]*```/.test(text)) formats.add('codeblock');
    
    // Check line-based formats by looking at the line containing the selection
    const textBeforeSelection = fullContent.substring(0, selectionStart);
    const lineStart = textBeforeSelection.lastIndexOf('\n') + 1;
    const lineEnd = fullContent.indexOf('\n', selectionStart);
    const currentLine = fullContent.substring(lineStart, lineEnd === -1 ? fullContent.length : lineEnd);
    
    if (/^#{1}\s/.test(currentLine)) formats.add('h1');
    if (/^#{2}\s/.test(currentLine)) formats.add('h2');
    if (/^#{3}\s/.test(currentLine)) formats.add('h3');
    if (/^>\s/.test(currentLine)) formats.add('quote');
    if (/^[-*+]\s/.test(currentLine)) formats.add('ul');
    if (/^\d+\.\s/.test(currentLine)) formats.add('ol');
    if (/\[.+\]\(.+\)/.test(text)) formats.add('link');
    
    return formats;
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelectionChange = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      if (start === end) {
        setIsVisible(false);
        return;
      }

      // Get textarea position and calculate approximate selection position
      const textareaRect = textarea.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const fontSize = parseFloat(computedStyle.fontSize) || 16;
      
      // Get text before selection to calculate position
      const textBeforeSelection = textarea.value.substring(0, start);
      const lines = textBeforeSelection.split('\n');
      const currentLineIndex = lines.length - 1;
      const currentLineText = lines[currentLineIndex];
      
      // Approximate character width (monospace assumption)
      const charWidth = fontSize * 0.6;
      
      // Calculate position
      const scrollTop = textarea.scrollTop;
      const top = textareaRect.top + paddingTop + (currentLineIndex * lineHeight) - scrollTop - 56;
      const left = textareaRect.left + paddingLeft + (currentLineText.length * charWidth);

      const toolbarWidth = 320;
      let adjustedLeft = Math.max(10, Math.min(left - toolbarWidth / 2, window.innerWidth - toolbarWidth - 10));
      let adjustedTop = top;
      
      if (adjustedTop < 10) {
        adjustedTop = textareaRect.top + paddingTop + ((currentLineIndex + 1) * lineHeight) - scrollTop + 8;
      }

      setPosition({ top: adjustedTop, left: adjustedLeft });
      setIsVisible(true);
      
      // Detect active formats
      const selectedText = textarea.value.substring(start, end);
      const formats = detectActiveFormats(selectedText, textarea.value, start);
      setActiveFormats(formats);
    };

    const handleMouseUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        handleSelectionChange();
      }
    };

    const handleBlur = () => {
      // Delay hiding to allow button clicks to register
      setTimeout(() => {
        if (document.activeElement !== textarea && !toolbarRef.current?.contains(document.activeElement)) {
          setIsVisible(false);
        }
      }, 150);
    };

    textarea.addEventListener('mouseup', handleMouseUp);
    textarea.addEventListener('keyup', handleKeyUp);
    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('select', handleSelectionChange);

    return () => {
      textarea.removeEventListener('mouseup', handleMouseUp);
      textarea.removeEventListener('keyup', handleKeyUp);
      textarea.removeEventListener('blur', handleBlur);
      textarea.removeEventListener('select', handleSelectionChange);
    };
  }, [textareaRef]);

  if (!isVisible || !position) return null;

  const buttonClass = (format: FormatType) => `p-2 rounded transition-colors ${
    activeFormats.has(format)
      ? 'bg-blue-500 text-white'
      : 'hover:bg-gray-700 dark:hover:bg-gray-600 text-white'
  }`;

  const headingButtonClass = (format: FormatType) => `px-2 py-1 rounded font-bold text-xs transition-colors ${
    activeFormats.has(format)
      ? 'bg-blue-500 text-white'
      : 'hover:bg-gray-700 dark:hover:bg-gray-600 text-white'
  }`;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-gray-800 dark:bg-gray-700 rounded-lg shadow-xl px-2 py-2 flex items-center gap-0.5"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      {/* Text Formatting */}
      <button onClick={() => onFormat('bold')} className={buttonClass('bold')} title="Bold (⌘B)">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13.5,15.5H10V12.5H13.5A1.5,1.5 0 0,1 15,14A1.5,1.5 0 0,1 13.5,15.5M10,6.5H13A1.5,1.5 0 0,1 14.5,8A1.5,1.5 0 0,1 13,9.5H10M15.6,10.79C16.57,10.11 17.25,9 17.25,8C17.25,5.74 15.5,4 13.25,4H7V18H14.04C16.14,18 17.75,16.3 17.75,14.21C17.75,12.69 16.89,11.39 15.6,10.79Z" />
        </svg>
      </button>

      <button onClick={() => onFormat('italic')} className={buttonClass('italic')} title="Italic (⌘I)">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10,4V7H12.21L8.79,15H6V18H14V15H11.79L15.21,7H18V4H10Z" />
        </svg>
      </button>

      <button onClick={() => onFormat('strikethrough')} className={buttonClass('strikethrough')} title="Strikethrough">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3,14H21V12H3M5,4V7H10V10H14V7H19V4M10,19H14V16H10V19Z" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-600 mx-1"></div>

      {/* Code */}
      <button onClick={() => onFormat('code')} className={buttonClass('code')} title="Inline Code">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8.5,18L3.5,13L8.5,8L9.91,9.41L6.33,13L9.91,16.59L8.5,18M15.5,18L14.09,16.59L17.67,13L14.09,9.41L15.5,8L20.5,13L15.5,18Z" />
        </svg>
      </button>

      <button onClick={() => onFormat('codeblock')} className={buttonClass('codeblock')} title="Code Block">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-600 mx-1"></div>

      {/* Quote & Lists */}
      <button onClick={() => onFormat('quote')} className={buttonClass('quote')} title="Quote">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6,17H9L11,13V7H5V13H8L6,17M14,17H17L19,13V7H13V13H16L14,17Z" />
        </svg>
      </button>

      <button onClick={() => onFormat('ul')} className={buttonClass('ul')} title="Bullet List">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7,5H21V7H7V5M7,13V11H21V13H7M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M7,19V17H21V19H7M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z" />
        </svg>
      </button>

      <button onClick={() => onFormat('ol')} className={buttonClass('ol')} title="Numbered List">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7,13V11H21V13H7M7,19V17H21V19H7M7,7V5H21V7H7M3,8V5H2V4H4V8H3M2,17V16H5V20H2V19H4V18.5H3V17.5H4V17H2M4.25,10A0.75,0.75 0 0,1 5,10.75C5,10.95 4.92,11.14 4.79,11.27L3.12,13H5V14H2V13.08L4,11H2V10H4.25Z" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-600 mx-1"></div>

      {/* Link */}
      <button onClick={() => onFormat('link')} className={buttonClass('link')} title="Link">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-600 mx-1"></div>

      {/* Headings */}
      <button onClick={() => onFormat('h1')} className={headingButtonClass('h1')} title="Heading 1">H1</button>
      <button onClick={() => onFormat('h2')} className={headingButtonClass('h2')} title="Heading 2">H2</button>
      <button onClick={() => onFormat('h3')} className={headingButtonClass('h3')} title="Heading 3">H3</button>
    </div>
  );
}
