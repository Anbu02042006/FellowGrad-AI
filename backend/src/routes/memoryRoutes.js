const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const MemoryService = require('../services/memoryService');

// Get all long-term memories for authenticated user
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const category = req.query.category || null;
    const memories = await MemoryService.getMemories(userId, category);
    return res.status(200).json({ success: true, memories });
  } catch (err) {
    next(err);
  }
});

// Save or update custom memory for authenticated user
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { category, content, importance } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const memory = await MemoryService.saveMemory(userId, {
      category,
      content,
      importance,
    });
    return res.status(200).json({ success: true, memory });
  } catch (err) {
    next(err);
  }
});

// Clear all memories for authenticated user
router.delete('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const count = await MemoryService.clearAllMemories(userId);
    return res.status(200).json({
      success: true,
      message: 'All memories cleared successfully',
      deletedCount: count,
    });
  } catch (err) {
    next(err);
  }
});

// Delete specific memory
router.delete('/:memoryId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { memoryId } = req.params;

    const success = await MemoryService.deleteMemory(userId, memoryId);
    return res.status(200).json({ success, memoryId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
