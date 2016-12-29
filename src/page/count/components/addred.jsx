import React, { PropTypes } from 'react';

const Addred = P => (
	<div>
		<h1>{P.title}</h1>
		<button onClick={P.add}>增加</button>
		<button onClick={P.red}>減少</button>
		<span>{P.value}</span>
	</div>
)

Addred.propTypes = {
	title: PropTypes.string.isRequired,
	add: PropTypes.func.isRequired,
	red: PropTypes.func.isRequired,
	value: PropTypes.number.isRequired
}
export default Addred
