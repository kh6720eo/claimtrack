const express = require('express');
const router = express.Router();
const {
  getAllClaims,
  getClaimById,
  createClaim,
  updateClaimStatus,
  triageClaimById,
  deleteClaim,
} = require('../controllers/claimsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getAllClaims);
router.get('/:id', getClaimById);
router.post('/', createClaim);
router.put('/:id/status', authorize('adjuster'), updateClaimStatus);
router.post('/:id/triage', authorize('adjuster'), triageClaimById);
router.delete('/:id', authorize('adjuster'), deleteClaim);

module.exports = router;
