import React, {Component} from 'react'
import Heading  from './components/heading'
import RPG  from './components/rpg'
import AboutFirebase  from './components/aboutFirebase'

import './home.sass'

export default class Home extends Component {
	render() {
		return (
			<div id='home' className='container'>
				<div className="card">
					<Heading />
					<RPG />
					<AboutFirebase />
				</div>
			</div>
		)
	}
}