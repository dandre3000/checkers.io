// dependencies
import {chat} from '../../modules/chat-client.js';
import {checkers} from '../../modules/checkers.js';

// debug
const debug = true;

// app
$(() => {
	// init socket.io connection
	const sock = io('/mm');
	
	// create game container
	checkers.element = $('#game');
	
	// connection
	// init chat
	chat.connect(sock);
	// init game after logging in
	chat.login = () => {
		checkers.connect(sock);
	};
	
	// disconnection
	sock.on('disconnect', (data) => {
		checkers.disconnect(sock, data);
		sock.emit('drop player', sock.username);
		console.log('drop player', sock.username);
	});
	
	// reconnection
	sock.on('reconnect', () => {
		chat.reconnect(sock);
	});
});