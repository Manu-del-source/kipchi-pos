const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.getBranches = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM "Branch" ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { name, location, code } = req.body;
    const id = uuidv4();
    const result = await db.query(
      'INSERT INTO "Branch" (id, name, location, code, "updatedAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [id, name, location, code]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
