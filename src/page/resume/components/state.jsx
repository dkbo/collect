import React from 'react'
import Card from './card'
import Chart from './chart'
import './state.sass'

const State = () => (
  <div className="state">
    <ul className="row">
      <Chart color="red" textColor="white" percent="80" text="HTML" />
      <Chart color="blue" textColor="white" percent="60" text="CSS" />
      <Chart color="green" textColor="white" percent="90" text="Javascript" />
    </ul>
  </div>
)

const About = () => (
  <Card header="狀態">
    <State />
  </Card>
)
export default About
