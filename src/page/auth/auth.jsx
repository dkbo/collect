import React, { Component, PropTypes } from 'react'
import currentHistory from '../../config/currentHistory'

import './auth.sass'

export default class Main extends Component {
	constructor(porps) {
		super(porps)
		this.state = {
			test: []
		}
		this.authGoogle = ::this.authGoogle
		this.authFacebook = ::this.authFacebook
		this.authGithub = ::this.authGithub
		this.firebaseAuth = ::this.firebaseAuth
	}
	componentWillMount() {
		document.body.className = 'auth'
	}
	componentWillUnmount() {
		document.body.className = ''
	}
	/**
	 * 透過 Google 授權註冊/登入
	 * @return {void}
	 */
	authGoogle() {
		var provider = new firebase.auth.GoogleAuthProvider();
		provider.addScope('https://www.googleapis.com/auth/plus.login');
		this.firebaseAuth(provider)
	}
	/**
	 * 透過 Facebook 授權註冊/登入
	 * @return {void}
	 */
	authFacebook() {
		var provider = new firebase.auth.FacebookAuthProvider();
		this.firebaseAuth(provider)
	}
	/**
	 * 透過 Github 授權註冊/登入
	 * @return {void}
	 */
	authGithub() {
		var provider = new firebase.auth.GithubAuthProvider();
		this.firebaseAuth(provider)
	}
	/**
	 * 透過 Google 授權註冊/登入
	 * @param {any} provider 授權資料
	 * @return {void}
	 */
	firebaseAuth(provider) {
		firebase.chatAH.signInWithPopup(provider)
			.then(result => {
				const {uid, displayName, photoURL} = result.user
				const onlineState = true
				firebase.chatDB.ref('members/' + uid).set({ displayName, photoURL, onlineState })
				currentHistory.push('/chat')
			}).catch(error => {
				console.log(error);
			});
	}
	/**
	 * 取得會員資料
	 * @returns {JSON} 取得會員資料
	 */
	getUser() {
		return firebase.chatAH.currentUser;
	}
	render() {
		return (
			<div className='container text-xs-center'>
				<div id='loginBox'>
					<h1>登入</h1>
					<div id="login">
						<button id="github" onClick={this.authGithub}><i className="fa fa-github"></i></button>
						<button id="facebook" onClick={this.authFacebook}><i className="fa fa-facebook"></i></button>
						<button id="google" onClick={this.authGoogle}><i className="fa fa-google"></i></button>
					</div>
					<p>選擇方式登入，登入後才可留言唷!</p>
				</div>
			</div>
		)
	}
}

Main.propTypes = {
	chatMessageOn: PropTypes.func,
	add_message: PropTypes.func,
}
