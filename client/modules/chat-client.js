/*!
 * chat: client
 *
 * usernames are colored
 * login page
 *
 * todo: separate login from chat
 */

import {log} from './log.js';

'use strict';

export {chat};

const chat = new function() {
	// ... fade out in ms
	const TYPING_TIMER_LENGTH = 400;
	// username colors
	const COLORS = [
		'#e21400', '#91580f', '#f8a700', '#f78b00',
		'#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
		'#3b88eb', '#3824aa', '#a700ff', '#d300e7'
	];

	// jQuery DOM references
	const $window = $(window);
	const $usernameInput = $('.usernameInput'); // username input
	const $username = $('.username'); // username display
	const $inputMessage = $('.inputMessage'); // message input box
	const $loginPage = $('.login.page'); // login page
	const $chatPage = $('.chat.page'); // chatroom page
	
	// Prompt for setting a username
	
	var connected = false; // login successful?
	var typing = false; // currently typing?
	var lastTypingTime; // timestamp for
	var $currentInput = $usernameInput.focus(); // selected element
	
	// executed after login
	this.login = () => {};
	
	/**
	 * log number of users
	 *
	 * @param {int}
	 */
	const addParticipantsMessage = users => {
		console.log(users);
		var message = '';
		if (users === 1) {
			message += "there's 1 participant";
		} else {
			message += "there are " + users + " participants";
		}
		log.text(message);
	}
	
	/**
	 * gets the color of a username through hash function
	 *
	 * @param {string}
	 */
	const getUsernameColor = username => {
		// Compute hash code
		var hash = 7;
		for (let i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + (hash << 5) - hash;
		}
		// Calculate color
		var index = Math.abs(hash % COLORS.length);
		return COLORS[index];
	};
	
	/**
	 * log user's message
	 *
	 * @param {object username: string, message: string, typing: bool} data
	 * @param {[object fade: bool]} options
	 */
	const addChatMessage = (data, options) => {
		// Don't fade the message in if there is an 'X was typing'
		var $typingMessages = getTypingMessages(data);
		options = options || {};
		if ($typingMessages.length !== 0) {
			options.fade = false;
			$typingMessages.remove();
		}

		var $usernameDiv = $('<span class="username"/>')
			.text(data.username + ' ')
			.css('color', getUsernameColor(data.username));
		var $messageBodyDiv = $('<span class="messageBody">')
			.text(data.message);

		var typingClass = data.typing ? 'typing' : '';
		var $messageDiv = $('<li class="message"/>')
			.data('username', data.username)
			.addClass(typingClass)
			.append($usernameDiv, $messageBodyDiv);

		log.element($messageDiv, options);
	}
	
	/**
	 * prevents input from having injected markup
	 *
	 * @param {string}
	 */
	const cleanInput = input => {
		return $('<div/>').text(input).html();
	}
	
	/**
	 * adds the visual chat typing message
	 *
	 * @param {string}
	 */
	const addChatTyping = username => {
		const data = {
			username: username,
			typing: true,
			message: '...'
		};
		addChatMessage(data);
	}

	/**
	 * removes the visual chat typing message
	 *
	 * @param {string}
	 */
	const removeChatTyping = username => {
		getTypingMessages(username).fadeOut(function () {
			$(this).remove();
		});
	}
	
	/**
	 * gets the 'X is typing' messages of a user
	 *
	 * @param {string}
	 */
	const getTypingMessages = username => {
		return $('.typing.message').filter(function () {
			return $(this).data('username') === username;
		});
	}
	
	// Click events
		
	// Focus input when clicking anywhere on login page
	$loginPage.click(() => {
		$currentInput.focus();
	});

	// Focus input when clicking on the message input's border
	$inputMessage.click(() => {
		$inputMessage.focus();
	});
	
	// connection
	this.connect = (socket) => {
		// save username in socket session
		socket.username = null;
		
		/**
		 * sets the client's username
		 */
		const setUsername = () => {
			socket.username = cleanInput($usernameInput.val().trim());

			// If the username is valid
			if (socket.username) {
				// Tell the server your username
				console.log('login');
				socket.emit('add user', socket.username);
			}
		};
		
		/**
		 * sends a chat message
		 */
		const sendMessage = () => {
			var message = $inputMessage.val();
			// Prevent markup from being injected into the message
			message = cleanInput(message);
			// if there is a non-empty message and a socket connection
			if (message && connected) {
				$inputMessage.val('');
				addChatMessage({
					username: socket.username,
					message: message
				});
				// tell server to execute 'new message' and send along one parameter
				socket.emit('new message', {
					message: message,
					channel: 'global'
				});
			}
		};
		
		/**
		 * updates the typing event
		 */
		const updateTyping = () => {
			if (connected) {
				// emit 'typing' once
				if (!typing) {
					typing = true;
					socket.emit('typing');
				}
				lastTypingTime = (new Date()).getTime();

				// stop typing after time limit
				setTimeout(() => {
					var typingTimer = (new Date()).getTime();
					var timeDiff = typingTimer - lastTypingTime;
					if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
						socket.emit('stop typing');
						typing = false;
					}
				}, TYPING_TIMER_LENGTH);
			}
		};
		
		// Keyboard events
		
		$window.keydown(event => {
			// Auto-focus the current input when a key is typed
			if (!(event.ctrlKey || event.metaKey || event.altKey)) {
				$currentInput.focus();
			}
			// When the client hits ENTER on their keyboard
			if (event.which === 13) {
				if (socket.username) {
					sendMessage();
					socket.emit('stop typing');
					typing = false;
				} else {
					setUsername();
				}
			}
		});
		
		$inputMessage.on('input', () => {
			updateTyping();
		});
		
		// Socket events
		
		// Whenever the server emits 'login', log the login message
		socket.on('login', data => {
			if (data == 'fail') {
				socket.username = null;
				alert('Username taken.');
			} else {
				// remove login page only after server validates username
				$loginPage.fadeOut();
				$username.html(socket.username);
				$chatPage.show();
				$loginPage.off('click');
				$currentInput = $inputMessage.focus();
					
				
				// Display the welcome message
				var message = "Welcome to Socket.IO Chat – ";
				log.text(message, {
					prepend: true
				});
			}
			
			if (!connected) {
				this.login(); // to be executed once per page, not on reconnect
				connected = true;
			}
		});
		
		// current amount of users
		socket.on('total users', users => {
			console.log(users);
			addParticipantsMessage(users);
		});
		
		// all usernames
		socket.on('usernames', (data) => {
			console.log(data);
		});
		
		// Whenever the server emits 'new message', update the chat body
		socket.on('new message', data => {
			addChatMessage(data);
		});

		// Whenever the server emits 'user joined', log it in the chat body
		socket.on('user joined', data => {
			log.text(data.username + ' joined');
		});
		
		// Whenever the server emits 'user left', log it in the chat body
		socket.on('user left', data => {
			log.text(data.username + ' left');
			removeChatTyping(data);
		});
		
		// Whenever the server emits 'typing', show the typing message
		socket.on('typing', username => {
			addChatTyping(username);
		});
		
		// Whenever the server emits 'stop typing', kill the typing message
		socket.on('stop typing', username => {
			removeChatTyping(username);
		});
		
		socket.on('disconnect', () => {
			log.text('you have been disconnected');
		});
		
		socket.on('reconnect_error', () => {
			log.text('attempt to reconnect has failed');
		});
	};
	
	// reconnection
	this.reconnect = socket => {
		log.text('you have been reconnected');
		if (socket.username) {
			socket.emit('add user', socket.username);
		}
	};
};