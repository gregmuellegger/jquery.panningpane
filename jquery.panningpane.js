(function ($) {
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
            snapBackDuration: 500,
            snapBackAnimationOptions: {},
            glideAcceleration: 0.9,
            outOfBoundaryGlideAcceleration: 0.5,
            padding: 200,
            clickCenterDuration: 500,
            frameDuration: 30,
            isTouchDevice: 'ontouchstart' in document.documentElement,
            mousemoveSpeedModifier: function (ratio) {
                return Math.sqrt(ratio * 0.2);
            }
        }, options);

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
            };

            Canvas.prototype.defaults = {};

            Canvas.prototype.setup = function () {

            };

            /*
             * Get the current offset for the canvas element.
             */
            Canvas.prototype.getCurrentOffset = function () {
                return {
                    x: -parseInt(this.$element.css('left')),
                    y: -parseInt(this.$element.css('top'))
                };
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

                this.$element.css({
                    left: -currentOffset.x,
                    top: -currentOffset.y
                });
            };

            // Stop the canvas from animating.
            Canvas.prototype.stop = function () {
                this.$element.stop();
            };

            /*
             * Return the edges for the canvas, including some padding.
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

                this.pane.canvas.$element.animate({
                    left: -destination.x,
                    top: -destination.y
                }, {duration: this.options.clickCenterDuration});
            };

            Box.prototype.getTop = function () { return parseInt(this.$element.attr('top')); };
            Box.prototype.getLeft = function () { return parseInt(this.$element.attr('left')); };
            Box.prototype.getRight = function () { return parseInt(this.$element.attr('top')) + this.$element.outerHeight(); };
            Box.prototype.getBottom = function () { return parseInt(this.$element.attr('left')) + this.$element.outerWidth(); };

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

                    // Now handle the velocity that is still there and move
                    // the canvas further.
                    _.delay(this.handleRestVelocity.bind(this), this.options.frameDuration, props, 'x');
                    _.delay(this.handleRestVelocity.bind(this), this.options.frameDuration, props, 'y');

                    // We need to delay the setting of the dragging variable
                    // since otherwise would we allow the bubbling click on a
                    // panebox.
                    _.delay(function () { this.dragging = false; }.bind(this), 0);
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

                props.velocity = {
                    x: (props.deltaX - props.latestDeltas[0].x) / 10,
                    y: (props.deltaY - props.latestDeltas[0].y) / 10
                };
            };

            /*
             * Takes the drag-event props and an axis that it should handle.
             * Then determines if the there is still some velocity left and
             * use that to move the canvas further after the user released the
             * mouse button.
             */
            DragHandler.prototype.handleRestVelocity = function (props, axis) {
                // Don'T handle velocity if some dragging is in progress.
                if (!this._allowGliding) {
                    return;
                }

                var outOfBoundary = this.pane.canvas.isOutOfBoundary(this.pane.canvas.getCurrentOffset(), axis),
                    acceleration = outOfBoundary ? this.options.outOfBoundaryGlideAcceleration : this.options.glideAcceleration,
                    velocity = props.velocity[axis] * acceleration,
                    distance = velocity * (this.options.velocityInterval / this.options.frameDuration),
                    lowThreshold = (this.options.frameDuration / this.options.velocityInterval);

                props.velocity[axis] = velocity;

                this.pane.canvas.move({
                    x: axis == 'x' ? -distance : 0,
                    y: axis == 'y' ? -distance : 0
                });

                if (Math.abs(velocity) > lowThreshold) {
                    _.delay(this.handleRestVelocity.bind(this), this.options.frameDuration, props, axis);
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
                var pos = {top: undefined, left: undefined},
                    boundary = this.pane.canvas.getBoundary(),
                    currentOffset = this.pane.canvas.getCurrentOffset();

                if (currentOffset.y < boundary.top) {
                    pos.top = -boundary.top;
                }
                if (currentOffset.y > boundary.bottom) {
                    pos.top = -boundary.bottom;
                }
                if (currentOffset.x < boundary.left) {
                    pos.left = -boundary.left;
                }
                if (currentOffset.x > boundary.right) {
                    pos.left = -boundary.right;
                }

                // If axis is set, then ignore the other axis.
                if (axis === 'x') { pos.top = undefined; }
                if (axis === 'y') { pos.left = undefined; }

                // If the canvas has been dragged outside the allowed boundaries, gracefully snap back with an animation.
                var animationOptions = $.extend({
                    duration: this.options.snapBackDuration
                }, this.options.snapBackAnimationOptions);

                // TODO.
                this.pane.canvas.$element.animate(pos, animationOptions);
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
                this._moveInterval;
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

                this._moveInterval = setInterval(this.performFrame.bind(this), this.options.frameDuration);
            };

            MouseMoveHandler.prototype.performFrame = function () {
                if (this.destination === null) { return; }

                var offset = this.pane.canvas.getCurrentOffset();
                var distance = {
                    x: this.destination.x - offset.x,
                    y: this.destination.y - offset.y
                };

                var moveBy = this.modifyMove(distance);

                this.pane.canvas.move(moveBy);
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
