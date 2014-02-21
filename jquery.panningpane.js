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
            outOfBoundarySlowdown: 0.5,
            snapBackDuration: 500,
            snapBackAnimationOptions: {},
            glideAcceleration: 0.9,
            outOfBoundaryGlideAcceleration: 0.5,
            padding: 200 
        }, options);

        $(this).each(function () {

            var that = $(this),
                frameDuration = 30,
                velocityInterval = 100,
                canvas = that.find('.panningpane-canvas'),
                boxes = that.find('.panebox'),
                currentOffset = {x: 0, y: 0},
                remainingVelocity = {x: 0, y: 0},
                allowGliding = true;

            /* Helpers */

            /*
             * Return the edges for the canvas, including some padding.
             */
            var getBoundary = function () {
                var padding = opts.padding;
                    boundary = {
                        top: Math.min(0, _.min(boxes.map(function () { return parseInt($(this).attr('top'));  }))),
                        left: Math.min(0, _.min(boxes.map(function () { return parseInt($(this).attr('left'));  }))),
                        bottom: Math.max(0, _.max(boxes.map(function () { return parseInt($(this).attr('top')) + $(this).outerHeight();  }))),
                        right: Math.max(0, _.max(boxes.map(function () { return parseInt($(this).attr('left')) + $(this).outerWidth();  })))
                    };

                boundary.top -= padding;
                boundary.right += padding;
                boundary.bottom += padding;
                boundary.left -= padding;

                boundary.right -= that.innerWidth();
                boundary.bottom -= that.innerHeight();

                return boundary;
            };

            /*
             * Returns true if the given point is out of the canvas' boundary.
             * If axis is given, only that axis will be taken into account for
             * the boundary calculation.
             */
            var isOutOfBoundary = function (offset, axis) {
                var includeX = axis != 'y',
                    includeY = axis != 'x',
                    boundary = getBoundary();
                if (includeX && (offset.x < boundary.left || offset.x > boundary.right)) {
                    return true;
                }
                if (includeY && (offset.y < boundary.top || offset.y > boundary.bottom)) {
                    return true;
                }
                return false;
            };

            /*
             * Get the current offset for the canvas element.
             */
            var getCurrentOffset = function () {
                return {
                    x: -parseInt(canvas.css('left')),
                    y: -parseInt(canvas.css('top'))
                };
            };

            /*
             * Move canvas by a given amount of pixels on the x and y axis.
             */
            var moveCanvas = function (offset) {
                var currentOffset = getCurrentOffset(),
                    boundary = getBoundary(),
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
                    verticalSpeed = opts.outOfBoundarySlowdown;
                }
                // The new position would be outside the horizontal boundary.
                if (newOffset.x < boundary.left || newOffset.x > boundary.right) {
                    horizontalSpeed = opts.outOfBoundarySlowdown;
                }

                currentOffset = {
                    x: currentOffset.x + offset.x * horizontalSpeed,
                    y: currentOffset.y + offset.y * verticalSpeed
                };

                canvas.css({
                    left: -currentOffset.x,
                    top: -currentOffset.y
                });
            };

            var init = function () {
                boxes.each(function () {
                    $(this).css({
                        position: 'absolute',
                        top: $(this).attr('top') + 'px',
                        left: $(this).attr('left') + 'px'
                    });
                });

                var boundary = getBoundary();
                canvas.css({
                    width: boundary.right,
                    height: boundary.bottom
                });

                moveCanvas({x: 0, y: 0});
            };

            /* Drag-handler */

            var calculateVelocity = function (props) {
                var now = Date.now(),
                    velocityInterval = 100;

                props.latestDeltas.push({
                    time: now,
                    x: props.deltaX,
                    y: props.deltaY
                });

                props.latestDeltas = _.filter(props.latestDeltas, function (d) {
                    return now - velocityInterval <= d.time;
                });

                props.velocity = {
                    x: (props.deltaX - props.latestDeltas[0].x) / 10,
                    y: (props.deltaY - props.latestDeltas[0].y) / 10
                };
            };

            /*
             * Glide the canvas back into view if it was dragged outside of
             * its boundaries.
             */
            var snapBack = function (axis) {
                var pos = {top: undefined, left: undefined},
                    boundary = getBoundary(),
                    currentOffset = getCurrentOffset();

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
                    duration: opts.snapBackDuration
                }, opts.snapBackAnimationOptions);
                canvas.animate(pos, animationOptions);
            };

            /*
             * Takes the drag-event props and an axis that it should handle.
             * Then determines if the there is still some velocity left and
             * use that to move the canvas further after the user released the
             * mouse button.
             */
            var handleRestVelocity = function (props, axis) {
                // Don'T handle velocity if some dragging is in progress.
                if (!allowGliding) {
                    return;
                }

                var outOfBoundary = isOutOfBoundary(getCurrentOffset(), axis),
                    acceleration = outOfBoundary ? opts.outOfBoundaryGlideAcceleration : opts.glideAcceleration,
                    velocity = props.velocity[axis] * acceleration,
                    distance = velocity * (velocityInterval / frameDuration),
                    lowThreshold = (frameDuration / velocityInterval);
                
                props.velocity[axis] = velocity;

                moveCanvas({
                    x: axis == 'x' ? -distance : 0,
                    y: axis == 'y' ? -distance : 0
                });

                if (Math.abs(velocity) > lowThreshold) {
                    _.delay(handleRestVelocity, frameDuration, props, axis);
                } else {
                    // Both axis has stopped, so we can snap the canvas back for both axis.
                    if (props.velocity.x < lowThreshold && props.velocity.y < lowThreshold) {
                        canvas.stop();
                        snapBack();
                    } else {
                        snapBack(axis);
                    }
                }
            };

            that
                .on('mousedown', function () {
                    // Disallow sliding, the mouse shall have the full control
                    // over the canvas. But we cannot do this in the drag
                    // event, since the dragging starts earliest after the
                    // mouse was moved for one pixel.
                    allowGliding = false;
                    canvas.stop();
                })
                .on('dragstart', function (event, props) {
                    props.previousDeltaX = 0;
                    props.previousDeltaY = 0;
                    props.lastEventTime = Date.now();
                    props.latestDeltas = [];
                })
                .on('drag', {distance: 1, click: false}, function (event, props) {
                    calculateVelocity(props);

                    var moveBy = {
                        x: props.previousDeltaX - props.deltaX,
                        y: props.previousDeltaY - props.deltaY
                    };

                    moveCanvas(moveBy);
                    props.previousDeltaX = props.deltaX;
                    props.previousDeltaY = props.deltaY;
                })
                .on('dragend', function (event, props) {
                    // Allow sliding again, we are not dragging any more.
                    allowGliding = true;

                    // Now handle the velocity that is still there and move
                    // the canvas further.
                    _.delay(handleRestVelocity, frameDuration, props, 'x');
                    _.delay(handleRestVelocity, frameDuration, props, 'y');
                });

            init();

        });

        return this;
    };
})(jQuery);
