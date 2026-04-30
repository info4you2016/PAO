import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('database.sqlite');

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
`);

// Migration and verification
const tableInfo = db.prepare("PRAGMA table_info(users)").all();
const columns = (tableInfo as any[]).map(col => col.name);
if (!columns.includes('password')) {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT;");
}
if (!columns.includes('name')) {
  db.exec("ALTER TABLE users ADD COLUMN name TEXT;");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS presentations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    course TEXT,
    owner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  
  // Auth
  app.post('/api/auth/register', (req, res) => {
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
    const user = db.prepare('SELECT id, email, role FROM users WHERE email = ? AND password = ?').get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Identifiants incorrects." });
    }
  });

  // Users
  app.get('/api/users/:id', (req, res) => {
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  });

  // Presentations
  app.get('/api/presentations', (req, res) => {
    const userId = req.query.ownerId;
    if (!userId) return res.status(400).json({ error: 'ownerId is required' });
    const presentations = db.prepare('SELECT * FROM presentations WHERE owner_id = ? ORDER BY created_at DESC').all(userId);
    res.json(presentations);
  });

  app.get('/api/presentations/:id', (req, res) => {
    const presentation = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
    res.json(presentation);
  });

  app.post('/api/presentations', (req, res) => {
    const { id, title, description, course, ownerId } = req.body;
    const stmt = db.prepare('INSERT INTO presentations (id, title, description, course, owner_id) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, title, description, course, ownerId);
    res.json({ status: 'ok' });
  });

  app.put('/api/presentations/:id', (req, res) => {
    const { title, description, course } = req.body;
    const stmt = db.prepare('UPDATE presentations SET title = ?, description = ?, course = ? WHERE id = ?');
    stmt.run(title, description, course, req.params.id);
    res.json({ status: 'ok' });
  });

  app.delete('/api/presentations/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM presentations WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ status: 'ok' });
  });

  // Slides
  app.get('/api/presentations/:id/slides', (req, res) => {
    const slides = db.prepare('SELECT * FROM slides WHERE presentation_id = ? ORDER BY slide_order ASC').all(req.params.id);
    res.json(slides);
  });

  app.post('/api/presentations/:id/slides', (req, res) => {
    const { id, title, content, imageUrl, bgColor, order, isPlayground, initialCode } = req.body;
    const stmt = db.prepare(`
      INSERT INTO slides (id, presentation_id, title, content, image_url, bg_color, slide_order, is_playground, initial_code) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, req.params.id, title, content, imageUrl, bgColor, order, isPlayground ? 1 : 0, initialCode);
    res.json({ status: 'ok' });
  });

  app.put('/api/slides/:id', (req, res) => {
    const { title, content, imageUrl, bgColor, order, isPlayground, initialCode } = req.body;
    const stmt = db.prepare(`
      UPDATE slides SET title = ?, content = ?, image_url = ?, bg_color = ?, slide_order = ?, is_playground = ?, initial_code = ? 
      WHERE id = ?
    `);
    stmt.run(title, content, imageUrl, bgColor, order, isPlayground ? 1 : 0, initialCode, req.params.id);
    res.json({ status: 'ok' });
  });

  app.delete('/api/slides/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM slides WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ status: 'ok' });
  });

  app.post('/api/presentations/:id/slides/batch', (req, res) => {
    const { slides } = req.body;
    const insert = db.prepare(`
      INSERT INTO slides (id, presentation_id, title, content, image_url, bg_color, slide_order, is_playground, initial_code) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          slide.initialCode || null
        );
      }
    });
    
    transaction(slides);
    res.json({ status: 'ok' });
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
