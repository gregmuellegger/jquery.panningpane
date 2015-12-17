/*
 * window.requestAnimationFrame polyfill taken from https://gist.github.com/paulirish/1579671
 */

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel

// MIT license

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());


(function ($) {
    function easeInOutQuad (x, t, b, c, d) {
            if ((t/=d/2) < 1) return c/2*t*t + b;
            return -c/2 * ((--t)*(t-2) - 1) + b;
    }

    $.fn.panningpane = function (options) {
        /**
         * Configuration options:
         *   outOfBoundarySlowdown: A factor of how much slower shall the
         *      canvas move when it is dragged outside the boundary.
         *
         *   snapBackDuration: Animation duration till the canvas snaps back
         *      when it's dragged outside the boundary.
         *
         *   snapBackAnimationOptions: TODO
         *
         *   glideAcceleration: A factor of how much slower the velocity will
         *      be after the user released the dragging.
         *
         *   outOfBoundaryGlideAcceleration: A factor of how much slower the
         *      velocity will be after the user released the dragging. This
         *      one is used over glideAcceleration when the canvas moved
         *      outside the boundaries.
         *
         *   padding: A value of how many pixels shall be added to the canvas
         *      on every side. That prevents the pane boxes to stick on the
         *      very edge of the canvas.
         */
        var opts = $.extend({
            scale: 1,
            outOfBoundarySlowdown: 0.5,
            snapBackDuration: 1500,
            snapBackEase: easeInOutQuad,
            glideAcceleration: 0.7,
            outOfBoundaryGlideAcceleration: 0.1,
            padding: 200,
            clickCenterDuration: 500,
            clickCenterEase: easeInOutQuad,
            isTouchDevice: 'ontouchstart' in document.documentElement,
            mousemoveSpeedModifier: function (ratio) {
                return Math.sqrt(ratio * 0.2);
            }
        }, options);

	var roundToFullNumber = function (value) {
	    return Math.round(value);
	};

        /*
         * Return a transform css property that uses translate() to move a
         * given point.
         */
        var translate = function (offset) {
	    var x = roundToFullNumber(offset.x),
		y = roundToFullNumber(offset.y);
            return {
                'transform': 'translate(' + (-x) + 'px,' + (-y) + 'px)',
                '-ms-transform': 'translate(' + (-x) + 'px,' + (-y) + 'px)',
                '-webkit-transform': 'translate(' + (-x) + 'px,' + (-y) + 'px)'
            };
        };

        /*
         * Return (a - b) or undefined if one of the values is not defined.
         */
        var diffOrUndefined = function (a, b) {
            if (a === undefined || b === undefined) {
                return undefined;
            } else {
                return a - b;
            }
        }

        /*
         * Return the distance between point start and end. One coordinate
         * might be undefined if one of the given points has an undefined
         * coordinate.
         */
        var pointDiff = function (a, b) {
            return {
                x: diffOrUndefined(a.x, b.x),
                y: diffOrUndefined(a.y, b.y),
            };
        };

        /**
           Some developer documentation:


           On scaling
           ----------

           There is the ``scale`` opt that can be given. It shrinks the whole
           panningpane by the factor that is given. So to make everything half
           the size, 0.5 is given.

           The width height of the panningpane element is not changed, however
           these elements are affected:

           - The .panningpane-canvas width and height is scaled
           - The panebox width and height is scaled
           - The panebox position is scaled

        */

        $(this).each(function () {
            var Canvas = function (element, options, pane) {
                this.$element = $(element);
                this.options = $.extend({}, this.defaults, options);
                this.pane = pane;
                this._animating = false;
            };

            Canvas.prototype.defaults = {};

            Canvas.prototype.setup = function () {
                this.setOffset({ x: 0, y: 0 });
            };

            /*
             * Get the current offset for the canvas element.
             */
            Canvas.prototype.getCurrentOffset = function () {
                // Returning a copy, so that it cannot be fiddled with the
                // internal value.
                return {
                    x: this._offset.x,
                    y: this._offset.y
                };
            };

            Canvas.prototype.setOffset = function (offset) {
                this._offset = offset;
            };

            Canvas.prototype.move = function (offset) {
                var currentOffset = this.getCurrentOffset(),
                    boundary = this.getBoundary(),
                    newOffset = {
                        x: currentOffset.x + offset.x,
                        y: currentOffset.y + offset.y
                    },
                    verticalSpeed = 1,
                    horizontalSpeed = 1;

                // Slow down when we move outside the boundaries.
                //

                // The new position would be outside the vertical boundary.
                if (newOffset.y < boundary.top || newOffset.y > boundary.bottom) {
                    verticalSpeed = this.options.outOfBoundarySlowdown;
                }
                // The new position would be outside the horizontal boundary.
                if (newOffset.x < boundary.left || newOffset.x > boundary.right) {
                    horizontalSpeed = this.options.outOfBoundarySlowdown;
                }

                currentOffset = {
                    x: currentOffset.x + offset.x * horizontalSpeed,
                    y: currentOffset.y + offset.y * verticalSpeed
                };

                this.setOffset(currentOffset);
                this.$element.css(translate(currentOffset));
            };

            /*
             * Move canvas instantly to the given destination.
             */
            Canvas.prototype.moveTo = function (destination) {
                destination = {
                    x: destination.x !== undefined ? destination.x : this.getCurrentOffset().x,
                    y: destination.y !== undefined ? destination.y : this.getCurrentOffset().y,
                };
                this.setOffset(destination);
                this.$element.css(translate(destination));
            };

            /*
             * Animate the canvas to a new position over a period of
             * ``duration`` ms. Use the given ``ease`` function to define the
             * transition. This function must take the same arguments as
             * jQuery ease function.
             */
            Canvas.prototype.animateTo = function (destination, duration, ease) {
                this.stopAnimation();

                var start = this.getCurrentOffset();
                var diff = pointDiff(destination, start);

                var animationOpts = {
                    startTime: new Date().getTime(),
                    duration: duration,
                    start: start,
                    diff: diff,
                    ease: ease,
                };

                this._animating = true;

                var performFrame = function () {
                    if (this._animating) {
                        window.requestAnimationFrame(function () {
                            var now = new Date().getTime();
                            var passedTime = now - animationOpts.startTime;

                            // Never over run the animation.
                            passedTime = Math.min(passedTime, duration);

                            var frameDestination = {};

                            // We support only animating in one direction.

                            if (diff.x !== undefined) {
                                frameDestination.x = animationOpts.ease(null, passedTime, start.x, diff.x, animationOpts.duration);
                            }

                            if (diff.y !== undefined) {
                                frameDestination.y = animationOpts.ease(null, passedTime, start.y, diff.y, animationOpts.duration);
                            }

                            this.moveTo(frameDestination);

                            if (now - animationOpts.startTime >= duration) {
                                this.stopAnimation();
                            } else {
                                performFrame();
                            }
                        }.bind(this));
                    }
                    // Just stop requesting frames if we stopped animating.
                }.bind(this);

                performFrame()
            };

            Canvas.prototype.isAnimating = function () {
                return this._animating;
            };

            Canvas.prototype.stopAnimation = function () {
                if (this.isAnimating()) {
                    this._animating = false;
                }
            };

            // Stop the canvas from animating.
            Canvas.prototype.stop = function () {
                this.stopAnimation();
            };

            /*
             * Return the edges for the canvas, including some padding. These
             * are the coordinations that we maximum can scroll to.
             */
            Canvas.prototype.getBoundary = function () {
                var padding = this.options.padding;
                    boundary = {
                        top: Math.min(0, _.min(this.pane.boxes.map(function (box) { return box.getTop(); }))),
                        left: Math.min(0, _.min(this.pane.boxes.map(function (box) { return box.getLeft(); }))),
                        bottom: Math.max(0, _.max(this.pane.boxes.map(function (box) { return box.getBottom(); }))),
                        right: Math.max(0, _.max(this.pane.boxes.map(function (box) { return box.getRight(); })))
                    };

                boundary.right = Math.max(boundary.right, this.pane.$element.width());
                boundary.bottom = Math.max(boundary.bottom, this.pane.$element.height());

                boundary.top -= padding;
                boundary.right += padding;
                boundary.bottom += padding;
                boundary.left -= padding;

                boundary.right -= this.pane.$element.innerWidth();
                boundary.bottom -= this.pane.$element.innerHeight();

                return boundary;
            };

            /*
             * Returns dimensions, including the padding.
             */
            Canvas.prototype.getDimensions = function () {
                var boundary = this.getBoundary();
                return {
                    x: boundary.right - boundary.left,
                    y: boundary.bottom - boundary.top
                };

            };

            /*
             * Returns true if the given point is out of the canvas' boundary.
             * If axis is given, only that axis will be taken into account for
             * the boundary calculation.
             */
            Canvas.prototype.isOutOfBoundary = function (offset, axis) {
                var includeX = axis != 'y',
                    includeY = axis != 'x',
                    boundary = this.getBoundary();
                if (includeX && (offset.x < boundary.left || offset.x > boundary.right)) {
                    return true;
                }
                if (includeY && (offset.y < boundary.top || offset.y > boundary.bottom)) {
                    return true;
                }
                return false;
            };

            var Box = function (element, options, pane) {
                this.$element = $(element);
                this.options = $.extend({}, this.defaults, options);
                this.pane = pane;
            };

            Box.prototype.defaults = {};

            Box.prototype.setup = function () {
                var top = parseInt(this.$element.attr('top'));
                var left = parseInt(this.$element.attr('left'));
                var width = this.$element.width();
                var height = this.$element.height();

                top = top * this.options.scale;
                left = left * this.options.scale;
                width = width * this.options.scale;
                height = height * this.options.scale;

                this.$element.css({
                    position: 'absolute',
                    top: top + 'px',
                    left: left + 'px',
                    width: width + 'px',
                    height: height + 'px'
                });
                this.$element.attr('top', top);
                this.$element.attr('left', left);

                if (this.$element.attr('data-select') === 'select') {
                    this.$element.on('click', function (event) {
                        if (this.pane.allowCentering()) {
                            this.pane.stop();
                            this.center();
                        }
                    }.bind(this));
                }
            };

            /*
             * Center a panebox as far as possible.
             */
            Box.prototype.center = function () {
                var position = this.$element.position();
                var destination = {
                    x: position.left + (this.$element.outerWidth() / 2) - ($(window).width() / 2),
                    y: position.top + (this.$element.outerHeight() / 2) - ($(window).height() / 2)
                };
                this.pane.canvas.animateTo(
                    destination,
                    this.options.clickCenterDuration,
                    this.options.clickCenterEase);
            };

            Box.prototype.getTop = function () { return parseInt(this.$element.attr('top')); };
            Box.prototype.getLeft = function () { return parseInt(this.$element.attr('left')); };
            Box.prototype.getRight = function () { return parseInt(this.$element.attr('left')) + this.$element.outerWidth(); };
            Box.prototype.getBottom = function () { return parseInt(this.$element.attr('top')) + this.$element.outerHeight(); };

            var Pane = function (element, options) {
                this.$element = $(element);
                this.options = $.extend({}, this.defaults, options);
                this.boxes = [];
                this.canvas = new Canvas(this.$element.find('.panningpane-canvas'), options, this);
                this._allowGliding = true;
                this.handlers = [];
            };

            Pane.prototype.defaults = {};

            Pane.prototype.setup = function () {
                this.$element.find('.panebox').each(function (i, boxElement) {
                    var box = new Box(boxElement, this.options, this);
                    box.setup();
                    this.boxes.push(box);
                }.bind(this));

                this.canvas.setup();
                this.handlers.forEach(function (handler) {
                    handler.setup();
                });
            };

            Pane.prototype.addBox = function (box) {
                this.boxes.push(box);
            };

            Pane.prototype.init = function () {
                var boundary = this.canvas.getBoundary();
                this.canvas.$element.css({
                    width: boundary.right,
                    height: boundary.bottom
                });

                this.canvas.move({x: 0, y: 0});
            };

            Pane.prototype.addHandler = function (handler) {
                this.handlers.push(handler);
            };

            /*
             * Instruct all handlers to stop moving.
             */
            Pane.prototype.stop = function () {
                this.handlers.forEach(function (handler) {
                    handler.stop();
                });
            };

            Pane.prototype.allowCentering = function (handler) {
                return this.handlers.every(function (handler) {
                    return handler.allowCentering();
                });
            };

            var DragHandler = function (pane, options) {
                this.pane = pane;
                this.dragging = false;
                this.options = $.extend({}, this.defaults, options);
            };

            DragHandler.prototype.defaults = {
                velocityInterval: 100
            };

            DragHandler.prototype.setup = function () {
                this.pane.$element.on('dragstart', function (event, props) {
                    this.dragging = true;
                    props.previousDeltaX = 0;
                    props.previousDeltaY = 0;
                    props.lastEventTime = Date.now();
                    props.latestDeltas = [];
                }.bind(this));

                this.pane.$element.on('drag', {distance: 1, click: false}, function (event, props) {
                    this.calculateVelocity(props);

                    var moveBy = {
                        x: props.previousDeltaX - props.deltaX,
                        y: props.previousDeltaY - props.deltaY
                    };

                    this.pane.canvas.move(moveBy);
                    props.previousDeltaX = props.deltaX;
                    props.previousDeltaY = props.deltaY;
                }.bind(this));

                this.pane.$element.on('dragend', function (event, props) {
                    // Allow sliding again, we are not dragging any more.
                    this._allowGliding = true;

                    var now = new Date().getTime();

                    // We need to delay the setting of the dragging variable
                    // since otherwise would we allow the bubbling click on a
                    // panebox.
                    setTimeout(function () { this.dragging = false; }.bind(this), 0);

                    // Now handle the velocity that is still there and move
                    // the canvas further.
                    window.requestAnimationFrame(this.handleRestVelocity.bind(this, now, props, 'x'));
                    window.requestAnimationFrame(this.handleRestVelocity.bind(this, now, props, 'y'));
                }.bind(this));

                this.pane.$element.on('mousedown', function () {
                    // Disallow sliding, the mouse shall have the full control
                    // over the canvas. But we cannot do this in the drag
                    // event, since the dragging starts earliest after the
                    // mouse was moved for one pixel.
                    this._allowGliding = false;
                    this.pane.canvas.stop();
                }.bind(this));

            };

            DragHandler.prototype.calculateVelocity = function (props) {
                var now = Date.now();

                props.latestDeltas.push({
                    time: now,
                    x: props.deltaX,
                    y: props.deltaY
                });

                props.latestDeltas = _.filter(props.latestDeltas, function (d) {
                    return now - this.options.velocityInterval <= d.time;
                }.bind(this));

                // props.velocity will contain the distance traveled in the last
                // (velocityInterval) amount of time.
                props.velocity = {
                    x: (props.deltaX - props.latestDeltas[0].x),
                    y: (props.deltaY - props.latestDeltas[0].y)
                };
            };

            /*
             * Takes the drag-event props and an axis that it should handle.
             * Then determines if the there is still some velocity left and
             * use that to move the canvas further after the user released the
             * mouse button.
             */
            DragHandler.prototype.handleRestVelocity = function (lastFrame, props, axis) {
                // Don'T handle velocity if some dragging is in progress.
                if (!this._allowGliding) {
                    return;
                }

                var now = new Date().getTime();
                var frameDuration = now - lastFrame;
                var outOfBoundary = this.pane.canvas.isOutOfBoundary(this.pane.canvas.getCurrentOffset(), axis);

                var acceleration = outOfBoundary ? this.options.outOfBoundaryGlideAcceleration : this.options.glideAcceleration;
                // Normalize, so that we can apply the acceleration only for
                // the already elapsed frameDuration.
                var relativeAcceleration = 1 - (1 - acceleration) * (frameDuration / this.options.velocityInterval);

                var velocity = props.velocity[axis] * relativeAcceleration,
                    distance = velocity * (frameDuration / this.options.velocityInterval),
                    lowThreshold = (frameDuration / this.options.velocityInterval);

                props.velocity[axis] = velocity;

                this.pane.canvas.move({
                    x: axis == 'x' ? -1 * distance : 0,
                    y: axis == 'y' ? -1 * distance : 0
                });

                if (Math.abs(velocity) > lowThreshold) {
                    window.requestAnimationFrame(this.handleRestVelocity.bind(this, now, props, axis));
                } else {
                    // Both axis has stopped, so we can snap the canvas back for both axis.
                    if (props.velocity.x < lowThreshold && props.velocity.y < lowThreshold) {
                        this.pane.canvas.stop();
                        this.snapBack();
                    } else {
                        this.snapBack(axis);
                    }
                }
            };

            /*
             * Glide the canvas back into view if it was dragged outside of
             * its boundaries.
             */
            DragHandler.prototype.snapBack = function (axis) {
                var destination = {x: undefined, y: undefined},
                    boundary = this.pane.canvas.getBoundary(),
                    currentOffset = this.pane.canvas.getCurrentOffset();

                if (currentOffset.y < boundary.top) {
                    destination.y = boundary.top;
                }
                if (currentOffset.y > boundary.bottom) {
                    destination.y = boundary.bottom;
                }
                if (currentOffset.x < boundary.left) {
                    destination.x = boundary.left;
                }
                if (currentOffset.x > boundary.right) {
                    destination.x = boundary.right;
                }

                // If axis is set, then ignore the other axis.
                if (axis === 'x') { destination.y = undefined; }
                if (axis === 'y') { destination.x = undefined; }

                // If the canvas has been dragged outside the allowed boundaries, gracefully snap back with an animation.

                this.pane.canvas.animateTo(
                    destination,
                    this.options.snapBackDuration,
                    this.options.snapBackEase);
            };

            DragHandler.prototype.stop = function () {
                // noop.
            };

            DragHandler.prototype.allowCentering = function () {
                return this.dragging === false;
            };

            var MouseMoveHandler = function (pane, options) {
                this.pane = pane;
                this.options = $.extend({}, this.defaults, options);
                // We will always try to center the destination.
                this.destination = null;
            };

            MouseMoveHandler.prototype.defaults = {};

            MouseMoveHandler.prototype.setup = function () {
                this.pane.$element.on('mousemove', function (event) {
                    var pointerPositionRelative = {
                        x: event.clientX / $(window).width(),
                        y: event.clientY / $(window).height()
                    };
                    var boundary = this.pane.canvas.getBoundary();
                    this.destination = {
                        x: boundary.left + (pointerPositionRelative.x * (boundary.right - boundary.left)),
                        y: boundary.top + (pointerPositionRelative.y * (boundary.bottom - boundary.top))
                    }
                }.bind(this));

		window.requestAnimationFrame(this.performFrame.bind(this));
            };

            MouseMoveHandler.prototype.performFrame = function () {
		if (this.destination === null) {
		    window.requestAnimationFrame(this.performFrame.bind(this));
		    return;
		}

                var offset = this.pane.canvas.getCurrentOffset();
                var distance = pointDiff(this.destination, offset);
		var moveBy = this.modifyMove(distance);
		this.pane.canvas.move(moveBy);
		window.requestAnimationFrame(this.performFrame.bind(this));
            };

            MouseMoveHandler.prototype.modifyMove = function (distance) {
                var dimensions = this.pane.canvas.getDimensions();
                var ratio = {
                    x: Math.abs(distance.x / dimensions.x),
                    y: Math.abs(distance.y / dimensions.y)
                };
                var moveBy = {
                    x: distance.x * this.options.mousemoveSpeedModifier(ratio.x),
                    y: distance.y * this.options.mousemoveSpeedModifier(ratio.y)
                };
                return moveBy;
            };

            MouseMoveHandler.prototype.stop =function () {
                this.destination = null;
            };

            MouseMoveHandler.prototype.allowCentering = function () {
                return false;
            };

            var pane = new Pane($(this), opts);

            var dragHandler = new DragHandler(pane, opts);
            var mousemoveHandler = new MouseMoveHandler(pane, opts);

            if (opts.isTouchDevice) {
                pane.addHandler(dragHandler);
            } else {
                pane.addHandler(mousemoveHandler);
            }

            pane.setup();
            pane.init();
        });

        return this;
    };
})(jQuery);
