import React, { useEffect, createRef } from 'react'
import Card from './card'
import list from '../constants/coudlist'
import './skill.sass'


const About = () => {
  const canvasEl = createRef(null)
  const configration = {
    list,
    gridSize: 12,
    weightFactor: 8,
    fontFamily: 'cursive, sans-serif',
    color: 'white',
    hover: window.drawBox,
    click: drawWordCloud,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    wait: 100,
  }
  function drawWordCloud() {
    WordCloud(canvasEl.current, configration);
  }
  useEffect(() => {
    drawWordCloud()
  }, [])


  return (
    <Card header="技能">
      <div className="skill">
        <canvas ref={canvasEl} width="600px" height="400px" />
      </div>
    </Card>
  )
}
export default About
