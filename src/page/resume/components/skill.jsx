import React, { Component } from 'react'
import Card from './card'
import list from '../constants/coudlist'
import './skill.sass'


export default class About extends Component {
  constructor(prop) {
    super(prop)
    this.drawWordCloud = ::this.drawWordCloud
    this.configration = {
      list,
      gridSize: 12,
      weightFactor: 8,
      fontFamily: 'cursive, sans-serif',
      color: 'white',
      hover: window.drawBox,
      click: this.drawWordCloud,
      backgroundColor: 'rgba(0, 0, 0, 0)',
      wait: 100,
    }
  }
  componentDidMount() {
    this.drawWordCloud()
  }
  drawWordCloud() {
    WordCloud(this.refs.canvas, this.configration);
  }
  render() {
    return (
      <Card header="技能">
        <div className="skill">
          <canvas ref="canvas" width="600px" height="400px" />
        </div>
      </Card>
    )
  }
}
