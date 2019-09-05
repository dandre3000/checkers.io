/*!
 * login
 *
 * session based login that only requires a temporary username
 *
 * todo:
 * logout
 */

'use strict';

module.exports = new function() {
	const names = new Set(); // usernames
	var users = 0; // total users
	
	/**
	 * create socket events
	 * @param {object}
	 */
	this.connect = socket => {
		/**
		 * login
		 * @param {string}
		 */
		socket.on('add user', username => {
			// can't login twice
			if (socket.username) {
				return;
			}
			// login fails if username is taken
			else if (names.has(username)) {
				socket.emit('login', 'fail');
				return;
			}

			// we store the username in the socket session for this client
			socket.username = username;
			names.add(username);
			++users;
			// login successful
			socket.emit('login');
			// echo globally that a person has connected
			socket.broadcast.emit('user joined', {
				username: socket.username
			});
			socket.emit('total users', users);
			
			console.log(socket.id, 'add user', username);
			console.log(users);
		});
		
		/**
		 * emit total users
		 */
		socket.on('get total users', () => {
			socket.emit('total users', users);
		});
		
		/**
		 * emit username list
		 */
		socket.on('get usernames', () => {
			socket.emit('usernames', {
				usernames: names
			});
		});
		
		
	};
	
	/**
	 * logout
	 * @param {object}
	 */
	this.disconnect = socket => {
		console.log(users, names);
		// only logout if logged in
		// remove username from server and reduce user count
		if (socket.username) {
			--users;
			names.delete(socket.username);
			console.log(users, names);

			// echo globally that this client has left
			socket.broadcast.emit('user left', {
				username: socket.username
			});
			socket.broadcast.emit('total users', users);
			socket.username = null;
			
			console.log(socket.id, 'disconnect');
		}
	};
};