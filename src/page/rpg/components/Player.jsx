import React, { Component, PropTypes } from 'react'
import isMoveObject from '../../../constants/ismove/'
import messageObject from '../../../constants/message/'
import man from '../../../images/man.png'

export default class Player extends Component {
  constructor(props) {
    super(props)
    this.touchstart = {
      x: 0,
      y: 0,
    }
    this.handleResize = ::this.handleResize
    this.handleKeyDown = ::this.handleKeyDown
    this.handleKeyUp = ::this.handleKeyUp
    this.moveAnimate = ::this.moveAnimate
    this.isDraw = ::this.isDraw
  }
  componentWillMount() {
    this.resize = Rx.Observable
      .fromEvent(window, 'resize')
      .debounceTime(300)
      .subscribe(this.handleResize)
    window.addEventListener('keydown', this.handleKeyDown, false)
    window.addEventListener('keyup', this.handleKeyUp, false)
    window.addEventListener('touchstart', this.moveAnimate, false)
  }
  componentDidMount() {
    this.canvas = this.refs.player
    this.player = this.canvas.getContext('2d')
    this.player.nX = 32
    this.player.nY = 48

    this.img = new Image()
    this.img.onload = () => {
      this.handleResize()
    }
    this.img.src = man
    this.af = 0

    this.props.rAF()(this.isDraw)
    this.drawPlayer()
  }
  componentDidUpdate() {
    this.drawPlayer()
  }
  componentWillUnmount() {
    this.resize.unsubscribe()
    window.removeEventListener('keydown', this.handleKeyDown, false)
    window.removeEventListener('keyup', this.handleKeyUp, false)
    window.removeEventListener('touchstart', this.moveAnimate, false)
    this.props.cAF()(this.aframe)
  }
  isDraw() {
    if (!this.props.sence.get('isTransSence')) {
      let [x, y, isMoveX, isMoveY] = [0, 0, false, false]
      let { px, py, sx, sy, spx, spy } = this.props.player
      let msx = this.props.sence.get('msx')
      let msy = this.props.sence.get('msy')
      const senceWidth = isMoveObject[this.props.sence.get('mapId')].map.width
      const senceHeight = isMoveObject[this.props.sence.get('mapId')].map.height
      const h = window.innerHeight
      const w = window.innerWidth
      const { s, left, up, down, right } = this.props.player
      const mDw = this.props.sence.get('mDw')
      const mLf = this.props.sence.get('mLf')
      const mRf = this.props.sence.get('mRf')
      const mUp = this.props.sence.get('mUp')
      const { nX, nY } = this.player

      if (left && !right) {
        x = -s
        sy = nY
        if ((spx + x) < mLf) {
          if (msx > 0) {
            msx += x
          }
          if ((spx + x) <= 0) {
            spx = 0
          } else if (msx === 0) {
            spx += x
          }
        } else {
          spx += x
        }
        isMoveX = true
      } else if (right && !left) {
        x = s
        sy = nY * 2
        const rsw = senceWidth - w

        if ((spx + x) > mRf) {
          if (msx >= rsw) {
            if (spx < w - nX) {
              spx += x
            }
          } else {
            msx += x
          }
        } else {
          spx += x
        }
        isMoveX = true
      }

      if (up && !down) {
        y = -s
        sy = nY * 3
        if ((spy + y) < mUp) {
          if (msy > 0) {
            msy += y
          }
          if ((spy + y) <= 0) {
            spy = 0
          } else if (msy === 0) {
            spy += y
          }
        } else {
          spy += y
        }
        isMoveY = true
      } else if (down && !up) {
        y = s
        sy = 0
        const dsh = senceHeight - h
        if ((spy + y) > mDw) {
          if (msy >= dsh) {
            if (spy < h - nY) {
              spy += y
            }
          } else {
            msy += y
          }
        } else {
          spy += y
        }
        isMoveY = true
      }
      if (isMoveX || isMoveY) {
        msy = msy < 0 ? 0 : msy
        msx = msx < 0 ? 0 : msx

        px = w > senceWidth ? spx - ((w - senceWidth) / 2) : msx + spx
        py = h > senceHeight ? spy - ((h - senceHeight) / 2) : msy + spy
        if (!this.isTransSence(px, py)) {
          this.af = this.af + 1 === nX ? 0 : this.af += 1
          sx = parseInt(this.af / (nX / 4), 10) * nX
          if (this.isMove(px, py)) {
            this.drawSenceAndPlayer({ px, py, sx, sy, spx, spy }, { msx, msy })
          } else if (this.isMove(px, this.props.player.py)) {
            this.drawSenceAndPlayer({ px, py: this.props.player.py, sx, sy, spx, spy: this.props.player.spy }, { msx, msy: this.props.sence.get('msy') })
          } else if (this.isMove(this.props.player.px, py)) {
            this.drawSenceAndPlayer({ px: this.props.player.px, py, sx, sy, spx: this.props.player.spx, spy }, { msx: this.props.sence.get('msx'), msy })
          } else {
            this.drawSenceAndPlayer({ px: this.props.player.px, py: this.props.player.py, sx, sy, spx: this.props.player.spx, spy: this.props.player.spy }, { msx: this.props.sence.get('msx'), msy: this.props.sence.get('msy') })
          }
        }
        if (this.props.npc.isChat) {
          this.closeChat()
        }
      }
    }
    this.aframe = this.props.rAF()(this.isDraw)
  }
  drawSenceAndPlayer(json, jsonSence) {
    this.props.pos(json)
    this.props.sen(jsonSence)
  }

