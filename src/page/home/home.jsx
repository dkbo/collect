import React from 'react'
import Heading from './components/heading'
import HeadingNew from './components/headingNew'
import RPG from './components/rpg'
import AboutFirebase from './components/aboutFirebase'

import './home.sass'

const Home = () => (
  <div id="home" className="container">
    <div className="card">
      <HeadingNew />
      <Heading />
      <RPG />
      <AboutFirebase />
    </div>
  </div>
)

export default Home
