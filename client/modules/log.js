/*!
 * log
 *
 * display messages onto an element
 */

'use strict';

export {log};

const log = new function() {
	this.fadeTime = 150; // ms till '...' disappears
	this.$display = $('.messages'); // element that displays messages
	
	/**
	 * adds an element to the display and scrolls to the bottom
	 *
	 * @param {object} jQuery element to add as a message
	 * @param {[object]} options passed to element
	 */
	this.element = (el, options) => {
		const $el = $(el);

		// Setup default options
		if (!options) {
			options = {};
		}
		if (typeof options.fade === 'undefined') {
			options.fade = true; // If the element should fade-in
		}
		if (typeof options.prepend === 'undefined') {
			options.prepend = false; // If the element should prepend
		}

		// Apply options
		if (options.fade) {
			$el.hide().fadeIn(this.fadeTime);
		}
		if (options.prepend) {
			this.$display.prepend($el);
		} else {
			this.$display.append($el);
		}
		this.$display[0].scrollTop = this.$display[0].scrollHeight;
	};
	
	/**
	 * creates hardcoded li for text messages
	 *
	 * @param {string} message
	 * @param {[object]} options
	 */
	this.text = (message, options) => {
		const $el = $('<li>').addClass('log').text(message);
		this.element($el, options);
	};
};