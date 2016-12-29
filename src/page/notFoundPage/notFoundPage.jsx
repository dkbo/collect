import React from 'react';
import { Link } from 'react-router';
import './notFoundPage.sass'

const NotFoundPage = () => (
	<div id='notFoundPage' className='container'>
		<h1>404</h1>
		<Link to='/'>首頁</Link>
	</div>
)

export default NotFoundPage
