import React from 'react'
import PropTypes from 'prop-types'
import Card from './card'
import './about.sass'

const Pair = ({ label, span }) => (
  <div className="pair">
    <label htmlFor="null">{label}</label>
    <span>{span}</span>
  </div>
)
Pair.propTypes = {
  label: PropTypes.string.isRequired,
  span: PropTypes.string.isRequired,
}

const Media = () => (
  <div className="about media">
    <a href="" className="media-left">
      <div className="imgBox">
        <img src="https://avatars.githubusercontent.com/u/10608131?v=3" alt="" />
      </div>
    </a>
    <div className="media-body">
      <div className="h4 media-heading">盧宏寶</div>
      <Pair label="Class:" span="高階前端工程師" />
      <Pair label="Level:" span="9年" />
      <Pair label="Email:" span="dk880842@gmail.com" />
      <Pair label="Location:" span="台灣高雄市" />
    </div>
  </div>
)

const About = () => (
  <Card header="人物">
    <Media />
  </Card>
)

export default About
