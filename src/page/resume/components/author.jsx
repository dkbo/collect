import React, {Component} from 'react'
import Card from './card'
import './author.sass'

const Media = () => (
	<div className="media author">
		<div className="media-body">
			<p>個性率真不做作，平常喜歡聽聽音樂哼哼歌、玩玩遊戲、吸收新知等來紓解壓力，不喜歡拖泥帶水的事情纏身</p>
			<p>主要志向是以 Javascript 來開發前端、後端、桌面 APP、手機 APP，未來勢必會成為不可或缺的人才。 </p>
		</div>
	</div>
)

export default class Author extends Component {
	render() {
		return (
			<Card header='人物介紹'>
				<Media />
			</Card>
		)
	}
}
