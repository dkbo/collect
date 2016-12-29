import React from 'react';
import {Link} from 'react-router'

const example = () => (
	<div className="card">
    <h3 className="card-header">Card 範例三</h3>
    <div className="card-block">
      <h4 className="card-title">Test</h4>
      <p className="card-text text-justify">TestTestT estTestTes tTestTestT estTe stTestTes tTestTes tTestTe stTest</p>
      <Link to='/main2' className="card-link">test</Link>
    </div>
  </div>
)

export default example
