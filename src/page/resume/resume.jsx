import React, { Component } from 'react'
import About from './components/about'
import Author from './components/author'
import History from './components/history'
import Skill from './components/skill'
import State from './components/state'

import './resume.sass'

export default class Resume extends Component {

  render() {
    return (
      <div className="container-fluid" id="resume">
        <div className="masonry">
          <About />
          <Author />
          <State />
          <History />
          <Skill />
        </div>
      </div>
    )
  }
}
