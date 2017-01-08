import React, {Component, PropTypes} from 'react'
import './log.sass'

export default class Log extends Component {
	constructor(props) {
		super(props)
		this.state = {
			logOpacity: 0,
			stemWidth: 0
		}
	}
	componentDidMount() {
		const logOpacity = 1
		const stemWidth = '100px'
		setTimeout(() => this.setState({stemWidth}), 1500)
		setTimeout(() => this.setState({logOpacity}), 2100)
	}
	render() {
		return (
			<div className="log">
				<div className="stem" style={{width: this.state.stemWidth}}/>
				<section style={{opacity: this.state.logOpacity}}>
					<div className='name'>{this.props.name}</div>
					<div className='class'>{this.props.classor}</div>
					<div className='time'>{this.props.time}</div>
				</section>
			</div>
		)
	}
}

Log.propTypes = {
	name: PropTypes.string.isRequired,
	classor: PropTypes.string.isRequired,
	time: PropTypes.string.isRequired,
}