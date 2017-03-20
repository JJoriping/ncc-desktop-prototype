const FILTER_IMG = {
	filters: [{
		name: L('file-image'),
		extensions: [ 'jpg', 'png', 'gif' ]
	}],
	properties: [ "openFile" ]
};
const STATUS_CLASS = {
	'online': "online",
	'afk': "afk"
};
const CHANNEL_MENU = Remote.Menu.buildFromTemplate([
	{
		label: L('menu-actli-whisper'),
		click: () => { Activity.current.$stage.chat.val(`/w ${$data._cTarget} `).focus(); }
	}
]);
const CHANNEL_HOST = "jjo.kr";
const ACT_OPENED = "opened";

/**
 * 액티비티를 정의한다.
 * 각 액티비티는 방 목록 또는 한 채팅방을 담당하며 탭으로 전환시킬 수 있다.
 * 한 채팅방은 한 채널과 연관되어 있다.
 */
class Activity{
	/**
	 * @type {Activity}
	 * 현재 액티비티 객체를 가리킨다.
	 */
	static get current(){
		return $data.acts[$data.currentAct];
	}

	constructor(id, title, ord, $obj){
		this.id = id;
		this.title = title;
		this.ord = ord;
		this.$obj = $obj;
		
		this.$stage = {
			board: $obj.children(".act-board"),
			ghost: $obj.find(".act-ghost").on('click', e => {
				let b = this.$stage.board.get(0);

				b.scrollTop = b.scrollHeight - b.clientHeight;
				$(e.currentTarget).hide();
			}),
			menu: $obj.children(".act-menu"),
			list: $obj.children(".act-list"),
			chat: $obj.find(".act-chat")
				.on('keydown', e => this.onChatKeyDown(e))
				.on('paste', e => this.onChatPaste(e.originalEvent)),
			send: $obj.find(".act-send")
				.on('click', e => this.onSendClick(e)),
			image: $obj.find(".act-image")
				.on('click', e => this.onImageClick(e)),
			prev: $obj.find(".act-menu-prev")
				.on('click', e => this.onMenuPrevClick(e)),
			save: $obj.find(".act-menu-save")
				.on('click', e => this.onMenuSaveClick(e)),
			quit: $obj.find(".act-menu-quit")
				.on('click', e => this.onMenuQuitClick(e))
		};
		this.initChannel(this.$stage.list);
	}
	/**
	 * 채널을 초기화한다.
	 * 
	 * @param {*} $list 채널 이용자 목록을 가리키는 jQuery 객체
	 */
	initChannel($list){
		if(this.id == ACT_OPENED) return;

		if(OPT['channel-pw']){
			this.channel = new Channel(this.id, $list);
		}else{
			this.$stage.list.html(`
				<label>${L('act-mr-chan-no')}</label><br/>
				<button class="act-mr-chan-go-login" style="color: blue;">${L('act-mr-chan-go-login')}</button><br/>
				<button class="act-mr-chan-go-email" style="color: blue;">${L('act-mr-chan-go-email')}</button>
			`);
			this.$stage.list.children(".act-mr-chan-go-login").on('click', e => {
				prompt(L('act-mr-chan-go-login')).then(pw => {
					if(!pw) return;
					setOpt('channel-pw', pw);
					
					Channel.init($data.myInfo.profile.id, pw);
					for(let i in $data.acts) $data.acts[i].initChannel($data.acts[i].$stage.list);
				});
			});
			this.$stage.list.children(".act-mr-chan-go-email").on('click', e => {
				$.post(`http://${CHANNEL_HOST}/ncc/email`, { id: $data.myInfo.profile.id }, res => {
					if(res) $dialog('ce', true).show().find("#diag-ce-target").html(L('diag-ce-target', $data.myInfo.profile.id));
				});
			});
		}
	}
	/**
	 * 이 액티비티가 가지는 방 정보를 설정하고 방 정보에 맞게 DOM 객체를 수정한다.
	 * 
	 * @param {*} room 방 정보
	 */
	setRoom(room){
		this.room = room;
		this.nCount = 0;

		$(`#at-item-${this.id}`)[room.isPublic ? 'removeClass' : 'addClass']("at-item-locked");
		this.$stage.menu.children(".act-menu-title").html(`
			<label class="actm-title-name"><b>${room.name}</b></label><i/>
			<label class="actm-title-user">${L('act-mr-user', room.userCount)}</label><i/>
			<label class="actm-title-cafe">${room.cafe.name}</label><i/>
			<label class="actm-title-attr">${room.isPublic ? L('act-mr-public') : L('act-mr-private')}</label>
		`);
	}
	/**
	 * 이 액티비티가 포함한 채팅 기록을 저장한다.
	 * 
	 * @param {string} path 기록될 파일의 경로
	 */
	requestSaveChat(path){
		let data = [];

		this.$stage.board.children(".act-talk").each((i, o) => {
			let $o = $(o);

			data.push(`[${$o.children(".actt-stamp").html()}] ${$o.children(".actt-user").attr('title')}: ${$o.children(".actt-body").html().trim()}`);
		});
		ipc.send('cojer', "Save", {
			path: path,
			data: data.join('\n')
		});
	}
	/**
	 * 이전 대화를 불러오도록 요청한다.
	 */
	requestPrevChat(){
		let v = this._prevChat;
		
		this._prevChat = Math.max(0, v - OPT['prev-per-req']);
		ipc.send('cojer', "PrevChat", {
			room: this.room,
			from: this._prevChat + 1,
			to: v
		});
	}
	/**
	 * 이 액티비티가 가리키는 방에서 퇴장한다.
	 */
	requestQuit(){
		ipc.send('cojer', "Quit", {
			room: this.room
		});
	}

