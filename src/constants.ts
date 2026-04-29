export const INITIAL_SLIDES = [
  {
    order: 0,
    title: "Programmation JavaScript – Séance 4",
    image: "https://picsum.photos/seed/js-code/800/600",
    content: `
      <div class="space-y-6">
        <p class="text-2xl font-light italic">Les boucles : for, while, do...while</p>
        <div class="flex flex-col gap-3 mt-8">
          <div class="flex items-center gap-3 text-slate-500">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Durée : 5 heures</span>
          </div>
          <div class="flex items-center gap-3 text-slate-500">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Formateur : [Votre nom]</span>
          </div>
        </div>
      </div>
    `
  },
  {
    order: 1,
    title: "Programme de la séance",
    image: "https://picsum.photos/seed/agenda/800/600",
    content: `
      <ul class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div><span class="font-medium">Rappel de la séance 3</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">2</div><span class="font-medium">Pourquoi les boucles ?</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">3</div><span class="font-medium">La boucle for</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">4</div><span class="font-medium">La boucle while</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">5</div><span class="font-medium">La boucle do...while</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">6</div><span class="font-medium">break et continue</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">7</div><span class="font-medium">Boucles imbriquées</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">8</div><span class="font-medium">TP Pratiques</span></li>
        <li class="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm border border-slate-100"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">9</div><span class="font-medium">Quiz final</span></li>
      </ul>
    `
  },
  {
    order: 2,
    title: "Challenge 1 : La boucle For",
    isPlayground: true,
    initialCode: "// OBJECTIF : Afficher les nombres pairs de 0 à 20\n// Utilisez une boucle for pour ce challenge.\n\nconsole.log(\"Nombres pairs de 0 à 20 :\");\n\nfor (let i = 0; i <= 20; i++) {\n  // Votre code ici\n  if (i % 2 === 0) {\n    console.log(i);\n  }\n}\n",
    content: "Complétez le code pour afficher tous les nombres pairs entre 0 et 20 en utilisant une boucle <code class='text-brand-primary font-bold'>for</code>."
  },
  {
    order: 3,
    title: "Challenge 2 : La boucle While",
    isPlayground: true,
    initialCode: "// OBJECTIF : Simuler un compte à rebours de 10 à 0\n// Utilisez une boucle while.\n\nlet count = 10;\nconsole.log(\"Décollage dans...\");\n\nwhile (count >= 0) {\n  console.log(count + \"...\");\n  // N'oubliez pas de décrémenter !\n  count--;\n}\n\nconsole.log(\"Décollage réussi ! 🚀\");\n",
    content: "Utilisez une boucle <code class='text-brand-primary font-bold'>while</code> pour créer un compte à rebours allant de 10 jusqu'à 0."
  },
  {
    order: 4,
    title: "Challenge 3 : La boucle Do...While",
    isPlayground: true,
    initialCode: "// OBJECTIF : Demander un nombre jusqu'à ce qu'il soit supérieur à 100\n// (Simulation avec un tableau de valeurs pour le playground)\n\nlet numbers = [45, 12, 89, 120, 30];\nlet i = 0;\nlet currentNumber;\n\ndo {\n  currentNumber = numbers[i];\n  console.log(\"Nombre analysé : \" + currentNumber);\n  i++;\n} while (currentNumber <= 100 && i < numbers.length);\n\nconsole.log(\"Boucle terminée car \" + currentNumber + \" est > 100\");\n",
    content: "La boucle <code class='text-brand-primary font-bold'>do...while</code> s'exécute au moins une fois. Observez comment elle s'arrête dès qu'elle trouve un nombre supérieur à 100."
  },
  {
    order: 5,
    title: "Bac à sable final",
    isPlayground: true,
    initialCode: "// Espace libre pour expérimenter toutes les boucles vues aujourd'hui\n\nconsole.log(\"Prêt pour vos propres expériences !\");\n",
    content: "Utilisez cet espace pour tester des boucles imbriquées ou combiner les concepts appris."
  }
];
