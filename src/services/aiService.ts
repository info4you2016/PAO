import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateSlideExplanation(title: string, content: string): Promise<string> {
  const prompt = `Génère une explication détaillée et pédagogique pour une diapositive de présentation.
  
Titre de la diapositive : ${title}
Contenu de la diapositive : ${content}

L'explication doit être riche, formatée en Markdown, et apporter de la valeur ajoutée au contenu affiché. Elle doit aider le présentateur à expliquer les concepts ou donner plus de détails à l'audience.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text || "Impossible de générer l'explication.";
  } catch (error: any) {
    console.error("Erreur lors de la génération de l'explication :", error);
    if (error?.message?.includes("429") || error?.message?.includes("quota")) {
      throw new Error("Quota API dépassé. Veuillez attendre une minute avant de réessayer.");
    }
    throw new Error("Erreur de l'IA lors de la génération.");
  }
}

export async function generateImageForSlide(title: string, content: string): Promise<string> {
  const prompt = `A highly professional, modern, and high-quality presentation image or illustration.
Title: ${title}
Context: ${content}

The style should be minimalist, tech-oriented, and suitable for a professional slide. NO TEXT in the image.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Error generating image:", error);
    // Return a fallback image
    return `https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop`;
  }
}

export async function generateSlideContent(presentationTitle: string, slideTitle: string): Promise<string> {
  const prompt = `Génère le contenu d'une diapositive pour une présentation intitulée "${presentationTitle}".
Titre de la diapositive : "${slideTitle}".

Le contenu doit être formaté en Markdown, avec des points clairs, des exemples si pertinent, et une structure professionnelle.
Utilise des émojis si cela aide à la lisibilité.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });
    return response.text || "Contenu généré vide.";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Erreur lors de la génération du contenu.";
  }
}

export async function generateQuizQuestions(topic: string): Promise<any[]> {
  const prompt = `Génère 3 questions de quiz à choix multiples sur le sujet : "${topic}".`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "4 options de réponse"
              },
              correctAnswer: { 
                type: Type.NUMBER, 
                description: "L'index de la réponse correcte (0-3)" 
              }
            },
            required: ["question", "options", "correctAnswer"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error generating quiz:", error);
    return [];
  }
}

export async function generateSpeakerNotes(title: string, content: string): Promise<string> {
  const prompt = `Génère des notes de l'orateur pour cette diapositive.
Titre : ${title}
Contenu : ${content}

Les notes doivent être un script ou des points clés que le présentateur peut dire à haute voix.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });
    return response.text || "Notes générées vides.";
  } catch (error) {
    console.error("Error generating speaker notes:", error);
    return "Erreur lors de la génération des notes.";
  }
}

export async function generatePresentationFromText(
  topic: string, 
  slideCount: number = 8,
  options: {
    audience?: string;
    tone?: string;
    arc?: string;
    language?: string;
  } = {}
): Promise<any> {
  const { audience = 'Général', tone = 'Professionnel', arc = 'Classique', language = 'Français' } = options;

  const prompt = `Agis en tant qu'expert en design de présentation et en pédagogie. 
Crée une présentation haut de gamme, intelligente et structurée sur le sujet : "${topic}".

Cible (Audience) : ${audience}
Ton de la présentation : ${tone}
Structure Narrative (Arc) : ${arc}
Langue : ${language}

La présentation doit suivre la structure narrative demandée :
${arc === 'Storytelling' ? 'Utilise le voyage du héros pour engager l\'audience.' : 
  arc === 'Pitch' ? 'Utilise la méthode de Guy Kawasaki (problème, solution, business model).' :
  arc === 'Technique' ? 'Détaille l\'architecture, les implémentations et les cas d\'usage complexes.' :
  'Utilise une structure classique Hook-Setup-Insight-Evidence-Application-Summary.'}

RÈGLES DE GÉNÉRATION :
- EXACTEMENT ${slideCount} diapositives.
- "Une idée par diapositive" : Ne surcharge jamais visuellement la diapo.
- Visuels Contextuels : Choisis des layoutTypes qui renforcent le message.
- Visual Metaphor : Propose des images Unsplash (image_url) qui sont des métaphores visuelles.

Pour CHAQUE diapositive, fournis :
- title : Un titre percutant.
- content : Contenu Markdown minimaliste (3-4 points max).
- keyTakeaway : UNE SEULE phrase courte et puissante qui résume l'essence de la slide.
- explanation : Un texte riche en Markdown qui apporte de la profondeur.
- speakerNotes : Un script naturel pour l'orateur adapté au ton "${tone}".
- layoutType : 'standard', 'bento', 'split' ou 'fullImage'.
- bgColor : Une couleur hexadécimale très subtile qui change le "mood" de la slide.
- image : Une URL Unsplash pertinente.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  keyTakeaway: { type: Type.STRING, description: "La phrase choc en bas de slide" },
                  explanation: { type: Type.STRING },
                  speakerNotes: { type: Type.STRING },
                  layoutType: { type: Type.STRING },
                  bgColor: { type: Type.STRING, description: "Couleur Hex (ex: #f8fafc)" },
                  image: { type: Type.STRING },
                  isQuiz: { type: Type.BOOLEAN },
                  quizQuestions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.NUMBER }
                      },
                      required: ["question", "options", "correctAnswer"]
                    }
                  }
                },
                required: ["title", "content", "keyTakeaway", "explanation", "layoutType", "speakerNotes", "bgColor", "image"]
              }
            }
          },
          required: ["title", "description", "slides"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Error generating presentation:", error);
    const msg = error?.message || "";
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      throw new Error("Quota d'utilisation dépassé. Veuillez patienter environ une minute avant de tenter une nouvelle génération.");
    }
    throw new Error("Erreur de l'IA lors de la génération de la présentation. Détail: " + (msg || "Inconnu"));
  }
}
