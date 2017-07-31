import React, { Component } from 'react'
import './minigame.sass'

const requestAFrame = (() => window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  function (callback) {
    return window.setTimeout(callback, 1000 / 60);
  })();
export default class MiniGame extends Component {
  constructor(props) {
    super(props)
    this.startGame = ::this.startGame
    this.animation = ::this.animation
  }
  state = {
    score: 0,
    hp: 10,
  }
  componentWillMount() {
    window.addEventListener('keydown', (e) => {
      switch (e.keyCode) {
        case 32:
          this.bow.push({ x: 15 + this.x, y: this.y + 10 });
          break;
        case 37:
          this.key.left = true;
          break;
        case 38:
          this.key.up = true;
          break;
        case 39:
          this.key.right = true;
          break;
        case 40:
          this.key.down = true;
          break;
        default:
          break

      }
    });
    window.addEventListener('keyup', (e) => {
      switch (e.keyCode) {
        case 37:
          this.key.left = false;
          break;
        case 38:
          this.key.up = false;
          break;
        case 39:
          this.key.right = false;
          break;
        case 40:
          this.key.down = false;
          break;
        default:
          break
      }
    });
  }
  componentDidMount() {
    this.startGame();
  }
  setXY(x, y) {
    this.x = x;
    this.y = y;
  }
  x = 50
  y = 100
  w = 15
  h = 20
  sp = 4
  key = {
    up: false,
    right: false,
    down: false,
    left: false,
  }
  bow = []
  wall = []
  animation() {
    this.c.clearRect(0, 0, 9999, 9999)
    this.c.beginPath();
    this.c.lineWidth = 1;
    this.c.rect(this.x, this.y, this.h, this.w)

    if (this.key.up && this.y > 0) {
      this.setXY(this.x, this.y - this.sp)
    }
    if (this.key.right && (this.x + this.w) < this.refs.canvas.width) {
      this.setXY(this.x + this.sp, this.y)
    }
    if (this.key.down && (this.y + this.h) < this.refs.canvas.height) {
      this.setXY(this.x, this.y + this.sp)
    }
    if (this.key.left && this.x > 0) {
      this.setXY(this.x - this.sp, this.y)
    }
    if (this.bow.length > 0) {
      for (let x in this.bow) {
        this.bow[x].x = this.bow[x].x + 5
        if (this.bow[x].x >= this.refs.canvas.width) {
          this.bow.splice(x, 1);
          x--;
          continue;
        }
        if (this.wall.length > 0) {
          let ism = false;
          for (const y in this.wall) {
            const left = this.bow[x].x + 10 > this.wall[y].x
            const top = this.bow[x].y - this.wall[y].y > 0
            const height = this.bow[x].y - this.wall[y].h <= this.wall[y].y
            if (left && top && height) {
              this.wall.splice(y, 1);
              ism = true;
              break;
            }
          }
          if (ism) {
            this.setState({ score: this.state.score + 100 })
            this.bow.splice(x, 1);
            x--;
            continue;
          }
        }
        this.c.moveTo(this.bow[x].x, this.bow[x].y)
        this.c.lineTo(this.bow[x].x + 10, this.bow[x].y)
      }
    }
    this.c.closePath();
    this.c.stroke();

    if (this.wall.length > 0) {
      for (let x in this.wall) {
        if (this.wall[x].x < 0) {
          this.wall.splice(x, 1);
          this.setState({ hp: this.state.hp - 1 })
          x--;
          continue;
        }
        this.c.beginPath();
        this.wall[x].x = this.wall[x].x - 2;
        this.c.lineWidth = this.wall[x].w;
        this.c.moveTo(this.wall[x].x, this.wall[x].y);
        this.c.lineTo(this.wall[x].x, this.wall[x].y + this.wall[x].h);
        this.c.closePath();
        this.c.stroke();
      }
    }
    if (this.random(0, 33) === 0) {
      this.wall.push({
        x: this.refs.canvas.width,
        y: this.random(0, this.refs.canvas.height - 30),
        h: this.random(10, 30),
        w: this.random(3, 10),
      });
    }
    this.state.hp > 0 && requestAFrame(this.animation);
  }
  random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  startGame() {
    this.setState({
      score: 0,
      hp: 10,
    }, () => {
      this.refs.canvas.height = window.innerHeight
      this.refs.canvas.width = window.innerWidth
      this.c = this.refs.canvas.getContext('2d')
      this.x = 50
      this.y = 100
      this.w = 15
      this.h = 20
      this.sp = 4
      this.key = {
        up: false,
        right: false,
        down: false,
        left: false,
      }
      this.bow = []
      this.wall = []
      requestAFrame(this.animation);
    })
  }
  render() {
    return (
      <div id="miniGame">
        { this.state.hp
          ? <canvas ref="canvas" id="canvas1" width="1200px" height="1000px" />
          : <div className="gameover" onClick={this.startGame}>Game Over</div>
        }
        <div className="score"><strong>Score:</strong> {this.state.score}/hp: {this.state.hp}</div>
      </div>
    )
  }
}
