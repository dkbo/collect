import React, {Component} from 'react'
import Heading  from './components/heading'
import './home.sass'

export default class Home extends Component {
	render() {
		return (
			<div id='home' className='container'>
				<Heading />
			</div>
		)
	}
}