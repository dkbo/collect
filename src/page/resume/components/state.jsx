import React, {Component} from 'react'
import Card from './card'
import Chart from './chart'
import './state.sass'

const State = () => (
	<div className="state">
		<ul className='row'>
			<Chart color='red' textColor='white' percent='75' text='HTML' />
			<Chart color='blue' textColor='white' percent='65' text='CSS' />
			<Chart color='green' textColor='white' percent='60' text='Javascript' />
		</ul>
	</div>
)

export default class About extends Component {
	render() {
		return (
			<Card header='狀態'>
				<State />
			</Card>
		)
	}
}
