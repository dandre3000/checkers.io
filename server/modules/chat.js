/*!
 * chat: server
 *
 * live typing indicator
 * multichannel
 */

'use strict';

module.exports = (socket, namespace) => {
	// send message to proper channel
	socket.on('new message', (data) => {
		if (data.channel == 'global') {
			socket.broadcast.emit('new message', {
				username: socket.username,
				message: data.message
			});
		} else {
			namespace.to(data.channel).emit('new message', {
				username: socket.username,
				message: data.message
			});
		}
	});
	
	// broadcast ... while typing
	socket.on('typing', () => {
		socket.broadcast.emit('typing', socket.username);
	});
	
	// remove ... when not typing
	socket.on('stop typing', () => {
		socket.broadcast.emit('stop typing', socket.username);
	});
}