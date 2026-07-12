let claims = [];
let nextId = 1;

function getAll() {
  return claims;
}

function getById(id) {
  return claims.find((claim) => claim.id === id);
}

function create(data) {
  const claim = {
    id: nextId++,
    description: data.description,
    amount: data.amount,
    dateOfLoss: data.dateOfLoss,
    status: 'submitted',
  };
  claims.push(claim);
  return claim;
}

function update(id, data) {
  const claim = getById(id);
  if (!claim) return null;

  Object.assign(claim, data);
  return claim;
}

function remove(id) {
  const index = claims.findIndex((claim) => claim.id === id);
  if (index === -1) return false;

  claims.splice(index, 1);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