	onChatKeyDown(e){
		if(!e.shiftKey && e.keyCode == 13){
			this.$stage.send.trigger('click');
			e.preventDefault();
		}
	}
	onChatPaste(e){
		let files, len, i;

		switch(e.type){
			case "drop":
				files = e.dataTransfer.files;
				len = files.length;
				if(!len || files[0].kind == "string") return true;

				$data._uploading = files[0].path.replace(/\\/g, "/");
				$dialog('upload', true).show();
				$stage.diag.uploadImg.attr('src', $data._uploading);
				if(OPT['no-ask-upload']) $stage.diag.uploadOK.trigger('click');
				break;
			case "paste":
				files = e.clipboardData.items;
				len = files.length;
				if(!len || files[0].kind == "string") return true;

				$data._uploading = Clipboard.readImage();
				$dialog('upload', true).show();
				$stage.diag.uploadImg.attr('src', $data._uploading.toDataURL());
				$data._uploading = $data._uploading.toPNG();
				if(OPT['no-ask-upload']) $stage.diag.uploadOK.trigger('click');
				break;
		}
		return false;
	}
	onSendClick(e){
		let text = this.$stage.chat.val();

		if(text.length > 500) if(!confirm(L('error-101'))){
			return this.$stage.chat.val(text.slice(0, 500));
		}
		sendMessage("text", this.room, text);
		this.$stage.chat.val("");
	}
	onImageClick(e){
		Remote.dialog.showOpenDialog(Remote.getCurrentWindow(), FILTER_IMG, files => {
			if(!files) return;
			files.forEach(v => sendMessage('image', this.room, v));
		});
	}
	onMenuPrevClick(e){
		this.$stage.prev.prop('disabled', true);
		setTimeout(() => this.$stage.prev.prop('disabled', false), 1000);

		this.requestPrevChat();
	}
	onMenuSaveClick(e){
		Remote.dialog.showSaveDialog(Remote.getCurrentWindow(), {
			title: L('act-mr-save'),
			defaultPath: `${this.room.name}-${Date.now()}.txt`
		}, path => this.requestSaveChat(path.replace(/\\/g, "/")));
	}
	onMenuQuitClick(e){
		if(!confirm(L('sure-quit', this.room.name))) return;

		this.requestQuit();
	}
}

/**
 * 채널을 정의한다.
 * 채널에 접속하여 쪼런처를 이용하는 사람들에게 부가 기능을 제공한다.
 */
class Channel{
	static init(id, pw){
		let socket = new WebSocket(`ws://${CHANNEL_HOST}:525/${id}@${pw}`);
		
		if(Channel.socket){
			Channel._queue = [];
			Channel.socket.close();
		}
		socket.onmessage = Channel.onMessage;
		socket.onclose = Channel.onClose;
	}
	static send(type, data){
		if(!data) data = {};
		data.type = type;
		data = JSON.stringify(data);

		if(Channel.socket) Channel.socket.send(data);
		else Channel._queue.push(data);
	}
	static flushQueue(socket){
		Channel.socket = socket;
		while(Channel._queue[0]) socket.send(Channel._queue.shift());
	}
	static updateUser(user){
		let $items = $(`.actli-${user.id}`);
		let status = global.LANG[`diag-status-${user.status}`] || user.status;
		let title = `${user.nickname} (${user.id})\n${status}`;

		$items.attr('title', title);
		$items.children(".act-list-item-status")
			.removeClass("actli-status-online actli-status-custom actli-status-afk")
			.addClass(`actli-status-${STATUS_CLASS[user.status] || 'custom'}`);
		$items.find(".act-list-item-nick").html(user.nickname);
		$items.children(".act-list-item-exordial").html(user.exordial);
	}
	static onMessage(e){
		let data = JSON.parse(e.data);
		let chan = ($data.acts[data.rId] || {}).channel;

		switch(data.type){
			case 'welcome':
				Channel.flushQueue(e.target);
				break;
			case 'error':
				error(data.code, data.msg);
				break;
			case 'conn':
				chan.list.push(data.user);
				chan.renderList();
				break;
			case 'disconn':
				chan.list = chan.list.filter(v => v.id != data.user.id);
				chan.renderList();
				break;
			case 'list':
				chan.list = data.list;
				chan.renderList();
				break;
			case 'user':
				Channel.updateUser(data.user);
				break;
			case 'whisper':
				processWhisper(data);
				break;
			default:
				console.warn("Unhandled data: ", data);
		}
	}
	static onClose(code){
		$(".act-list").empty().addClass("act-list-closed");
	}

	constructor(rId, $list){
		this.rId = rId;
		this.$list = $list;
		this.list = [];

		Channel.send('join', { rId: rId });
	}
	renderList(){
		this.$list.removeClass("act-list-closed").empty();
		this.list.forEach(v => {
			let $item;

			this.$list.append($item = $(`
				<div id="actli-${this.rId}-${v.id}" class="act-list-item actli-${v.id}">
					<div class="act-list-item-status"/>
					<div class="act-list-item-name ellipse">
						<label class="act-list-item-nick"/>
						<label class="act-list-item-id"> (${v.id})</label>
					</div>
					<div class="act-list-item-exordial ellipse"/>
				</div>
			`.trim()));
			Channel.updateUser(v);
			$item.on('click', this.onClick);
			if(v.id == $data.myInfo.profile.id) $item.addClass("act-list-item-me");
		});
	}
	onClick(e){
		$data._cTarget = e.currentTarget.id.split('-')[3];
		CHANNEL_MENU.popup(Remote.getCurrentWindow());
	}
	close(){
		Channel.send('leave', { rId: this.rId });
	}
}
Channel._queue = [];