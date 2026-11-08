'use strict'
const { ID, SECRET, seguro } = require('./_comum.js')
module.exports = (req, res) => { seguro(res); res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify({ pronto: !!(ID && SECRET), versao: 1 })) }
