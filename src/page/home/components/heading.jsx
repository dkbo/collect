import React from 'react'
import Highlight from 'react-syntax-highlighter'
import { monokai } from 'react-syntax-highlighter/dist/styles/hljs';

import head from '../../../images/aboutbg.jpg'

const highlight = `/**
 * @作者 DKBO
 * @Blog https://dkbo-blog.github.io【react-syntax-highlighter
 * @LICENSE MIT
 * @returns {作品} Me
 */

<div className="col col-md-6">
    <div className="card">
        <img className="card-img-top" src={head} style={{width: '100%'}}/>
    </div>
</div>
<div className="col col-md-6">
    <div className='hidden-md-down'>
        <div className='h1 '><a href="https://github.com/dkbo/collect"><i className="fa fa-github"></i></a>大家好我是<code>DKBO</code></div>
        <hr />
    </div>
    <div>
        <div className='h2'><a href="https://github.com/dkbo/collect"><i className="fa fa-github"></i></a>大家好我是<code>DKBO</code></div>
        <hr/>
    </div>
    <div className='hidden-sm-down'>
        <div className='h3'><a href="https://github.com/dkbo/collect"><i className="fa fa-github"></i></a>大家好我是<code>DKBO</code></div>
        <hr/>
    </div>
    <div className='hidden-sm-down'>
        <div className='h4'><a href="https://github.com/dkbo/collect"><i className="fa fa-github"></i></a>大家好我是<code>DKBO</code></div>
        <hr/>
    </div>
    <div className='hidden-sm-down'>
        <div className='h5'><a href="https://github.com/dkbo/collect"><i className="fa fa-github"></i></a>大家好我是<code>DKBO</code></div>
        <hr/>
    </div>
    <div className='hidden-sm-down'>
        <div className='h6'><a href="https://github.com/dkbo/collect"><i className="fa fa-github"></i></a>大家好我是<code>DKBO</code></div>
    </div>
</div>`


const Heading = () => (
  <div>
    <h2 className="card-header">5年前(過去式)</h2>
    <div className="card-block row">
      <div className="col col-md-6">
        <div className="card">
          <img className="card-img-top" src={head} style={{ width: '100%' }} alt="" />
        </div>
      </div>
      <div className="col col-md-6">
        <div className="hidden-md-down">
          <div className="h1 "><a href="https://github.com/dkbo/collect"><i className="fa fa-github" /></a>大家好我是<code>DKBO</code></div>
          <hr />
        </div>
        <div>
          <div className="h2"><a href="https://github.com/dkbo/collect"><i className="fa fa-github" /></a>大家好我是<code>DKBO</code></div>
          <hr />
        </div>
        <div className="hidden-sm-down">
          <div className="h3"><a href="https://github.com/dkbo/collect"><i className="fa fa-github" /></a>大家好我是<code>DKBO</code></div>
          <hr />
        </div>
        <div className="hidden-sm-down">
          <div className="h4"><a href="https://github.com/dkbo/collect"><i className="fa fa-github" /></a>大家好我是<code>DKBO</code></div>
          <hr />
        </div>
        <div className="hidden-sm-down">
          <div className="h5"><a href="https://github.com/dkbo/collect"><i className="fa fa-github" /></a>大家好我是<code>DKBO</code></div>
          <hr />
        </div>
        <div className="hidden-sm-down">
          <div className="h6"><a href="https://github.com/dkbo/collect"><i className="fa fa-github" /></a>大家好我是<code>DKBO</code></div>
        </div>
      </div>
    </div>
    <Highlight showLineNumbers language="html" style={monokai}>{highlight}</Highlight>
  </div>
)


export default Heading
