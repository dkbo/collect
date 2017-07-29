webpackJsonp([6],{422:function(e,t,n){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var s=n(564),a=s.a;t.default=a,function(){"undefined"!=typeof __REACT_HOT_LOADER__&&__REACT_HOT_LOADER__.register(a,"default","C:/Github/collect/src/page/chat/index.jsx")}()},430:function(e,t,n){"use strict";var s=n(41),a=n.n(s),_=n(68),r=n.n(_),o=n(69),i=n.n(o),c=n(72),u=n.n(c),l=n(71),p=n.n(l),h=n(70),f=n.n(h),g=n(3),m=n.n(g),E=n(195),y=n(73),T=n(432);n.n(T),n.d(t,"a",function(){return d});var d=function(e){function t(){var e,n,s,a;i()(this,t);for(var _=arguments.length,o=Array(_),c=0;c<_;c++)o[c]=arguments[c];return n=s=p()(this,(e=t.__proto__||r()(t)).call.apply(e,[this].concat(o))),s.state={message:""},s.getPlaceholder=function(){var e;return(e=s).__getPlaceholder__REACT_HOT_LOADER__.apply(e,arguments)},s.getUser=function(){var e;return(e=s).__getUser__REACT_HOT_LOADER__.apply(e,arguments)},s.setMessage=function(){var e;return(e=s).__setMessage__REACT_HOT_LOADER__.apply(e,arguments)},s.setGeoLocation=function(){var e;return(e=s).__setGeoLocation__REACT_HOT_LOADER__.apply(e,arguments)},s.SendMessage=function(){var e;return(e=s).__SendMessage__REACT_HOT_LOADER__.apply(e,arguments)},a=n,p()(s,a)}return f()(t,e),u()(t,[{key:"componentWillMount",value:function(){this.keyDownSubject=new Rx.Subject,this.changeSubject=new Rx.Subject,this.clickSubject=new Rx.Subject,this.keyDown=this.keyDownSubject.filter(function(e){return 13===e.keyCode}).throttleTime(1e3).do(this.SendMessage),this.change=this.changeSubject.do(this.setMessage),this.click=this.clickSubject.throttleTime(500).do(this.props.clearMessage),this.event=Rx.Observable.merge(this.change,this.keyDown,this.click).subscribe()}},{key:"componentWillUnmount",value:function(){this.event.unsubscribe()}},{key:"__getPlaceholder__REACT_HOT_LOADER__",value:function(){return this.__getPlaceholder__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__getPlaceholder__REACT_HOT_LOADER__",value:function(){return this.getUser()?"留言":"登入後才可留言唷~"}},{key:"__getUser__REACT_HOT_LOADER__",value:function(){return this.__getUser__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__getUser__REACT_HOT_LOADER__",value:function(){return firebase.chatAH.currentUser}},{key:"getGeoLocation",value:function(e,t){var n=this;E.a.getCurrentPosition(function(s){var _=[s.coords.latitude,s.coords.longitude],r=_[0],o=_[1];n.setGeoLocation(e,a()({},t,{lat:r,lng:o,uid:e}))})}},{key:"__setMessage__REACT_HOT_LOADER__",value:function(){return this.__setMessage__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__setMessage__REACT_HOT_LOADER__",value:function(e){return this.setState({message:e.target.value})}},{key:"__setGeoLocation__REACT_HOT_LOADER__",value:function(){return this.__setGeoLocation__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__setGeoLocation__REACT_HOT_LOADER__",value:function(e,t){firebase.geoDB.ref("geolocation/"+e).set(t).then(function(){})}},{key:"__SendMessage__REACT_HOT_LOADER__",value:function(){return this.__SendMessage__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__SendMessage__REACT_HOT_LOADER__",value:function(){var e=this,t=this.getUser();t?!function(){var n=e.state.message;n.trim("")&&!function(){var s=/(?:[?&]v=|\/embed\/|\/1\/|\/v\/|https:\/\/(?:www\.)?youtu\.be\/)([^&\n?#]+)/,a=n.match(s),_=t.uid,r=t.displayName,o=t.photoURL,i=firebase.database.ServerValue.TIMESTAMP,c=a?{uid:_,message:a[1],type:"youtube",timestamp:i}:{uid:_,message:n,timestamp:i};firebase.chatDB.ref("messages/").push(c).then(function(){c=a?{message:a[1],type:"youtube",timestamp:i,photoURL:o,displayName:r}:{message:n,timestamp:i,photoURL:o,displayName:r},e.getGeoLocation(_,c)}),e.setState({message:""})}()}():y.a.push("/auth")}},{key:"render",value:function(){var e=this;return m.a.createElement("div",{className:"control"},m.a.createElement("input",{className:"form-control",type:"text",value:this.state.message,placeholder:this.getPlaceholder(),onChange:function(t){return e.changeSubject.next(t)},onKeyDown:function(t){return e.keyDownSubject.next(t)}}),m.a.createElement("button",{className:"btn",type:"button",title:"發送",onClick:this.SendMessage},m.a.createElement("i",{className:"fa fa-paper-plane"})),m.a.createElement("button",{className:"btn",type:"button",title:"清除",onClick:function(t){return e.clickSubject.next(t)}},m.a.createElement("i",{className:"fa fa-eraser"})))}}]),t}(g.Component);d.propTypes={clearMessage:g.PropTypes.func},function(){"undefined"!=typeof __REACT_HOT_LOADER__&&__REACT_HOT_LOADER__.register(d,"Control","C:/Github/collect/src/components/miniChat/components/control.jsx")}()},431:function(e,t,n){"use strict";var s=n(68),a=n.n(s),_=n(69),r=n.n(_),o=n(72),i=n.n(o),c=n(71),u=n.n(c),l=n(70),p=n.n(l),h=n(3),f=n.n(h),g=n(433);n.n(g),n.d(t,"a",function(){return m});var m=function(e){function t(){var e,n,s,_;r()(this,t);for(var o=arguments.length,i=Array(o),c=0;c<o;c++)i[c]=arguments[c];return n=s=u()(this,(e=t.__proto__||a()(t)).call.apply(e,[this].concat(i))),s.state={opacity:0},s.getMessage=function(){var e;return(e=s).__getMessage__REACT_HOT_LOADER__.apply(e,arguments)},s.getMessageContent=function(){var e;return(e=s).__getMessageContent__REACT_HOT_LOADER__.apply(e,arguments)},s.transVideo=function(){var e;return(e=s).__transVideo__REACT_HOT_LOADER__.apply(e,arguments)},_=n,u()(s,_)}return p()(t,e),i()(t,[{key:"componentWillMount",value:function(){var e=this,t=new Image;t.onload=function(){e.setState({opacity:1})},t.onerror=function(t){console.log(t),e.setState({opacity:1})},t.src=this.props.photoURL}},{key:"__getMessage__REACT_HOT_LOADER__",value:function(){return this.__getMessage__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__getMessage__REACT_HOT_LOADER__",value:function(){return this.props.type?this.transVideo():this.props.message}},{key:"__getMessageContent__REACT_HOT_LOADER__",value:function(){return this.__getMessageContent__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__getMessageContent__REACT_HOT_LOADER__",value:function(){return this.props.type?"messageVideo embed-responsive embed-responsive-16by9":"messagesContent rounded"}},{key:"__transVideo__REACT_HOT_LOADER__",value:function(){return this.__transVideo__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__transVideo__REACT_HOT_LOADER__",value:function(){switch(this.props.type){case"youtube":return f.a.createElement("iframe",{className:"embed-responsive-item",src:"https://www.youtube.com/embed/"+this.props.message,frameBorder:"0",allowFullScreen:!0});default:return this.props.message}}},{key:"render",value:function(){return f.a.createElement("li",{className:this.props.className,style:{opacity:this.state.opacity}},f.a.createElement("figure",null,f.a.createElement("img",{src:this.props.photoURL,alt:this.props.displayName})),f.a.createElement("div",{className:"messagesBox"},f.a.createElement("div",{className:"messagesName"},f.a.createElement("b",null,this.props.displayName)),f.a.createElement("div",{className:this.getMessageContent()},this.getMessage()),f.a.createElement("div",{className:"clearfix"})))}}]),t}(h.Component);m.propTypes={className:h.PropTypes.string.isRequired,displayName:h.PropTypes.string.isRequired,photoURL:h.PropTypes.string.isRequired,message:h.PropTypes.string.isRequired,type:h.PropTypes.any},function(){"undefined"!=typeof __REACT_HOT_LOADER__&&__REACT_HOT_LOADER__.register(m,"Messages","C:/Github/collect/src/components/miniChat/components/messages.jsx")}()},432:function(e,t){},433:function(e,t){},564:function(e,t,n){"use strict";var s=n(68),a=n.n(s),_=n(69),r=n.n(_),o=n(72),i=n.n(o),c=n(71),u=n.n(c),l=n(70),p=n.n(l),h=n(3),f=n.n(h),g=n(566),m=n(565),E=n(600);n.n(E),n.d(t,"a",function(){return y});var y=function(e){function t(){var e,n,s,_;r()(this,t);for(var o=arguments.length,i=Array(o),c=0;c<o;c++)i[c]=arguments[c];return n=s=u()(this,(e=t.__proto__||a()(t)).call.apply(e,[this].concat(i))),s.getUser=function(){var e;return(e=s).__getUser__REACT_HOT_LOADER__.apply(e,arguments)},_=n,u()(s,_)}return p()(t,e),i()(t,[{key:"componentDidMount",value:function(){this.refs.messageBlock.scrollTop=this.refs.messageBlockUl.clientHeight}},{key:"shouldComponentUpdate",value:function(e){return e.chat!==this.props.chat}},{key:"componentDidUpdate",value:function(){this.refs.messageBlock.scrollTop=this.refs.messageBlockUl.clientHeight}},{key:"componentWillUnmount",value:function(){firebase.chatDB.ref(".info/connected").off("value",this.connected)}},{key:"getMessageClassName",value:function(e){return this.getUser()&&e===this.getUser().uid?"clearfix messagesSelf":"clearfix messagesOther"}},{key:"__getUser__REACT_HOT_LOADER__",value:function(){return this.__getUser__REACT_HOT_LOADER__.apply(this,arguments)}},{key:"__getUser__REACT_HOT_LOADER__",value:function(){return firebase.chatAH.currentUser}},{key:"render",value:function(){var e=this;return f.a.createElement("div",{className:"container-fluid",ref:"chat",id:"chat"},f.a.createElement("div",{id:"chatBox",className:"card"},f.a.createElement("div",{className:"card-block",ref:"messageBlock",id:"messageBlock"},f.a.createElement("ul",{ref:"messageBlockUl"},this.props.chat.map(function(t){return f.a.createElement(g.a,{key:t.timestamp,className:e.getMessageClassName(t.uid),photoURL:t.photoURL,displayName:t.displayName,message:t.message,type:t.type})})))),f.a.createElement(m.a,{clearMessage:this.props.clearMessage}))}}]),t}(h.Component);y.propTypes={chat:h.PropTypes.object,clearMessage:h.PropTypes.func},function(){"undefined"!=typeof __REACT_HOT_LOADER__&&__REACT_HOT_LOADER__.register(y,"Chat","C:/Github/collect/src/page/chat/chat.jsx")}()},565:function(e,t,n){"use strict";var s=n(68),a=n.n(s),_=n(69),r=n.n(_),o=n(72),i=n.n(o),c=n(71),u=n.n(c),l=n(70),p=n.n(l),h=n(3),f=n.n(h),g=n(430),m=n(601);n.n(m),n.d(t,"a",function(){return E});var E=function(e){function t(){return r()(this,t),u()(this,(t.__proto__||a()(t)).apply(this,arguments))}return p()(t,e),i()(t,[{key:"render",value:function(){return f.a.createElement("div",{className:"control"},f.a.createElement("input",{className:"form-control",ref:"message",type:"text",placeholder:this.getPlaceholder(),onKeyDown:this.handleKeyDown}),f.a.createElement("button",{className:"btn",type:"button",title:"發送",onClick:this.SendMessage},f.a.createElement("i",{className:"fa fa-paper-plane"})),f.a.createElement("button",{className:"btn",type:"button",title:"清除",onClick:this.props.clearMessage},f.a.createElement("i",{className:"fa fa-eraser"})))}}]),t}(g.a);E.propTypes={addMessage:h.PropTypes.func,clearMessage:h.PropTypes.func},function(){"undefined"!=typeof __REACT_HOT_LOADER__&&__REACT_HOT_LOADER__.register(E,"Control","C:/Github/collect/src/page/chat/components/control.jsx")}()},566:function(e,t,n){"use strict";var s=n(68),a=n.n(s),_=n(69),r=n.n(_),o=n(71),i=n.n(o),c=n(70),u=n.n(c),l=n(431),p=n(602);n.n(p),n.d(t,"a",function(){return h});var h=function(e){function t(){return r()(this,t),i()(this,(t.__proto__||a()(t)).apply(this,arguments))}return u()(t,e),t}(l.a);!function(){"undefined"!=typeof __REACT_HOT_LOADER__&&__REACT_HOT_LOADER__.register(h,"Messages","C:/Github/collect/src/page/chat/components/messages.jsx")}()},600:function(e,t){},601:function(e,t){},602:function(e,t){}});