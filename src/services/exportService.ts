// Contenu de /src/services/exportService.ts amélioré
import PptxGenJS from 'pptxgenjs';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface SlideData {
  id?: string;
  order: number;
  title: string;
  content: any;
  image?: string;
  bgColor?: string;
  isPlayground?: boolean;
  initialCode?: string;
  isQuiz?: boolean;
  quizQuestions?: QuizQuestion[];
  isQA?: boolean;
}

interface PresentationData {
  id: string;
  title: string;
  description?: string;
  course?: string;
  owner_id: string;
}

/**
 * Fonction utilitaire pour parser sommairement le HTML vers des objets PPTX riches
 */
const parseHtmlToPptxText = (html: string) => {
  if (!html) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const textObjects: any[] = [];

  const traverseNodes = (node: Node, currentOptions: any = {}) => {
    node.childNodes.forEach(child => {
      let options = { ...currentOptions };

      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Gestion des styles par tag
        if (tag === 'strong' || tag === 'b') options.bold = true;
        if (tag === 'em' || tag === 'i') options.italic = true;
        if (tag === 'u') options.underline = true;
        if (tag === 's' || tag === 'strike') options.strike = true;
        if (tag === 'code' || tag === 'pre') {
          options.fontFace = 'Courier New';
          options.color = '334155'; // slate-700
          if (tag === 'code') options.bold = true;
        }
        if (tag === 'h1') { options.fontSize = 24; options.bold = true; }
        if (tag === 'h2') { options.fontSize = 20; options.bold = true; }
        if (tag === 'h3') { options.fontSize = 18; options.bold = true; }
        
        // Gestion des listes
        if (tag === 'li') {
          options.bullet = true;
          // Note: PPTXGenJS gère les listes avec bullet: true ou bullet: { type: 'number' }
        }

        // Couleurs inline via style
        if (el.style.color) {
          const colorMatch = el.style.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (colorMatch) {
            const r = parseInt(colorMatch[1]).toString(16).padStart(2, '0');
            const g = parseInt(colorMatch[2]).toString(16).padStart(2, '0');
            const b = parseInt(colorMatch[3]).toString(16).padStart(2, '0');
            options.color = (r + g + b).toUpperCase();
          } else if (el.style.color.startsWith('#')) {
            options.color = el.style.color.replace('#', '').toUpperCase();
          }
        }

        traverseNodes(child, options);

        // Sauts de ligne après les blocs
        if (['p', 'div', 'h1', 'h2', 'h3', 'li', 'br'].includes(tag)) {
          textObjects.push({ text: '\n', options: {} });
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (text && text.trim().length > 0) {
          textObjects.push({ text, options });
        }
      }
    });
  };

  traverseNodes(doc.body);
  return textObjects;
};

