import React, {Component} from 'react'
import Card from './card'
import Log from './log'
import './history.sass'

export default class History extends Component {
	constructor(props) {
		super(props)
		this.state = {
			middleLineHeight: 0
		}
	}
	componentDidMount() {
		const middleLineHeight = '600px'
		setTimeout(() => this.setState({middleLineHeight}), 500)
	}
	render() {
		return (
			<Card header='經歷'>
				<div className='history'>
					<div className="middleLine" style={{height: this.state.middleLineHeight}}/>
					<Log name='盛大資訊股份有限公司' classor='前端工程師' time='2016-2017' />
					<Log name='台灣惠多笑有限公司' classor='網頁工程師' time='2013-2016' />
					<Log name='威弘數位工程有限公司' classor='系統工程師' time='2012-2012' />
					<Log name='宗賢科技有限公司' classor='系統工程師' time='2011-2012' />
					<Log name='正修科技大學' classor='電機學生' time='2006-2010' />
				</div>
			</Card>
		)
	}
}
