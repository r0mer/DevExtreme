"use strict";

var $ = require("../../core/renderer"),
    devices = require("../../core/devices"),
    support = require("../../core/utils/support"),
    browser = require("../../core/utils/browser"),
    domUtils = require("../../core/utils/dom"),
    mathUtils = require("../../core/utils/math"),
    commonUtils = require("../../core/utils/common"),
    eventUtils = require("../utils"),
    Emitter = require("../core/emitter"),
    sign = mathUtils.sign,
    abs = Math.abs;

var SLEEP = 0,
    INITED = 1,
    STARTED = 2,

    TOUCH_BOUNDARY = 10,
    IMMEDIATE_TOUCH_BOUNDARY = 0,
    IMMEDIATE_TIMEOUT = 180;

var isMouseWheelEvent = function(e) {
    return e && e.type === "dxmousewheel";
};

var supportPointerEvents = function() {
    var cssSupport = support.styleProp("pointer-events");
    var msieLess11 = browser.msie && parseInt(browser.version, 10) < 11;

    return cssSupport && !msieLess11;
};

var gestureCover = (function() {
    var GESTURE_COVER_CLASS = "dx-gesture-cover";

    var isDesktop = devices.real().platform === "generic";

    if(!supportPointerEvents() || !isDesktop) {
        return commonUtils.noop;
    }

    var $cover = $("<div>")
        .addClass(GESTURE_COVER_CLASS)
        .css("pointerEvents", "none");

    $cover.on("dxmousewheel", function(e) {
        e.preventDefault();
    });

    domUtils.ready(function() {
        $cover.appendTo("body");
    });

    return function(toggle, cursor) {
        $cover.css("pointerEvents", toggle ? "all" : "none");
        toggle && $cover.css("cursor", cursor);
    };
})();


var GestureEmitter = Emitter.inherit({

    gesture: true,

    configure: function(data) {
        this.getElement().css("msTouchAction", data.immediate ? "pinch-zoom" : "");

        this.callBase(data);
    },

    allowInterruptionByMouseWheel: function() {
        return this._stage !== STARTED;
    },

    getDirection: function() {
        return this.direction;
    },

    _cancel: function() {
        this.callBase.apply(this, arguments);

        this._toggleGestureCover(false);
        this._stage = SLEEP;
    },

    start: function(e) {
        if(eventUtils.needSkipEvent(e)) {
            this._cancel(e);
            return;
        }

        this._startEvent = eventUtils.createEvent(e);
        this._startEventData = eventUtils.eventData(e);

        this._stage = INITED;
        this._init(e);

        this._setupImmediateTimer();
    },

    _setupImmediateTimer: function() {
        clearTimeout(this._immediateTimer);
        this._immediateAccepted = false;

        if(!this.immediate) {
            return;
        }

        this._immediateTimer = setTimeout((function() {
            this._immediateAccepted = true;
        }).bind(this), IMMEDIATE_TIMEOUT);
    },

    move: function(e) {
        if(this._stage === INITED && this._directionConfirmed(e)) {
            this._stage = STARTED;

            this._resetActiveElement();
            this._toggleGestureCover(true);
            this._clearSelection(e);

            this._adjustStartEvent(e);
            this._start(this._startEvent);

            if(this._stage === SLEEP) {
                return;
            }

            this._requestAccept(e);
            this._move(e);
            this._forgetAccept();
        } else if(this._stage === STARTED) {
            this._clearSelection(e);
            this._move(e);
        }
    },

    _directionConfirmed: function(e) {
        var touchBoundary = this._getTouchBoundary(e),
            delta = eventUtils.eventDelta(this._startEventData, eventUtils.eventData(e)),
            deltaX = abs(delta.x),
            deltaY = abs(delta.y);

        var horizontalMove = this._validateMove(touchBoundary, deltaX, deltaY),
            verticalMove = this._validateMove(touchBoundary, deltaY, deltaX);

        var direction = this.getDirection(e),
            bothAccepted = direction === "both" && (horizontalMove || verticalMove),
            horizontalAccepted = direction === "horizontal" && horizontalMove,
            verticalAccepted = direction === "vertical" && verticalMove;

        return bothAccepted || horizontalAccepted || verticalAccepted || this._immediateAccepted;
    },

    _validateMove: function(touchBoundary, mainAxis, crossAxis) {
        return mainAxis && mainAxis >= touchBoundary && (this.immediate ? mainAxis >= crossAxis : true);
    },

    _getTouchBoundary: function(e) {
        return (this.immediate || isMouseWheelEvent(e)) ? IMMEDIATE_TOUCH_BOUNDARY : TOUCH_BOUNDARY;
    },

    _adjustStartEvent: function(e) {
        var touchBoundary = this._getTouchBoundary(e),
            delta = eventUtils.eventDelta(this._startEventData, eventUtils.eventData(e));

        this._startEvent.pageX += sign(delta.x) * touchBoundary;
        this._startEvent.pageY += sign(delta.y) * touchBoundary;
    },

    _resetActiveElement: function() {
        if(devices.real().platform === "ios" && $(":focus", this.getElement()).length) {
            domUtils.resetActiveElement();
        }
    },

    _toggleGestureCover: function(toggle) {
        var isStarted = this._stage === STARTED;

        if(isStarted) {
            gestureCover(toggle, this.getElement().css("cursor"));
        }
    },

    _clearSelection: function(e) {
        if(isMouseWheelEvent(e) || eventUtils.isTouchEvent(e)) {
            return;
        }

        domUtils.clearSelection();
    },

    end: function(e) {
        this._toggleGestureCover(false);

        if(this._stage === STARTED) {
            this._end(e);
        } else if(this._stage === INITED) {
            this._stop(e);
        }

        this._stage = SLEEP;
    },

    dispose: function() {
        clearTimeout(this._immediateTimer);
        this.callBase.apply(this, arguments);
        this._toggleGestureCover(false);
    },

    _init: commonUtils.noop,
    _start: commonUtils.noop,
    _move: commonUtils.noop,
    _stop: commonUtils.noop,
    _end: commonUtils.noop

});
GestureEmitter.initialTouchBoundary = TOUCH_BOUNDARY;
GestureEmitter.touchBoundary = function(newBoundary) {
    if(commonUtils.isDefined(newBoundary)) {
        TOUCH_BOUNDARY = newBoundary;
        return;
    }

    return TOUCH_BOUNDARY;
};

module.exports = GestureEmitter;
