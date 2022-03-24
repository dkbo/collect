import React, { useEffect, useState, createRef, useRef } from 'react'
import './minigame.sass'

const requestAFrame = (() =>
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  (callback => window.setTimeout(callback, 1000 / 60))
)()

let x = 50
let y = 100
let w = 15
let h = 20
let sp = 4
let key = {
  up: false,
  right: false,
  down: false,
  left: false,
}
let bow = []
let wall = []
let c = null

const MiniGame = () => {
  const requestRef = useRef();
  const canvasEl = createRef(null)
  const [score, setScore] = useState(0)
  const [hp, setHp] = useState(10)
  const keydown = (e) => {
    switch (e.keyCode) {
      case 32:
        bow.push({ x: 15 + x, y: y + 10 })
        break
      case 37:
        key.left = true
        break
      case 38:
        key.up = true
        break
      case 39:
        key.right = true
        break
      case 40:
        key.down = true
        break
      default:
        break
    }
  }
  const keyup = (e) => {
    switch (e.keyCode) {
      case 37:
        key.left = false
        break
      case 38:
        key.up = false
        break
      case 39:
        key.right = false
        break
      case 40:
        key.down = false
        break
      default:
        break
    }
  }
  // eslint-disable-next-line no-shadow
  const setXY = (x2, y2) => {
    x = x2
    y = y2
  }
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

  const animation = () => {
    if (!canvasEl.current) return
    c.clearRect(0, 0, 9999, 9999)
    c.beginPath()
    c.lineWidth = 1
    c.rect(x, y, h, w)
    // console.log(key.up);
    if (key.up && y > 0) {
      setXY(x, y - sp)
    }
    if (key.right && x + w < canvasEl.current.width) {
      setXY(x + sp, y)
    }
    if (key.down && y + h < canvasEl.current.height) {
      setXY(x, y + sp)
    }
    // console.log(key);
    if (key.left && x > 0) {
      setXY(x - sp, y)
    }
    if (bow.length > 0) {
      for (let x in bow) {
        bow[x].x = bow[x].x + 5
        if (bow[x].x >= canvasEl.current.width) {
          bow.splice(x, 1)
          x--
          continue
        }
        if (wall.length > 0) {
          let ism = false
          for (const y in wall) {
            const left = bow[x].x + 10 > wall[y].x
            const top = bow[x].y - wall[y].y > 0
            const height = bow[x].y - wall[y].h <= wall[y].y
            if (left && top && height) {
              wall.splice(y, 1)
              ism = true
              break
            }
          }
          if (ism) {
            setScore(score => score + 100)
            bow.splice(x, 1)
            x--
            continue
          }
        }
        c.moveTo(bow[x].x, bow[x].y)
        c.lineTo(bow[x].x + 10, bow[x].y)
      }
    }
    c.closePath()
    c.stroke()

    if (wall.length > 0) {
      for (let x in wall) {
        if (wall[x].x < 0) {
          wall.splice(x, 1)
          setHp(hp - 1)
          x--
          continue
        }
        c.beginPath()
        wall[x].x = wall[x].x - 2
        c.lineWidth = wall[x].w
        c.moveTo(wall[x].x, wall[x].y)
        c.lineTo(wall[x].x, wall[x].y + wall[x].h)
        c.closePath()
        c.stroke()
      }
    }
    if (random(0, 33) === 0) {
      wall.push({
        x: canvasEl.current.width,
        y: random(0, canvasEl.current.height - 30),
        h: random(10, 30),
        w: random(3, 10),
      })
    }
    requestRef.current = requestAFrame(animation)
  }
  const startGame = () => {
    setScore(0)
    setHp(10)
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
    requestRef.current = requestAFrame(animation)
  }

  useEffect(() => {
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    if (canvasEl.current) {
      canvasEl.current.height = window.innerHeight
      canvasEl.current.width = window.innerWidth
      c = canvasEl.current.getContext('2d')
      requestRef.current = requestAFrame(animation)
    }
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      cancelAnimationFrame(requestRef.current)
    }
  }, [canvasEl])

  useEffect(() => {
    // console.log(key);
  })


  return (
    <div id="miniGame">
      {hp
        ? <canvas ref={canvasEl} id="canvas1" width="1200px" height="1000px" />
        : <div className="gameover" onClick={startGame}>
          Game Over
        </div>
      }
      <div className="score">
        <strong>Score:</strong> {score}/hp: {hp}
      </div>
    </div>
  )
}

export default MiniGame
