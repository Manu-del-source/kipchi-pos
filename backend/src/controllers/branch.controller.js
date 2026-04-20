const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createBranch = async (req, res) => {
  try {
    const { name, location, code } = req.body;
    const branch = await prisma.branch.create({
      data: { name, location, code }
    });
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany();
    res.json(branches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
