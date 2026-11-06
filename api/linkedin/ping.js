'use strict'
const { ID, SECRET } = require('./_comum.js')
module.exports = (req, res) => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify({ pronto: !!(ID && SECRET), versao: 1 })) }