  isMove(px, py) {
    const { nX, nY } = this.player
    let ismove = true
    isMoveObject[this.props.sence.get('mapId')].isMove.forEach((json) => {
      const a = px + nX >= json.x
      const b = px <= json.x + json.w
      const c = py + nY >= json.y
      const d = py <= json.y + json.h
      if (a && b && c && d) {
        ismove = false
      }
    })
    return ismove
  }
  isTransSence(px, py) {
    const { nX, nY } = this.player
    let isTransSence = false
    isMoveObject[this.props.sence.get('mapId')].isMove.forEach((json) => {
      const a = px + nX >= json.x
      const b = px <= json.x + json.w
      const c = py + nY >= json.y
      const d = py <= json.y + json.h
      if (a && b && c && d) {
        if (json.cm >= 0) {
          isTransSence = true
          this.props.sen({ mapId: json.cm, isTransSence })
          this.props.pos(
            {
              px: isMoveObject[json.cm].map.in[json.cmm].x,
              py: isMoveObject[json.cm].map.in[json.cmm].y,
            },
          )
          this.handleResize()
        }
      }
    })
    return isTransSence
  }


  // Check the player's direction, then excute isMessage
  moveAnimate() {
    const { sy, s } = this.props.player
    switch (sy) {
      case 0: // down
        this.isMessage(0, s)
        break
      case 48: // left
        this.isMessage(-s, 0)
        break
      case 96: // right
        this.isMessage(s, 0)
        break
      case 144: // up
        this.isMessage(0, -s)
        break
      default:
        break
    }
  }
  isMessage(x, y) {
    const { px, py } = this.props.player
    const { nX, nY } = this.player
    isMoveObject[this.props.sence.get('mapId')].isMove.forEach((json) => {
      const a = px + nX + x >= json.x
      const b = px + x <= json.x + json.w
      const c = py + nY + y >= json.y
      const d = py + y <= json.y + json.h
      if (a && b && c && d) {
        if (json.e >= 0) {
          const npcJson = messageObject[this.props.sence.get('mapId')][json.e]
          if (npcJson.text) {
            let messageCount = this.props.npc.messageCount ? this.props.npc.messageCount + 1 : 1
            const npcName = npcJson.name
            const npcMessage = npcJson.text.length >= messageCount
              ? npcJson.text[messageCount - 1] : npcJson.text[messageCount - 2]
            const isChat = npcJson.text.length >= messageCount
            messageCount = npcJson.text.length >= messageCount ? messageCount : 0
            this.props.mes({ messageCount, npcName, npcMessage, isChat })
          }
        }
      }
    })
  }
  closeChat() {
    const messageCount = 0
    const { npcName, npcMessage } = this.props.npc
    const isChat = false
    this.props.mes({ messageCount, npcName, npcMessage, isChat })
  }
  drawPlayer({ spx, spy, sx, sy } = this.props.player, { nX, nY } = this.player) {
    this.player.clearRect(0, 0, window.innerWidth, window.innerHeight)
    this.player.drawImage(this.img, sx, sy, nX, nY, spx, spy, nX, nY)
  }

