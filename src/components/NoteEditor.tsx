import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import TurndownService from 'turndown';
import { marked } from 'marked';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Note } from '../types';

interface NoteEditorProps {
  note: Note | null;
  onUpdateNote: (note: Note) => void;
  fontSize: number;
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

export function NoteEditor({ note, onUpdateNote, fontSize, onUnsavedChanges }: NoteEditorProps) {
  const [localTitle, setLocalTitle] = useState('');
  const [localFavorite, setLocalFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const previousNoteIdRef = useRef<number | null>(null);

  // Notify parent component when unsaved changes state changes
  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChanges]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Strike,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none p-6',
        style: `font-size: ${fontSize}px`,
      },
    },
    onUpdate: ({ editor }) => {
      setHasUnsavedChanges(true);
      
      if (!titleManuallyEdited) {
        const text = editor.getText();
        const firstLine = text.split('\n')[0].trim();
        if (firstLine) {
          setLocalTitle(firstLine.substring(0, 50));
        }
      }
    },
  });

  useEffect(() => {
    const loadNewNote = () => {
      if (note && editor) {
        setLocalTitle(note.title);
        setLocalFavorite(note.favorite);
        setHasUnsavedChanges(false);
        
        // Only reset titleManuallyEdited when switching to a different note
        // Check if the current title matches the first line of content
        const firstLine = note.content.split('\n')[0].replace(/^#+\s*/, '').trim();
        const titleMatchesFirstLine = note.title === firstLine || note.title === firstLine.substring(0, 50);
        setTitleManuallyEdited(!titleMatchesFirstLine);
        
        previousNoteIdRef.current = note.id;
        
        // Convert markdown to HTML using marked library
        const html = marked.parse(note.content || '', { async: false }) as string;
        editor.commands.setContent(html);
      }
    };

    // If switching notes, save the previous note first
    if (previousNoteIdRef.current !== null && previousNoteIdRef.current !== note?.id) {
      // Save if there are unsaved changes
      if (hasUnsavedChanges && editor) {
        handleSave();
      }
      // Load new note after a brief delay to ensure save completes
      setTimeout(loadNewNote, 100);
    } else {
      // First load or same note, load immediately
      loadNewNote();
    }
  }, [note?.id, editor]);

  const handleSave = () => {
    if (!note || !hasUnsavedChanges || !editor) return;
    
    // Convert HTML to markdown
    const html = editor.getHTML();
    const markdown = turndownService.turndown(html);
    
    console.log('Saving note content length:', markdown.length);
    console.log('Last 50 chars:', markdown.slice(-50));
    setIsSaving(true);
    setHasUnsavedChanges(false);
    onUpdateNote({
      ...note,
      title: localTitle,
      content: markdown,
      category: '',
      favorite: localFavorite,
    });
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleTitleChange = (value: string) => {
    setLocalTitle(value);
    setTitleManuallyEdited(true);
    setHasUnsavedChanges(true);
  };

  const handleDiscard = () => {
    if (!note || !editor) return;
    
    // Reload original note content
    setLocalTitle(note.title);
    setLocalFavorite(note.favorite);
    setHasUnsavedChanges(false);
    
    const firstLine = note.content.split('\n')[0].replace(/^#+\s*/, '').trim();
    const titleMatchesFirstLine = note.title === firstLine || note.title === firstLine.substring(0, 50);
    setTitleManuallyEdited(!titleMatchesFirstLine);
    
    const html = marked.parse(note.content || '', { async: false }) as string;
    editor.commands.setContent(html);
  };

  const handleExportPDF = async () => {
    if (!note || !editor) return;

    try {
      // Get the editor content element
      const editorElement = document.querySelector('.ProseMirror');
      if (!editorElement) return;

      // Create a temporary container with better styling for PDF
      const container = document.createElement('div');
      container.style.width = '210mm'; // A4 width
      container.style.padding = '20mm';
      container.style.backgroundColor = 'white';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.fontFamily = 'Arial, sans-serif';
      
      // Add title
      const titleElement = document.createElement('h1');
      titleElement.textContent = localTitle || 'Untitled';
      titleElement.style.marginBottom = '20px';
      titleElement.style.fontSize = '24px';
      titleElement.style.fontWeight = 'bold';
      container.appendChild(titleElement);
      
      // Clone and add content
      const contentClone = editorElement.cloneNode(true) as HTMLElement;
      contentClone.style.fontSize = '12px';
      contentClone.style.lineHeight = '1.6';
      container.appendChild(contentClone);
      
      document.body.appendChild(container);

      // Convert to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      // Remove temporary container
      document.body.removeChild(container);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Save the PDF
      const fileName = `${localTitle || 'note'}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handleFavoriteToggle = () => {
    setLocalFavorite(!localFavorite);
    if (note) {
      onUpdateNote({
        ...note,
        title: localTitle,
        content: editor ? turndownService.turndown(editor.getHTML()) : note.content,
        category: '',
        favorite: !localFavorite,
      });
    }
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white text-gray-400">
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

  if (!editor) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note Title"
          className="flex-1 text-2xl font-bold border-none outline-none focus:ring-0 bg-transparent text-gray-900 dark:text-gray-100"
        />
        
        <div className="flex items-center space-x-2 ml-4">
          {hasUnsavedChanges && (
            <span className="text-sm text-orange-500 dark:text-orange-400">Unsaved changes</span>
          )}
          {isSaving && (
            <span className="text-sm text-gray-500 dark:text-gray-400">Saving...</span>
          )}
          
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={`p-2 rounded-lg transition-colors ${
              hasUnsavedChanges && !isSaving
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
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
            className={`p-2 rounded-lg transition-colors ${
              hasUnsavedChanges && !isSaving
                ? 'bg-gray-500 dark:bg-gray-600 text-white hover:bg-gray-600 dark:hover:bg-gray-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
            title="Discard Changes"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <button
            onClick={handleExportPDF}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
            title="Export as PDF"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          <button
            onClick={handleFavoriteToggle}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={localFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <svg 
              className={`w-6 h-6 ${localFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400 dark:text-gray-500'}`}
              fill={localFavorite ? "currentColor" : "none"}
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('bold') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Bold"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.5,15.5H10V12.5H13.5A1.5,1.5 0 0,1 15,14A1.5,1.5 0 0,1 13.5,15.5M10,6.5H13A1.5,1.5 0 0,1 14.5,8A1.5,1.5 0 0,1 13,9.5H10M15.6,10.79C16.57,10.11 17.25,9 17.25,8C17.25,5.74 15.5,4 13.25,4H7V18H14.04C16.14,18 17.75,16.3 17.75,14.21C17.75,12.69 16.89,11.39 15.6,10.79Z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('italic') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Italic"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10,4V7H12.21L8.79,15H6V18H14V15H11.79L15.21,7H18V4H10Z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('strike') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Strikethrough"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3,14H21V12H3M5,4V7H10V10H14V7H19V4M10,19H14V16H10V19Z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('underline') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Underline"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5,21H19V19H5V21M12,17A6,6 0 0,0 18,11V3H15.5V11A3.5,3.5 0 0,1 12,14.5A3.5,3.5 0 0,1 8.5,11V3H6V11A6,6 0 0,0 12,17Z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded transition-colors font-bold text-sm ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Heading 1"
        >
          H1
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded transition-colors font-bold text-sm ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Heading 2"
        >
          H2
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded transition-colors font-bold text-sm ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Heading 3"
        >
          H3
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('bulletList') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Bullet List"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7,5H21V7H7V5M7,13V11H21V13H7M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M7,19V17H21V19H7M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('orderedList') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Numbered List"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7,13V11H21V13H7M7,19V17H21V19H7M7,7V5H21V7H7M3,8V5H2V4H4V8H3M2,17V16H5V20H2V19H4V18.5H3V17.5H4V17H2M4.25,10A0.75,0.75 0 0,1 5,10.75C5,10.95 4.92,11.14 4.79,11.27L3.12,13H5V14H2V13.08L4,11H2V10H4.25Z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('code') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Inline Code"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.5,18L3.5,13L8.5,8L9.91,9.41L6.33,13L9.91,16.59L8.5,18M15.5,18L14.09,16.59L17.67,13L14.09,9.41L15.5,8L20.5,13L15.5,18Z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('codeBlock') ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title="Code Block"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15,4V6H18V18H15V20H20V4M4,4V20H9V18H6V6H9V4H4Z" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
