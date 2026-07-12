const express = require('express');
const healthRoutes = require('./routes/health');
const claimsRoutes = require('./routes/claims');

const app = express();

app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api/claims', claimsRoutes);

module.exports = app;
