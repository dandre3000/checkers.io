/*!
 * server
 */

'use strict';

(() => {
	// dependencies
	const express = require('express');
	const app = express();
	const server = require('http').createServer(app);
	const fs = require('fs');
	const path = require('path');
	const socketio = require('socket.io');
	
	// modules
	const matchMaker = require('./modules/matchmaker');
	const login = require('./modules/login');
	const chat = require('./modules/chat');
	
	const port = process.env.PORT || 80;
	server.listen(port, () => {
		console.log('Server listening at port %d', port);
		fs.writeFile(__dirname + '/log.txt', 'started', (err) => {
			if (err) throw err;
			console.log('The file has been saved!');
		});
	});
	server.on('error', (err) => {
		console.error('Server error:', err);
	});
	
	// Routing
	const clientPath = `${__dirname}\..\client`;
	//app.use(express.static(clientPath));
	app.use(express.static(path.join(__dirname, '../client')));
	console.log(`Serving static from ${clientPath}`);

	const io = socketio(server);
	io.on('connection', (sock) => {
		
	});
	
	// Matchmaking
	const mm = io.of('/mm');
	mm.on('connection', sock => {
		chat(sock, mm);
		matchMaker.namespace = mm;
		matchMaker.connect(sock);
		
		sock.on('disconnect', () => {
			matchMaker.disconnect(sock);
		});
	});
})();