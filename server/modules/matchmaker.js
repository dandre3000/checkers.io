/*!
 * matchmaker: server
 *
 * 2 player
 * each match has it's own socket.io room for private comms
 * match persists until forfeit or timeout
 * 
 * todo:
 * match list
 * spectators
 * remove match if all players have disconnected without leaving/forfeiting
 */

'use strict';

// dependencies
const login = require('./login');
const Timer = require('./timer');

module.exports = new function() {
	const MAX_PLAYERS = 2; // 2 player only for now
	const TURN_TIME_LIMIT = 30 * 1000 // time limit to end your turn
	const RECONN_TIME_LIMIT = 30 * 1000 // time limit to reconnect to a match
	
	// holds all games and info
	const matchCollection = new function() {
		this.count = 0,
		this.list = new Map()
	};
	
	this.namespace = null;
	
	/**
	 * recursive game search
	 * @param {object} socket
	 * @param {object} options
	 */
	const matchSeeker = (socket, options, iterations) => {
		const searchLimit = 20; // amount of matches to check in matchSeeker
		
		let i = iterations || 0;
		// create game if there are none or if at the search limit
		if ((matchCollection.count == 0) || (i >= searchLimit)) {
			buildMatch(socket, options);
		} else {
			// try to join random game as player 2
			const rndPick = Math.floor(Math.random() * matchCollection.count);
			const game = [...matchCollection.list][rndPick][1];
			if (options.format == game.options.format && !game.start && game.players.size < MAX_PLAYERS /*game['playerTwo'] == null*/) {
				joinMatch(socket, game);
			// search again
			} else {
				++i;
				matchSeeker(socket, options, i);
			}
		}
	};
	
	/**
	 * create match
	 * @param {object} socket
	 * @param {[object]} options
	 */
	const buildMatch = (socket, options) => {
		// match object
		const match = {};
		
		let id = (Math.random() + 1).toString(36).slice(2, 18); // random id
		// validate id
		while (matchCollection.list.has(id)) {
			id = (Math.random() + 1).toString(36).slice(2, 18);
		}
		
		match.id = id;
		match.start = false;
		match.players = new Map();
		match.players.set(socket.username, {
			order: 1,
			connected: true,
			timer: new Timer(RECONN_TIME_LIMIT, () => {
				this.namespace.to(id).emit('timeout');
			})
		});
		if (options) {
			match.options = options;
			console.log(options);
		}
		match.state = {turn: 1};
		match.timer = new Timer(TURN_TIME_LIMIT, () => {
			this.namespace.to(id).emit('timeout');
		});
		
		// add match to list
		matchCollection.count++;
		console.log(id, match);
		matchCollection.list.set(id, match);
		
		console.log("Game Created by "+ socket.username + " w/ " + match.id);

		socket.join(match.id);
		socket.emit('gameCreated', {
			username: socket.username,
			id: match.id
		});
		
		//console.log(JSON.stringify(matchCollection)); // don't work with Maps
		console.log(matchCollection);
	};
	
	/**
	 * add player to a match
	 * @param {object} socket
	 * @param {object} match
	 */
	const joinMatch = (socket, match) => {
		match.players.set(socket.username, {
			order: match.players.size + 1,
			connected: true,
			timer: new Timer(RECONN_TIME_LIMIT, () => {
				this.namespace.to(id).emit('timeout');
			})
		});
		
		const id = match['id'];
		socket.join(id);
		
		socket.emit('joinSuccess', {
			id: id,
			numPlayers: match.players.size
		});
		
		if (match.players.size == MAX_PLAYERS) {
			match.start = true;
			match.timer.start(1000, () => {
				this.namespace.to(id).emit('state update', {turnTime: match.timer.getTime()});
			});
			this.namespace.to(id).emit('start game', {
				id: match.id,
				players: [...match.players.keys()],
				options: match.options
			});
			this.namespace.to(id).emit('state update', match.state);
		}
		
		console.log(socket.username + " has been added to: " + match['id']);
	};
	
	/**
	 * check if user is in a game
	 * @param {string}
	 * @return {bool}
	 */
	const alreadyInGame = username => {
		for (let i = 0; i < matchCollection.count; i++) {
			const match = [...matchCollection.list][i][1];
			
			if (match.players.has(username)) {
				return match['id'];
			}
		}
		
		return false;
	};
	
	/**
	 * stop game
	 * @param {object}
	 */
	const killGame = socket => {
		const id = alreadyInGame(socket.username);
		if (id) {
			const match = matchCollection.list.get(id);
			match.timer.stop();
			
			if (match.players.size == 1) {
				matchCollection.list.delete(id);
				--matchCollection.count;
				
				console.log("Destroy Game "+ id + "!");
				console.log(matchCollection);
				
				socket.leave(id);
				socket.emit('leftGame', { gameId: id });
				this.namespace.emit('gameDestroyed', {gameId: id, gameOwner: socket.username});
			} else {
				match.players.delete(socket.username);
				socket.leave(id);
				socket.emit('leftGame', { gameId: id });
				this.namespace.to(id).emit('forfeit', socket.username);
				
				console.log(socket.username + " has left " + id);
				console.log(matchCollection.list.get(id));
			}
		} else {
			socket.emit('notInGame');
		}
	};
	
	/**
	 * create socket events
	 * @param {object}
	 */
	this.connect = socket => {
		login.connect(socket);
		
		/**
		 * create/join a match
		 * @param {object}
		 */
		socket.on('joinGame', options => {
			//console.log(socket.username + " wants to join a game");
			
			const id = alreadyInGame(socket.username);
			if (!id){
				matchSeeker(socket, options);
			} else {
				socket.emit('alreadyJoined', {
					id: id
				});
			}
		});
		
		/**
		 * rejoin match
		 */
		socket.on('rejoin', () => {
			const id = alreadyInGame(socket.username);
			const match = matchCollection.list.get(id);
			if (id) {
				// join socket to match room
				socket.join(id);
				// only restart live matches
				if (match.start) {
					// stop disconnect timer
					const player = match.players.get(socket.username);
					player.connected = true;
					player.timer.stop();
					//player.timer.ms = RECONN_TIME_LIMIT;
					// if its still the players turn revert back to turn timer
					if (match.state.turn == player.order) {
						match.timer.restart(match.timer.ms, 1000, () => {
							this.namespace.to(id).emit('state update', {turnTime: match.timer.getTime()});
						});
					}
					
					// only restart this player
					socket.emit('restart game', {
						id: match.id,
						players: [...match.players.keys()],
						options: match.options
					});
					
					this.namespace.to(id).emit('state update', match.state);
				}
			}
		});
		
		/**
		 * leave match
		 * @param {int}
		 */
		socket.on('leaveGame', idx => {
			if (matchCollection.count == 0){
				socket.emit('notInGame');
			} else {
				killGame(socket, idx);
			}
		});
		
		/**
		 * emit all match data
		 */
		socket.on('get matches', () => {
			const list = [];
			const i = matchCollection.list.values();
			for (let j = 0; j < matchCollection.list.size; j++) {
				list.push(i.next().value);
			}
			socket.emit('matches', list);
		});
		
		/**
		 * update server match state
		 * @param {object}
		 */
		socket.on('server update', state => {
			const id = alreadyInGame(socket.username);
			const match = matchCollection.list.get(id);
			Object.keys(state).forEach(key => {
				if (key == 'turn') {
					const currentPlayer = match.players.get(socket.username);
					const players = [...match.players];
					
					match.timer.stop();
					match.timer.ms = TURN_TIME_LIMIT;
					
					currentPlayer.timer.ms = RECONN_TIME_LIMIT;
					
					players.forEach(p => {
						const username = p[0];
						const player = p[1];
						// if next player is connected start turn timer else start disconnect timer
						if (player.order == state[key]) {
							console.log('next player is '+username);
							if (player.connected) {
								match.timer.start(1000, () => {
									this.namespace.to(id).emit('state update', {turnTime: match.timer.getTime()});
								});
							} else {
								player.timer.start(1000, () => {
									this.namespace.to(id).emit('state update', {['timer'+player.order]: player.timer.getTime()}); // strings are arrays
								});
							}
						}
					});
					
				}
				match.state[key] = state[key];
			});
			
			// emit update to other players
			socket.to(id).emit('state update', match.state);
		});
		
		/**
		 * game over
		 * @param {string}
		 */
		socket.on('game over', winner => {
			const id = alreadyInGame(socket.username);
			socket.to(id).emit('game over', winner);
		});
		
		socket.on('joinLobby', () => {
			socket.join('lobby');
		});
		
		socket.on('leaveLobby', () => {
			socket.leave('lobby');
		});
		
		socket.on('lobby', () => {
			this.namespace.in('lobby').clients((error, clients) => {
				console.log(clients);
			});
		});
	};
	
	/**
	 * handle socket disconnection
	 * @param {object}
	 */
	this.disconnect = socket => {
		const id = alreadyInGame(socket.username);
		if (id) {
			const match = matchCollection.list.get(id);
			// if it's the player's turn save current time left and start disconnect timer
			const player = match.players.get(socket.username);
			if (match.state.turn == player.order) {
				match.timer.stop();
				
				player.timer.start(1000, () => {
					this.namespace.to(id).emit('state update', {['timer'+player.order]: player.timer.getTime()}); // strings are arrays
				});
			}
			player.connected = false;
			
			socket.to(id).emit('drop player', socket.username);
		}
		// logout
		login.disconnect(socket);
	};
};