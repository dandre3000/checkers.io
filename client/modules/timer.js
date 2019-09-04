/*!
 * timer
 *
 * todo: continous loop instead of interval for more precise timing
 */

'use strict';

export {Timer};

class Timer {
	constructor(ms, callback) {
		this.ms = ms;
		this.alarm = callback || null;
		this.loop = null;
	}
	
	countDown(dt) {
		if (this.ms > 0) {
			this.ms -= dt;
		}
		if (this.ms < 0) {
			this.ms = 0;
		}
		if (this.ms == 0) {
			if (this.alarm && typeof(this.alarm) == 'function') {
				this.alarm();
			}
		}
	};
	
	getTime() {
		// values that show on the clock
		const minutes = Math.floor(this.ms / 60000);
		const seconds = Math.ceil(this.ms / 1000) % 60;
		
		if (seconds === 60) {
			return (minutes + 1)+':'+0+0;
		} else if (seconds < 10) {
			return minutes+':'+0+seconds;
		} else {
			return minutes+':'+seconds;
		}
	};
	
	start(dt, callback) {
		this.loop = setInterval(() => {
			this.countDown(dt);
			if (callback && typeof(callback) == 'function') {
				callback();
			}
		}, dt);
	};
	
	stop() {
		clearInterval(this.loop);
	};
};