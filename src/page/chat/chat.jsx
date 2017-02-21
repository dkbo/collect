import React, { Component, PropTypes } from 'react'
import Messages from './components/messages'
import Control from './components/control'
import './chat.sass'

export default class Chat extends Component {

  componentDidMount() {
    this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight
  }
  shouldComponentUpdate(props) {
    return props.chat !== this.props.chat
  }
  componentDidUpdate() {
    this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight
  }
  componentWillUnmount() {
    firebase.chatDB
      .ref('.info/connected')
      .off('value', this.connected);
  }
  /**
   * 判斷 message 是使用者自己的還是他人的來決定放哪個 className
   * @param {any} uid uid
   * @returns {String} className
   */
  getMessageClassName(uid) {
    if (this.getUser()) {
      return uid === this.getUser().uid
        ? 'clearfix messagesSelf'
        : 'clearfix messagesOther'
    }
    return 'clearfix messagesOther'
  }
  /**
     * 取得會員的資訊
     * @returns {Object} 會員資訊
     */
  getUser = () => firebase.chatAH.currentUser;

  render() {
    // 'background': `url("${p1}")`
    return (
      <div className="container-fluid" ref="chat" id="chat">
        <div id="chatBox" className="card">
          <div className="card-block" ref="messageBlock" id="messageBlock">
            <ul ref="messageBlockUl">
              {this.props.chat.map(obj =>
                <Messages
                  key={obj.timestamp}
                  className={this.getMessageClassName(obj.uid)}
                  photoURL={obj.photoURL}
                  displayName={obj.displayName}
                  message={obj.message}
                  type={obj.type}
                />)}
            </ul>
          </div>
        </div>
        <Control clearMessage={this.props.clearMessage} />
      </div>
    )
  }
}

Chat.propTypes = {
  chat: PropTypes.object,
  clearMessage: PropTypes.func,
}
