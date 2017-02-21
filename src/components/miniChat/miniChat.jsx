import React, { Component, PropTypes } from 'react'
import Messages from './components/messages'
import Control from './components/control'
import './miniChat.sass'

export default class Chat extends Component {
  componentDidMount() {
    this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight
  }
  shouldComponentUpdate(props, state) {
    return props.chat !== this.props.chat
      || props.miniChat !== this.props.miniChat
      || this.state !== state
  }
  componentDidUpdate() {
    this.refs.messageBlock.scrollTop = this.refs.messageBlockUl.clientHeight
  }
  componentWillUnmount() {
    firebase.chatDB
      .ref('.info/connected')
      .off('value', this.connected)
    firebase.chatDB
      .ref('members')
      .off('child_changed', this.userOnlineLog)
  }
  getUser = () => firebase.chatAH.currentUser
  handleClick = () => {
    this.props.toggleMinichat(this.props.chat.size)
  }

  render() {
    const user = this.getUser()
      ? this.getUser()
      : {
        uid: null,
      }
    const isShow = this.props.miniChat.get('isShow')
    const count = this.props.chat.size - this.props.miniChat.get('count')

    return (
      <div id="miniChat" style={this.props.miniChatStyle} className={isShow ? 'active' : ''}>
        <div id="miniChatBox" className="card">
          <button className="card-header" ref="miniChatHeader" onClick={this.handleClick}>
            <b>多人聊天窗口
              {!isShow && count
                ? <span className="tag tag-danger">{count}</span>
                : null
              }
            </b>
          </button>
          <div
            className="card-block"
            ref="messageBlock"
          >
            <ul ref="messageBlockUl">
              {this.props.chat
                .map(obj => <Messages
                  key={obj.timestamp}
                  className={obj.uid === user.uid
                  ? 'clearfix messagesSelf'
                  : 'clearfix messagesOther'}
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
  chat: PropTypes.object.isRequired,
  clearMessage: PropTypes.func,
  toggleMinichat: PropTypes.func,
  miniChat: PropTypes.object.isRequired,
  miniChatStyle: PropTypes.object,
}