export const exportPresentationToPPTX = (presentation: PresentationData, slides: SlideData[], snapshots?: string[]) => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  
  const presentationTitle = presentation?.title || 'Presentation';
  const presentationCourse = presentation?.course || 'Formation';

  slides.forEach((slide, index) => {
    const pptxSlide = pptx.addSlide();
    const snapshot = snapshots?.[index];

    if (snapshot) {
      // Use full-page snapshot for perfect style reproduction
      pptxSlide.addImage({
        data: snapshot,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%'
      });
    } else {
      // Background color/style Fallback
      pptxSlide.background = { color: 'F8FAFC' }; // slate-50

      // Title
      pptxSlide.addText(slide.title, {
        x: 0.5,
        y: 0.5,
        w: '90%',
        fontSize: 32,
        bold: true,
        color: '0F172A', // slate-900
        fontFace: 'Arial'
      });

      // Accent border under title
      pptxSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 1.1,
        w: 2,
        h: 0.05,
        fill: { color: '3b82f6' }
      });

      // Content handling
      if (slide.isQA) {
        pptxSlide.addText("Session de Questions & Réponses Interactive", {
          x: 1,
          y: 3.5,
          w: 11,
          h: 1,
          align: 'center',
          valign: 'middle',
          fontSize: 28,
          bold: true,
          color: '3b82f6',
          fill: { color: 'EFF6FF' },
          shape: pptx.ShapeType.rect
        });
      } else if (slide.isQuiz && slide.quizQuestions) {
        pptxSlide.addText("Quiz Interactif", {
          x: 0.5,
          y: 1.5,
          w: 3,
          fontSize: 14,
          bold: true,
          color: '3b82f6'
        });
        
        let currentY = 2.0;
        slide.quizQuestions.slice(0, 5).forEach((q: any, i: number) => {
          if (currentY > 6.5) return;
          pptxSlide.addText(`${i + 1}. ${q.question}`, {
            x: 0.5,
            y: currentY,
            w: 12,
            fontSize: 12,
            bold: true,
            color: '0F172A'
          });
          currentY += 0.4;
          q.options.slice(0, 4).forEach((opt: string, oi: number) => {
            if (currentY > 6.8) return;
             pptxSlide.addText(`  • ${opt}`, {
                x: 0.7,
                y: currentY,
                w: 11,
                fontSize: 10,
                color: '475569'
              });
              currentY += 0.3;
          });
          currentY += 0.2;
        });
      } else if (typeof slide.content === 'string') {
        const styledTextObjects = parseHtmlToPptxText(slide.content);
        
        if (styledTextObjects.length > 0) {
          pptxSlide.addText(styledTextObjects, {
            x: 0.5,
            y: 1.5,
            w: slide.image ? '50%' : '90%',
            fontSize: 18,
            color: '334155', // slate-700
            fontFace: 'Arial',
            valign: 'top',
            lineSpacing: 24
          });
        } else {
          pptxSlide.addText("Contenu vide", {
            x: 0.5,
            y: 1.5,
            w: slide.image ? '50%' : '90%',
            fontSize: 14,
            italic: true,
            color: '94a3b8'
          });
        }
      } else {
        pptxSlide.addText("Contenu de la diapositive " + (index + 1), {
          x: 0.5,
          y: 1.5,
          w: slide.image ? '50%' : '90%',
          fontSize: 18,
          color: '334155'
        });
      }

      if (slide.isPlayground && slide.initialCode) {
        // Background for code block header
        pptxSlide.addText("Code Interactif", {
          x: 0.5,
          y: 4.5,
          w: 2,
          h: 0.3,
          fontSize: 10,
          bold: true,
          color: 'FFFFFF',
          fill: { color: '3b82f6' },
          align: 'center',
          valign: 'middle'
        });

        // Code content block
        pptxSlide.addText(slide.initialCode, {
          x: 0.5,
          y: 4.8,
          w: slide.image ? 6.5 : 12,
          h: 2,
          fontSize: 10,
          fontFace: 'Courier New',
          color: 'F1F5F9', // slate-100
          fill: { color: '1E293B' }, // slate-800
          valign: 'top',
          inset: 0.15
        });
      }

      if (slide.image) {
        pptxSlide.addImage({
          path: slide.image,
          x: 7.5,
          y: 1.5,
          w: 5,
          h: 3.75,
          sizing: { type: 'contain', w: 5, h: 3.75 }
        });
      }

      // Sidebar accent for wide slides
      if (!slide.image) {
        pptxSlide.addShape(pptx.ShapeType.rect, {
          x: 13,
          y: 0,
          w: 0.33,
          h: '100%',
          fill: { color: '3b82f6' }
        });
      }

      // Footer
      pptxSlide.addText(`${presentationTitle} | ${presentationCourse} | Diapositive ${index + 1}`, {
        x: 0.5,
        y: 7,
        w: '90%',
        fontSize: 10,
        color: '94a3b8',
        fontFace: 'Arial'
      });
    }
  });

  const safeFileName = presentationTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  pptx.writeFile({ fileName: `${safeFileName}.pptx` });
};
