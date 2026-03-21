import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import jsPDF from 'jspdf';
import { message } from '@tauri-apps/plugin-dialog';
import { Note } from '../types';
import { NextcloudAPI } from '../api/nextcloud';
import { FloatingToolbar } from './FloatingToolbar';
import { InsertToolbar } from './InsertToolbar';

interface NoteEditorProps {
  note: Note | null;
  onUpdateNote: (note: Note) => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  categories: string[];
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  editorFont?: string;
  editorFontSize?: number;
  previewFont?: string;
  previewFontSize?: number;
  api?: NextcloudAPI | null;
}

const imageCache = new Map<string, string>();


export function NoteEditor({ note, onUpdateNote, onUnsavedChanges, categories, isFocusMode, onToggleFocusMode, editorFont = 'Source Code Pro', editorFontSize = 14, previewFont = 'Merriweather', previewFontSize = 16, api }: NoteEditorProps) {
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [localCategory, setLocalCategory] = useState('');
  const [localFavorite, setLocalFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [processedContent, setProcessedContent] = useState('');
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const previousNoteIdRef = useRef<number | null>(null);
  const previousNoteContentRef = useRef<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChanges]);

  // Handle Escape key to exit focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode && onToggleFocusMode) {
        onToggleFocusMode();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, onToggleFocusMode]);

  // Auto-resize textarea when content changes, switching from preview to edit, or font size changes
  useEffect(() => {
    if (textareaRef.current && !isPreviewMode) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (textareaRef.current) {
          // Save cursor position and scroll position
          const cursorPosition = textareaRef.current.selectionStart;
          const scrollTop = textareaRef.current.scrollTop;
          
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
          
          // Restore cursor position and scroll position
          textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
          textareaRef.current.scrollTop = scrollTop;
        }
      }, 0);
    }
  }, [localContent, isPreviewMode, editorFontSize]);

  // Process images when entering preview mode or content changes
  useEffect(() => {
    if (!isPreviewMode || !note || !api) {
      setProcessedContent(localContent);
      return;
    }

    // Guard: Only process if localContent has been updated for the current note
    // This prevents processing stale content from the previous note
    if (previousNoteIdRef.current !== note.id) {
      console.log(`[Note ${note.id}] Skipping image processing - waiting for content to sync (previousNoteIdRef: ${previousNoteIdRef.current})`);
      return;
    }

    const processImages = async () => {
      console.log(`[Note ${note.id}] Processing images in preview mode. Content length: ${localContent.length}`);
      setIsLoadingImages(true);
      setProcessedContent(''); // Clear old content immediately
      
      // Find all image references in markdown: ![alt](path)
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let content = localContent;
      const matches = [...localContent.matchAll(imageRegex)];
      console.log(`[Note ${note.id}] Found ${matches.length} images to process`);
      
      for (const match of matches) {
        const [fullMatch, alt, imagePath] = match;
        
        // Skip external URLs (http/https)
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
          continue;
        }
        
        // Check cache first
        const cacheKey = `${note.id}:${imagePath}`;
        if (imageCache.has(cacheKey)) {
          const dataUrl = imageCache.get(cacheKey)!;
          content = content.replace(fullMatch, `![${alt}](${dataUrl})`);
          continue;
        }
        
        try {
          const dataUrl = await api.fetchAttachment(note.id, imagePath, note.category);
          imageCache.set(cacheKey, dataUrl);
          content = content.replace(fullMatch, `![${alt}](${dataUrl})`);
        } catch (error) {
          console.error(`Failed to fetch attachment: ${imagePath}`, error);
          // Keep original path, image will show as broken
        }
      }
      
      setProcessedContent(content);
      setIsLoadingImages(false);
    };

    processImages();
  }, [isPreviewMode, localContent, note?.id, api]);

  useEffect(() => {
    const loadNewNote = () => {
      if (note) {
        setLocalTitle(note.title);
        setLocalContent(note.content);
        setLocalCategory(note.category || '');
        setLocalFavorite(note.favorite);
        setHasUnsavedChanges(false);
        setIsPreviewMode(false);
        setProcessedContent(''); // Clear preview content immediately
        
        const firstLine = note.content.split('\n')[0].replace(/^#+\s*/, '').trim();
        const titleMatchesFirstLine = note.title === firstLine || note.title === firstLine.substring(0, 50);
        setTitleManuallyEdited(!titleMatchesFirstLine);
        
        previousNoteIdRef.current = note.id;
        previousNoteContentRef.current = note.content;
      }
    };

    // Switching to a different note
    if (previousNoteIdRef.current !== null && previousNoteIdRef.current !== note?.id) {
      console.log(`Switching from note ${previousNoteIdRef.current} to note ${note?.id}`);
      setProcessedContent('');
      if (hasUnsavedChanges) {
        handleSave();
      }
      loadNewNote();
    } 
    // Same note but content changed from server (and no unsaved local changes)
    else if (note && previousNoteIdRef.current === note.id && !hasUnsavedChanges && previousNoteContentRef.current !== note.content) {
      console.log(`Note ${note.id} content changed from server (prev: ${previousNoteContentRef.current.length} chars, new: ${note.content.length} chars)`);
      loadNewNote();
    }
    // Initial load
    else if (!note || previousNoteIdRef.current === null) {
      loadNewNote();
    }
  }, [note?.id, note?.content, note?.modified]);

  const handleSave = () => {
    if (!note || !hasUnsavedChanges) return;
    
    console.log('Saving note content length:', localContent.length);
    console.log('Last 50 chars:', localContent.slice(-50));
    setIsSaving(true);
    setHasUnsavedChanges(false);
    onUpdateNote({
      ...note,
      title: localTitle,
      content: localContent,
      category: localCategory,
      favorite: localFavorite,
    });
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleTitleChange = (value: string) => {
    setLocalTitle(value);
    setTitleManuallyEdited(true);
    setHasUnsavedChanges(true);
  };

  const handleContentChange = (value: string) => {
    setLocalContent(value);
    setHasUnsavedChanges(true);
    
    if (!titleManuallyEdited) {
      const firstLine = value.split('\n')[0].replace(/^#+\s*/, '').trim();
      if (firstLine) {
        setLocalTitle(firstLine.substring(0, 50));
      }
    }
  };

  const handleDiscard = () => {
    if (!note) return;
    
    setLocalTitle(note.title);
    setLocalContent(note.content);
    setLocalCategory(note.category || '');
    setLocalFavorite(note.favorite);
    setHasUnsavedChanges(false);
    
    const firstLine = note.content.split('\n')[0].replace(/^#+\s*/, '').trim();
    const titleMatchesFirstLine = note.title === firstLine || note.title === firstLine.substring(0, 50);
    setTitleManuallyEdited(!titleMatchesFirstLine);
  };

  const handleExportPDF = async () => {
    if (!note) return;

    setIsExportingPDF(true);

    try {
      const container = document.createElement('div');
      container.style.fontFamily = `"${previewFont}", Georgia, serif`;
      container.style.fontSize = '12px';
      container.style.lineHeight = '1.6';
      container.style.color = '#000000';
      
      const titleElement = document.createElement('h1');
      titleElement.textContent = localTitle || 'Untitled';
      titleElement.style.marginTop = '0';
      titleElement.style.marginBottom = '20px';
      titleElement.style.fontSize = '24px';
      titleElement.style.fontWeight = 'bold';
      titleElement.style.color = '#000000';
      titleElement.style.textAlign = 'center';
      titleElement.style.fontFamily = `"${previewFont}", Georgia, serif`;
      container.appendChild(titleElement);
      
      const contentElement = document.createElement('div');
      const html = marked.parse(localContent || '', { async: false }) as string;
      contentElement.innerHTML = html;
      contentElement.style.fontSize = '12px';
      contentElement.style.lineHeight = '1.6';
      contentElement.style.color = '#000000';
      container.appendChild(contentElement);
      
      // Apply monospace font to code elements
      const style = document.createElement('style');
      style.textContent = `
        code, pre { font-family: "Source Code Pro", ui-monospace, monospace !important; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { background: #f0f0f0; padding: 2px 4px; border-radius: 2px; }
      `;
      container.appendChild(style);

      // Create PDF using jsPDF's html() method (like dompdf)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Use jsPDF's html() method which handles pagination automatically
      await pdf.html(container, {
        callback: async (doc) => {
          // Save the PDF
          const fileName = `${localTitle || 'note'}.pdf`;
          doc.save(fileName);
          
          // Show success message using Tauri dialog
          setTimeout(async () => {
            try {
              await message(`PDF exported successfully!\n\nFile: ${fileName}\nLocation: Downloads folder`, {
                title: 'Export Complete',
                kind: 'info',
              });
            } catch (err) {
              console.log('Dialog shown successfully or not available');
            }
            setIsExportingPDF(false);
          }, 500);
        },
        margin: [20, 20, 20, 20], // top, right, bottom, left margins in mm
        autoPaging: 'text', // Enable automatic page breaks
        width: 170, // Content width in mm (A4 width 210mm - 40mm margins)
        windowWidth: 650, // Rendering width in pixels (matches content width ratio)
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      try {
        await message('Failed to export PDF. Please try again.', {
          title: 'Export Failed',
          kind: 'error',
        });
      } catch (err) {
        console.error('Could not show error dialog');
      }
      setIsExportingPDF(false);
    }
  };

  const handleFavoriteToggle = () => {
    setLocalFavorite(!localFavorite);
    if (note) {
      onUpdateNote({
        ...note,
        title: localTitle,
        content: localContent,
        category: localCategory,
        favorite: !localFavorite,
      });
    }
  };

  const handleCategoryChange = (category: string) => {
    setLocalCategory(category);
    setHasUnsavedChanges(true);
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !note || !api) return;

    setIsUploading(true);
    try {
      const relativePath = await api.uploadAttachment(note.id, file, note.category);
      
      // Determine if it's an image or other file
      const isImage = file.type.startsWith('image/');
      const markdownLink = isImage 
        ? `![${file.name}](${relativePath})`
        : `[${file.name}](${relativePath})`;
      
      // Insert at cursor position or end of content
      const textarea = textareaRef.current;
      if (textarea) {
        const cursorPos = textarea.selectionStart;
        const newContent = localContent.slice(0, cursorPos) + markdownLink + localContent.slice(cursorPos);
        setLocalContent(newContent);
        setHasUnsavedChanges(true);
        
        // Move cursor after inserted text
        setTimeout(() => {
          textarea.focus();
          const newPos = cursorPos + markdownLink.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      } else {
        // Append to end
        setLocalContent(localContent + '\n' + markdownLink);
        setHasUnsavedChanges(true);
      }
      
      await message(`Attachment uploaded successfully!`, {
        title: 'Upload Complete',
        kind: 'info',
      });
    } catch (error) {
      console.error('Upload failed:', error);
      await message(`Failed to upload attachment: ${error}`, {
        title: 'Upload Failed',
        kind: 'error',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInsertLink = (text: string, url: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    const markdownLink = `[${text}](${url})`;
    const newContent = localContent.slice(0, cursorPos) + markdownLink + localContent.slice(cursorPos);
    setLocalContent(newContent);
    setHasUnsavedChanges(true);
    
    setTimeout(() => {
      textarea.focus();
      const newPos = cursorPos + markdownLink.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleInsertFile = () => {
    fileInputRef.current?.click();
  };

  const handleFormat = (format: 'bold' | 'italic' | 'strikethrough' | 'code' | 'codeblock' | 'quote' | 'ul' | 'ol' | 'link' | 'h1' | 'h2' | 'h3') => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localContent.substring(start, end);
    
    if (!selectedText) return;
    
    let formattedText = '';
    let cursorOffset = 0;
    let isRemoving = false;
    
    // Helper to check and remove inline formatting
    const toggleInline = (text: string, wrapper: string): { result: string; removed: boolean } => {
      const escaped = wrapper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}(.+)${escaped}$`, 's');
      const match = text.match(regex);
      if (match) {
        return { result: match[1], removed: true };
      }
      return { result: `${wrapper}${text}${wrapper}`, removed: false };
    };
    
    // Helper to check and remove line-prefix formatting
    const toggleLinePrefix = (text: string, prefixRegex: RegExp, addPrefix: (line: string, i: number) => string): { result: string; removed: boolean } => {
      const lines = text.split('\n');
      const allHavePrefix = lines.every(line => prefixRegex.test(line));
      if (allHavePrefix) {
        return { 
          result: lines.map(line => line.replace(prefixRegex, '')).join('\n'), 
          removed: true 
        };
      }
      return { 
        result: lines.map((line, i) => addPrefix(line, i)).join('\n'), 
        removed: false 
      };
    };
    
    switch (format) {
      case 'bold': {
        const { result, removed } = toggleInline(selectedText, '**');
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'italic': {
        const { result, removed } = toggleInline(selectedText, '*');
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'strikethrough': {
        const { result, removed } = toggleInline(selectedText, '~~');
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'code': {
        const { result, removed } = toggleInline(selectedText, '`');
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'codeblock': {
        const codeBlockMatch = selectedText.match(/^```\n?([\s\S]*?)\n?```$/);
        if (codeBlockMatch) {
          formattedText = codeBlockMatch[1];
          isRemoving = true;
        } else {
          formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
        }
        break;
      }
      case 'quote': {
        const { result, removed } = toggleLinePrefix(selectedText, /^>\s?/, (line) => `> ${line}`);
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'ul': {
        const { result, removed } = toggleLinePrefix(selectedText, /^[-*+]\s/, (line) => `- ${line}`);
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'ol': {
        const { result, removed } = toggleLinePrefix(selectedText, /^\d+\.\s/, (line, i) => `${i + 1}. ${line}`);
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'link': {
        const linkMatch = selectedText.match(/^\[(.+)\]\((.+)\)$/);
        if (linkMatch) {
          formattedText = linkMatch[1]; // Just return the text part
          isRemoving = true;
        } else {
          formattedText = `[${selectedText}](url)`;
          cursorOffset = formattedText.length - 4;
        }
        break;
      }
      case 'h1': {
        const { result, removed } = toggleLinePrefix(selectedText, /^#\s/, (line) => `# ${line}`);
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'h2': {
        const { result, removed } = toggleLinePrefix(selectedText, /^##\s/, (line) => `## ${line}`);
        formattedText = result;
        isRemoving = removed;
        break;
      }
      case 'h3': {
        const { result, removed } = toggleLinePrefix(selectedText, /^###\s/, (line) => `### ${line}`);
        formattedText = result;
        isRemoving = removed;
        break;
      }
    }
    
    const newContent = localContent.substring(0, start) + formattedText + localContent.substring(end);
    setLocalContent(newContent);
    setHasUnsavedChanges(true);
    
    setTimeout(() => {
      textarea.focus();
      if (format === 'link' && !isRemoving) {
        // Select "url" for easy replacement
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset + 3);
      } else {
        textarea.setSelectionRange(start, start + formattedText.length);
      }
    }, 0);
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 text-gray-400">
        <div className="text-center">
          <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No Note Selected</p>
          <p className="text-sm mt-2">Select a note from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={localTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Note Title"
              className="w-full text-2xl font-semibold border-none outline-none focus:ring-0 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>
          
          <button
            onClick={handleFavoriteToggle}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
            title={localFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <svg 
              className={`w-5 h-5 ${localFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400 dark:text-gray-500'}`}
              fill={localFavorite ? "currentColor" : "none"}
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Category Selector */}
            <div className="relative">
              <select
                value={localCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-700 border-0 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-colors"
              >
                <option value="">No Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <svg className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Attachment Upload */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleAttachmentUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isPreviewMode}
              className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 text-sm ${
                isUploading || isPreviewMode
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={isPreviewMode ? "Switch to Edit mode to upload" : "Upload Image/Attachment"}
            >
              {isUploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Attach</span>
                </>
              )}
            </button>

            {/* Preview Toggle */}
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 text-sm ${
                isPreviewMode 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={isPreviewMode ? "Edit Mode" : "Preview Mode"}
            >
              {isPreviewMode ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Preview</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Status */}
            {(hasUnsavedChanges || isSaving) && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                isSaving 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' 
                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
              }`}>
                {isSaving ? 'Saving...' : 'Unsaved'}
              </span>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
                className={`p-1.5 rounded-lg transition-colors ${
                  hasUnsavedChanges && !isSaving
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
                title="Save Note"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>

              <button
                onClick={handleDiscard}
                disabled={!hasUnsavedChanges || isSaving}
                className={`p-1.5 rounded-lg transition-colors ${
                  hasUnsavedChanges && !isSaving
                    ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
                title="Discard Changes"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className={`p-1.5 rounded-lg transition-colors ${
                  isExportingPDF
                    ? 'text-blue-500 cursor-wait'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={isExportingPDF ? "Generating PDF..." : "Export as PDF"}
              >
                {isExportingPDF ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </button>

              {/* Focus Mode Toggle */}
              {onToggleFocusMode && (
                <button
                  onClick={onToggleFocusMode}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isFocusMode
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={isFocusMode ? "Exit Focus Mode (Esc)" : "Focus Mode"}
                >
                  {isFocusMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className={`min-h-full ${isFocusMode ? 'max-w-3xl mx-auto w-full' : ''}`}>
          {isPreviewMode ? (
            <div className="relative">
              {isLoadingImages && (
                <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full shadow-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading images...
                </div>
              )}
              <div 
                className={`prose prose-slate dark:prose-invert p-8 ${isFocusMode ? '' : 'max-w-none'} [&_code]:font-mono [&_pre]:font-mono [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-md`}
                style={{ fontSize: `${previewFontSize}px`, fontFamily: previewFont }}
                dangerouslySetInnerHTML={{ 
                  __html: marked.parse(processedContent || '', { async: false }) as string 
                }}
              />
            </div>
          ) : (
            <div className="min-h-full p-8">
              <FloatingToolbar onFormat={handleFormat} textareaRef={textareaRef} />
              <InsertToolbar 
                textareaRef={textareaRef} 
                onInsertLink={handleInsertLink} 
                onInsertFile={handleInsertFile}
                isUploading={isUploading}
              />
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={(e) => {
                  handleContentChange(e.target.value);
                  // Auto-resize textarea to fit content
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                className="w-full resize-none border-none outline-none focus:ring-0 bg-transparent text-gray-900 dark:text-gray-100 overflow-hidden"
                style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.6', minHeight: '100%', fontFamily: editorFont }}
                placeholder="Start writing in markdown..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
