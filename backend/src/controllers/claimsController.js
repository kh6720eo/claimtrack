const claimModel = require('../models/claimModel');
const { triageClaim } = require('../services/triageService');

async function getAllClaims(req, res) {
  const filter = req.user.role === 'adjuster' ? {} : { submittedBy: req.user._id };
  const claims = await claimModel.getAll(filter);
  res.status(200).json(claims);
}

async function getClaimById(req, res) {
  try {
    const claim = await claimModel.getById(req.params.id);
    if (!claim || (req.user.role !== 'adjuster' && String(claim.submittedBy) !== String(req.user._id))) {
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
    const claim = await claimModel.create({
      description,
      amount,
      dateOfLoss,
      submittedBy: req.user._id,
    });
    res.status(201).json(claim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateClaimStatus(req, res) {
  const { status } = req.body;
  const allowed = ['submitted', 'in_review', 'approved', 'denied'];

  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  try {
    const updated = await claimModel.update(req.params.id, { status });
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

async function triageClaimById(req, res) {
  const claim = await claimModel.getById(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  try {
    const { summary, category, priority } = await triageClaim({
      description: claim.description,
      amount: claim.amount,
    });
    const updated = await claimModel.update(req.params.id, {
      aiSummary: summary,
      aiCategory: category,
      aiPriority: priority,
    });
    res.status(200).json(updated);
  } catch (err) {
    res.status(502).json({ error: `Triage failed: ${err.message}` });
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
  updateClaimStatus,
  triageClaimById,
  deleteClaim,
};
