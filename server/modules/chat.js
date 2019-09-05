/*!
 * chat: server
 *
 * live typing indicator
 * multichannel
 */

'use strict';

/**
 * create socket events
 * @param {object} socket
 * @param {object} namespace
 */
module.exports = (socket, namespace) => {
	/**
	 * send message to proper channel
	 * @param {object}
	 */
	socket.on('new message', data => {
		if (data.channel == 'global') {
			// global emit
			socket.broadcast.emit('new message', {
				username: socket.username,
				message: data.message
			});
		} else {
			// private
			namespace.to(data.channel).emit('new message', {
				username: socket.username,
				message: data.message
			});
		}
	});
	
	/**
	 * broadcast ... while typing
	 */
	socket.on('typing', () => {
		socket.broadcast.emit('typing', socket.username);
	});
	
	/**
	 * remove ... when not typing
	 */
	socket.on('stop typing', () => {
		socket.broadcast.emit('stop typing', socket.username);
	});
};