import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

router.get('/', (req, res) => {
  let entries = db.data.auditLog ?? [];

  const { action } = req.query;
  if (action) entries = entries.filter((e) => e.action === action);

  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = sorted.length;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const start = (page - 1) * pageSize;

  res.json({ total, page, pageSize, entries: sorted.slice(start, start + pageSize) });
});

export default router;
