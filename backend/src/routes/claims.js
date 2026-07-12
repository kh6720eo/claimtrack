const express = require('express');
const router = express.Router();
const {
  getAllClaims,
  getClaimById,
  createClaim,
  updateClaim,
  deleteClaim,
} = require('../controllers/claimsController');

router.get('/', getAllClaims);
router.get('/:id', getClaimById);
router.post('/', createClaim);
router.put('/:id', updateClaim);
router.delete('/:id', deleteClaim);

module.exports = router;
