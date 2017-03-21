const {
	clipboard: Clipboard,
	ipcRenderer: ipc,
	remote: Remote,
	shell
} = require("electron");
const OPT = require("../settings.json");

let $data = {};

/**
 * 주어진 식별자에 대응되는 언어 표현을 가져온다.
 * 
 * * 언어 표현 중 {*번호*}는 추가 인수로 대체된다. *번호*는 1부터 시작한다.
 * * 언어 표현 중 FA{*식별자*}는 FontAwesome 그림 표현으로 대체된다.
 * 
 * @param {string} key 식별자
 * @returns {string} 결과 문자열
 */
function L(key){
	let v = global.LANG[key];

	if(v) return v.replace(/\{(\d+?)\}/g, (v, p1) => (arguments[p1] === undefined) ? v : arguments[p1])
		.replace(/FA\{(.+?)\}/g, (v, p1) => FA(p1));
	return "#" + key;
}
$(() => {
	$(".diag-title").on('mousedown', e => {
		$data.$drag = $(e.currentTarget).parent().parent();
		$data.cx = e.pageX;
		$data.cy = e.pageY;
		$(window)
			.on('mousemove', onDiagMouseMove)
			.on('mouseup', onDiagMouseUp);
	});
	$(".diag-close").on('click', e => {
		$(e.currentTarget).parent().parent().hide();
	});
});
ipc.on('alert', (ev, msg) => {
	alert(msg);
});
ipc.on('dialog', (ev, type) => {
	return $dialog(type, true).toggle();
});
ipc.on('external', (ev, href, isLocal) => {
	if(isLocal) shell.openItem(href);
	else shell.openExternal(href);
});
ipc.on('log', (ev, msg) => {
	console.log(msg);
});

/**
 * 주어진 식별자에 대응되는 FontAwesome 그림 표현을 가져온다.
 * 
 * @param {string} key 식별자
 * @param {boolean} afterSpace true일 때 그림 표현 뒤에 공백(&nbsp;) 문자를 추가한다.
 * @returns {string} FontAwesome 그림 표현
 */
function FA(key, afterSpace){
	return `<i class="fa fa-${key}"></i>${afterSpace ? "&nbsp;" : ""}`;
}
/**
 * 프로그램의 설정 값을 변경하고 파일로 저장한다.
 * 값이 할당되지 않은 경우 해당 정보를 지운다.
 * 
 * @param {string} key 식별자
 * @param {*} value 값. undefined 또는 null인 경우 해당 정보를 지운다.
 */
function setOpt(key, value){
	if(value === undefined || value === null) delete OPT[key];
	else OPT[key] = value;
	ipc.send('opt', key, value);
}
/**
 * Notification 모듈을 이용하여 사용자에게 주어진 내용을 알린다.
 * 
 * @param {string} title 제목
 * @param {string} msg 내용
 */
function notify(title, msg){
	let $window = Remote.getCurrentWindow();

	$window.flashFrame(true);
	$window.once('focus', e => $window.flashFrame(false));
	new Notification(`${title} - ${L('title')}`, {
		icon: "img/logo.ico",
		body: msg
	});
}
/**
 * 주어진 식별자로부터 대화 상자를 가져온다.
 * 
 * @param {string} type 식별자
 * @param {boolean} toCenter true인 경우 가운데로 배치된다.
 * @returns {*} 대화 상자의 jQuery 객체
 */
function $dialog(type, toCenter){
	let $R = $(`#diag-${type}`);

	if(toCenter) $R.css({
		'left': (window.innerWidth - $R.width()) * 0.5,
		'top': (window.innerHeight - $R.height()) * 0.5
	});
	return $R;
}
/**
 * 사용자로부터 비동기적으로 텍스트 입력을 받는다.
 * 대화 상자가 표시되고 있는지 확인하기 위해 매 500ms마다 표시 여부를 확인한다.
 * 
 * @param {string} title 제목
 * @param {string} defaultValue 기본값
 */
function prompt(title, defaultValue){
	return new Promise((res, rej) => {
		let timer = setInterval(checkVisible, 500);
		let $diag = $dialog('prompt', true).show();

		$("#diag-prompt-key").html(title);
		$("#diag-prompt-value").val(defaultValue || "");
		$("#diag-prompt-ok").on('click', e => {
			clearInterval(timer);
			$("#diag-prompt-ok").off('click');
			res($("#diag-prompt-value").val());
			$diag.hide();
		});
		function checkVisible(){
			if(!$diag.is(':visible')) res(null);
		}
	});
}
function onDiagMouseMove(e){
	let pos = $data.$drag.position();
	let dx = e.clientX - $data.cx, dy = e.clientY - $data.cy;
	
	$data.$drag.css({ 'top': pos.top + dy, 'left': pos.left + dx });
	$data.cx = e.clientX;
	$data.cy = e.clientY;
}
function onDiagMouseUp(e){
	delete $data.$drag, $data.cx, $data.cy;
	$(window)
		.off('mousemove', onDiagMouseMove)
		.off('mouseup', onDiagMouseUp);
}