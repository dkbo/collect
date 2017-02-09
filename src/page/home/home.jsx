import React from 'react'
import Heading from './components/heading'
import RPG from './components/rpg'
import AboutFirebase from './components/aboutFirebase'

import './home.sass'

const Home = () => (
  <div id="home" className="container">
    <div className="card">
      <Heading />
      <RPG />
      <AboutFirebase />
    </div>
  </div>
)

export default Home
