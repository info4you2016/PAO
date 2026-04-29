import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const presentationSchema = {
  type: Type.OBJECT,
  properties: {
    title: { 
      type: Type.STRING,
      description: "Titre de la présentation"
    },
    description: { 
      type: Type.STRING,
      description: "Brève description du contenu"
    },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { 
            type: Type.STRING,
            description: "Titre de la diapositive"
          },
          content: { 
            type: Type.STRING, 
            description: "Contenu formaté en HTML. Utilisez des balises Tailwind CSS si possible pour le style (ex: <div class='space-y-4'>...</div>). Restez concis et visuel." 
          },
          isPlayground: { 
            type: Type.BOOLEAN, 
            description: "Vrai si cette diapositive doit inclure un bac à sable JavaScript interactif (particulièrement utile pour les concepts de programmation comme les boucles)." 
          },
          initialCode: { 
            type: Type.STRING, 
            description: "Code JavaScript initial si isPlayground est vrai. Incluez des commentaires explicatifs." 
          }
        },
        required: ["title", "content"]
      }
    }
  },
  required: ["title", "description", "slides"]
};

export async function generatePresentationFromText(topic: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Génère une présentation pédagogique et interactive structurée en slides sur le sujet suivant : "${topic}". 
      La présentation doit être captivante, inclure des exemples concrets et au moins une diapositive interactive (playground) si le sujet s'y prête (programmation, logique). 
      
      CONSIGNES DE DESIGN CRITIQUES :
      - NE JAMAIS utiliser de texte blanc sans un fond sombre contrasté.
      - Par défaut, utilise du texte sombre (slate-900) sur fond clair (white/slate-50).
      - Utilise des composants visuels riches : cartes avec bordures subtiles, icônes, listes à puces stylisées.
      - Le contenu HTML doit être aéré (spacing important).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: presentationSchema,
        systemInstruction: "Tu es un expert en conception pédagogique et en UI/UX. Tu crées des présentations modernes de type 'SaaS dashboard' ou 'Digital Whiteboard'. Utilise exclusivement Tailwind CSS. Assure-toi que tout le texte a un ratio de contraste suffisant."
      }
    });

    if (!response.text) {
      throw new Error("Aucune réponse du modèle AI.");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erreur lors de la génération AI:", error);
    throw error;
  }
}

export async function generateImageForSlide(title: string, content: string) {
  try {
    const prompt = `Génère une illustration pédagogique et moderne pour une diapositive de présentation. 
    Sujet: "${title}"
    Contenu de la slide: "${content.replace(/<[^>]*>?/gm, '').slice(0, 500)}"
    
    Style: Moderne, propre, type illustration vectorielle ou photo professionnelle de haute qualité, minimaliste, adapté à un contexte éducatif. Pas de texte dans l'image.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        // Import must be at the top, but for now I'll just use the function if I can, 
        // or I'll add the import in a sequence.
        try {
          const { compressBase64Image } = await import('../lib/imageUtils');
          return await compressBase64Image(base64, 1280, 720, 0.8);
        } catch (e) {
          console.warn("Compression failed, returning original", e);
          return base64;
        }
      }
    }

    throw new Error("Aucune image générée par le modèle.");
  } catch (error) {
    console.error("Erreur lors de la génération d'image AI:", error);
    throw error;
  }
}
