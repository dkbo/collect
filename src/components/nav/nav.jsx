import React, { Component } from 'react'
import NavItem from './components/navItem'
import currentHistory from '../../config/currentHistory'
import './nav.sass'

const navItems = [
  {
    to: '/',
    id: 'home',
    title: '首頁',
  },
  {
    to: '/resume',
    id: 'resume',
    title: 'e履歷',
  },
  {
    to: '/rpgroom',
    id: 'rpgroom',
    title: '遊戲室',
  },
  {
    to: '/search',
    id: 'search',
    title: '外部查詢',
  },
  {
    to: '/directions',
    id: 'directions',
    title: '地圖導航',
  },
  {
    to: '/chat',
    id: 'chat',
    title: '多人聊天',
  },
]

export default class Nav extends Component {
  state = {
    isShowNav: false,
  }

  getUser = () => firebase.chatAH.currentUser;

  getNavbarClass = () => (this.state.isShowNav ? 'nav navbar-nav active' : 'nav navbar-nav')

  /**
   * 在解析度寬度 767px 以下顯示隱藏選單
   * @returns {void}
   */
  navToggle = () => this.setState({ isShowNav: !this.state.isShowNav })

  logout = () => {
    firebase.chatAH
    .signOut()
    .then(() => {
      console.log('登出成功')
      currentHistory.push('/auth')
    })
    .catch((error) => {
      console.log('登出失敗', error)
    });
  }

  login = () => currentHistory.push('/auth')

  render() {
    const user = this.getUser()
    return (
      <nav id="navTop" className="navbar navbar-dark navbar-full">
        <button className="btn hidden-md-up" onClick={this.navToggle}><i className="fa fa-bars" /></button>
        <ul className={this.getNavbarClass()}>
          {navItems.map(item =>
            <NavItem to={item.to} key={item.id} title={item.title} navToggle={this.navToggle} />)}
        </ul>
        <div className="float-xs-right">
          {user ? <button className="btn"><img className="rounded" src={user.photoURL} alt="" /></button> : null}
          {user ? <button className="btn" onClick={this.logout} ><i className="fa fa-sign-out" /></button> : <button className="btn" onClick={this.login} ><i className="fa fa-sign-out" /></button>}
        </div>
      </nav>
    )
  }
}
