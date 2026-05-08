import React from 'react';
import { cn } from '../lib/utils';

interface CodeBlockProps {
  code: string;
  inline?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, inline }) => {
  if (inline) {
    return (
      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-brand-primary">
        {code}
      </code>
    );
  }
  
  return (
    <pre className="code-block my-4 max-w-full overflow-x-auto whitespace-pre-wrap break-all bg-slate-900 text-slate-100 p-4 rounded-xl shadow-inner font-mono text-sm leading-relaxed">
      <code className="block">{code}</code>
    </pre>
  );
};