  handleKeyDown(e) {
    switch (e.keyCode) {
      case 37:
        this.isKeyDown('left')
        break
      case 38:
        this.isKeyDown('up')
        break
      case 39:
        this.isKeyDown('right')
        break
      case 40:
        this.isKeyDown('down')
        break
      case 32:
        this.moveAnimate()
        break
      default:
        break
    }
  }

  isKeyDown(way) {
    if (!this.props.player[way]) {
      this.props.way(way, true)
    }
  }
  handleKeyUp(e) {
    switch (e.keyCode) {
      case 37:
        this.isKeyUp('left')
        break
      case 38:
        this.isKeyUp('up')
        break
      case 39:
        this.isKeyUp('right')
        break
      case 40:
        this.isKeyUp('down')
        break
      default:
        break
    }
  }
  isKeyUp(way) {
    if (this.props.player[way]) {
      this.props.way(way, false)
    }
  }
  handleResize() {
    const { nY, nX } = this.player
    const { px, py } = this.props.player
    const h = window.innerHeight
    const w = window.innerWidth
    const mh = h / 4
    const mw = w / 4
    const senceWidth = isMoveObject[this.props.sence.get('mapId')].map.width
    const senceHeight = isMoveObject[this.props.sence.get('mapId')].map.height
    const mUp = parseInt((h / 2) - mh, 10) - (parseInt((h / 2) - mh, 10) % 4)
    const mDw = parseInt((h / 2) + (mh - nY), 10) - (parseInt((h / 2) + (mh - nY), 10) % 4)
    const mLf = parseInt((w / 2) - mw, 10) - (parseInt((w / 2) - mw, 10) % 4)
    const mRf = parseInt((w / 2) + (mw - nX), 10) - (parseInt((w / 2) + (mw - nX), 10) % 4)
    let msx
    if (w > senceWidth || px <= mRf) {
      msx = 0
    } else if (px >= senceWidth - nX || (px - mRf) > (senceWidth - w)) {
      msx = senceWidth - w
    } else {
      msx = px - mRf
    }

    let msy
    if (h > senceHeight || py <= mDw) {
      msy = 0
    } else if (py >= senceHeight - nY || (py - mDw) > (senceHeight - h)) {
      msy = senceHeight - h
    } else {
      msy = py - mDw
    }
    let spx
    if (w > senceWidth) {
      spx = px + ((w - senceWidth) / 2)
    } else if (px <= mRf) {
      spx = px
    } else if (px >= senceWidth - nX || (px - mRf) > (senceWidth - w)) {
      spx = px - msx
    } else {
      spx = mRf
    }

    let spy
    if (h > senceHeight) {
      spy = py + ((h - senceHeight) / 2)
    } else if (py <= mDw) {
      spy = py
    } else if (py >= senceHeight - nY || (py - mDw) > (senceHeight - h)) {
      spy = py - msy
    } else {
      spy = mDw
    }
    this.drawSenceAndPlayer({ spx, spy }, { mUp, mDw, mLf, mRf, msx, msy })
  }
  render() {
    return (
      <div>
        <canvas
          className={this.props.sence.get('isTransSence') ? 'x-hide' : null}
          ref="player"
          width={window.innerWidth}
          height={window.innerHeight}
        />
      </div>
    )
  }
}
Player.propTypes = {
  npc: PropTypes.shape({
    isChat: PropTypes.bool,
    npcName: PropTypes.string,
    messageCount: PropTypes.number,
    npcMessage: PropTypes.any,
  }).isRequired,
  player: PropTypes.shape({
    s: PropTypes.number,
    px: PropTypes.number,
    py: PropTypes.number,
    sx: PropTypes.number,
    sy: PropTypes.number,
    spx: PropTypes.number,
    spy: PropTypes.number,
    left: PropTypes.bool,
    right: PropTypes.bool,
    up: PropTypes.bool,
    down: PropTypes.bool,
  }).isRequired,
  sence: PropTypes.any,
  pos: PropTypes.func.isRequired,
  sen: PropTypes.func.isRequired,
  mes: PropTypes.func.isRequired,
  way: PropTypes.func.isRequired,
  rAF: PropTypes.func.isRequired,
  cAF: PropTypes.func.isRequired,
}
