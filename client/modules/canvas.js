/*!
 * canvas
 * 
 * uses jquery to add or remove a canvas element
 */

'use strict';

export {canvas};

const canvas = new function() {
	var $canvas = null;
	
	/**
	 * create and append a canvas to an element
	 *
	 * @param {string} canvasSelect
	 * @param {string} targetSelect
	 */
	this.create = (canvasSelect, targetSelect) => {
		// create canvas
		this.canvasSelect = canvasSelect;
		$canvas = $(canvasSelect);
		$(targetSelect).append($canvas);
		
		return $canvas[0];
	};
	
	/**
	 * remove canvas
	 */
	this.remove = () => {
		if ($canvas) {
			$canvas.remove('canvas');
		}
	};
};