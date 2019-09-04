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

const login = require('./login');
const Timer = require('./timer');

const MAX_PLAYERS = 2;

module.exports = new function() {
	// GameCollection holds all games and info
	const gameCollection = new function() {
		this.totalGameCount = 0,
		this.gameList = new Map()
	};

	const searchLimit = 20;
	var iGameList = 0;
	
	this.namespace = null;
	
	// recursive game search
	function gameSeeker(socket, options) {
		// create game if there are none or if at the search limit
		if ((gameCollection.totalGameCount == 0) || (iGameList >= searchLimit)) {
			buildMatch(socket, options);
		} else {
			// try to join random game as player 2
			const rndPick = Math.floor(Math.random() * gameCollection.totalGameCount);
			const game = [...gameCollection.gameList][rndPick][1];
			if (options.format == game.options.format && !game.start && game.players.size < MAX_PLAYERS /*game['playerTwo'] == null*/) {
				joinMatch(socket, game);
			// search again
			} else {
				++iGameList;
				gameSeeker(socket, options);
			}
		}
		
		iGameList = 0;
	}
	
	// create match
	const buildMatch = (socket, options) => {
		const match = {};
		
		let id = (Math.random() + 1).toString(36).slice(2, 18); // random id
		// validate id
		while (gameCollection.gameList.has(id)) {
			id = (Math.random() + 1).toString(36).slice(2, 18);
		}
		
		match.id = id;
		match.start = false;
		match.players = new Set();
		match.players.add(socket.username);
		if (options) {
			match.options = options;
			console.log(options);
		}
		match.state = {turn: 1};
		match.timer = new Timer(30000, () => {
			this.namespace.to(id).emit('timeout');
		});
		
		gameCollection.totalGameCount++;
		console.log(id, match);
		gameCollection.gameList.set(id, match);
		
		console.log("Game Created by "+ socket.username + " w/ " + match.id);

		socket.join(match.id);
		socket.emit('gameCreated', {
			username: socket.username,
			id: match.id
		});
		
		//console.log(JSON.stringify(gameCollection)); // don't work with Maps
		console.log(gameCollection);
	};
	
	const joinMatch = (socket, match) => {
		match.players.add(socket.username);
		//match['playerTwo'] = socket.username;
		
		const id = match['id'];
		socket.join(id);
		
		socket.emit('joinSuccess', {
			id: id,
			numPlayers: [...match.players].length
		});
		
		if (match.players.size == MAX_PLAYERS) {
			match.start = true;
			match.timer.start(1000, () => {
				this.namespace.to(id).emit('state update', {turnTime: match.timer.getTime()});
				console.log(match.timer.getTime());
			});
			this.namespace.to(id).emit('start game', {
				id: match.id,
				players: [...match.players],
				options: match.options
			});
			this.namespace.to(id).emit('state update', match.state);
		}
		
		console.log(socket.username + " has been added to: " + match['id']);
	};
	
	// check if user is in a game
	const alreadyInGame = (username) => {
		for (let i = 0; i < gameCollection.totalGameCount; i++) {
			const game = [...gameCollection.gameList][i][1];
			
			for (let j = 0; j < game.players.size; j++) {
				const player = [...game.players][j];
				if (player == username /*plyr1Tmp == socket.username || plyr2Tmp == socket.username*/){
					return game['id'];
				}
			}
		}
		
		return false;
	};
	
	// stop game
	const killGame = (socket) => {
		const id = alreadyInGame(socket.username);
		if (id) {
			const match = gameCollection.gameList.get(id);
			match.timer.stop();
			
			if (match.players.size == 1) {
				gameCollection.gameList.delete(id);
				--gameCollection.totalGameCount;
				
				console.log("Destroy Game "+ id + "!");
				console.log(gameCollection);
				
				socket.leave(id);
				socket.emit('leftGame', { gameId: id });
				this.namespace.emit('gameDestroyed', {gameId: id, gameOwner: socket.username});
			} else {
				match.players.delete(socket.username);
				socket.leave(id);
				socket.emit('leftGame', { gameId: id });
				
				console.log(socket.username + " has left " + id);
				console.log(gameCollection.gameList.get(id));
			}
		} else {
			socket.emit('notInGame');
		}
	};
	
	this.connect = (socket) => {
		login.connect(socket);
		
		// make/join a Game
		socket.on('joinGame', options => {
			console.log(socket.username + " wants to join a game");
			
			const id = alreadyInGame(socket.username);
			if (!id){
				gameSeeker(socket, options);
			} else {
				socket.emit('alreadyJoined', {
					id: id
				});
			}
		});
		
		// rejoin match
		socket.on('rejoin', (data) => {
			const id = alreadyInGame(socket.username);
			const match = gameCollection.gameList.get(id);
			if (id) {
				socket.join(id);
				if (match.start) {
					match.timer.ms = match.timer.tmpMs;
					match.timer.restart(match.timer.ms, 1000, () => {
						this.namespace.to(id).emit('state update', {turnTime: match.timer.getTime()});
						console.log(match.timer.getTime());
					});
					
					socket.emit('restart game', {
						id: match.id,
						players: [...match.players],
						options: match.options
					});
					
					this.namespace.to(id).emit('state update', match.state);
				}
			}
		});
		
		socket.on('leaveGame', (idx) => {
			if (gameCollection.totalGameCount == 0){
				socket.emit('notInGame');
			} else {
				killGame(socket, idx);
			}
		});
		
		socket.on('get matches', () => {
			const gameList = [];
			const i = gameCollection.gameList.values();
			for (let j = 0; j < gameCollection.gameList.size; j++) {
				gameList.push(i.next().value);
			}
			socket.emit('matches', gameList);
		});
		
		socket.on('server update', (state) => {
			const id = alreadyInGame(socket.username);
			const match = gameCollection.gameList.get(id);
			Object.keys(state).forEach(key => {
				if (key == 'turn') {
					match.timer.restart(30000, 1000, () => {
						this.namespace.to(id).emit('state update', {turnTime: match.timer.getTime()});
						console.log(match.timer.getTime());
					});
				}
				match.state[key] = state[key];
			});
			
			socket.to(id).emit('state update', match.state);
		});
		
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
		
		socket.on('test', () => {
			console.log('success');
		});
	};
	
	
	
	this.disconnect = socket => {
		const id = alreadyInGame(socket.username);
		if (id) {
			const match = gameCollection.gameList.get(id);
			match.timer.tmpMs = match.timer.ms;
			match.timer.restart(30000, 1000, () => {
				this.namespace.to(id).emit('state update', {turnTime: match.timer.getTime()});
				console.log(match.timer.getTime());
			});
			
			socket.to(id).emit('drop player', socket.username);
		}
		
		
		login.disconnect(socket);
	};
};