const claimModel = require('../models/claimModel');

function getAllClaims(req, res) {
  res.status(200).json(claimModel.getAll());
}

function getClaimById(req, res) {
  const id = Number(req.params.id);
  const claim = claimModel.getById(id);

  if (!claim) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  res.status(200).json(claim);
}

function createClaim(req, res) {
  const { description, amount, dateOfLoss } = req.body;

  if (!description || !amount) {
    return res.status(400).json({ error: 'description and amount are required' });
  }

  const claim = claimModel.create({ description, amount, dateOfLoss });
  res.status(201).json(claim);
}

function updateClaim(req, res) {
  const id = Number(req.params.id);
  const updated = claimModel.update(id, req.body);

  if (!updated) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  res.status(200).json(updated);
}

function deleteClaim(req, res) {
  const id = Number(req.params.id);
  const deleted = claimModel.remove(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  res.status(204).send();
}

module.exports = {
  getAllClaims,
  getClaimById,
  createClaim,
  updateClaim,
  deleteClaim,
};
