/*!
 * matchmaker: client
 * 
 * todo:
 * continue match on refresh
 * reconnect timer
 */

import {log} from './log.js';

'use strict';

export {matchmaker};

const matchmaker = new function() {
	const $joinGame = $('.join-match');
	const $leaveGame = $('.leave-match');
	const $format = $('#format');
	
	this.options = {format: $format[0][$format[0].selectedIndex].value};
	
	$format.click(() => {
		this.options.format = $format[0][$format[0].selectedIndex].value;
	});
	
	this.disconnect = () => {};
	
	this.connect = (socket, game) => {
		//Join into an Existing Game
		const joinGame = () => {
			socket.emit('joinGame', this.options);
		};
		
		function leaveGame(){
			socket.emit('leaveGame', game.playerIdx);
		};
		
		$joinGame.click(() => {
			joinGame();
		});
		
		$leaveGame.click(() => {
			leaveGame();
		});
	
		socket.on('gameCreated', data => {
			game.playerIdx = 1;
			
			log.text(data.username + ' created Game: ' + data.id);
			//alert("Game Created! ID is: "+ JSON.stringify(data));
		});
		
		socket.on('joinSuccess', data => {
			game.playerIdx = data.numPlayers;
			
			log.text('Joining ' + data.id + ' as player' + game.playerIdx);
		});
		
		const startGame = (data) => {
			window.location.hash = data.id;
			
			game.start(data);
			log.text('Game started!');
		};
		
		socket.on('start game', data => {
			startGame(data);
		});
		
		socket.on('restart game', data => {
			data.players.forEach((p, i) => {
				if (p === socket.username) {
					game.playerIdx = i + 1;
				}
			});
			
			startGame(data);
		});

		socket.on('leftGame', data => {
			window.location.hash = '';
			
			game.kill();
			log.text('Leaving Game ' + data.gameId);
		});
		
		//Response from Server on existing User found in a game
		socket.on('alreadyJoined', data => {
			log.text('You are already in an Existing Game: ' + data.id);
		});
		
		socket.on('notInGame', () => {
			log.text('You are not currently in a Game.');
		});

		socket.on('gameDestroyed', match => {
			log.text(match.gameOwner + ' destroyed game: ' + match.gameId);
		});
		
		socket.on('matches', data => {
			log.text(data);
		});
		
		socket.on('state update', state => {
			game.stateUpdate(state);
		});
		
		socket.on('forfeit', player => {
			log.text(player+' forfeits!');
			if (game.players.size == 2) {
				game.endGame(socket.username);
				socket.emit('game over', socket.username);
			}
		});
		
		socket.on('game over', winner => {
			game.endGame(winner);
		});
		
		socket.on('drop player', player => {
			game.dropPlayer(player);
		});
		
		socket.on('timeout', () => {
			game.timeOut();
		});
		
		this.disconnect = (sock) => {
			//socket.emit('player disconnect', socket.username);
			//console.log(socket.username+' disconnected');
		};
		
		// if user is in a match on the server join it
		socket.emit('rejoin');
	};
};