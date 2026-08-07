import fs from 'node:fs'
import path from 'node:path'

// Dev-only helper: POST a data URL to /__screenshot and it gets saved to disk.
// Lets us capture WebGL frames for debugging. Safe to remove for production.
const screenshotEndpoint = {
  name: 'screenshot-endpoint',
  configureServer(server) {
    server.middlewares.use('/__screenshot', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        return res.end('POST only')
      }
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        try {
          const base64 = body.replace(/^data:image\/\w+;base64,/, '')
          const file = path.resolve('shots', `${Date.now()}.jpg`)
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.writeFileSync(file, Buffer.from(base64, 'base64'))
          res.end(file)
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    })
  },
}

export default {
  base: './',
  plugins: [screenshotEndpoint],
}
