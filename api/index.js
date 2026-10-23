/**
 * Função serverless da Vercel: todas as rotas /api/* chegam aqui (ver vercel.json)
 * e são atendidas pelo Express do server/, compilado em server/dist no build.
 */
module.exports = require('../server/dist/vercel.js').app;
