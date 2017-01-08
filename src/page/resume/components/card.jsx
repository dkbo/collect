import React, {Component, PropTypes} from 'react'
import './card.sass'

export default class Card extends Component {
	render() {
		return (
			<div className='card'>
				<div className="h3 text-xs-center">{this.props.header}</div>
				{this.props.children}
			</div>
		)
	}
}

Card.proptypes = {
	header: PropTypes.string.isRequired,
}
