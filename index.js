const Koa = require('koa')
const koaBody = require('koa-body')
const request = require('./utils/request')

class Updates {
  /**
   * @param {String} token - VK Point Token
   * @param {Number} userId - VK User ID
   */
  constructor (token, userId) {
    this.token = token
    this.userId = userId

    this.isStarted = false

    this.transferCallback = null
  }

  /**
   *
   * @param {Object} options - Callback API options
   * @param {String} options.url - Callback API URL (Ex: 255.255.255.255)
   * @param {Number} options.port - Callback API Port (Ex: 3000)
   * @param {String} options.path - Callback API Path (Ex: /)
   * @default options.path '/'
   */
  async start (options) {
    let { url, port, path } = options

    if (!url) {
      return new Error('Specify an URL.')
    }
    if (!port) {
      port = 8181
    }
    if (!path) {
      path = '/'
    }

    this.app = new Koa()
    this.app.use(koaBody())
    this.app.listen(port)

    if (!/^(?:https?)/.test(url)) {
      url = `http://${url}`
    }

    await request('https://vkpoint.vposter.ru/api/method/account.changeSettings',
      {
        user_id: this.userId,
        callback: `${url}:${port}${path}`,
        access_token: this.token,
      }).then(result => {
      if (result) {
        this.isStarted = true

        this.app.use((ctx) => {
          ctx.status = 200

          this.transferHandler(ctx.request.body)
        })
      } else {
        this.isStarted = false
      }
    })
  }

  onTransfer (callback) {
    if (!this.isStarted) return
    this.transferCallback = callback
  }
}

class API {
  /**
   * @param {String} token - VK Point Token
   * @param {Number} userId - VK User ID
   */
  constructor (token, userId) {
    this.token = token
    this.userId = userId
  }

  async sendPayment (toId, amount) {
    if (typeof toId !== 'number') {
      throw new Error('toId must be a number!')
    }

    if (typeof amount !== 'number') {
      throw new Error('amount must be a number!')
    }

    const body = {
      user_id_to: toId,
      point: amount,
      user_id: this.userId,
      access_token: this.token,
    }

    await request('https://vkpoint.vposter.ru/api/method/account.MerchantSend', body)
      .then((result) => {
        if (result.error) {
          throw new Error(result.error)
        }

        return result
      })
  }
}

module.exports = class VKPoint {
  /**
     * @param {Object} options - Options
     * @param {String} options.token - VK Point API Key
     * @param {Number} options.userId - VK User ID
     */

  constructor (options) {
    if (!options.token) throw new Error('VK Point Token is invalid!')
    if (!options.userId) throw new Error('VK User ID is invalid!')

    this.token = options.token
    this.userId = options.userId

    this.updates = new Updates(this.token, this.userId)
    this.api = new API(this.token, this.userId)
  }
}