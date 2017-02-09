import React, { Component } from 'react'
import About from './components/about'
import Author from './components/author'
import History from './components/history'
import Skill from './components/skill'
import State from './components/state'

import './resume.sass'

export default class Resume extends Component {
  componentWillMount() {
    document.body.className = 'resume'
  }
  componentWillUnmount() {
    document.body.className = ''
  }
  render() {
    return (
      <div className="container-fluid">
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
