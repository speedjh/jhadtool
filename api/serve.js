const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(html);
  } catch(e) {
    res.status(500).send('Error: ' + e.message);
  }
};
