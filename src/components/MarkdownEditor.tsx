import React, { Suspense, lazy } from 'react';
import 'react-quill-new/dist/quill.snow.css';
import { cn } from '../lib/utils';

// Lazy load ReactQuill to avoid concurrent rendering issues with DOM-heavy components
const ReactQuill = lazy(() => import('react-quill-new'));

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  label?: string;
}

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link', 'image', 'video'],
    ['blockquote', 'code-block'],
    ['clean']
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'color', 'background',
  'link', 'image', 'video',
  'blockquote', 'code-block'
];

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  className,
  label
}) => {
  return (
    <div className={cn("w-full flex flex-col space-y-2 quill-editor-custom", className)} data-label={label}>
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <Suspense fallback={
          <div className="h-[200px] w-full bg-slate-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chargement de l'éditeur...</span>
            </div>
          </div>
        }>
          <ReactQuill 
            theme="snow"
            value={value || ''}
            onChange={(content) => {
              if (content !== value) {
                onChange(content);
              }
            }}
            modules={modules}
            formats={formats}
            placeholder={placeholder || 'Commencez à écrire...'}
            className="bg-white"
          />
        </Suspense>
      </div>
      <style>{`
        .quill-editor-custom .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
          padding: 0.75rem 1rem;
        }
        .quill-editor-custom .ql-container.ql-snow {
          border: none;
          min-height: 200px;
          font-family: inherit;
        }
        .quill-editor-custom .ql-editor {
          padding: 1.25rem 1.5rem;
          font-size: 0.875rem;
          line-height: 1.6;
          color: #334155;
        }
        .quill-editor-custom .ql-editor.ql-blank::before {
          color: #94a3b8;
          font-style: normal;
          left: 1.5rem;
        }
        .quill-editor-custom .ql-snow .ql-picker.ql-header {
          width: 120px;
        }
        .quill-editor-custom .ql-snow .ql-active {
          color: var(--brand-primary, #2563eb) !important;
        }
        .quill-editor-custom .ql-snow.ql-toolbar button:hover,
        .quill-editor-custom .ql-snow.ql-toolbar button.ql-active,
        .quill-editor-custom .ql-snow .ql-toolbar button:hover,
        .quill-editor-custom .ql-snow .ql-toolbar button.ql-active {
          color: #2563eb;
        }
        .quill-editor-custom .ql-snow.ql-toolbar button:hover .ql-stroke,
        .quill-editor-custom .ql-snow.ql-toolbar button.ql-active .ql-stroke {
          stroke: #2563eb;
        }
      `}</style>
      <p className="text-[10px] text-slate-400 font-medium px-2">Propulsé par Quill • Édition riche active</p>
    </div>
  );
};
