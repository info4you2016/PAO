import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
try {
  db = new Database('database.sqlite');
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('Database initialized successfully');
} catch (err) {
  console.error('Failed to initialize database:', err);
  process.exit(1);
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS presentations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    course TEXT,
    owner_id TEXT NOT NULL,
    theme TEXT DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS slides (
    id TEXT PRIMARY KEY,
    presentation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    bg_color TEXT DEFAULT '#F8FAFC',
    slide_order INTEGER NOT NULL,
    is_playground BOOLEAN DEFAULT 0,
    initial_code TEXT,
    is_quiz BOOLEAN DEFAULT 0,
    quiz_questions TEXT,
    is_qa BOOLEAN DEFAULT 0,
    speaker_notes TEXT,
    layout_type TEXT DEFAULT 'standard',
    explanation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS qa_interactions (
    id TEXT PRIMARY KEY,
    slide_id TEXT NOT NULL,
    type TEXT NOT NULL, 
    content TEXT,
    user_name TEXT,
    votes INTEGER DEFAULT 0,
    is_answered BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    primary_color TEXT NOT NULL,
    secondary_color TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    bg_color TEXT NOT NULL,
    slide_bg_color TEXT NOT NULL,
    text_color TEXT NOT NULL,
    description TEXT,
    font_family TEXT DEFAULT 'Inter',
    is_public BOOLEAN DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Migration and verification
const themesTableInfo = db.prepare("PRAGMA table_info(themes)").all();
const themeColumns = (themesTableInfo as any[]).map(col => col.name);
if (themeColumns.length > 0 && !themeColumns.includes('accent_color')) {
  db.exec("DROP TABLE themes;"); // Safe to drop and recreate for now since it's new
  db.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      primary_color TEXT NOT NULL,
      secondary_color TEXT NOT NULL,
      accent_color TEXT NOT NULL,
      bg_color TEXT NOT NULL,
      slide_bg_color TEXT NOT NULL,
      text_color TEXT NOT NULL,
      description TEXT,
      font_family TEXT DEFAULT 'Inter',
      is_public BOOLEAN DEFAULT 1,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
}

if ((db.prepare("SELECT count(*) as count FROM themes").get() as any).count === 0) {
  db.exec(`
    INSERT INTO themes (id, name, primary_color, secondary_color, accent_color, bg_color, slide_bg_color, text_color, font_family, is_public)
    VALUES ('default', 'Défaut', '#3B82F6', '#10B981', '#6366F1', '#F8FAFC', '#FFFFFF', '#1E293B', 'Inter', 1);
  `);
}
const tableInfo = db.prepare("PRAGMA table_info(users)").all();
const columns = (tableInfo as any[]).map(col => col.name);
if (!columns.includes('password')) {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT;");
}
if (!columns.includes('name')) {
  db.exec("ALTER TABLE users ADD COLUMN name TEXT;");
}

const slideTableInfo = db.prepare("PRAGMA table_info(slides)").all();
const slideColumns = (slideTableInfo as any[]).map(col => col.name);

const presTableInfo = db.prepare("PRAGMA table_info(presentations)").all();
const presColumns = (presTableInfo as any[]).map(col => col.name);

if (!presColumns.includes('theme')) {
  db.exec("ALTER TABLE presentations ADD COLUMN theme TEXT DEFAULT 'default';");
}

if (!slideColumns.includes('is_quiz')) {
  db.exec("ALTER TABLE slides ADD COLUMN is_quiz BOOLEAN DEFAULT 0;");
}
if (!slideColumns.includes('quiz_questions')) {
  db.exec("ALTER TABLE slides ADD COLUMN quiz_questions TEXT;");
}
if (!slideColumns.includes('is_qa')) {
  db.exec("ALTER TABLE slides ADD COLUMN is_qa BOOLEAN DEFAULT 0;");
}
if (!slideColumns.includes('speaker_notes')) {
  db.exec("ALTER TABLE slides ADD COLUMN speaker_notes TEXT;");
}
if (!slideColumns.includes('layout_type')) {
  db.exec("ALTER TABLE slides ADD COLUMN layout_type TEXT DEFAULT 'standard';");
}
if (!slideColumns.includes('explanation')) {
  db.exec("ALTER TABLE slides ADD COLUMN explanation TEXT;");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API routes health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth
  app.post('/api/auth/register', (req, res) => {
    console.log('Register request received:', req.body.email);
    const { email, password, name } = req.body;
    try {
      const id = crypto.randomUUID();
      const stmt = db.prepare('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)');
      stmt.run(id, email, password, name);
      const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id);
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ error: "L'utilisateur existe déjà ou données invalides." });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ? AND password = ?').get(email, password);
      if (user) {
        res.json(user);
      } else {
        res.status(401).json({ error: "Identifiants incorrects." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Users
  app.get('/api/users/:id', (req, res) => {
    try {
      const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.params.id);
      if (user) {
        res.json(user);
      } else {
        res.status(404).json({ error: "Utilisateur non trouvé" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Presentations
  app.get('/api/presentations', (req, res) => {
    const userId = req.query.ownerId;
    console.log(`GET /api/presentations?ownerId=${userId}`);
    if (!userId) {
      console.error('Missing ownerId in presentations request');
      return res.status(400).json({ error: 'ownerId is required' });
    }
    try {
      const presentations = db.prepare(`
        SELECT p.*, 
          (SELECT s.image_url FROM slides s WHERE s.presentation_id = p.id ORDER BY s.slide_order ASC LIMIT 1) as thumbnail_url
        FROM presentations p 
        WHERE p.owner_id = ? 
        ORDER BY p.created_at DESC
      `).all(userId);
      console.log(`Found ${presentations.length} presentations for user ${userId}`);
      res.json(presentations);
    } catch (err: any) {
      console.error("Error fetching presentations:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/presentations/:id', (req, res) => {
    try {
      const presentation = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
      if (presentation) {
        res.json(presentation);
      } else {
        res.status(404).json({ error: "Présentation non trouvée" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/presentations', (req, res) => {
    const { id, title, description, course, ownerId, theme } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO presentations (id, title, description, course, owner_id, theme) VALUES (?, ?, ?, ?, ?, ?)');
      stmt.run(id, title, description, course, ownerId, theme || 'default');
      res.json({ status: 'ok' });
    } catch (err: any) {
      console.error("Presentation creation error:", err);
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/presentations/:id', (req, res) => {
    const { title, description, course, theme } = req.body;
    try {
      const stmt = db.prepare('UPDATE presentations SET title = ?, description = ?, course = ?, theme = ? WHERE id = ?');
      stmt.run(title, description, course, theme || 'default', req.params.id);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/presentations/:id', (req, res) => {
    console.log(`Attempting to delete presentation: ${req.params.id}`);
    try {
      const stmt = db.prepare('DELETE FROM presentations WHERE id = ?');
      const info = stmt.run(req.params.id);
      console.log(`Delete result:`, info);
      if (info.changes === 0) {
        return res.status(404).json({ error: "Présentation non trouvée" });
      }
      res.json({ status: 'ok', deleted: info.changes });
    } catch (err: any) {
      console.error("Delete presentation error:", err);
      res.status(400).json({ error: err.message });
    }
  });

  // Themes
  app.get('/api/themes', (req, res) => {
    console.log('GET /api/themes');
    try {
      const themes = db.prepare('SELECT * FROM themes ORDER BY created_at DESC').all();
      console.log(`Found ${themes.length} themes`);
      res.json(themes.map((t: any) => ({
        ...t,
        primaryColor: t.primary_color,
        secondaryColor: t.secondary_color,
        accentColor: t.accent_color,
        bgColor: t.bg_color,
        slideBgColor: t.slide_bg_color,
        textColor: t.text_color,
        fontFamily: t.font_family,
        isPublic: Boolean(t.is_public),
        createdBy: t.created_by,
        createdAt: t.created_at
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/themes', (req, res) => {
    const { id, name, primaryColor, secondaryColor, accentColor, bgColor, slideBgColor, textColor, description, fontFamily, isPublic, createdBy } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO themes (id, name, primary_color, secondary_color, accent_color, bg_color, slide_bg_color, text_color, description, font_family, is_public, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id || crypto.randomUUID(), name, primaryColor, secondaryColor, accentColor, bgColor, slideBgColor, textColor, description, fontFamily || 'Inter', isPublic ? 1 : 0, createdBy);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/themes/:id', (req, res) => {
    const { name, primaryColor, secondaryColor, accentColor, bgColor, slideBgColor, textColor, description, fontFamily, isPublic } = req.body;
    try {
      const stmt = db.prepare(`
        UPDATE themes SET name = ?, primary_color = ?, secondary_color = ?, accent_color = ?, bg_color = ?, slide_bg_color = ?, text_color = ?, description = ?, font_family = ?, is_public = ? 
        WHERE id = ?
      `);
      stmt.run(name, primaryColor, secondaryColor, accentColor, bgColor, slideBgColor, textColor, description, fontFamily || 'Inter', isPublic ? 1 : 0, req.params.id);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/themes/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM themes WHERE id = ?').run(req.params.id);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Slides
  app.get('/api/presentations/:id/slides', (req, res) => {
    try {
      const slides = db.prepare('SELECT * FROM slides WHERE presentation_id = ? ORDER BY slide_order ASC').all(req.params.id);
      res.json(slides);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // QA Interactions
  app.get('/api/slides/:slideId/qa', (req, res) => {
    try {
      const interactions = db.prepare('SELECT * FROM qa_interactions WHERE slide_id = ? ORDER BY created_at DESC').all(req.params.slideId);
      res.json(interactions.map((i: any) => ({
        ...i,
        is_answered: Boolean(i.is_answered)
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/slides/:slideId/qa', (req, res) => {
    const { id, type, content, userName } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO qa_interactions (id, slide_id, type, content, user_name) VALUES (?, ?, ?, ?, ?)');
      stmt.run(id, req.params.slideId, type, content, userName || 'Anonyme');
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/qa/:id/vote', (req, res) => {
    try {
      db.prepare('UPDATE qa_interactions SET votes = votes + 1 WHERE id = ?').run(req.params.id);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/qa/:id/answer', (req, res) => {
    try {
      db.prepare('UPDATE qa_interactions SET is_answered = 1 WHERE id = ?').run(req.params.id);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/slides/:slideId/qa', (req, res) => {
    try {
      db.prepare('DELETE FROM qa_interactions WHERE slide_id = ?').run(req.params.slideId);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/presentations/:id/slides', (req, res) => {
    const { id, title, content, imageUrl, bgColor, order, isPlayground, initialCode, isQuiz, quizQuestions, isQA, speakerNotes, explanation, layoutType } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO slides (id, presentation_id, title, content, image_url, bg_color, slide_order, is_playground, initial_code, is_quiz, quiz_questions, is_qa, speaker_notes, explanation, layout_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, 
        req.params.id, 
        title, 
        content, 
        imageUrl, 
        bgColor, 
        order, 
        isPlayground ? 1 : 0, 
        initialCode, 
        isQuiz ? 1 : 0, 
        quizQuestions ? JSON.stringify(quizQuestions) : null, 
        isQA ? 1 : 0,
        speakerNotes || null,
        explanation || null,
        layoutType || 'standard'
      );
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/slides/:id', (req, res) => {
    const { title, content, imageUrl, bgColor, order, isPlayground, initialCode, isQuiz, quizQuestions, isQA, speakerNotes, explanation, layoutType } = req.body;
    try {
      const stmt = db.prepare(`
        UPDATE slides SET title = ?, content = ?, image_url = ?, bg_color = ?, slide_order = ?, is_playground = ?, initial_code = ?, is_quiz = ?, quiz_questions = ?, is_qa = ?, speaker_notes = ?, explanation = ?, layout_type = ? 
        WHERE id = ?
      `);
      stmt.run(
        title, 
        content, 
        imageUrl, 
        bgColor, 
        order, 
        isPlayground ? 1 : 0, 
        initialCode, 
        isQuiz ? 1 : 0, 
        quizQuestions ? JSON.stringify(quizQuestions) : null, 
        isQA ? 1 : 0,
        speakerNotes || null,
        explanation || null,
        layoutType || 'standard',
        req.params.id
      );
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/slides/:id', (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM slides WHERE id = ?');
      stmt.run(req.params.id);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/slides/reorder', (req, res) => {
    const { orders } = req.body; // Array of { id, order }
    try {
      const update = db.prepare('UPDATE slides SET slide_order = ? WHERE id = ?');
      const transaction = db.transaction((updates) => {
        for (const item of updates) {
          update.run(item.order, item.id);
        }
      });
      transaction(orders);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/presentations/:id/slides/batch', (req, res) => {
    const { slides } = req.body;
    try {
      const insert = db.prepare(`
        INSERT INTO slides (id, presentation_id, title, content, image_url, bg_color, slide_order, is_playground, initial_code, is_quiz, quiz_questions, is_qa, speaker_notes, explanation, layout_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const transaction = db.transaction((slidesList) => {
        for (const slide of slidesList) {
          insert.run(
            slide.id || crypto.randomUUID(),
            req.params.id,
            slide.title,
            slide.content,
            slide.image || slide.imageUrl || null,
            slide.bgColor || '#F8FAFC',
            slide.order,
            slide.isPlayground ? 1 : 0,
            slide.initialCode || null,
            slide.isQuiz ? 1 : 0,
            slide.quizQuestions ? JSON.stringify(slide.quizQuestions) : null,
            slide.isQA ? 1 : 0,
            slide.speakerNotes || null,
            slide.explanation || null,
            slide.layoutType || 'standard'
          );
        }
      });
      
      transaction(slides);
      res.json({ status: 'ok' });
    } catch (err: any) {
      console.error("Batch slide creation error:", err);
      res.status(400).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
