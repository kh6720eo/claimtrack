const claimModel = require('../models/claimModel');

async function getAllClaims(req, res) {
  const claims = await claimModel.getAll();
  res.status(200).json(claims);
}

async function getClaimById(req, res) {
  try {
    const claim = await claimModel.getById(req.params.id);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.status(200).json(claim);
  } catch (err) {
    res.status(404).json({ error: 'Claim not found' });
  }
}

async function createClaim(req, res) {
  const { description, amount, dateOfLoss } = req.body;

  if (!description || !amount) {
    return res.status(400).json({ error: 'description and amount are required' });
  }

  try {
    const claim = await claimModel.create({ description, amount, dateOfLoss });
    res.status(201).json(claim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateClaim(req, res) {
  try {
    const updated = await claimModel.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.status(200).json(updated);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.status(400).json({ error: err.message });
  }
}

async function deleteClaim(req, res) {
  try {
    const deleted = await claimModel.remove(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ error: 'Claim not found' });
  }
}

module.exports = {
  getAllClaims,
  getClaimById,
  createClaim,
  updateClaim,
  deleteClaim,
};
