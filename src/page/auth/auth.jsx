import React, { useEffect, useState } from 'react';
// import PropTypes from 'prop-types'
import currentHistory from '../../config/currentHistory';

import './auth.sass';

const Main = () => {
  // const { test, setTest } = useState([]);
  /**
   * 透過 Google 授權註冊/登入
   * @param {any} provider 授權資料
   * @return {void}
   */
  const firebaseAuth = (provider) => {
    firebase.chatAH
      .signInWithPopup(provider)
      .then((result) => {
        const { uid, displayName, photoURL } = result.user;
        const onlineState = true;
        firebase.chatDB
          .ref(`members/${uid}`)
          .set({ displayName, photoURL, onlineState });
        currentHistory.push('/chat');
      })
      .catch((error) => {
        console.log(error);
      });
  }
  /**
   * 取得會員資料
   * @returns {JSON} 取得會員資料
   */
  // const getUser = () => firebase.chatAH.currentUser;
  /**
   * 透過 Google 授權註冊/登入
   * @return {void}
   */
  const authGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/plus.login');
    firebaseAuth(provider);
  }
  /**
   * 透過 Facebook 授權註冊/登入
   * @return {void}
   */
  const authFacebook = () => {
    const provider = new firebase.auth.FacebookAuthProvider();
    firebaseAuth(provider);
  }
  /**
   * 透過 Github 授權註冊/登入
   * @return {void}
   */
  const authGithub = () => {
    const provider = new firebase.auth.GithubAuthProvider();
    firebaseAuth(provider);
  }
  return (
    <div className="text-xs-center" id="auth">
      <div id="loginBox">
        <h1>登入</h1>
        <div id="login">
          <button id="github" onClick={authGithub}>
            <i className="fa fa-github" />
          </button>
          <button id="facebook" onClick={authFacebook}>
            <i className="fa fa-facebook" />
          </button>
          <button id="google" onClick={authGoogle}>
            <i className="fa fa-google" />
          </button>
        </div>
        <p>選擇方式登入，登入後才可留言唷!</p>
      </div>
    </div>
  )
}

export default Main
// Main.propTypes = {
//   chatMessageOn: PropTypes.func,
//   addMessage: PropTypes.func,
// }
