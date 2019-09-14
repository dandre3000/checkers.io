/*!
 * checkers
 *
 * todo: touch support/ clean up board feedback, put timers on server
 */

import {canvas} from './canvas.js';
import {matchmaker} from './matchmaker-client.js';
import {Timer} from './timer.js';

'use strict';

const gameDebug = true;

export {checkers};

const checkers = new function() {
	if (gameDebug) {
		window.game = this;
	}
	
	const fps = 60;
	const mousePos = {x: 0, y: 0};
	
	var socket = null;
	var canv = null;
	var ctx = null;
	var id = null; // match id
	var target = null;
	var winner = null;
	var gameOver = false;
	var bLColor = 0;
	var placementColor = 1;
	
	this.element = $('body');
	this.players = null; // players
	this.playerIdx = 1; // is this player 1, 2...
	this.turn = 1; // current turn
	this.score = 0;
	this.timer1 = '0:30';
	this.timer2 = '0:30';
	
	// board
	this.board = new function() {
		this.x = 0;
		this.y = 0;
		this.w = 8;
		this.h = 8;
		this.space = 32;
		this.colors = ['red', 'black'];
		
		this.getWidth = () => {
			return this.w * this.space;
		};
		
		this.getHeight = () => {
			return this.h * this.space;
		};
		
		this.getRight = () => {
			return this.x + this.getWidth();
		};
		
		this.getBottom = () => {
			return this.y + this.getHeight();
		};
		
		// fill board
		this.fill = () => {
			this.data = Array(this.h).fill(0);
			const b = this.data;
			b.forEach((row, i) => {
				b[i] = Array(this.w).fill(0);
			});
			
			b.forEach((row, i) => {
				row.forEach((col, j) => {
					if ((i + j) % 2 == placementColor) {
						const piece = {
							type: 'man',
							moves: []
						};
						if (i < this.h / 2 - 1) {
							piece.owner = 2;
							b[i][j] = piece;
						}
						if (i > this.h / 2) {
							piece.owner = 1;
							b[i][j] = piece;
						}
					}
				});
			});
			
			/* b[4][3] = {
				type: 'man',
				owner: 1
			};
			b[3][4] = {
				type: 'man',
				owner: 2
			}; */
			/* b[1][0] = {
				type: 'man',
				owner: 1
			};
			b[6][7] = {
				type: 'man',
				owner: 2
			}; */
		};
		
		this.draw = player => {
			const b = this.data;
			
			ctx.fillStyle = 'brown';
			ctx.fillRect(this.x - this.space, this.y - this.space, this.getWidth() + this.space * 2, this.getHeight() + this.space * 2);
		
			b.forEach((row, i) => {
				row.forEach((col, j) => {
					// flip board
					let i2 = i;
					let j2 = j;
					if (player == 2) { // for player 2
						i2 = b.length - 1 - i;
						j2 = b[i].length - 1 - j;
					}
					
					ctx.fillStyle = 'black';
					ctx.font = '16px sans-serif';
					ctx.textAlign = 'center';
					// y coordinates
					if (j == 0) { // draw once
						ctx.fillText('ABCDEFGHIJKLMN'[i2], this.x - this.space / 2, this.y + this.space / 2 + (i * this.space) + 8);
						ctx.fillText('ABCDEFGHIJKLMN'[i2], this.getRight() + this.space / 2, this.y + this.space / 2 + (i * this.space) + 8);
					}
					// x coordinates
					if (i == 0) { // draw once
						ctx.fillText(j2 + 1, this.x + this.space / 2 + (j * this.space), this.y - this.space / 2 + 8);
						ctx.fillText(j2 + 1, this.x + this.space / 2 + (j * this.space), this.getBottom() + this.space / 2 + 8);
					}
					
					// squares
					ctx.fillStyle = (i + j) % 2 == bLColor ? this.colors[0] : this.colors[1];
					// possible moves
					if (this.moves) {
						this.moves.forEach(m => {
							if (m[0] == i && m[1] == j) {
								ctx.fillStyle = 'blue';
							}
						});
					}
					ctx.fillRect(j2 * this.space + this.x, i2 * this.space + this.y, this.space, this.space);
					
					// pieces
					if (b[i][j]) {
						const piece = b[i][j];
						ctx.fillStyle = 'grey';
						ellipse(j2 * this.space + this.x, i2 * this.space + this.y, this.space, this.space);
						ctx.fillStyle = this.colors[piece.owner - 1];
						ellipse(j2 * this.space + this.x + 1, i2 * this.space + this.y + 1, this.space - 2, this.space - 2);
						
						if (piece.type == 'king') {
							ctx.fillStyle = 'white';
							ctx.fillText('K', j2 * this.space + this.x + this.space / 2, i2 * this.space + this.y + 3 * this.space / 4);
						}
					}
					
					// mouse hover
					if (mousePos.x >= j2 * this.space + this.x + 1 && mousePos.x <= j2 * this.space + this.x + this.space - 1 && mousePos.y >= i2 * this.space + this.y + 1 && mousePos.y <= i2 * this.space + this.y + this.space - 1) {
						this.hover = [i, j];
						
						ctx.strokeStyle = 'green';
						ctx.strokeRect(j2 * this.space + this.x + 2, i2 * this.space + this.y + 2, this.space - 4, this.space - 4);
					}
				});
			});
		};
	};
	
	
	const setRules = format => {
		switch (format) {
			case 'American':
				this.board.w = 8;
				this.board.h = 8;
				this.turn = 1;
				break;
			case 'Spanish':
				this.board.w = 8;
				this.board.h = 8;
				this.turn = 1;
				bLColor = 1;
				placementColor = 0;
				break;
			case 'South African':
				this.board.w = 14;
				this.board.h = 14;
				this.turn = 1;
				break;
		}
	};
	
	function ellipse(x, y, w, h) {
		ctx.beginPath();
		ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
		ctx.fill();
		ctx.closePath();
	}
	
	const render = (arr) => {
		const set = new Set(arr);
		
		//ctx.fillStyle = 'grey';
		//ctx.fillRect(0, 0, canv.width, canv.height);
		
		if (set.has('board') || arr == 'all') {
			this.board.draw(this.playerIdx);
		}
		
		if (set.has('hud') || arr == 'all') {
			ctx.fillStyle = 'black';
			ctx.fillRect(0, 0, canv.width, 64);
			
			// display
			let p1Text = {
				text: [...this.players][0],
				x: canv.width / 4,
				y: 48
			};
			let p2Text = {
				text: [...this.players][1],
				x: 3 * canv.width / 4,
				y: 48
			};
			ctx.fillStyle = 'white';
			ctx.textAlign = 'center';
			ctx.font = '32px sans-serif';
			ctx.fillText('VS', canv.width / 2, 48);
			if (gameOver) {
				if (winner) {
					ctx.fillText('You Win!', canv.width / 2, 96);
				} else {
					ctx.fillText('You Lose!', canv.width / 2, 96);
				}
			}
			
			ctx.fillStyle = this.board.colors[0];
			ctx.fillText(p1Text.text, p1Text.x, p1Text.y);
			ctx.fillStyle = this.board.colors[1];
			ctx.fillText(p2Text.text, p2Text.x, p2Text.y);
			
			ctx.strokeStyle = this.turn == 1 ? 'gold' : 'white';
			ctx.strokeText(p1Text.text, p1Text.x, p1Text.y);
			ctx.strokeStyle = this.turn == 2 ? 'gold' : 'white';
			ctx.strokeText(p2Text.text, p2Text.x, p2Text.y);
		}
		
		if (set.has('timer 1') || arr == 'all') {
			// timer
			ctx.fillStyle = 'black';
			ctx.fillRect(0, 0, 32, 32);
			ctx.font = '10px sans-serif';
			ctx.fillStyle = 'white';
			ctx.fillText(this.timer1, 16, 16);
		}
		
		if (set.has('timer 2') || arr == 'all') {
			// timer
			ctx.fillStyle = 'black';
			ctx.fillRect(canv.width - 32, 0, 32, 32);
			ctx.font = '10px sans-serif';
			ctx.fillStyle = 'white';
			ctx.fillText(this.timer2, canv.width - 16, 16);
		}
	};
	
	this.connect = s => {
		socket = s;
		matchmaker.connect(socket, this);
	}
	
	var canJump = false;
	// get possible moves for board ui and determines if player can jump
	const getMoves = space => {
		const b = this.board.data;
		const [i1, j1] = space;
		const playerPiece = b[i1][j1];
		const adj = [[i1 - 1, j1 - 1], [i1 - 1, j1 + 1], [i1 + 1, j1 - 1], [i1 + 1, j1 + 1]]; // adjacent cells [tl, tr, bl, br]
		const jumps = [[i1 - 2, j1 - 2], [i1 - 2, j1 + 2], [i1 + 2, j1 - 2], [i1 + 2, j1 + 2]]; // jump cells
		let moves = [];
		let tmpMoves = [];
		
		let value;
		adj.forEach((a, i) => {
			if (a[0] > -1 && a[0] < b.length && a[1] > -1 && a[1] < b[0].length) { // is index valid
				const aPiece = b[a[0]][a[1]];
				const jump = jumps[i];
				
				// jump
				if (jump[0] > -1 && jump[0] < b.length && jump[1] > -1 && jump[1] < b[0].length) { // is index valid
					const jSpace = b[jump[0]][jump[1]];
					if (aPiece && aPiece.owner != playerPiece.owner && !jSpace) {
						// bottom to top
						if (playerPiece.owner === 1 && i < 2 || playerPiece.type === 'king') {
							jump.target = a;
							moves.push(jump);
						}
						// top to bottom
						if (playerPiece.owner === 2 && i >= 2 || playerPiece.type === 'king') {
							jump.target = a;
							moves.push(jump);
						}
					}
				}
				if (moves.length > 0 && playerPiece.owner == this.playerIdx) {
					canJump = true;
				}
				
				// empty
				if (!aPiece) {
					if (!canJump || playerPiece.owner != this.playerIdx) {
						// bottom to top
						if (playerPiece.owner === 1 && i < 2 || playerPiece.type === 'king') { // king can move both ways
							tmpMoves.push(a);
						}
						// top to bottom
						if (playerPiece.owner === 2 && i >= 2 || playerPiece.type === 'king') {
							tmpMoves.push(a);
						}
					}
				}
			}
		});
		if (moves.length == 0) {// adjacent spaces are only valid if you can't jump
			moves = tmpMoves;
		}
		
		playerPiece.moves = moves;
		return moves;
	};
	
	// check if the mouse is over a possible move
	const validMove = () => {
		let value = false;
		this.board.moves.forEach((m) => {
			if (m[0] === this.board.hover[0] && m[1] === this.board.hover[1]) { // is this the space the mouse is over
				if (m.target) {
					target = m.target;
				}
				value = true;
				
				return;
			}
		});
		
		return value;
	};
	
	// get moves for all pieces to enforce mandatory jumps
	const setupMoves = () => {
		const b = this.board.data;
		b.forEach((row, i) => {
			row.forEach((col, j) => {
				if (b[i][j]) {
					getMoves([i, j]);
				}
			});
		});
	};
	
	// if opponent has no moves you win
	const winCondition = () => {
		const b = this.board.data;
		var value = true;
		b.forEach((row, i) => {
			row.forEach((col, j) => {
				if (b[i][j] && b[i][j].owner != this.playerIdx) {
					if (b[i][j].moves.length > 0) {
						value = false;
					}
				}
			});
		});
		
		if (value) {
			console.log('winner');
		}
		return value;
	};
	
	const mouseMove = (event) => {
		const clientRatio = { // make mouse pos consistent with canvas size changes
			x: canv.clientWidth / canv.width,
			y: canv.clientHeight / canv.height,
		};
		
		mousePos.x = event.offsetX / clientRatio.x;
		mousePos.y = event.offsetY / clientRatio.y;
		
		if (mousePos.x >= this.board.x && mousePos.x <= this.board.getRight() && mousePos.y >= this.board.y && mousePos.y <= this.board.getBottom()) {
			render(['board']);
		}
	};
	
	const select = () => {
		this.board.selected = [this.board.hover[0], this.board.hover[1]];
		this.board.moves = getMoves(this.board.selected);
		render(['board']);
	};
	
	const endTurn = () => {
		// next turn
		if (this.turn == 1) {
			this.turn = 2;
		} else {
			this.turn = 1;
		}
		this.turnTime = '0:30';
		render('all');
		
		socket.emit('server update', {
			board: this.board.data,
			turn: this.turn
		});
	};
	
	const click = (event) => {
		mouseMove(event);
		
		const b = this.board.data;
		if (!gameOver && this.board.hover && this.turn == this.playerIdx) { // is the mouse over the board
			if (!this.board.selected) {
				if (b[this.board.hover[0]][this.board.hover[1]]) { // is mouse over a piece, is it your piece and if no piece is currently selected
					select();
				}
			} else {
				target = false;
				const piece = b[this.board.selected[0]][this.board.selected[1]];
				if (piece.owner == this.playerIdx && validMove()) {
					b[this.board.hover[0]][this.board.hover[1]] = piece;
					b[this.board.selected[0]][this.board.selected[1]] = 0;
					if (target) {
						b[target[0]][target[1]] = 0;
					}
					
					if (this.playerIdx == 1 && this.board.hover[0] == 0) {
						piece.type = 'king';
					}
					if (this.playerIdx == 2 && this.board.hover[0] == b.length - 1) {
						piece.type = 'king';
					}
					
					
					canJump = false;
					this.board.selected = null;
					this.board.moves = null;
					
					// check for win
					setupMoves();
					if (winCondition()) {
						this.endGame(true);
						socket.emit('game over', socket.username);
					}
					
					endTurn();
				} else {
					this.board.selected = null;
					this.board.moves = null;
					render(['board']);
				}
			}
		}
	};
	
	this.start = match => {
		id = match.id;
		this.players = new Set(match.players);
		
		// create canvas
		canv = canvas.create("<canvas id='gameCanv'>", '#game');
		ctx = canv.getContext('2d');
		
		canv.width = 720;
		canv.height = 576;
		
		// canvas events
		canv.addEventListener('mousemove', e => {
			mouseMove(e);
		});
		canv.addEventListener('click', e => {
			click(e);
		});
		console.log(match.options)
		setRules(match.options.format);
		
		// center board
		this.board.x = canv.width / 2 - this.board.getWidth() / 2;
		this.board.y = canv.height / 2 - this.board.getHeight() / 2;
		
		this.board.fill();
		
		//updateProxy(0);
		ctx.fillStyle = 'grey';
		ctx.fillRect(0, 0, canv.width, canv.height);
		
		render('all');
	};
	
	this.stateUpdate = state => {
		Object.keys(state).forEach(key => {
			if (key == 'board') {
				this.board.data = state[key];
				setupMoves();
				render(['board']);
			} else if (key == 'turn') {
				this['timer'+this.turn] = '0:30';
				this[key] = state[key];
				render(['hud', 'timer 1', 'timer 2']);
			} else if (key == 'turnTime') {
				this['timer'+this.turn] = state[key];
				render(['timer '+this.turn]);
				
				console.log('turn', 'player '+this.turn, this['timer'+this.turn]);
			} else if (key == 'timer1') {
				this[key] = state[key];
				render(['timer 1']);
				
				console.log('disconnect', 'player 1', this[key]);
			} else if (key == 'timer2') {
				this[key] = state[key];
				render(['timer 2']);
				
				console.log('disconnect', 'player 2', this[key]);
			} else {
				this[key] = state[key];
			}
		});
	};
	
	this.timeOut = () => {
		if (this.turn != this.playerIdx) {
			this.endGame(socket.username);
			socket.emit('game over', socket.username);
		}
	};
	
	this.endGame = w => {
		winner = w == socket.username ? true : false;
		gameOver = true;
		render(['hud', 'turn timer', 'afk timer']);
	};
	
	this.kill = () => {
		winner = null;
		gameOver = false;
		//cancelAnimationFrame(loop);
		canvas.remove();
	};
	
	this.dropPlayer = player => {
		//this.players.delete(player);
		
		console.log(player+' disconnected');
	};
	
	this.disconnect = (sock) => {
		this.kill();
		matchmaker.disconnect(sock);
	};
};