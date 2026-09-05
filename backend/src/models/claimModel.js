const Claim = require('./Claim');

function getAll(filter = {}) {
  return Claim.find(filter);
}

function getById(id) {
  return Claim.findById(id);
}

function create(data) {
  return Claim.create(data);
}

function update(id, data) {
  return Claim.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
}

function remove(id) {
  return Claim.findByIdAndDelete(id);
}

module.exports = { getAll, getById, create, update, remove };
