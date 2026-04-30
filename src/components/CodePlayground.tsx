import React, { useState, useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { motion, AnimatePresence } from 'motion/react';

// Configure Monaco loader to minimize cross-origin issues inside iframes
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs'
  }
});
import { Play, RotateCcw, Terminal, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

interface CodePlaygroundProps {
  initialCode: string;
  title?: string;
  description?: string;
}

export const CodePlayground: React.FC<CodePlaygroundProps> = ({ 
  initialCode, 
  title = "Bac à sable JS",
  description = "Expérimentez avec les boucles ici"
}) => {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>('vs-light');

  const runCode = () => {
    setIsRunning(true);
    setError(null);
    setOutput([]);
    
    const startTime = performance.now();
    const logs: string[] = [];
    
    // Custom console.log to capture output
    const customConsole = {
      log: (...args: any[]) => {
        logs.push(args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
      error: (...args: any[]) => {
        logs.push(`Error: ${args.join(' ')}`);
      },
      warn: (...args: any[]) => {
        logs.push(`Warning: ${args.join(' ')}`);
      }
    };

    try {
      // Use a worker-like pattern or just a captured eval for simple demo
      // In a real app, we'd use a Web Worker for safety
      const wrappedCode = `
        (function(console) {
          try {
            ${code}
          } catch (e) {
            console.error(e.message);
          }
        })(customConsole);
      `;

      // Safe-ish execution with captured console
      const execute = new Function('customConsole', wrappedCode);
      execute(customConsole);
      
      const endTime = performance.now();
      setExecutionTime(endTime - startTime);
      setOutput(logs.length > 0 ? logs : ["(Aucune sortie)"]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    setCode(initialCode);
    setOutput([]);
    setError(null);
    setExecutionTime(null);
  };

  return (
    <div className="flex flex-col h-full max-h-[600px] border border-slate-200 rounded-2xl bg-white shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-primary/10 rounded-lg">
            <Play className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'vs-light' ? 'vs-dark' : 'vs-light')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            title={theme === 'vs-light' ? "Passer au thème sombre" : "Passer au thème clair"}
          >
            {theme === 'vs-light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button
            onClick={resetCode}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            title="Réinitialiser"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={runCode}
            disabled={isRunning}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold transition-all shadow-md active:scale-95",
              isRunning ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-800"
            )}
          >
            {isRunning ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>Exécuter</span>
          </button>
        </div>
      </div>

      {/* Editor & Output Container */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[400px]">
        {/* Editor Area */}
        <div className="flex-1 border-b md:border-b-0 md:border-r border-slate-100 h-1/2 md:h-auto overflow-hidden">
          <Editor
            height="100%"
            language="javascript"
            value={code}
            onChange={(value) => setCode(value || '')}
            theme={theme}
            loading={<div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs">Chargement de l'éditeur...</div>}
            onMount={(editor, monaco) => {
              // Register loop snippets for auto-completion
              monaco.languages.registerCompletionItemProvider('javascript', {
                provideCompletionItems: () => {
                  const suggestions = [
                    {
                      label: 'for-loop',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: [
                        'for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {',
                        '\t$0',
                        '}'
                      ].join('\n'),
                      insertTextRules: monaco.languages.CompletionItemInsertValueRule.InsertAsSnippet,
                      documentation: 'Boucle for standard'
                    },
                    {
                      label: 'while-loop',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: [
                        'while (${1:condition}) {',
                        '\t$0',
                        '}'
                      ].join('\n'),
                      insertTextRules: monaco.languages.CompletionItemInsertValueRule.InsertAsSnippet,
                      documentation: 'Boucle while'
                    },
                    {
                      label: 'do-while-loop',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: [
                        'do {',
                        '\t$0',
                        '} while (${1:condition});'
                      ].join('\n'),
                      insertTextRules: monaco.languages.CompletionItemInsertValueRule.InsertAsSnippet,
                      documentation: 'Boucle do...while'
                    },
                    {
                      label: 'clog',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: 'console.log($0);',
                      insertTextRules: monaco.languages.CompletionItemInsertValueRule.InsertAsSnippet,
                      documentation: 'Sortie console'
                    }
                  ];
                  return { suggestions };
                }
              });
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              suggestOnTriggerCharacters: true,
              wordBasedSuggestions: "currentDocument",
              quickSuggestions: { other: true, comments: false, strings: true },
              snippetSuggestions: "top"
            }}
          />
        </div>

        {/* Output Area */}
        <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col bg-slate-50 h-1/2 md:h-auto overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-100/50">
            <Terminal className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">Console</span>
            {executionTime && (
              <span className="ml-auto text-[10px] font-mono text-slate-400">
                {executionTime.toFixed(2)}ms
              </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
            <AnimatePresence mode="popLayout">
              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 text-red-600 p-3 bg-red-50 border border-red-100 rounded-xl"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </motion.div>
              ) : output.length > 0 ? (
                <div className="space-y-1.5">
                  {output.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="text-slate-700 flex items-start gap-3 whitespace-pre-wrap"
                    >
                      <span className="text-slate-400 select-none w-4 text-right">{i + 1}</span>
                      <span>{line}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                  <Play className="w-8 h-8 mb-2" />
                  <p>Appuyez sur "Exécuter" pour voir le résultat</p>
                </div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-100/50 flex items-center justify-between">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            {!error && output.length > 0 && (
              <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                EXEC_SUCCESS
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
