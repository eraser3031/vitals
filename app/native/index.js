const path = require('path')
const binary = require('node-gyp-build')(path.join(__dirname))

module.exports = {
  setCornerRadius: binary.setCornerRadius,
  resetCornerRadius: binary.resetCornerRadius,
}
