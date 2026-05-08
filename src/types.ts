export interface Theme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  slideBg: string;
  text: string;
  description?: string;
  isCustom?: boolean;
}

export interface CustomTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  slideBgColor: string;
  textColor: string;
  description: string;
  fontFamily: string;
  isPublic: boolean;
  createdBy: string;
  createdAt?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface SlideData {
  id?: string;
  order: number;
  title: string;
  content: string;
  image?: string;
  bgColor?: string;
  isPlayground?: boolean;
  initialCode?: string;
  isQuiz?: boolean;
  quizQuestions?: QuizQuestion[];
  isQA?: boolean;
  speakerNotes?: string;
  explanation?: string;
  keyTakeaway?: string;
  layoutType?: 'standard' | 'bento' | 'split' | 'fullImage';
}

export interface PresentationData {
  id: string;
  title: string;
  description?: string;
  course?: string;
  owner_id: string;
  theme?: string;
  created_at?: string;
  thumbnail_url?: string;
}
