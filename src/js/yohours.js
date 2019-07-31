/* globals jQuery,window,moment,jSmart:false */
var YoHours = YoHours || {};
(function (window, $, moment, YoHours, jSmart, Jed) {
	'use strict';

	let i18n;

	jSmart.prototype.registerPlugin('modifier', 't', function (s, ctx) {
		let t = s;
		if (i18n instanceof Jed) {
			if (ctx === undefined) {
				ctx = 'yohours';
			}
			t = i18n.translate(s).withContext(ctx).fetch();
		}
		return t;
	});

	/**
	 * Converts the day code from a sunday-starting week into the day code of a monday-starting week
	 * @param {int|string} d The sunday-starting week day (as string)
	 * @return {int} The monday-starting week day
	 */
	function swDayToMwDay(d) {
		let day = parseInt(d);
		return (day === 0) ? 6 : day - 1;
	}

	/**
	 * Compares to array for equality
	 * @param {Array} array
	 * @return {boolean}
	 */
	window.Array.prototype.equals = function (array) {
		// if the other array is a falsy value, return
		if (!array) {
			return false;
		}

		// compare lengths - can save a lot of time
		if (this.length !== array.length) {
			return false;
		}

		let i = 0, l = this.length;
		for (; i < l; i++) {
			// Check if we have nested arrays
			if (this[i] instanceof Array && array[i] instanceof Array) {
				// recurse into the nested arrays
				if (!this[i].equals(array[i])) {
					return false;
				}
			} else if (this[i] !== array[i]) {
				// Warning - two different object instances will never be equal: {x:20} != {x:20}
				return false;
			}
		}
		return true;
	};

	/**
	 * Does the array contains the given object
	 * @param {*} obj The object to look for
	 * @return {boolean} True if obj in array
	 */
	window.Array.prototype.contains = function (obj) {
		let i = this.length;
		while (i--) {
			if (this[i] === obj) {
				return true;
			}
		}
		return false;
	};

	YoHours = $.extend(YoHours, {
		counter: 0,

		DAYS: {
			MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6
		},
		OSM_DAYS: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
		IRL_DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
		OSM_MONTHS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		IRL_MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		MONTH_END_DAY: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
		MINUTES_MAX: 1440,
		DAYS_MAX: 6,
		PH_WEEKDAY: -2,

		RGX_RULE_MODIFIER: /^(open|closed|off)$/i,
		RGX_WEEK_KEY: /^week$/,
		RGX_WEEK_VAL: /^([01234]?[0-9]|5[0123])(-([01234]?[0-9]|5[0123]))?(,([01234]?[0-9]|5[0123])(-([01234]?[0-9]|5[0123]))?)*:?$/,
		RGX_MONTH: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))?:?$/,
		RGX_MONTHDAY: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([012]?[0-9]|3[01])(-((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) )?([012]?[0-9]|3[01]))?:?$/,
		RGX_TIME: /^((([01]?[0-9]|2[01234]):[012345][0-9](-([01]?[0-9]|2[01234]):[012345][0-9])?(,([01]?[0-9]|2[01234]):[012345][0-9](-([01]?[0-9]|2[01234]):[012345][0-9])?)*)|(24\/7))$/,
		RGX_WEEKDAY: /^(((Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)|(PH|SH|easter))(,(((Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)|(PH|SH|easter)))*$/,
		RGX_HOLIDAY: /^(PH|SH|easter)$/,
		RGX_WD: /^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?$/
	});

	/**
	 * Class Interval, defines an interval in a week where the POI is open.
	 * @param {int} dayStart The start week day (use DAYS constants)
	 * @param {int|void} dayEnd The end week day (use DAYS constants)
	 * @param {int|void} minStart The interval start (in minutes since midnight)
	 * @param {int|void} minEnd The interval end (in minutes since midnight)
	 * @constructor
	 */
	YoHours.Interval = function (dayStart, dayEnd, minStart, minEnd) {
		/** The start day in the week, see DAYS **/
		this._dayStart = dayStart;

		/** The end day in the week, see DAYS **/
		this._dayEnd = dayEnd;

		/** The interval start, in minutes since midnight (local hour) **/
		this._start = minStart;

		/** The interval end, in minutes since midnight (local hour) **/
		this._end = minEnd;

		if (!this._dayEnd && !this._end) {
			this._dayEnd = YoHours.DAYS_MAX;
			this._end = YoHours.MINUTES_MAX;
		}
	};
	/**
	 * @return {int} The start day in the week, see DAYS constants
	 */
	YoHours.Interval.prototype.getStartDay = function () {
		return parseInt(this._dayStart);
	};
	/**
	 * @return {int} The end day in the week, see DAYS constants
	 */
	YoHours.Interval.prototype.getEndDay = function () {
		return parseInt(this._dayEnd);
	};
	/**
	 * @return {int} The interval start, in minutes since midnight
	 */
	YoHours.Interval.prototype.getFrom = function () {
		return parseInt(this._start);
	};
	/**
	 * @return {int} The interval end, in minutes since midnight
	 */
	YoHours.Interval.prototype.getTo = function () {
		return parseInt(this._end);
	};

	/**
	 * A wide interval is an interval of one or more days, weeks, months, holidays.
	 * Use WideInterval.days/weeks/months/holidays methods to construct one object.
	 * @constructor
	 */
	YoHours.WideInterval = function () {
		//ATTRIBUTES
		/** The start of the interval **/
		this._start = null;

		/** The end of the interval **/
		this._end = null;

		/** The kind of interval **/
		this._type = null;
	};
	/**
	 * @param {int} startDay
	 * @param {int} startMonth,
	 * @param {int|void} endDay
	 * @param {int|void} endMonth
	 * @return {YoHours.WideInterval} a day-based interval
	 */
	YoHours.WideInterval.prototype.day = function (startDay, startMonth, endDay, endMonth) {
		if (startDay === undefined || startMonth === undefined) {
			throw Error(i18n.translate('Start day and month can\'t be null').withContext('yohours/notifications').fetch());
		}
		this._start = {day: startDay, month: startMonth};
		this._end = (endDay && endMonth && (endDay !== startDay || endMonth !== startMonth)) ? {
			day: endDay, month: endMonth
		} : null;
		this._type = 'day';
		return this;
	};
	/**
	 * @param {int} startWeek
	 * @param {int|void} endWeek
	 * @return {YoHours.WideInterval} a week-based interval
	 */
	YoHours.WideInterval.prototype.week = function (startWeek, endWeek) {
		if (startWeek === undefined) {
			throw Error(i18n.translate('Start week can\'t be null').withContext('yohours/notifications').fetch());
		}
		this._start = {week: startWeek};
		this._end = (endWeek && endWeek !== startWeek) ? {week: endWeek} : null;
		this._type = 'week';
		return this;
	};
	/**
	 * @param {int} startMonth
	 * @param {int|void} endMonth
	 * @return {YoHours.WideInterval} a month-based interval
	 */
	YoHours.WideInterval.prototype.month = function (startMonth, endMonth) {
		if (startMonth === undefined) {
			throw Error(i18n.translate('Start month can\'t be null').withContext('yohours/notifications').fetch());
		}
		this._start = {month: startMonth};
		this._end = (endMonth && endMonth !== startMonth) ? {month: endMonth} : null;
		this._type = 'month';
		return this;
	};
	/**
	 * @param {string} holiday
	 * @return {YoHours.WideInterval} a holiday-based interval
	 */
	YoHours.WideInterval.prototype.holiday = function (holiday) {
		if (holiday === undefined || (holiday !== 'PH' && holiday !== 'SH' && holiday !== 'easter')) {
			throw Error(i18n.translate('Invalid holiday, must be PH, SH or easter').withContext('yohours/notifications').fetch());
		}
		this._start = {holiday: holiday};
		this._end = null;
		this._type = 'holiday';
		return this;
	};
	/**
	 * @return {YoHours.WideInterval} a holiday-based interval
	 */
	YoHours.WideInterval.prototype.always = function () {
		this._start = null;
		this._end = null;
		this._type = 'always';
		return this;
	};
	/**
	 * @return {string|null} The kind of wide interval (always, day, month, week, holiday)
	 */
	YoHours.WideInterval.prototype.getType = function () {
		return this._type;
	};
	/**
	 * @return {Object} The start moment
	 */
	YoHours.WideInterval.prototype.getStart = function () {
		return this._start;
	};
	/**
	 * @return {Object} end moment
	 */
	YoHours.WideInterval.prototype.getEnd = function () {
		return this._end;
	};
	/**
	 * @return {boolean} if the given object concerns the same interval as this one
	 */
	YoHours.WideInterval.prototype.equals = function (o) {
		if (!(o instanceof YoHours.WideInterval)) {
			return false;
		}
		if (this === o) {
			return true;
		}
		if (o._type === 'always') {
			return this._type === 'always';
		}
		let result = false;

		switch (this._type) {
			case 'always':
				result = o._start === null;
				break;
			case 'day':
				result = (o._type === 'day' && o._start.month === this._start.month && o._start.day === this._start.day && ((o._end === null && this._end === null) || (o._end !== null && this._end !== null && this._end.month === o._end.month && this._end.day === o._end.day))) || (o._type === 'month' && o._start.month === this._start.month && (this.isFullMonth() && o.isFullMonth()) || (o._end !== null && this._end !== null && this._end.month === o._end.month && this.endsMonth() && o.endsMonth()));
				break;

			case 'week':
				result = o._start.week === this._start.week && (o._end === this._end || (this._end !== null && o._end !== null && o._end.week === this._end.week));
				break;

			case 'month':
				result = (o._type === 'day' && this._start.month === o._start.month && o.startsMonth() && ((this._end === null && o._end !== null && this._start.month === o._end.month && o.endsMonth()) || (this._end !== null && o._end !== null && this._end.month === o._end.month && o.endsMonth()))) || (o._type === 'month' && o._start.month === this._start.month && ((this._end === null && o._end === null) || (this._end !== null && o._end !== null && this._end.month === o._end.month)));
				break;

			case 'holiday':
				result = o._start.holiday === this._start.holiday;
				break;
			default:
		}

		return result;
	};
	/**
	 * @return {string} The human readable time
	 */
	YoHours.WideInterval.prototype.getTimeForHumans = function () {
		let result;

		switch (this._type) {
			case 'day':
				if (this._end != null) {

					result = i18n.translate('every week from %s %u to %s %u')
						.withContext('yohours/timespan')
						.fetch(i18n.translate(YoHours.IRL_MONTHS[this._start.month - 1]).withContext('yohours').fetch(), this._start.day, (this._start.month !== this._end.month) ? i18n.translate(YoHours.IRL_MONTHS[this._end.month - 1]).withContext('yohours').fetch() : '', this._end.day);
				} else {
					result = i18n.translate('day %s %u').withContext('yohours/timespan')
						.fetch(i18n.translate(YoHours.IRL_MONTHS[this._start.month - 1]).withContext('yohours').fetch(), this._start.day);
				}
				break;

			case 'week':
				if (this._end != null) {
					result = i18n.translate('every week from week %u to %u').withContext('yohours/timespan').fetch(this._start.week, this._end.week);
				} else {
					result = i18n.translate('week %u').withContext('yohours/timespan').fetch(this._start.week);
				}
				break;

			case 'month':
				if (this._end != null) {
					result = i18n.translate('every week from %s to %s').withContext('yohours/timespan')
						.fetch(i18n.translate(YoHours.IRL_MONTHS[this._start.month - 1]).withContext('yohours').fetch(), i18n.translate(YoHours.IRL_MONTHS[this._end.month - 1]).withContext('yohours').fetch());
				} else {
					result = 'every week in ' + YoHours.IRL_MONTHS[this._start.month - 1];
					result = i18n.translate('every week in %s').withContext('yohours/timespan').fetch(i18n.translate(YoHours.IRL_MONTHS[this._start.month - 1]).withContext('yohours').fetch());
				}
				break;

			case 'holiday':
				if (this._start.holiday === 'SH') {
					result = i18n.translate('every week during school holidays').withContext('yohours/timespan').fetch();
				} else if (this._start.holiday === 'PH') {
					result = i18n.translate('every public holidays').withContext('yohours/timespan').fetch();
				} else if (this._start.holiday === 'easter') {
					result = i18n.translate('each easter day').withContext('yohours/timespan').fetch();
				} else {
					throw new Error(i18n.translate('Invalid holiday type: %s').withContext('yohours/notifications').fetch(this._start.holiday));
				}
				break;

			case 'always':
				result = i18n.translate('every week of year').withContext('yohours/timespan').fetch();
				break;
			default:
				result = i18n.translate('invalid time').withContext('yohours/timespan').fetch();
		}

		return result;
	};
	/**
	 * @return {string} The time selector for OSM opening_hours
	 */
	YoHours.WideInterval.prototype.getTimeSelector = function () {
		let result;

		switch (this._type) {
			case 'day':
				result = YoHours.OSM_MONTHS[this._start.month - 1] + ' ' + ((this._start.day < 10) ? '0' : '') + this._start.day;
				if (this._end != null) {
					//Same month as start ?
					if (this._start.month === this._end.month) {
						result += '-' + ((this._end.day < 10) ? '0' : '') + this._end.day;
					} else {
						result += '-' + YoHours.OSM_MONTHS[this._end.month - 1] + ' ' + ((this._end.day < 10) ? '0' : '') + this._end.day;
					}
				}
				break;

			case 'week':
				result = 'week ' + ((this._start.week < 10) ? '0' : '') + this._start.week;
				if (this._end != null) {
					result += '-' + ((this._end.week < 10) ? '0' : '') + this._end.week;
				}
				break;

			case 'month':
				result = YoHours.OSM_MONTHS[this._start.month - 1];
				if (this._end != null) {
					result += '-' + YoHours.OSM_MONTHS[this._end.month - 1];
				}
				break;

			case 'holiday':
				result = this._start.holiday;
				break;

			case 'always':
			default:
				result = '';
		}

		return result;
	};
	/**
	 * Does this interval corresponds to a full month ?
	 * @return {boolean}
	 */
	YoHours.WideInterval.prototype.isFullMonth = function () {
		if (this._type === 'month' && this._end === null) {
			return true;
		} else if (this._type === 'day') {
			return (this._start.day === 1 && this._end !== null && this._end.month === this._start.month && this._end.day !== undefined && this._end.day === YoHours.MONTH_END_DAY[this._end.month - 1]);
		} else {
			return false;
		}
	};
	/**
	 * Does this interval starts the first day of a month
	 * @return {boolean}
	 */
	YoHours.WideInterval.prototype.startsMonth = function () {
		return this._type === 'month' || this._type === 'always' || (this._type === 'day' && this._start.day === 1);
	};
	/**
	 * Does this interval ends the last day of a month
	 * @return {boolean}
	 */
	YoHours.WideInterval.prototype.endsMonth = function () {
		return this._type === 'month' || this._type === 'always' || (this._type === 'day' && this._end !== null && this._end.day === YoHours.MONTH_END_DAY[this._end.month - 1]);
	};
	/**
	 * Does this interval strictly contains the given one (ie the second is a refinement of the first, and not strictly equal)
	 * @param {Object} o The other wide interval
	 * @return {boolean} True if this date contains the given one (and is not strictly equal to)
	 */
	YoHours.WideInterval.prototype.contains = function (o) {
		let result = false;

		/*
		 * Check if it is contained in this one
		 */
		if (this.equals(o)) {
			result = false;
		} else if (this._type === 'always') {
			result = true;
		} else if (this._type === 'day') {
			if (o._type === 'day') {
				//Starting after
				if (o._start.month > this._start.month || (o._start.month === this._start.month && o._start.day >= this._start.day)) {
					//Ending before
					if (o._end != null) {
						if (this._end != null && (o._end.month < this._end.month || (o._end.month === this._end.month && o._end.day <= this._end.day))) {
							result = true;
						}
					} else {
						if (this._end != null && (o._start.month < this._end.month || (o._start.month === this._end.month && o._start.day <= this._end.day))) {
							result = true;
						}
					}
				}
			} else if (o._type === 'month') {
				//Starting after
				if (o._start.month > this._start.month || (o._start.month === this._start.month && this._start.day === 1)) {
					//Ending before
					if (o._end != null && this._end != null && (o._end.month < this._end.month || (o._end.month === this._end.month && this._end.day === YoHours.MONTH_END_DAY[end.month - 1]))) {
						result = true;
					} else if (o._end === null && (this._end != null && o._start.month < this._end.month)) {
						result = true;
					}
				}
			}
		} else if (this._type === 'week') {
			if (o._type === 'week') {
				if (o._start.week >= this._start.week) {
					if (o._end != null && this._end != null && o._end.week <= this._end.week) {
						result = true;
					} else if (o._end == null && ((this._end != null && o._start.week <= this._end.week) || o._start.week === this._start.week)) {
						result = true;
					}
				}
			}
		} else if (this._type === 'month') {
			if (o._type === 'month') {
				if (o._start.month >= this._start.month) {
					if (o._end != null && this._end != null && o._end.month <= this._end.month) {
						result = true;
					} else if (o._end == null && ((this._end != null && o._start.month <= this._end.month) || o._start.month === this._start.month)) {
						result = true;
					}
				}
			} else if (o._type === 'day') {
				if (o._end != null) {
					if (this._end == null) {
						if (o._start.month === this._start.month && o._end.month === this._start.month && ((o._start.day >= 1 && o._end.day < YoHours.MONTH_END_DAY[o._start.month - 1]) || (o._start.day > 1 && o._end.day <= YoHours.MONTH_END_DAY[o._start.month - 1]))) {
							result = true;
						}
					} else {
						if (o._start.month >= this._start.month && o._end.month <= this._end.month) {
							if ((o._start.month > this._start.month && o._end.month < this._end.month) || (o._start.month === this._start.month && o._end.month < this._end.month && o._start.day > 1) || (o._start.month > this._start.month && o._end.month === this._end.month && o._end.day < YoHours.MONTH_END_DAY[o._end.month - 1]) || (o._start.day >= 1 && o._end.day < YoHours.MONTH_END_DAY[o._end.month - 1]) || (o._start.day > 1 && o._end.day <= YoHours.MONTH_END_DAY[o._end.month - 1])) {
								result = true;
							}
						}
					}
				} else {
					if (this._end == null) {
						if (this._start.month === o._start.month) {
							result = true;
						}
					} else {
						if (o._start.month >= this._start.month && o._start.month <= this._end.month) {
							result = true;
						}
					}
				}
			}
		}

		return result;
	};

	/**
	 * Class Day, represents a typical day
	 * @constructor
	 */
	YoHours.Day = function () {
		/** The intervals defining this week **/
		this._intervals = [];

		/** The next interval ID **/
		this._nextInterval = 0;
	};
	/**
	 * @return {Array} This day, as a boolean array (minutes since midnight). True if open, false else.
	 */
	YoHours.Day.prototype.getAsMinutesArray = function () {
		//Create array with all values set to false
		let minute;
		//For each minute
		let minuteArray = [];
		for (minute = 0; minute <= YoHours.MINUTES_MAX; minute++) {
			minuteArray[minute] = false;
		}

		//Set to true values where an interval is defined
		let id = 0, l = this._intervals.length;
		for (; id < l; id++) {
			if (this._intervals[id] !== undefined) {
				let startMinute = null;
				let endMinute = null;

				if (this._intervals[id].getStartDay() === this._intervals[id].getEndDay() || (this._intervals[id].getEndDay() === YoHours.DAYS_MAX && this._intervals[id].getTo() === YoHours.MINUTES_MAX)) {
					//Define start and end minute regarding the current day
					startMinute = this._intervals[id].getFrom();
					endMinute = this._intervals[id].getTo();
				}

				//Set to true the minutes for this day
				if (startMinute !== null && endMinute !== null) {
					for (minute = startMinute; minute <= endMinute; minute++) {
						minuteArray[minute] = true;
					}
				} else {
					console.log(this._intervals[id].getFrom() + ' ' + this._intervals[id].getTo() + ' ' + this._intervals[id].getStartDay() + ' ' + this._intervals[id].getEndDay());
					throw new Error(i18n.translate('Invalid interval').withContext('yohours/notifications').fetch());
				}
			}
		}

		return minuteArray;
	};
	/**
	 * @param {boolean|void} clean Clean intervals ? (default: false)
	 * @return {Array} The intervals in this week
	 */
	YoHours.Day.prototype.getIntervals = function (clean) {
		clean = clean || false;

		if (clean) {
			//Create continuous intervals over days
			let minuteArray = this.getAsMinutesArray();
			let intervals = [];
			let minStart = -1;

			let min = 0, lm = minuteArray.length;
			for (; min < lm; min++) {
				//First minute
				if (min === 0) {
					if (minuteArray[min]) {
						minStart = min;
					}
				}
				//Last minute
				else if (min === lm - 1) {
					if (minuteArray[min]) {
						intervals.push(new YoHours.Interval(0, 0, minStart, min));
					}
				}
				//Other minutes
				else {
					//New interval
					if (minuteArray[min] && minStart < 0) {
						minStart = min;
					} else if (!minuteArray[min] && minStart >= 0) {
						intervals.push(new YoHours.Interval(0, 0, minStart, min - 1));

						minStart = -1;
					}
				}
			}

			return intervals;
		} else {
			return this._intervals;
		}
	};
	/**
	 * Add a new interval to this week
	 * @param interval The new interval
	 * @return {int} The ID of the added interval
	 */
	YoHours.Day.prototype.addInterval = function (interval) {
		this._intervals[this._nextInterval] = interval;
		this._nextInterval++;

		return this._nextInterval - 1;
	};
	/**
	 * Edits the given interval
	 * @param {int} id The interval ID
	 * @param interval The new interval
	 */
	YoHours.Day.prototype.editInterval = function (id, interval) {
		this._intervals[id] = interval;
	};
	/**
	 * Remove the given interval
	 * @param {int} id the interval ID
	 */
	YoHours.Day.prototype.removeInterval = function (id) {
		this._intervals[id] = undefined;
		delete this._intervals[id];
	};
	/**
	 * Redefines this date range intervals with a copy of the given ones
	 * @param {YoHours.Interval[]} intervals
	 */
	YoHours.Day.prototype.copyIntervals = function (intervals) {
		this._intervals = [];
		for (let i = 0; i < intervals.length; i++) {
			if (intervals[i] !== undefined && intervals[i].getStartDay() === 0 && intervals[i].getEndDay() === 0) {
				this._intervals.push($.extend(true, {}, intervals[i]));
			}
		}

		this._intervals = this.getIntervals(true);
	};
	/**
	 * Removes all defined intervals
	 */
	YoHours.Day.prototype.clearIntervals = function () {
		this._intervals = [];
	};
	/**
	 * Is this day defining the same intervals as the given one ?
	 * @param {YoHours.Day} d
	 */
	YoHours.Day.prototype.sameAs = function (d) {
		return d.getAsMinutesArray().equals(this.getAsMinutesArray());
	};

	/**
	 * Class Week, represents a typical week of opening hours.
	 * @constructor
	 */
	YoHours.Week = function () {
		/** The intervals defining this week **/
		this._intervals = [];
	};
	/**
	 * @return {Array} This week, as a two-dimensional boolean array. First dimension is for days (see DAYS), second dimension for minutes since midnight. True if open, false else.
	 */
	YoHours.Week.prototype.getAsMinutesArray = function () {
		let minute;
		let day;
		let minuteArray = [];
		for (day = 0; day <= YoHours.DAYS_MAX; day++) {
			//For each minute
			minuteArray[day] = [];
			for (minute = 0; minute <= YoHours.MINUTES_MAX; minute++) {
				minuteArray[day][minute] = false;
			}
		}

		//Set to true values where an interval is defined
		let id = 0, l = this._intervals.length;
		for (; id < l; id++) {
			if (this._intervals[id] !== undefined) {
				for (day = this._intervals[id].getStartDay(); day <= this._intervals[id].getEndDay(); day++) {
					//Define start and end minute regarding the current day
					let startMinute = (day === this._intervals[id].getStartDay()) ? this._intervals[id].getFrom() : 0;
					let endMinute = (day === this._intervals[id].getEndDay()) ? this._intervals[id].getTo() : YoHours.MINUTES_MAX;

					//Set to true the minutes for this day
					if (startMinute != null && endMinute != null) {
						for (minute = startMinute; minute <= endMinute; minute++) {
							minuteArray[day][minute] = true;
						}
					}
				}
			}
		}

		return minuteArray;
	};
	/**
	 * @param {boolean|void} clean Clean intervals ? (default: false)
	 * @return {Array} The intervals in this week
	 */
	YoHours.Week.prototype.getIntervals = function (clean) {
		clean = clean || false;

		if (clean) {
			//Create continuous intervals over days
			let minuteArray = this.getAsMinutesArray();
			let intervals = [];
			let dayStart = -1, minStart = -1;

			let day = 0, l = minuteArray.length;
			for (; day < l; day++) {
				let min = 0, lm = minuteArray[day].length;
				for (; min < lm; min++) {
					//First minute of monday
					if (day === 0 && min === 0) {
						if (minuteArray[day][min]) {
							dayStart = day;
							minStart = min;
						}
					} else if (day === YoHours.DAYS_MAX && min === lm - 1) {
						if (dayStart >= 0 && minuteArray[day][min]) {
							intervals.push(new YoHours.Interval(dayStart, day, minStart, min));
						}
					} else {
						//New interval
						if (minuteArray[day][min] && dayStart < 0) {
							dayStart = day;
							minStart = min;
						} else if (!minuteArray[day][min] && dayStart >= 0) {
							if (min === 0) {
								intervals.push(new YoHours.Interval(dayStart, day - 1, minStart, YoHours.MINUTES_MAX));
							} else {
								intervals.push(new YoHours.Interval(dayStart, day, minStart, min - 1));
							}
							dayStart = -1;
							minStart = -1;
						}
					}
				}
			}

			return intervals;
		} else {
			return this._intervals;
		}
	};
	/**
	 * Returns the intervals which are different from those defined in the given week
	 * @param {YoHours.Week} w The general week
	 * @return {Object} The intervals which are different, as object { open: [ Intervals ], closed: [ Intervals ] }
	 */
	YoHours.Week.prototype.getIntervalsDiff = function (w) {
		//Get minutes arrays
		let myMinArray = this.getAsMinutesArray();
		let wMinArray = w.getAsMinutesArray();

		//Create diff array
		let intervals = {open: [], closed: []};
		let dayStart = -1, minStart = -1;
		let diffDay, m, intervalsLength;

		for (let d = 0; d <= YoHours.DAYS_MAX; d++) {
			diffDay = false;
			m = 0;
			intervalsLength = intervals.open.length;

			while (m <= YoHours.MINUTES_MAX) {
				//Copy entire day
				if (diffDay) {
					//First minute of monday
					if (d === 0 && m === 0) {
						if (myMinArray[d][m]) {
							dayStart = d;
							minStart = m;
						}
					} else if (d === YoHours.DAYS_MAX && m === YoHours.MINUTES_MAX) {
						if (dayStart >= 0 && myMinArray[d][m]) {
							intervals.open.push(new YoHours.Interval(dayStart, d, minStart, m));
						}
					} else {
						//New interval
						if (myMinArray[d][m] && dayStart < 0) {
							dayStart = d;
							minStart = m;
						} else if (!myMinArray[d][m] && dayStart >= 0) {
							if (m === 0) {
								intervals.open.push(new YoHours.Interval(dayStart, d - 1, minStart, YoHours.MINUTES_MAX));
							} else {
								intervals.open.push(new YoHours.Interval(dayStart, d, minStart, m - 1));
							}
							dayStart = -1;
							minStart = -1;
						}
					}
					m++;
				} else {
					diffDay = myMinArray[d][m] ? !wMinArray[d][m] : wMinArray[d][m];

					//If there is a difference, start to copy full day
					if (diffDay) {
						m = 0;
					}
					//Else, continue checking
					else {
						m++;
					}
				}
			}

			//Close intervals if day is identical
			if (!diffDay && dayStart > -1) {
				intervals.open.push(new YoHours.Interval(dayStart, d - 1, minStart, YoHours.MINUTES_MAX));
				dayStart = -1;
				minStart = -1;
			}

			//Create closed intervals if closed all day
			if (diffDay && dayStart === -1 && intervalsLength === intervals.open.length) {
				//Merge with previous interval if possible
				if (intervals.closed.length > 0 && intervals.closed[intervals.closed.length - 1].getEndDay() === d - 1) {
					intervals.closed[intervals.closed.length - 1] = new YoHours.Interval(intervals.closed[intervals.closed.length - 1].getStartDay(), d, 0, YoHours.MINUTES_MAX);
				} else {
					intervals.closed.push(new YoHours.Interval(d, d, 0, YoHours.MINUTES_MAX));
				}
			}
		}

		return intervals;
	};
	/**
	 * Add a new interval to this week
	 * @param {YoHours.Interval} interval The new interval
	 * @return {int} The ID of the added interval
	 */
	YoHours.Week.prototype.addInterval = function (interval) {
		this._intervals[this._intervals.length] = interval;
		return this._intervals.length - 1;
	};
	/**
	 * Edits the given interval
	 * @param {string|int} id The interval ID
	 * @param {YoHours.Interval} interval The new interval
	 */
	YoHours.Week.prototype.editInterval = function (id, interval) {
		this._intervals[id] = interval;
	};
	/**
	 * Remove the given interval
	 * @param {string|int} id the interval ID
	 */
	YoHours.Week.prototype.removeInterval = function (id) {
		this._intervals[id] = undefined;
		delete this._intervals[id];
	};
	/**
	 * Removes all intervals during a given day
	 */
	YoHours.Week.prototype.removeIntervalsDuringDay = function (day) {
		let interval, itLength = this._intervals.length, dayDiff;
		for (let i = 0; i < itLength; i++) {
			interval = this._intervals[i];
			if (interval !== undefined) {
				//If interval over given day
				if (interval.getStartDay() <= day && interval.getEndDay() >= day) {
					dayDiff = interval.getEndDay() - interval.getStartDay();

					//Avoid deletion if over night interval
					if (dayDiff > 1 || dayDiff === 0 || interval.getStartDay() === day || interval.getFrom() <= interval.getTo()) {
						//Create new interval if several day
						if (interval.getEndDay() - interval.getStartDay() >= 1 && interval.getFrom() <= interval.getTo()) {
							if (interval.getStartDay() < day) {
								this.addInterval(new YoHours.Interval(interval.getStartDay(), day - 1, interval.getFrom(), 24 * 60));
							}
							if (interval.getEndDay() > day) {
								this.addInterval(new YoHours.Interval(day + 1, interval.getEndDay(), 0, interval.getTo()));
							}
						}

						//Delete
						this.removeInterval(i);
					}
				}
			}
		}
	};
	/**
	 * Redefines this date range intervals with a copy of the given ones
	 * @param {YoHours.Interval[]} intervals
	 */
	YoHours.Week.prototype.copyIntervals = function (intervals) {
		this._intervals = [];
		for (let i = 0; i < intervals.length; i++) {
			if (intervals[i] !== undefined) {
				this._intervals.push($.extend(true, {}, intervals[i]));
			}
		}
	};
	/**
	 * Is this week defining the same intervals as the given one ?
	 * @param {YoHours.Week} w
	 * @return {boolean}
	 */
	YoHours.Week.prototype.sameAs = function (w) {
		return w.getAsMinutesArray().equals(this.getAsMinutesArray());
	};

	/**
	 * Class DateRange, defines a range of months, weeks or days.
	 * A typical week or day will be associated.
	 * @param {YoHours.WideInterval} w
	 * @constructor
	 */
	YoHours.DateRange = function (w) {
		/** The wide interval of this date range **/
		this._wideInterval = null;

		/** The typical week or day associated **/
		this._typical = undefined;

		this.updateRange(w);
	};
	/**
	 * Is this interval defining a typical day ?
	 * @return {boolean}
	 */
	YoHours.DateRange.prototype.definesTypicalDay = function () {
		return this._typical instanceof YoHours.Day;
	};
	/**
	 * Is this interval defining a typical week ?
	 * @return {boolean}
	 */
	YoHours.DateRange.prototype.definesTypicalWeek = function () {
		return this._typical instanceof YoHours.Week;
	};
	/**
	 * @return {YoHours.Day|YoHours.Week|null} The typical day or week
	 */
	YoHours.DateRange.prototype.getTypical = function () {
		return this._typical;
	};
	/**
	 * @return {YoHours.WideInterval} The wide interval this date range concerns
	 */
	YoHours.DateRange.prototype.getInterval = function () {
		return this._wideInterval;
	};
	/**
	 * Changes the date range
	 */
	YoHours.DateRange.prototype.updateRange = function (wide) {
		this._wideInterval = (wide != null) ? wide : new YoHours.WideInterval().always();

		//Create typical week/day
		if (this._typical === undefined) {
			switch (this._wideInterval.getType()) {
				case 'day':
					if (this._wideInterval.getEnd() === null) {
						this._typical = new YoHours.Day();
					} else {
						this._typical = new YoHours.Week();
					}
					break;
				case 'week':
					this._typical = new YoHours.Week();
					break;
				case 'month':
					this._typical = new YoHours.Week();
					break;
				case 'holiday':
					if (this._wideInterval.getStart().holiday === 'SH') {
						this._typical = new YoHours.Week();
					} else {
						this._typical = new YoHours.Day();
					}
					break;
				case 'always':
					this._typical = new YoHours.Week();
					break;
				default:
					throw Error('Invalid interval type: ' + this._wideInterval.getType());
			}
		}
	};
	/**
	 * Check if the typical day/week of this date range is the same as in the given date range
	 * @param {YoHours.DateRange} dr The other DateRange
	 * @return {boolean} if same typical day/week
	 */
	YoHours.DateRange.prototype.hasSameTypical = function (dr) {
		return this.definesTypicalDay() === dr.definesTypicalDay() && this._typical.sameAs(dr.getTypical());
	};
	/**
	 * Does this date range contains the given date range (ie the second is a refinement of the first)
	 * @param {YoHours.DateRange} dr The other DateRange
	 * @return {boolean} if this date contains the given one (and is not strictly equal to)
	 */
	YoHours.DateRange.prototype.isGeneralFor = function (dr) {
		return dr.definesTypicalDay() === this.definesTypicalDay() && this._wideInterval.contains(dr.getInterval());
	};

	/**
	 * An opening_hours time, such as "08:00" or "08:00-10:00" or "off" (if no start and end)
	 * @param {int|void|string} start The start minute (from midnight), can be null
	 * @param {int|void|string} end The end minute (from midnight), can be null
	 * @constructor
	 */
	YoHours.OhTime = function (start, end) {
		/** The start minute **/
		this._start = (start >= 0) ? start : null;

		/** The end minute **/
		this._end = (end >= 0 && end !== start) ? end : null;
	};
	/**
	 * @return {string} The time in opening_hours format
	 */
	YoHours.OhTime.prototype.get = function () {
		if (this._start === null && this._end === null) {
			return 'off';
		} else {
			return this._timeString(this._start) + ((this._end == null) ? '' : '-' + this._timeString(this._end));
		}
	};
	/**
	 * @return {string|null} The start minutes
	 */
	YoHours.OhTime.prototype.getStart = function () {
		return this._start === null ? null : this._start.toString();
	};
	/**
	 * @return {string|null} The end minutes
	 */
	YoHours.OhTime.prototype.getEnd = function () {
		return this._end === null ? null : this._end.toString();
	};
	/**
	 * @param {YoHours.OhTime} t
	 * @return {boolean} True if same time
	 */
	YoHours.OhTime.prototype.equals = function (t) {
		return this.getStart() === t.getStart() && this.getEnd() === t.getEnd();
	};
	/**
	 * @return {string} The hour in HH:MM format
	 */
	YoHours.OhTime.prototype._timeString = function (minutes) {
		let h = Math.floor(minutes / 60);
		let period = '';
		let m = minutes % 60;
		return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + period;
	};

	/**
	 * An opening_hours date, such as "Apr 21", "week 1-15 Mo,Tu", "Apr-Dec Mo-Fr", "SH Su", ...
	 * @param {string} w The wide selector, as string
	 * @param {string} wt The wide selector type (month, week, day, holiday, always)
	 * @param {int[]} wd The weekdays, as integer array (0 to 6 = Monday to Sunday, -1 = single day date, -2 = PH)
	 * @constructor
	 */
	YoHours.OhDate = function (w, wt, wd) {
		/** Kind of wide date (month, week, day, holiday, always) **/
		this._wideType = wt;

		/** Wide date **/
		this._wide = w;

		/** Weekdays + PH **/
		this._weekdays = wd.sort();

		/** Overwritten days (to allow create simpler rules) **/
		this._wdOver = [];

		if (w === null || wt === null || wd === null) {
			throw Error(i18n.translate('Missing parameter').withContext('yohours/notifications').fetch());
		}
	};
	/**
	 * @return {string} The wide type
	 */
	YoHours.OhDate.prototype.getWideType = function () {
		return this._wideType.toString();
	};
	/**
	 * @return {string} The month day, month, week, SH (depends of type)
	 */
	YoHours.OhDate.prototype.getWideValue = function () {
		return this._wide.toString();
	};
	/**
	 * @return {int[]} The weekdays array
	 */
	YoHours.OhDate.prototype.getWd = function () {
		return this._weekdays;
	};
	/**
	 * @return {int[]} The overwritten weekdays array
	 */
	YoHours.OhDate.prototype.getWdOver = function () {
		return this._wdOver;
	};
	/**
	 * @param {Array} a The other weekdays array
	 * @return {boolean} True if same weekdays as other object
	 */
	YoHours.OhDate.prototype.sameWd = function (a) {
		return a.equals(this._weekdays);
	};
	/**
	 * @return {string} The weekdays in opening_hours syntax
	 */
	YoHours.OhDate.prototype.getWeekdays = function () {
		let i;
		let result = '';
		let wd = this._weekdays.concat(this._wdOver).sort();

		//PH as weekday
		if (wd.length > 0 && parseInt(wd[0]) === YoHours.PH_WEEKDAY) {
			result = 'PH';
			wd.shift();
		}

		//Check if we should create a continuous interval for week-end
		if (wd.length > 0 && wd.contains(6) && wd.contains(0) && (wd.contains(5) || wd.contains(1))) {
			//Find when the week-end starts
			let startWE = 6;
			i = wd.length - 2;
			let stopLooking = false;
			while (!stopLooking && i >= 0) {
				if (wd[i] === wd[i + 1] - 1) {
					startWE = wd[i];
					i--;
				} else {
					stopLooking = true;
				}
			}

			//Find when it stops
			i = 1;
			stopLooking = false;
			let endWE = 0;

			while (!stopLooking && i < wd.length) {
				if (wd[i - 1] === wd[i] - 1) {
					endWE = wd[i];
					i++;
				} else {
					stopLooking = true;
				}
			}

			//If long enough, add it as first weekday interval
			let length = 7 - startWE + endWE + 1;

			if (length >= 3 && startWE > endWE) {
				if (result.length > 0) {
					result += ',';
				}
				result += YoHours.OSM_DAYS[startWE] + '-' + YoHours.OSM_DAYS[endWE];

				//Remove processed days
				let j = 0;
				while (j < wd.length) {
					if (wd[j] <= endWE || wd[j] >= startWE) {
						wd.splice(j, 1);
					} else {
						j++;
					}
				}
			}
		}

		//Process only if not empty weekday list
		if (wd.length > 1 || (wd.length === 1 && wd[0] !== -1)) {
			result += (result.length > 0) ? ',' + YoHours.OSM_DAYS[wd[0]] : YoHours.OSM_DAYS[wd[0]];
			let firstInRow = wd[0];

			for (i = 1; i < wd.length; i++) {
				//When days aren't following
				if (wd[i - 1] !== wd[i] - 1) {
					//Previous day range length > 1
					if (firstInRow !== wd[i - 1]) {
						//Two days
						if (wd[i - 1] - firstInRow === 1) {
							result += ',' + YoHours.OSM_DAYS[wd[i - 1]];
						} else {
							result += '-' + YoHours.OSM_DAYS[wd[i - 1]];
						}
					}

					//Add the current day
					result += ',' + YoHours.OSM_DAYS[wd[i]];
					firstInRow = wd[i];
				} else if (i === wd.length - 1) {
					if (wd[i] - firstInRow === 1) {
						result += ',' + YoHours.OSM_DAYS[wd[i]];
					} else {
						result += '-' + YoHours.OSM_DAYS[wd[i]];
					}
				}
			}
		}

		if (result === 'Mo-Su') {
			result = '';
		}

		return result;
	};
	/**
	 * Is the given object of the same kind as this one
	 * @param {YoHours.OhDate} d
	 * @return {boolean} True if same weekdays and same wide type
	 */
	YoHours.OhDate.prototype.sameKindAs = function (d) {
		return this._wideType === d.getWideType() && d.sameWd(this._weekdays);
	};
	/**
	 * @param {Object} o
	 * @return {boolean} True if this object is equal to the given one
	 */
	YoHours.OhDate.prototype.equals = function (o) {
		return o instanceof YoHours.OhDate && this._wideType === o.getWideType() && this._wide === o.getWideValue() && o.sameWd(this._weekdays);
	};
	/**
	 * Adds a new weekday in this date
	 * @param {int} wd
	 */
	YoHours.OhDate.prototype.addWeekday = function (wd) {
		if (!this._weekdays.contains(wd) && !this._wdOver.contains(wd)) {
			this._weekdays.push(wd);
			this._weekdays = this._weekdays.sort();
		}
	};
	/**
	 * Adds public holiday as a weekday of this date
	 */
	YoHours.OhDate.prototype.addPhWeekday = function () {
		this.addWeekday(YoHours.PH_WEEKDAY);
	};
	/**
	 * Adds an overwritten weekday, which can be included in this date and that will be overwritten in a following rule
	 * @param {int} wd
	 */
	YoHours.OhDate.prototype.addOverwrittenWeekday = function (wd) {
		if (!this._wdOver.contains(wd) && !this._weekdays.contains(wd)) {
			this._wdOver.push(wd);
			this._wdOver = this._wdOver.sort();
		}
	};

	/**
	 * An opening_hours rule, such as "Mo,Tu 08:00-18:00"
	 * @constructor
	 */
	YoHours.OhRule = function () {
		/** The date selectors **/
		this._date = [];

		/** The time selectors **/
		this._time = [];
	};
	/**
	 * @return {YoHours.OhDate[]} The date selectors, as an array
	 */
	YoHours.OhRule.prototype.getDate = function () {
		return this._date;
	};
	/**
	 * @return {YoHours.OhTime[]} The time selectors, as an array
	 */
	YoHours.OhRule.prototype.getTime = function () {
		return this._time;
	};
	/**
	 * @return {string} The opening_hours value
	 */
	YoHours.OhRule.prototype.get = function () {
		let i;
		let l;
		let result = '';

		//Create date part
		if (this._date.length > 1 || this._date[0].getWideValue() !== '') {
			//Add wide selectors
			i = 0;
			l = this._date.length;
			for (; i < l; i++) {
				if (i > 0) {
					result += ',';
				}
				result += this._date[i].getWideValue();
			}
		}

		//Add weekdays
		if (this._date.length > 0) {
			let wd = this._date[0].getWeekdays();
			if (wd.length > 0) {
				result += ' ' + wd;
			}
		}

		//Create time part
		if (this._time.length > 0) {
			result += ' ';
			i = 0;
			l = this._time.length;
			for (; i < l; i++) {
				if (i > 0) {
					result += ',';
				}
				result += this._time[i].get();
			}
		} else {
			result += ' off';
		}

		if (result.trim() === '00:00-24:00') {
			result = '24/7';
		}

		return result.trim();
	};
	/**
	 * @param {Object} o
	 * @return {boolean} True if the given rule has the same time as this one
	 */
	YoHours.OhRule.prototype.sameTime = function (o) {
		if (o === undefined || o == null || o.getTime().length !== this._time.length) {
			return false;
		} else {
			let i = 0, l = this._time.length;
			for (; i < l; i++) {
				if (!this._time[i].equals(o.getTime()[i])) {
					return false;
				}
			}
			return true;
		}
	};
	/**
	 * Is this rule concerning off time ?
	 * @return {boolean}
	 */
	YoHours.OhRule.prototype.isOff = function () {
		return this._time.length === 0 || (this._time.length === 1 && this._time[0].getStart() === null);
	};
	/**
	 * Does the rule have any overwritten weekday ?
	 * @return {boolean}
	 */
	YoHours.OhRule.prototype.hasOverwrittenWeekday = function () {
		return this._date.length > 0 && this._date[0]._wdOver.length > 0;
	};
	/**
	 * Adds a weekday to all the dates
	 * @param {int} wd
	 */
	YoHours.OhRule.prototype.addWeekday = function (wd) {
		for (let i = 0; i < this._date.length; i++) {
			this._date[i].addWeekday(wd);
		}
	};
	/**
	 * Adds public holidays as weekday to all dates
	 */
	YoHours.OhRule.prototype.addPhWeekday = function () {
		for (let i = 0; i < this._date.length; i++) {
			this._date[i].addPhWeekday();
		}
	};
	/**
	 * Adds an overwritten weekday to all the dates
	 * @param {int} wd
	 */
	YoHours.OhRule.prototype.addOverwrittenWeekday = function (wd) {
		for (let i = 0; i < this._date.length; i++) {
			this._date[i].addOverwrittenWeekday(wd);
		}
	};
	/**
	 * @param {YoHours.OhDate} d A new date selector
	 */
	YoHours.OhRule.prototype.addDate = function (d) {
		//Check param
		if (d === null || d === undefined || !(d instanceof YoHours.OhDate)) {
			throw Error(i18n.translate('Invalid parameter').withContext('yohours/notifications').fetch());
		}

		//Check if date can be added
		if (this._date.length === 0 || (this._date[0].getWideType() !== 'always' && this._date[0].sameKindAs(d))) {
			this._date.push(d);
		} else {
			if (this._date.length !== 1 || this._date[0].getWideType() !== 'always' || !this._date[0].sameWd(d.getWd())) {
				throw Error(i18n.translate('This date can\'t be added to this rule').withContext('yohours/notifications').fetch());
			}
		}
	};
	/**
	 * @param {YoHours.OhTime} t A new time selector
	 */
	YoHours.OhRule.prototype.addTime = function (t) {
		if ((this._time.length === 0 || this._time[0].get() !== 'off') && !this._time.contains(t)) {
			this._time.push(t);
		} else {
			throw Error(i18n.translate('This time can\'t be added to this rule').withContext('yohours/notifications').fetch());
		}
	};

	/**
	 * Class OpeningHoursBuilder, creates opening_hours value from date range object
	 * @constructor
	 */
	YoHours.OpeningHoursBuilder = function () {

	};
	/**
	 * Parses several date ranges to create an opening_hours string
	 * @param {YoHours.DateRange[]} dateRanges The date ranges to parse
	 * @return {string} The opening_hours string
	 */
	YoHours.OpeningHoursBuilder.prototype.build = function (dateRanges) {
		let rangeId;
		let rules = [];
		let dateRange, ohRules, ohRule, ohRuleAdded, ruleId, rangeGeneral, rangeGeneralFor;

		//Read each date range
		rangeId = 0;
		let l = dateRanges.length;
		for (; rangeId < l; rangeId++) {
			dateRange = dateRanges[rangeId];

			if (dateRange !== undefined) {
				//Check if the defined typical week/day is not strictly equal to a previous wider rule
				rangeGeneral = null;
				rangeGeneralFor = null;
				let rangeGenId = rangeId - 1;
				while (rangeGenId >= 0 && rangeGeneral == null) {
					if (dateRanges[rangeGenId] !== undefined) {
						let generalFor = dateRanges[rangeGenId].isGeneralFor(dateRange);
						if (dateRanges[rangeGenId].hasSameTypical(dateRange) && (dateRanges[rangeGenId].getInterval().equals(dateRange.getInterval()) || generalFor)) {
							rangeGeneral = rangeGenId;
						} else if (generalFor && dateRanges[rangeGenId].definesTypicalWeek() && dateRange.definesTypicalWeek()) {
							rangeGeneralFor = rangeGenId; //Keep this ID to make differences in order to simplify result
						}
					}
					rangeGenId--;
				}

				if (rangeId === 0 || rangeGeneral == null) {
					//Get rules for this date range
					if (dateRange.definesTypicalWeek()) {
						if (rangeGeneralFor != null) {
							ohRules = this._buildWeekDiff(dateRange, dateRanges[rangeGeneralFor]);
						} else {
							ohRules = this._buildWeek(dateRange);
						}
					} else {
						ohRules = this._buildDay(dateRange);
					}

					//Process each rule
					let ohruleId = 0, orl = ohRules.length;
					for (; ohruleId < orl; ohruleId++) {
						ohRule = ohRules[ohruleId];
						ohRuleAdded = false;
						ruleId = 0;

						//Try to add them to previously defined ones
						while (!ohRuleAdded && ruleId < rules.length) {
							//Identical one
							if (rules[ruleId].sameTime(ohRule)) {
								try {
									let dateId = 0, dl = ohRule.getDate().length;
									for (; dateId < dl; dateId++) {
										rules[ruleId].addDate(ohRule.getDate()[dateId]);
									}
									ohRuleAdded = true;
								} catch (e) {
									//But before, try to merge PH with always weekdays
									if (ohRule.getDate()[0].getWideType() === 'holiday' && ohRule.getDate()[0].getWideValue() === 'PH' && rules[ruleId].getDate()[0].getWideType() === 'always') {
										rules[ruleId].addPhWeekday();
										ohRuleAdded = true;
									} else if (rules[ruleId].getDate()[0].getWideType() === 'holiday' && rules[ruleId].getDate()[0].getWideValue() === 'PH' && ohRule.getDate()[0].getWideType() === 'always') {
										ohRule.addPhWeekday();
										rules[ruleId] = ohRule;
										ohRuleAdded = true;
									} else {
										ruleId++;
									}
								}
							} else {
								ruleId++;
							}
						}

						//If not, add as new rule
						if (!ohRuleAdded) {
							rules.push(ohRule);
						}

						//If some overwritten weekdays are still in last rule
						if (ohruleId === orl - 1 && ohRule.hasOverwrittenWeekday()) {
							let ohruleOWD = new YoHours.OhRule();
							for (let ohruleDateId = 0; ohruleDateId < ohRule.getDate().length; ohruleDateId++) {
								ohruleOWD.addDate(new YoHours.OhDate(ohRule.getDate()[ohruleDateId].getWideValue(), ohRule.getDate()[ohruleDateId].getWideType(), ohRule.getDate()[ohruleDateId].getWdOver()));
							}
							ohruleOWD.addTime(new YoHours.OhTime());
							ohRules.push(ohruleOWD);
							orl++;
						}
					}
				}
			}
		}

		//Create result string
		let result = '';
		ruleId = 0;
		l = rules.length;
		for (; ruleId < l; ruleId++) {
			if (ruleId > 0) {
				result += '; ';
			}
			result += rules[ruleId].get();
		}

		return result;
	};
	/**
	 * Creates rules for a given typical day
	 * @param {YoHours.DateRange} dateRange The date range defining a typical day
	 * @return {YoHours.OhRule[]} An array of OhRules
	 */
	YoHours.OpeningHoursBuilder.prototype._buildDay = function (dateRange) {
		let intervals = dateRange.getTypical().getIntervals(true);
		let interval;

		//Create rule
		let rule = new YoHours.OhRule();
		let date = new YoHours.OhDate(dateRange.getInterval().getTimeSelector(), dateRange.getInterval().getType(), [-1]);
		rule.addDate(date);

		//Read time
		let i = 0, l = intervals.length;
		for (; i < l; i++) {
			interval = intervals[i];

			if (interval !== undefined) {
				rule.addTime(new YoHours.OhTime(interval.getFrom(), interval.getTo()));
			}
		}

		return [rule];
	};
	/**
	 * Create rules for a date range defining a typical week
	 * Algorithm inspired by OpeningHoursEdit plugin for JOSM
	 * @param {YoHours.DateRange} dateRange The date range defining a typical day
	 * @return {YoHours.OhRule[]} An array of OhRules
	 */
	YoHours.OpeningHoursBuilder.prototype._buildWeek = function (dateRange) {
		let i;
		let result = [];
		let intervals = dateRange.getTypical().getIntervals(true);

		/*
		 * Create time intervals per day
		 */
		let timeIntervals = this._createTimeIntervals(dateRange.getInterval().getTimeSelector(), dateRange.getInterval().getType(), intervals);
		let monday0 = timeIntervals[0];
		let sunday24 = timeIntervals[1];
		let days = timeIntervals[2];

		//Create continuous night for monday-sunday
		days = this._nightMonSun(days, monday0, sunday24);

		/*
		 * Group rules with same time
		 */
		// 0 means nothing done with this day yet
		// 8 means the day is off
		// -8 means the day is off and should be shown
		// 0<x<8 means the day have the openinghours of day x
		// -8<x<0 means nothing done with this day yet, but it intersects a
		// range of days with same opening_hours
		let daysStatus = [];

		//Init status
		for (i = 0; i < YoHours.OSM_DAYS.length; i++) {
			daysStatus[i] = 0;
		}

		//Read status
		for (i = 0; i < days.length; i++) {
			if (days[i].isOff() && daysStatus[i] === 0) {
				daysStatus[i] = 8;
			} else if (days[i].isOff() && daysStatus[i] < 0 && daysStatus[i] > -8) {
				daysStatus[i] = -8;

				//Try to merge with another off day
				let merged = false, mdOff = 0;
				while (!merged && mdOff < i) {
					if (days[mdOff].isOff()) {
						days[mdOff].addWeekday(i);
						merged = true;
					} else {
						mdOff++;
					}
				}

				//If not merged, add it
				if (!merged) {
					result.push(days[i]);
				}
			} else if (daysStatus[i] <= 0 && daysStatus[i] > -8) {
				let j;
				daysStatus[i] = i + 1;
				let lastSameDay = i;
				let sameDayCount = 1;

				for (j = i + 1; j < days.length; j++) {
					if (days[i].sameTime(days[j])) {
						daysStatus[j] = i + 1;
						days[i].addWeekday(j);
						lastSameDay = j;
						sameDayCount++;
					}
				}
				if (sameDayCount === 1) {
					// a single Day with this special opening_hours
					result.push(days[i]);
				} else if (sameDayCount === 2) {
					// exactly two Days with this special opening_hours
					days[i].addWeekday(lastSameDay);
					result.push(days[i]);
				} else if (sameDayCount > 2) {
					// more than two Days with this special opening_hours
					for (j = i + 1; j < lastSameDay; j++) {
						if (daysStatus[j] === 0) {
							daysStatus[j] = -i - 1;
							days[i].addOverwrittenWeekday(j);
						}
					}
					days[i].addWeekday(lastSameDay);
					result.push(days[i]);
				}
			}
		}

		result = this._mergeDays(result);

		return result;
	};
	/**
	 * Reads a week to create an opening_hours string for weeks which are overwriting a previous one
	 * @param {YoHours.DateRange} dateRange The date range defining a typical day
	 * @param {YoHours.DateRange} generalDateRange The date range which is wider than this one
	 * @return {YoHours.OhRule[]} An array of OhRules
	 */
	YoHours.OpeningHoursBuilder.prototype._buildWeekDiff = function (dateRange, generalDateRange) {
		let j;
		let l;
		let intervals = dateRange.getTypical().getIntervalsDiff(generalDateRange.getTypical());

		/*
		 * Create time intervals per day
		 */
		//Open
		let timeIntervals = this._createTimeIntervals(dateRange.getInterval().getTimeSelector(), dateRange.getInterval().getType(), intervals.open);
		let monday0 = timeIntervals[0];
		let sunday24 = timeIntervals[1];
		let days = timeIntervals[2];
		let interval;

		//Closed
		let i = 0;
		l = intervals.closed.length;
		for (; i < l; i++) {
			interval = intervals.closed[i];

			for (j = interval.getStartDay(); j <= interval.getEndDay(); j++) {
				days[j].addTime(new YoHours.OhTime());
			}
		}

		//Create continuous night for monday-sunday
		days = this._nightMonSun(days, monday0, sunday24);

		/*
		 * Group rules with same time
		 */
		// 0 means nothing done with this day yet
		// 8 means the day is off
		// -8 means the day is off and should be shown
		// 0<x<8 means the day have the openinghours of day x
		// -8<x<0 means nothing done with this day yet, but it intersects a
		// range of days with same opening_hours
		let daysStatus = [];

		//Init status
		for (i = 0; i < YoHours.OSM_DAYS.length; i++) {
			daysStatus[i] = 0;
		}

		//Read rules
		let result = [];
		for (i = 0; i < days.length; i++) {
			//Off day which must be shown
			if (days[i].isOff() && days[i].getTime().length === 1) {
				daysStatus[i] = -8;

				//Try to merge with another off day
				let merged = false, mdOff = 0;
				while (!merged && mdOff < i) {
					if (days[mdOff].isOff() && days[mdOff].getTime().length === 1) {
						days[mdOff].addWeekday(i);
						merged = true;
					} else {
						mdOff++;
					}
				}

				//If not merged, add it
				if (!merged) {
					result.push(days[i]);
				}
			}
			//Off day which must be hidden
			else if (days[i].isOff() && days[i].getTime().length === 0) {
				daysStatus[i] = 8;
			}
			//Non-processed day
			else if (daysStatus[i] <= 0 && daysStatus[i] > -8) {
				daysStatus[i] = i + 1;
				let sameDayCount = 1;
				let lastSameDay = i;

				result.push(days[i]);

				for (j = i + 1; j < days.length; j++) {
					if (days[i].sameTime(days[j])) {
						daysStatus[j] = i + 1;
						days[i].addWeekday(j);
						lastSameDay = j;
						sameDayCount++;
					}
				}
				if (sameDayCount === 1) {
					// a single Day with this special opening_hours
					result.push(days[i]);
				} else if (sameDayCount === 2) {
					// exactly two Days with this special opening_hours
					days[i].addWeekday(lastSameDay);
					result.push(days[i]);
				} else if (sameDayCount > 2) {
					// more than two Days with this special opening_hours
					for (j = i + 1; j < lastSameDay; j++) {
						if (daysStatus[j] === 0) {
							daysStatus[j] = -i - 1;
							if (days[j].getTime().length > 0) {
								days[i].addOverwrittenWeekday(j);
							}
						}
					}
					days[i].addWeekday(lastSameDay);
					result.push(days[i]);
				}
			}
		}

		result = this._mergeDays(result);

		return result;
	};
	/**
	 * Merge days with same opening time
	 * @param {YoHours.OhRule[]} rules
	 * @return {YoHours.OhRule[]}
	 */
	YoHours.OpeningHoursBuilder.prototype._mergeDays = function (rules) {
		if (rules.length === 0) {
			return rules;
		}

		let result = [];
		let dateMerged;

		result.push(rules[0]);
		let dm = 0, wds;
		for (let d = 1; d < rules.length; d++) {
			dateMerged = false;
			dm = 0;
			while (!dateMerged && dm < d) {
				if (rules[dm].sameTime(rules[d])) {
					wds = rules[d].getDate()[0].getWd();
					for (let wd = 0; wd < wds.length; wd++) {
						rules[dm].addWeekday(wds[wd]);
					}
					dateMerged = true;
				}
				dm++;
			}

			if (!dateMerged) {
				result.push(rules[d]);
			}
		}

		return result;
	};
	/**
	 * Creates time intervals for each day
	 * @param {string} timeSelector
	 * @param {string} type
	 * @param {YoHours.Interval[]} intervals
	 * @return {Array} [ monday0, sunday24, days ]
	 */
	YoHours.OpeningHoursBuilder.prototype._createTimeIntervals = function (timeSelector, type, intervals) {
		let i;
		let monday0 = -1;
		let sunday24 = -1;
		let days = [];
		let interval;

		//Create rule for each day of the week
		for (i = 0; i < 7; i++) {
			days.push(new YoHours.OhRule());
			days[i].addDate(new YoHours.OhDate(timeSelector, type, [i]));
		}

		i = 0;
		let l = intervals.length;
		for (; i < l; i++) {
			interval = intervals[i];

			if (interval !== undefined) {
				//Handle sunday 24:00 with monday 00:00
				if (interval.getStartDay() === YoHours.DAYS_MAX && interval.getEndDay() === YoHours.DAYS_MAX && interval.getTo() === YoHours.MINUTES_MAX) {
					sunday24 = interval.getFrom();
				}
				if (interval.getStartDay() === 0 && interval.getEndDay() === 0 && interval.getFrom() === 0) {
					monday0 = interval.getTo();
				}

				try {
					//Interval in a single day
					if (interval.getStartDay() === interval.getEndDay()) {
						days[interval.getStartDay()].addTime(new YoHours.OhTime(interval.getFrom(), interval.getTo()));
					} else if (interval.getEndDay() - interval.getStartDay() === 1) {
						//Continuous night
						if (interval.getFrom() > interval.getTo()) {
							days[interval.getStartDay()].addTime(new YoHours.OhTime(interval.getFrom(), interval.getTo()));
						} else {
							days[interval.getStartDay()].addTime(new YoHours.OhTime(interval.getFrom(), YoHours.MINUTES_MAX));
							days[interval.getEndDay()].addTime(new YoHours.OhTime(0, interval.getTo()));
						}
					} else {
						let j = interval.getStartDay(), end = interval.getEndDay();
						for (; j <= end; j++) {
							if (j === interval.getStartDay()) {
								days[j].addTime(new YoHours.OhTime(interval.getFrom(), YoHours.MINUTES_MAX));
							} else if (j === interval.getEndDay()) {
								days[j].addTime(new YoHours.OhTime(0, interval.getTo()));
							} else {
								days[j].addTime(new YoHours.OhTime(0, YoHours.MINUTES_MAX));
							}
						}
					}
				} catch (e) {
					console.warn(e);
				}
			}
		}

		return [monday0, sunday24, days];
	};
	/**
	 * Changes days array to make sunday - monday night continuous if needed
	 * @param {YoHours.OhRule[]} days
	 * @param {string|void} monday0
	 * @param {string|void} sunday24
	 * @return {YoHours.OhRule[]}
	 */
	YoHours.OpeningHoursBuilder.prototype._nightMonSun = function (days, monday0, sunday24) {
		if (monday0 >= 0 && sunday24 >= 0 && monday0 < sunday24) {
			days[0].getTime().sort(this._sortOhTime);
			days[6].getTime().sort(this._sortOhTime);

			//Change sunday interval
			days[6].getTime()[days[6].getTime().length - 1] = new YoHours.OhTime(sunday24, monday0);

			//Remove monday interval
			days[0].getTime().shift();
		}
		return days;
	};
	/**
	 * Sort OhTime objects by start hour
	 * @param {YoHours.OhTime} a
	 * @param {YoHours.OhTime} b
	 * @return {int}
	 */
	YoHours.OpeningHoursBuilder.prototype._sortOhTime = function (a, b) {
		return a.getStart() - b.getStart();
	};

	/**
	 * Class OpeningHoursParser, creates DateRange/Week/Day objects from opening_hours string
	 * Based on a subpart of grammar defined at http://wiki.openstreetmap.org/wiki/Key:opening_hours/specification
	 * @constructor
	 */
	YoHours.OpeningHoursParser = function () {

	};
	/**
	 * Parses the given opening_hours string
	 * @param {string} oh The opening_hours string
	 * @return {YoHours.DateRange[]} An array of date ranges
	 */
	YoHours.OpeningHoursParser.prototype.parse = function (oh) {
		let wdRm;
		let result = [];

		//Separate each block
		let blocks = oh.split(';');

		/*
		 * Blocks parsing
		 * Each block can be divided in three parts: wide range selector, small range selector, rule modifier.
		 * The last two are simpler to parse, so we start to read rule modifier, then small range selector.
		 * All the lasting tokens are part of wide range selector.
		 */

		let block, tokens, currentToken, ruleModifier, timeSelector, weekdaySelector, wideRangeSelector;
		let singleTime, from, to, times;
		let singleWeekday, holidays, weekdays;
		let monthSelector, weekSelector, weeks, singleWeek, weekFrom, weekTo, singleMonth, months, monthFrom, monthTo;
		let dateRanges, dateRange, drObj, foundDateRange, resDrId;

		//Read each block
		let i = 0, li = blocks.length;
		for (; i < li; i++) {
			block = blocks[i].trim();

			if (block.length === 0) {
				continue;
			} //Don't parse empty blocks

			tokens = this._tokenize(block);
			currentToken = tokens.length - 1;
			ruleModifier = null;
			timeSelector = null;
			weekdaySelector = null;
			wideRangeSelector = null;

			//console.log(tokens);

			/*
			 * Rule modifier (open, closed, off)
			 */
			if (currentToken >= 0 && this._isRuleModifier(tokens[currentToken])) {
				//console.log("rule modifier",tokens[currentToken]);
				ruleModifier = tokens[currentToken].toLowerCase();
				currentToken--;
			}

			/*
			 * Small range selectors
			 */
			from = null;
			to = null;
			times = []; //Time intervals in minutes

			//Time selector
			if (currentToken >= 0 && this._isTime(tokens[currentToken])) {
				timeSelector = tokens[currentToken];

				if (timeSelector === '24/7') {
					times.push({from: 0, to: 24 * 60});
				} else {
					//Divide each time interval
					timeSelector = timeSelector.split(',');
					let ts = 0, tsl = timeSelector.length;
					for (; ts < tsl; ts++) {
						//Separate start and end values
						singleTime = timeSelector[ts].split('-');
						from = this._asMinutes(singleTime[0]);
						if (singleTime.length > 1) {
							to = this._asMinutes(singleTime[1]);
						} else {
							to = from;
						}
						times.push({from: from, to: to});
					}
				}

				currentToken--;
			}

			holidays = [];
			weekdays = [];

			//Weekday selector
			if (timeSelector === '24/7') {
				weekdays.push({from: 0, to: 6});
			} else if (currentToken >= 0 && this._isWeekday(tokens[currentToken])) {
				weekdaySelector = tokens[currentToken];

				//Divide each weekday
				weekdaySelector = weekdaySelector.split(',');

				let wds = 0, wdsl = weekdaySelector.length;
				let wdFrom, wdTo;
				for (; wds < wdsl; wds++) {
					singleWeekday = weekdaySelector[wds];

					//Holiday
					if (YoHours.RGX_HOLIDAY.test(singleWeekday)) {
						holidays.push(singleWeekday);
					}
					//Weekday interval
					else if (YoHours.RGX_WD.test(singleWeekday)) {
						singleWeekday = singleWeekday.split('-');
						wdFrom = YoHours.OSM_DAYS.indexOf(singleWeekday[0]);
						if (singleWeekday.length > 1) {
							wdTo = YoHours.OSM_DAYS.indexOf(singleWeekday[1]);
						} else {
							wdTo = wdFrom;
						}
						weekdays.push({from: wdFrom, to: wdTo});
					} else {
						throw new Error(i18n.translate('Invalid weekday interval: %s').withContext('yohours/notifications').fetch(singleWeekday));
					}
				}

				currentToken--;
			}

			/*
			 * Wide range selector
			 */
			weeks = [];
			months = [];

			if (currentToken >= 0) {
				wideRangeSelector = tokens[0];
				for (let ct = 1; ct <= currentToken; ct++) {
					wideRangeSelector += ' ' + tokens[ct];
				}

				if (wideRangeSelector.length > 0) {
					wideRangeSelector = wideRangeSelector.replace(/:$/g, '').split('week'); //0 = Month or SH, 1 = weeks

					//Month or SH
					monthSelector = wideRangeSelector[0].trim();
					if (monthSelector.length === 0) {
						monthSelector = null;
					}

					//Weeks
					if (wideRangeSelector.length > 1) {
						weekSelector = wideRangeSelector[1].trim();
						if (weekSelector.length === 0) {
							weekSelector = null;
						}
					} else {
						weekSelector = null;
					}

					if (monthSelector != null && weekSelector != null) {
						throw new Error(i18n.translate('Unsupported simultaneous month and week selector').withContext('yohours/notifications').fetch());
					} else if (monthSelector != null) {
						monthSelector = monthSelector.split(',');

						let ms = 0, msl = monthSelector.length;
						for (; ms < msl; ms++) {
							singleMonth = monthSelector[ms];

							//School holidays
							if (singleMonth === 'SH') {
								months.push({holiday: 'SH'});
							} else if (YoHours.RGX_MONTH.test(singleMonth)) {
								singleMonth = singleMonth.split('-');
								monthFrom = YoHours.OSM_MONTHS.indexOf(singleMonth[0]) + 1;
								if (monthFrom < 1) {
									throw new Error(i18n.translate('Invalid month: %s').withContext('yohours/notifications').fetch(singleMonth[0]));
								}

								if (singleMonth.length > 1) {
									monthTo = YoHours.OSM_MONTHS.indexOf(singleMonth[1]) + 1;
									if (monthTo < 1) {
										throw new Error(i18n.translate('Invalid month: %s').withContext('yohours/notifications').fetch(singleMonth[1]));
									}
								} else {
									monthTo = null;
								}
								months.push({from: monthFrom, to: monthTo});
							} else if (YoHours.RGX_MONTHDAY.test(singleMonth)) {
								singleMonth = singleMonth.replace(/:/g, '').split('-');

								//Read monthday start
								monthFrom = singleMonth[0].split(' ');
								monthFrom = {
									day: parseInt(monthFrom[1], 10), month: YoHours.OSM_MONTHS.indexOf(monthFrom[0]) + 1
								};
								if (monthFrom.month < 1) {
									throw new Error(i18n.translate('Invalid month: %s').withContext('yohours/notifications').fetch(monthFrom[0]));
								}

								if (singleMonth.length > 1) {
									monthTo = singleMonth[1].split(' ');

									//Same month as start
									if (monthTo.length === 1) {
										monthTo = {day: parseInt(monthTo[0], 10), month: monthFrom.month};
									} else {
										monthTo = {
											day: parseInt(monthTo[1], 10),
											month: YoHours.OSM_MONTHS.indexOf(monthTo[0]) + 1
										};
										if (monthTo.month < 1) {
											throw new Error(i18n.translate('Invalid month: %s').withContext('yohours/notifications').fetch(monthTo[0]));
										}
									}
								} else {
									monthTo = null;
								}
								months.push({fromDay: monthFrom, toDay: monthTo});
							}
							//Unsupported
							else {
								throw new Error(i18n.translate('Unsupported month selector: %s').withContext('yohours/notifications').fetch(singleMonth));
							}
						}
					} else if (weekSelector != null) {
						//Divide each week interval
						weekSelector = weekSelector.split(',');

						let ws = 0, wsl = weekSelector.length;
						for (; ws < wsl; ws++) {
							singleWeek = weekSelector[ws].split('-');
							weekFrom = parseInt(singleWeek[0], 10);
							if (singleWeek.length > 1) {
								weekTo = parseInt(singleWeek[1], 10);
							} else {
								weekTo = null;
							}
							weeks.push({from: weekFrom, to: weekTo});
						}
					} else {
						throw Error(i18n.translate('Invalid date selector').withContext('yohours/notifications').fetch());
					}
				}
			}

			//If no read token, throw error
			if (currentToken === tokens.length - 1) {
				throw Error(i18n.translate('Unreadable string').withContext('yohours/notifications').fetch());
			}

			// console.log("months",months);
			// console.log("weeks",weeks);
			// console.log("holidays",holidays);
			// console.log("weekdays",weekdays);
			// console.log("times",times);
			// console.log("rule",ruleModifier);

			/*
			 * Create date ranges
			 */
			dateRanges = [];

			//Month range
			if (months.length > 0) {
				let mId = 0, ml = months.length;
				for (; mId < ml; mId++) {
					singleMonth = months[mId];

					if (singleMonth.holiday !== undefined) {
						dateRanges.push(new YoHours.WideInterval().holiday(singleMonth.holiday));
					} else if (singleMonth.fromDay !== undefined) {
						if (singleMonth.toDay != null) {
							dateRange = new YoHours.WideInterval().day(singleMonth.fromDay.day, singleMonth.fromDay.month, singleMonth.toDay.day, singleMonth.toDay.month);
						} else {
							dateRange = new YoHours.WideInterval().day(singleMonth.fromDay.day, singleMonth.fromDay.month);
						}
						dateRanges.push(dateRange);
					} else {
						if (singleMonth.to != null) {
							dateRange = new YoHours.WideInterval().month(singleMonth.from, singleMonth.to);
						} else {
							dateRange = new YoHours.WideInterval().month(singleMonth.from);
						}
						dateRanges.push(dateRange);
					}
				}
			} else if (weeks.length > 0) {
				let wId = 0, wl = weeks.length;
				for (; wId < wl; wId++) {
					if (weeks[wId].to != null) {
						dateRange = new YoHours.WideInterval().week(weeks[wId].from, weeks[wId].to);
					} else {
						dateRange = new YoHours.WideInterval().week(weeks[wId].from);
					}
					dateRanges.push(dateRange);
				}
			} else if (holidays.length > 0) {
				let hId = 0, hl = holidays.length;
				for (; hId < hl; hId++) {
					dateRanges.push(new YoHours.WideInterval().holiday(holidays[hId]));
					if (holidays[hId] === 'PH' && weekdays.length > 0 && months.length === 0 && weeks.length === 0) {
						dateRanges.push(new YoHours.WideInterval().always());
					}
				}
			} else {
				dateRanges.push(new YoHours.WideInterval().always());
			}

			//Case of no weekday defined = all week
			if (weekdays.length === 0) {
				if (holidays.length === 0 || (holidays.length === 1 && holidays[0] === 'SH')) {
					weekdays.push({from: 0, to: YoHours.OSM_DAYS.length - 1});
				} else {
					weekdays.push({from: 0, to: 0});
				}
			}

			//Case of no time defined = all day
			if (times.length === 0) {
				times.push({from: 0, to: 24 * 60});
			}

			/*
			 * Create date range objects
			 */
			let drId = 0, drl = dateRanges.length;
			for (; drId < drl; drId++) {
				/*
				 * Find an already defined date range or create new one
				 */
				foundDateRange = false;
				resDrId = 0;
				while (resDrId < result.length && !foundDateRange) {
					if (result[resDrId].getInterval().equals(dateRanges[drId])) {
						foundDateRange = true;
					} else {
						resDrId++;
					}
				}

				if (foundDateRange) {
					drObj = result[resDrId];
				} else {
					drObj = new YoHours.DateRange(dateRanges[drId]);

					//Find general date range that may be refined by this one
					let general = -1;
					for (resDrId = 0; resDrId < result.length; resDrId++) {
						if (result[resDrId].isGeneralFor(new YoHours.DateRange(dateRanges[drId]))) {
							general = resDrId;
						}
					}

					//Copy general date range intervals
					if (general >= 0 && drObj.definesTypicalWeek()) {
						drObj.getTypical().copyIntervals(result[general].getTypical().getIntervals());
					}

					result.push(drObj);
				}

				/*
				 * Add time intervals
				 */
				//For each weekday
				let wdId = 0, wdl = weekdays.length;
				for (; wdId < wdl; wdId++) {
					//Remove overlapping days
					if (weekdays[wdId].from <= weekdays[wdId].to) {
						for (wdRm = weekdays[wdId].from; wdRm <= weekdays[wdId].to; wdRm++) {
							if (drObj.definesTypicalWeek()) {
								drObj.getTypical().removeIntervalsDuringDay(wdRm);
							} else {
								drObj.getTypical().clearIntervals();
							}
						}
					} else {
						for (wdRm = weekdays[wdId].from; wdRm <= 6; wdRm++) {
							if (drObj.definesTypicalWeek()) {
								drObj.getTypical().removeIntervalsDuringDay(wdRm);
							} else {
								drObj.getTypical().clearIntervals();
							}
						}
						for (wdRm = 0; wdRm <= weekdays[wdId].to; wdRm++) {
							if (drObj.definesTypicalWeek()) {
								drObj.getTypical().removeIntervalsDuringDay(wdRm);
							} else {
								drObj.getTypical().clearIntervals();
							}
						}
					}

					//For each time interval
					let tId = 0, tl = times.length;
					for (; tId < tl; tId++) {
						if (ruleModifier === 'closed' || ruleModifier === 'off') {
							this._removeInterval(drObj.getTypical(), weekdays[wdId], times[tId]);
						} else {
							this._addInterval(drObj.getTypical(), weekdays[wdId], times[tId]);
						}
					}
				}
			}
		}

		return result;
	};
	/**
	 * Remove intervals from given typical day/week
	 * @param {YoHours.Day|YoHours.Week} typical The typical day or week
	 * @param {Object} weekdays The concerned weekdays
	 * @param {Object} times The concerned times
	 */
	YoHours.OpeningHoursParser.prototype._removeInterval = function (typical, weekdays, times) {
		let wd;
		if (weekdays.from <= weekdays.to) {
			for (wd = weekdays.from; wd <= weekdays.to; wd++) {
				this._removeIntervalWd(typical, times, wd);
			}
		} else {
			for (wd = weekdays.from; wd <= 6; wd++) {
				this._removeIntervalWd(typical, times, wd);
			}
			for (wd = 0; wd <= weekdays.to; wd++) {
				this._removeIntervalWd(typical, times, wd);
			}
		}
	};
	/**
	 * Remove intervals from given typical day/week for a given weekday
	 * @param {YoHours.Day|YoHours.Week} typical The typical day or week
	 * @param {Object} times The concerned times
	 * @param {int} wd The concerned weekday
	 */
	YoHours.OpeningHoursParser.prototype._removeIntervalWd = function (typical, times, wd) {
		//Interval during day
		if (times.to >= times.from) {
			typical.removeInterval(new YoHours.Interval(wd, wd, times.from, times.to));
		} else {
			//Everyday except sunday
			if (wd < 6) {
				typical.removeInterval(new YoHours.Interval(wd, wd + 1, times.from, times.to));
			} else {
				typical.removeInterval(new YoHours.Interval(wd, wd, times.from, 24 * 60));
				typical.removeInterval(new YoHours.Interval(0, 0, 0, times.to));
			}
		}
	};
	/**
	 * Adds intervals from given typical day/week
	 * @param {YoHours.Day|YoHours.Week} typical The typical day or week
	 * @param {Object} weekdays The concerned weekdays
	 * @param {Object} times The concerned times
	 */
	YoHours.OpeningHoursParser.prototype._addInterval = function (typical, weekdays, times) {
		let wd;

		if (typical instanceof YoHours.Day) {
			if (weekdays.from !== 0 || (weekdays.to !== 0 && times.from <= times.to)) {
				weekdays = $.extend({}, weekdays);
				weekdays.from = 0;
				weekdays.to = (times.from <= times.to) ? 0 : 1;
			}
		}

		if (weekdays.from <= weekdays.to) {
			for (wd = weekdays.from; wd <= weekdays.to; wd++) {
				this._addIntervalWd(typical, times, wd);
			}
		} else {
			for (wd = weekdays.from; wd <= 6; wd++) {
				this._addIntervalWd(typical, times, wd);
			}
			for (wd = 0; wd <= weekdays.to; wd++) {
				this._addIntervalWd(typical, times, wd);
			}
		}
	};
	/**
	 * Adds intervals from given typical day/week for a given weekday
	 * @param {YoHours.Day|YoHours.Week} typical The typical day or week
	 * @param {Object} times The concerned times
	 * @param {int} wd The concerned weekday
	 */
	YoHours.OpeningHoursParser.prototype._addIntervalWd = function (typical, times, wd) {
		//Interval during day
		if (times.to >= times.from) {
			typical.addInterval(new YoHours.Interval(wd, wd, times.from, times.to));
		} else {
			//Everyday except sunday
			if (wd < 6) {
				typical.addInterval(new YoHours.Interval(wd, wd + 1, times.from, times.to));
			} else {
				typical.addInterval(new YoHours.Interval(wd, wd, times.from, 24 * 60));
				typical.addInterval(new YoHours.Interval(0, 0, 0, times.to));
			}
		}
	};
	/**
	 * Converts a time string "12:45" into minutes integer
	 * @param {string} time The time string
	 * @return {int} The amount of minutes since midnight
	 */
	YoHours.OpeningHoursParser.prototype._asMinutes = function (time) {
		let values = time.split(':');
		return parseInt(values[0], 10) * 60 + parseInt(values[1], 10);
	};
	/**
	 * Is the given token a weekday selector ?
	 * @return {boolean}
	 */
	YoHours.OpeningHoursParser.prototype._isWeekday = function (token) {
		return YoHours.RGX_WEEKDAY.test(token);
	};
	/**
	 * Is the given token a time selector ?
	 * @return {boolean}
	 */
	YoHours.OpeningHoursParser.prototype._isTime = function (token) {
		return YoHours.RGX_TIME.test(token);
	};
	/**
	 * Is the given token a rule modifier ?
	 * @return {boolean}
	 */
	YoHours.OpeningHoursParser.prototype._isRuleModifier = function (token) {
		return YoHours.RGX_RULE_MODIFIER.test(token);
	};
	/**
	 * Create tokens for a given block
	 * @return {Array}
	 */
	YoHours.OpeningHoursParser.prototype._tokenize = function (block) {
		let result = block.trim().split(' ');
		let position = $.inArray('', result);
		while (~position) {
			result.splice(position, 1);
			position = $.inArray('', result);
		}
		return result;
	};
	/**
	 * Debug function
	 * @param {string} from
	 * @param {YoHours.Interval[]} intervals
	 * @private
	 */
	YoHours.OpeningHoursParser.prototype._printIntervals = function (from, intervals) {
		console.log('From: ' + from);
		if (intervals.length > 0) {
			console.log('-------------------------');
			for (let i = 0; i < intervals.length; i++) {
				if (intervals[i] === undefined) {
					console.log(i + ': ' + undefined);
				} else {
					console.log(i + ': ' + intervals[i].getStartDay() + ', ' + intervals[i].getEndDay() + ', ' + intervals[i].getFrom() + ', ' + intervals[i].getTo());
				}
			}
			console.log('-------------------------');
		} else {
			console.log('Empty intervals');
		}
	};

	/**
	 * Check compatibility of opening_hours string with YoHours
	 * @constructor
	 */
	YoHours.YoHoursChecker = function () {
		/** The OpeningHoursParser **/
		this._parser = new YoHours.OpeningHoursParser();
	};
	/**
	 * Check if the opening_hours is readable by YoHours
	 * @param {string} oh The opening_hours string
	 * @return {boolean} True if YoHours can read it and display it
	 */
	YoHours.YoHoursChecker.prototype.canRead = function (oh) {
		let result = false;

		try {
			let parsed = this._parser.parse(oh);
			if (parsed != null) {
				result = true;
			}
		} catch (e) {

		}

		return result;
	};

	/**
	 * Options
	 * @type {{bootstrapVersion: string, delay: number, minimal: boolean}}
	 */
	YoHours.options = {
		bootstrapVersion: 'bootstrap3', delay: 700, height: 600, locale: 'en', minimal: false
	};

	/**
	 * Templates
	 * @type {iconClock: string, {bootstrap3: {inputGroup: string, dateRangeModal: string, rangeNav: string}, bootstrap4: {inputGroup: string, dateRangeModal: string, rangeNav: string}}}
	 */
	YoHours.templates = {
		iconClock: '<strong>&#x1f556;</strong>',
		iconPencil: '&#x1F589;',
		iconTrash: '&#x1F5D1;',
		bootstrap3: {
			inputGroup: '<div class="input-group">\n\t<input type="text" class="form-control" id="toReplace">\n\t<span class="input-group-btn">\n\t\t<button class="btn btn-default" type="button" role="button" data-toggle="collapse" data-target="#{$prefix|default:\'\'}yo-hours-collapse"\n\t\t\t\taria-expanded="false" aria-controls="{$prefix|default:\'\'}yo-hours-collapse">\n\t\t\t{$iconClock|default:\'<strong>&#x1f556;</strong>\'}\n\t\t</button>\n\t</span>\n</div>\n<div id="{$prefix|default:\'\'}yo-hours-collapse" class="yo-hours-collapse collapse in">\n\t<div id="{$prefix|default:\'\'}yo-hours-range-nav"></div>\n\t\n\t<div class="tab-content">\n\t\t<div class="tab-pane active">\n\t\t\t<nav class="navbar navbar-default">\n\t\t\t\t<div class="navbar-header">\n\t\t\t\t\t<button type="button" class="navbar-toggle collapsed" data-toggle="collapse"\n\t\t\t\t\t\t\tdata-target="#{$prefix|default:\'\'}yo-hours-nav" aria-expanded="false"\n\t\t\t\t\t\t\taria-controls="{$prefix|default:\'\'}yo-hours-nav">\n\t\t\t\t\t\t<span class="sr-only">{"Toggle navigation"|t}</span>\n\t\t\t\t\t\t<span class="icon-bar"></span>\n\t\t\t\t\t\t<span class="icon-bar"></span>\n\t\t\t\t\t\t<span class="icon-bar"></span>\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t\t<div class="collapse navbar-collapse" id="{$prefix|default:\'\'}yo-hours-nav">\n\t\t\t\t\t<p class="navbar-text">{"Calendar defining"|t} <span id="{$prefix|default:\'\'}yo-hours-range-text-label"></span></p>\n\t\t\t\t\t<button id="{$prefix|default:\'\'}yo-hours-range-edit" class="btn btn-default navbar-btn navbar-right" type="button">\n\t\t\t\t\t\t{$iconPencil|default:\'&#x1F589;\'}\n\t\t\t\t\t</button>\n\t\t\t\t\t<button id="{$prefix|default:\'\'}yo-hours-range-delete" class="btn btn-danger navbar-btn navbar-right" type="button">\n\t\t\t\t\t\t{$iconTrash|default:\'&#x1F5D1;\'}\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t</nav>\n\t\t\t<div id="{$prefix|default:\'\'}yo-hours-calendar" class="yo-hours-calendar"></div>\n\t\t</div>\n\t</div>\n</div>',
			dateRangeModal: '<div class="modal fade yo-hours-daterange-modal" tabindex="-1" role="dialog">\n\t<div class="modal-dialog" role="document">\n\t\t<div class="modal-content">\n\t\t\t<form class="form-horizontal">\n\t\t\t\t<div class="modal-header">\n\t\t\t\t\t<button type="button" class="close" data-dismiss="modal" aria-label="Close">\n\t\t\t\t\t\t<span aria-hidden="true">&times;</span>\n\t\t\t\t\t</button>\n\t\t\t\t\t<h4 class="modal-title">{"Select date range"|t}</h4>\n\t\t\t\t</div>\n\t\t\t\t<div class="modal-body">\n\t\t\t\t\t<ul class="nav nav-tabs" role="tablist">\n\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t<li role="presentation"{if !$editMode || $type == "always"} class="active"{/if}>\n\t\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-always" role="tab" data-toggle="tab" data-type="always">{"Always"|t}</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t<li role="presentation"{if $editMode && $type == "month"} class="active"{/if}>\n\t\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-month" role="tab" data-toggle="tab" data-type="month">{"Month"|t}</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t<li role="presentation"{if $editMode && $type == "week"} class="active"{/if}>\n\t\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-week" role="tab" data-toggle="tab" data-type="week">{"Week"|t}</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t<li role="presentation"{if $editMode && $type == "day"} class="active"{/if}>\n\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-day" role="tab" data-toggle="tab" data-type="day">{"Day"|t}</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t\t<li role="presentation"{if $editMode && $type == "holiday"} class="active"{/if}>\n\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-holiday" role="tab" data-toggle="tab" data-type="holiday">{"Holiday"|t}</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t</ul>\n\t\n\t\t\t\t\t<div class="tab-content">\n\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t<div class="tab-pane{if !$editMode || $type == \'always\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-always">\n\t\t\t\t\t\t\t\t<p class="text-info">{"This calendar will define all weeks of the year"|t}</p>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'month\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-month">\n\t\t\t\t\t\t\t\t<p class="text-info">{"The end month is optional"|t}</p>\n\t\t\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-month-start" class="col-sm-2 control-label">{"Start"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<select id="{$prefix|default:\'\'}yo-hours-date-range-input-month-start" class="form-control input-sm">\n\t\t\t\t\t\t\t\t\t\t\t<option value="1"{if $editMode && $type == "month" && $start.month == 1} selected{/if}>{"January"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="2"{if $editMode && $type == "month" && $start.month == 2} selected{/if}>{"February"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="3"{if $editMode && $type == "month" && $start.month == 3} selected{/if}>{"March"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="4"{if $editMode && $type == "month" && $start.month == 4} selected{/if}>{"April"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="5"{if $editMode && $type == "month" && $start.month == 5} selected{/if}>{"May"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="6"{if $editMode && $type == "month" && $start.month == 6} selected{/if}>{"June"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="7"{if $editMode && $type == "month" && $start.month == 7} selected{/if}>{"July"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="8"{if $editMode && $type == "month" && $start.month == 8} selected{/if}>{"August"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="9"{if $editMode && $type == "month" && $start.month == 9} selected{/if}>{"September"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="10"{if $editMode && $type == "month" && $start.month == 10} selected{/if}>{"October"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="11"{if $editMode && $type == "month" && $start.month == 11} selected{/if}>{"November"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="12"{if $editMode && $type == "month" && $start.month == 12} selected{/if}>{"December"|t}</option>\n\t\t\t\t\t\t\t\t\t\t</select>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\n\t\t\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-month-end" class="col-sm-2 control-label">{"End"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<select id="{$prefix|default:\'\'}yo-hours-date-range-input-month-end" class="form-control input-sm">\n\t\t\t\t\t\t\t\t\t\t\t<option value="0"{if !$editMode || $type != "month" || !$end.month} selected{/if}></option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="1"{if $editMode && $type == "month" && $end.month == 1} selected{/if}>{"January"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="2"{if $editMode && $type == "month" && $end.month == 2} selected{/if}>{"February"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="3"{if $editMode && $type == "month" && $end.month == 3} selected{/if}>{"March"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="4"{if $editMode && $type == "month" && $end.month == 4} selected{/if}>{"April"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="5"{if $editMode && $type == "month" && $end.month == 5} selected{/if}>{"May"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="6"{if $editMode && $type == "month" && $end.month == 6} selected{/if}>{"June"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="7"{if $editMode && $type == "month" && $end.month == 7} selected{/if}>{"July"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="8"{if $editMode && $type == "month" && $end.month == 8} selected{/if}>{"August"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="9"{if $editMode && $type == "month" && $end.month == 9} selected{/if}>{"September"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="10"{if $editMode && $type == "month" && $end.month == 10} selected{/if}>{"October"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="11"{if $editMode && $type == "month" && $end.month == 11} selected{/if}>{"November"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="12"{if $editMode && $type == "month" && $end.month == 12} selected{/if}>{"December"|t}</option>\n\t\t\t\t\t\t\t\t\t\t</select>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'week\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-week">\n\t\t\t\t\t\t\t\t<p class="text-info">{"The end week is optional"|t}</p>\n\t\t\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-week-start" class="col-sm-2 control-label">{"Start"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="53" step="1"\n\t\t\t\t\t\t\t\t\t\t\t   value="{$start.week|default:1}" id="{$prefix|default:\'\'}yo-hours-date-range-input-week-start">\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-week-end" class="col-sm-2 control-label">{"End"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="53" step="1"\n\t\t\t\t\t\t\t\t\t\t\t   value="{$end.week|default:\'\'}" id="{$prefix|default:\'\'}yo-hours-date-range-input-week-end">\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'day\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-day">\n\t\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t\t<p class="text-info">{"The end day is optional"|t}</p>\n\t\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-day-startday" class="col-sm-2 control-label">{"Start"|t}</label>\n\t\t\t\t\t\t\t\t<div class="col-sm-10 input-group">\n\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="31" step="1"\n\t\t\t\t\t\t\t\t\t\t   id="{$prefix|default:\'\'}yo-hours-date-range-input-day-startday" value="{$start.day|default:\'\'}">\n\t\t\t\t\t\t\t\t\t<div class="input-group-btn month-dropdown">\n\t\t\t\t\t\t\t\t\t\t<button type="button" class="btn btn-default btn-block dropdown-toggle"\n\t\t\t\t\t\t\t\t\t\t\t\tdata-toggle="dropdown" aria-haspopup="true" aria-expanded="false">\n\t\t\t\t\t\t\t\t\t\t\t{if $start.month}{$months[$start.month - 1]|default:{"January"|t}}{else}{"January"|t}{/if}\n\t\t\t\t\t\t\t\t\t\t\t<span class="caret"></span>\n\t\t\t\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t\t\t\t\t<input type="hidden" id="{$prefix|default:\'\'}yo-hours-date-range-input-day-startmonth" value="{$start.month|default:1}">\n\t\t\t\t\t\t\t\t\t\t<ul class="dropdown-menu dropdown-menu-right">\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 1 || !$start.month}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="1">{"January"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 2}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="2">{"February"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 3}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="3">{"March"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 4}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="4">{"April"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 5}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="5">{"May"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 6}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="6">{"June"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 7}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="7">{"July"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 8}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="8">{"August"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 9}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="9">{"September"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 10}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="10">{"October"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 11}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="11">{"November"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t<li {if $start.month == 12}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="12">{"December"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t</ul>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-day-endday" class="col-sm-2 control-label">{"End"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10 input-group">\n\t\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="31" step="1"\n\t\t\t\t\t\t\t\t\t\t\t   id="{$prefix|default:\'\'}yo-hours-date-range-input-day-endday" value="{$end.day|default:\'\'}">\n\t\t\t\t\t\t\t\t\t\t<div class="input-group-btn month-dropdown">\n\t\t\t\t\t\t\t\t\t\t\t<button type="button" class="btn btn-default btn-block dropdown-toggle"\n\t\t\t\t\t\t\t\t\t\t\t\t\tdata-toggle="dropdown" aria-haspopup="true" aria-expanded="false">\n\t\t\t\t\t\t\t\t\t\t\t\t{if $end.month}{$months[$end.month - 1]|default:{"January"|t}}{else}{"(not set)"|t}{/if}\n\t\t\t\t\t\t\t\t\t\t\t\t<span class="caret"></span>\n\t\t\t\t\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t\t\t\t\t\t<input type="hidden" id="{$prefix|default:\'\'}yo-hours-date-range-input-day-endmonth" value="{$end.month}">\n\t\t\t\t\t\t\t\t\t\t\t<ul class="dropdown-menu dropdown-menu-right">\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 1}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="1">{"January"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 2}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="2">{"February"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 3}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="3">{"March"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 4}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="4">{"April"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 5}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="5">{"May"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 6}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="6">{"June"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 7}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="7">{"July"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 8}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="8">{"August"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 9}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="9">{"September"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 10}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="10">{"October"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 11}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="11">{"November"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t\t<li {if $end.month == 12}class="active"{/if}>\n\t\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="12">{"December"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t\t\t\t\t</ul>\n\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'holiday\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-holiday">\n\t\t\t\t\t\t\t<div class="radio">\n\t\t\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t\t\t<label id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-sh">\n\t\t\t\t\t\t\t\t\t\t<input type="radio" name="holiday-type" value="SH"\n\t\t\t\t\t\t\t\t\t\t\t   {if $start.holiday == "SH"} checked{/if}> {"School holidays"|t}\n\t\t\t\t\t\t\t\t\t</label>\n\t\t\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t\t\t{if !$editMode || !$typicalWeek}\n\t\t\t\t\t\t\t\t\t<label id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-ph">\n\t\t\t\t\t\t\t\t\t\t<input type="radio" name="holiday-type" value="PH"\n\t\t\t\t\t\t\t\t\t\t\t   {if $start.holiday == "PH"} checked{/if}> {"Public holidays"|t}\n\t\t\t\t\t\t\t\t\t</label>\n\t\t\t\t\t\t\t\t\t<label id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-easter">\n\t\t\t\t\t\t\t\t\t\t<input type="radio" name="holiday-type" value="easter"\n\t\t\t\t\t\t\t\t\t\t\t   {if $start.holiday == "easter"} checked{/if}> {"Easter"|t}\n\t\t\t\t\t\t\t\t\t</label>\n\t\t\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="modal-footer">\n\t\t\t\t\t<button type="button" class="btn btn-default" data-dismiss="modal">{"Close"|t}</button>\n\t\t\t\t\t<button type="button" class="btn btn-primary">{"OK"|t}</button>\n\t\t\t\t</div>\n\t\t\t</form>\n\t\t</div>\n\t</div>\n</div>',
			rangeNav: '<ul class="nav nav-tabs" id="{$prefix|default:\'\'}yo-hours-range-nav" role="tablist">\n\t{foreach $dateRanges as $dateRange}\n\t\t{assign var="timeName" value=$dateRange->getInterval()->getTimeSelector()}\n\t\t<li role="presentation" class="rnav{if $dateRange == $activeDateRange} active{/if}">\n\t\t\t<a href="javascript:;" role="tab" data-index="{$dateRange@index}">{{$timeName|default:"All year"}|t}</a>\n\t\t</li>\n\t{/foreach}\n\t\n\t<li role="presentation">\n\t\t<a href="javascript:;" role="button" class="add" title="{\'Add new date range\'|t}">\n\t\t\t<span aria-hidden="true">+</span>\n\t\t</a>\n\t</li>\n</ul>'
		},
		bootstrap4: {
			inputGroup: '<div class="input-group">\n\t<input type="text" class="form-control" id="toReplace">\n\t<div class="input-group-append">\n\t\t<button class="btn btn-outline-secondary" type="button" role="button" data-toggle="collapse"\n\t\t\t\tdata-target="#{$prefix|default:\'\'}yo-hours-collapse" aria-expanded="false"\n\t\t\t\taria-controls="{$prefix|default:\'\'}yo-hours-collapse">\n\t\t\t{$iconClock|default:\'<strong>&#x1f556;</strong>\'}\n\t\t</button>\n\t</div>\n</div>\n<div id="{$prefix|default:\'\'}yo-hours-collapse" class="yo-hours-collapse collapse show">\n\t<div id="{$prefix|default:\'\'}yo-hours-range-nav"></div>\n\n\t<nav class="navbar navbar-expand-sm navbar-light bg-light">\n\t\t<button type="button" class="navbar-toggler" data-toggle="collapse" data-target="#{$prefix|default:\'\'}yo-hours-nav" \n\t\t\t\taria-expanded="false" aria-controls="{$prefix|default:\'\'}yo-hours-nav" aria-label="{\'Toggle navigation\'|t}">\n\t\t\t<span class="navbar-toggler-icon"></span>\n\t\t</button>\n\t\t\n\t\t<div class="collapse navbar-collapse" id="{$prefix|default:\'\'}yo-hours-nav">\n\t\t\t<span class="navbar-text">{"Calendar defining"|t} <span id="{$prefix|default:\'\'}yo-hours-range-text-label"></span></span>\n\n\t\t\t<form class="form-inline ml-auto">\n\t\t\t\t<div class="btn-group" role="group">\n\t\t\t\t\t<button id="{$prefix|default:\'\'}yo-hours-range-edit" class="btn btn-outline-secondary" type="button">\n\t\t\t\t\t\t{$iconPencil|default:\'&#x1F589;\'}\n\t\t\t\t\t</button>\n\t\t\t\t\t<button id="{$prefix|default:\'\'}yo-hours-range-delete" class="btn btn-outline-danger" type="button">\n\t\t\t\t\t\t{$iconTrash|default:\'&#x1F5D1;\'}\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t</form>\n\t\t</div>\n\t</nav>\n\t\n\t<div id="{$prefix|default:\'\'}yo-hours-calendar" class="yo-hours-calendar"></div>\n</div>',
			dateRangeModal: '<div class="modal fade yo-hours-daterange-modal" tabindex="-1" role="dialog">\n\t<div class="modal-dialog" role="document">\n\t\t<div class="modal-content">\n\t\t\t<form class="form-horizontal">\n\t\t\t\t<div class="modal-header">\n\t\t\t\t\t<h4 class="modal-title">{"Select date range"|t}</h4>\n\t\t\t\t\t<button type="button" class="close" data-dismiss="modal" aria-label="Close">\n\t\t\t\t\t\t<span aria-hidden="true">&times;</span>\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t\t<div class="modal-body">\n\t\t\t\t\t<ul class="nav nav-tabs" role="tablist">\n\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t<li role="presentation" class="nav-item">\n\t\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-always" role="tab" data-toggle="tab" data-type="always"\n\t\t\t\t\t\t\t\t   class="nav-link{if !$editMode || $type == \'always\'} active{/if}" aria-selected="true"\n\t\t\t\t\t\t\t\t   aria-controls="{$prefix|default:\'\'}yo-hours-date-range-tab-always">{"Always"|t}</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t<li role="presentation" class="nav-item">\n\t\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-month" role="tab" data-toggle="tab" data-type="month"\n\t\t\t\t\t\t\t\t   class="nav-link{if $editMode && $type == \'month\'} active{/if}"\n\t\t\t\t\t\t\t\t   aria-selected="false" aria-controls="{$prefix|default:\'\'}yo-hours-date-range-tab-month">{"Month"|t}</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t<li role="presentation" class="nav-item">\n\t\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-week" role="tab" data-toggle="tab" data-type="week"\n\t\t\t\t\t\t\t\t   class="nav-link{if $editMode && $type == \'week\'} active{/if}"\n\t\t\t\t\t\t\t\t   aria-selected="false" aria-controls="{$prefix|default:\'\'}yo-hours-date-range-tab-week">{"Week"|t}</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t<li role="presentation" class="nav-item">\n\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-day" role="tab" data-toggle="tab" data-type="day"\n\t\t\t\t\t\t\t   class="nav-link{if $editMode && $type == \'day\'} active{/if}"\n\t\t\t\t\t\t\t   aria-selected="false" aria-controls="{$prefix|default:\'\'}yo-hours-date-range-tab-day">{"Day"|t}</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t\t<li role="presentation" class="nav-item">\n\t\t\t\t\t\t\t<a href="#{$prefix|default:\'\'}yo-hours-date-range-tab-holiday" role="tab" data-toggle="tab" data-type="holiday"\n\t\t\t\t\t\t\t   class="nav-link{if $editMode && $type == \'holiday\'} active{/if}"\n\t\t\t\t\t\t\t   aria-selected="false" aria-controls="{$prefix|default:\'\'}yo-hours-date-range-tab-holiday">{"Holiday"|t}</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t</ul>\n\n\t\t\t\t\t<div class="tab-content">\n\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t<div class="tab-pane{if !$editMode || $type == \'always\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-always">\n\t\t\t\t\t\t\t\t<p class="text-info">{"This calendar will define all weeks of the year"|t}</p>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'month\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-month">\n\t\t\t\t\t\t\t\t<p class="text-info">{"The end month is optional"|t}</p>\n\t\t\t\t\t\t\t\t<div class="form-group row">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-month-start" class="col-sm-2 col-form-label">{"Start"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<select id="{$prefix|default:\'\'}yo-hours-date-range-input-month-start" class="form-control input-sm">\n\t\t\t\t\t\t\t\t\t\t\t<option value="1"{if $editMode && $type == "month" && $start.month == 1} selected{/if}>{"January"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="2"{if $editMode && $type == "month" && $start.month == 2} selected{/if}>{"February"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="3"{if $editMode && $type == "month" && $start.month == 3} selected{/if}>{"March"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="4"{if $editMode && $type == "month" && $start.month == 4} selected{/if}>{"April"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="5"{if $editMode && $type == "month" && $start.month == 5} selected{/if}>{"May"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="6"{if $editMode && $type == "month" && $start.month == 6} selected{/if}>{"June"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="7"{if $editMode && $type == "month" && $start.month == 7} selected{/if}>{"July"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="8"{if $editMode && $type == "month" && $start.month == 8} selected{/if}>{"August"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="9"{if $editMode && $type == "month" && $start.month == 9} selected{/if}>{"September"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="10"{if $editMode && $type == "month" && $start.month == 10} selected{/if}>{"October"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="11"{if $editMode && $type == "month" && $start.month == 11} selected{/if}>{"November"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="12"{if $editMode && $type == "month" && $start.month == 12} selected{/if}>{"December"|t}</option>\n\t\t\t\t\t\t\t\t\t\t</select>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\n\t\t\t\t\t\t\t\t<div class="form-group row">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-month-end" class="col-sm-2 col-form-label">{"End"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<select id="{$prefix|default:\'\'}yo-hours-date-range-input-month-end" class="form-control input-sm">\n\t\t\t\t\t\t\t\t\t\t\t<option value="0"{if !$editMode || $type != "month" || !$end.month} selected{/if}></option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="1"{if $editMode && $type == "month" && $end.month == 1} selected{/if}>{"January"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="2"{if $editMode && $type == "month" && $end.month == 2} selected{/if}>{"February"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="3"{if $editMode && $type == "month" && $end.month == 3} selected{/if}>{"March"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="4"{if $editMode && $type == "month" && $end.month == 4} selected{/if}>{"April"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="5"{if $editMode && $type == "month" && $end.month == 5} selected{/if}>{"May"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="6"{if $editMode && $type == "month" && $end.month == 6} selected{/if}>{"June"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="7"{if $editMode && $type == "month" && $end.month == 7} selected{/if}>{"July"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="8"{if $editMode && $type == "month" && $end.month == 8} selected{/if}>{"August"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="9"{if $editMode && $type == "month" && $end.month == 9} selected{/if}>{"September"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="10"{if $editMode && $type == "month" && $end.month == 10} selected{/if}>{"October"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="11"{if $editMode && $type == "month" && $end.month == 11} selected{/if}>{"November"|t}</option>\n\t\t\t\t\t\t\t\t\t\t\t<option value="12"{if $editMode && $type == "month" && $end.month == 12} selected{/if}>{"December"|t}</option>\n\t\t\t\t\t\t\t\t\t\t</select>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'week\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-week">\n\t\t\t\t\t\t\t\t<p class="text-info">{"The end week is optional"|t}</p>\n\t\t\t\t\t\t\t\t<div class="form-group row">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-week-start" class="col-sm-2 col-form-label">{"Start"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="53" step="1"\n\t\t\t\t\t\t\t\t\t\t\t   value="{$start.week|default:1}" id="{$prefix|default:\'\'}yo-hours-date-range-input-week-start">\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t<div class="form-group row">\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-week-end" class="col-sm-2 col-form-label">{"End"|t}</label>\n\t\t\t\t\t\t\t\t\t<div class="col-sm-10">\n\t\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="53" step="1"\n\t\t\t\t\t\t\t\t\t\t\t   value="{$end.week|default:\'\'}" id="{$prefix|default:\'\'}yo-hours-date-range-input-week-end">\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'day\'} active{/if}" role="tabpanel" id="{$prefix|default:\'\'}yo-hours-date-range-tab-day">\n\t\t\t\t\t\t\t<p class="text-info">{"The end day is optional"|t}</p>\n\t\t\t\t\t\t\t<div class="form-group row">\n\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-day-startday" class="col-sm-2 col-form-label">{"Start"|t}</label>\n\t\t\t\t\t\t\t\t<div class="col-sm-10 input-group">\n\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="31" step="1"\n\t\t\t\t\t\t\t\t\t\t   id="{$prefix|default:\'\'}yo-hours-date-range-input-day-startday" value="{$start.day|default:\'\'}">\n\t\t\t\t\t\t\t\t\t<div class="input-group-append month-dropdown">\n\t\t\t\t\t\t\t\t\t\t<button type="button" class="btn btn-outline-secondary btn-block dropdown-toggle"\n\t\t\t\t\t\t\t\t\t\t\t\tdata-toggle="dropdown" aria-haspopup="true" aria-expanded="false">\n\t\t\t\t\t\t\t\t\t\t\t{if $start.month}{$months[$start.month - 1]|default:{"January"|t}}{else}{"January"|t}{/if}\n\t\t\t\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t\t\t\t\t<input type="hidden" id="{$prefix|default:\'\'}yo-hours-date-range-input-day-startmonth" value="{$start.month|default:1}">\n\t\t\t\t\t\t\t\t\t\t<div class="dropdown-menu dropdown-menu-right">\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="1" class="dropdown-item{if $start.month == 1 || !$start.month} active{/if}">{"January"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="2" class="dropdown-item{if $start.month == 2} active{/if}">{"February"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="3" class="dropdown-item{if $start.month == 3} active{/if}">{"March"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="4" class="dropdown-item{if $start.month == 4} active{/if}">{"April"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="5" class="dropdown-item{if $start.month == 5} active{/if}">{"May"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="6" class="dropdown-item{if $start.month == 6} active{/if}">{"June"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="7" class="dropdown-item{if $start.month == 7} active{/if}">{"July"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="8" class="dropdown-item{if $start.month == 8} active{/if}">{"August"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="9" class="dropdown-item{if $start.month == 9} active{/if}">{"September"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="10" class="dropdown-item{if $start.month == 10} active{/if}">{"October"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="11" class="dropdown-item{if $start.month == 11} active{/if}">{"November"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="12" class="dropdown-item{if $start.month == 12} active{/if}">{"December"|t}</a>\n\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t<div class="form-group row">\n\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-day-endday" class="col-sm-2 col-form-label">{"End"|t}</label>\n\t\t\t\t\t\t\t\t<div class="col-sm-10 input-group">\n\t\t\t\t\t\t\t\t\t<input type="number" class="form-control input-sm" min="1" max="31" step="1"\n\t\t\t\t\t\t\t\t\t\t   id="{$prefix|default:\'\'}yo-hours-date-range-input-day-endday" value="{$end.day|default:\'\'}">\n\t\t\t\t\t\t\t\t\t<div class="input-group-append month-dropdown">\n\t\t\t\t\t\t\t\t\t\t<button type="button" class="btn btn-outline-secondary btn-block dropdown-toggle"\n\t\t\t\t\t\t\t\t\t\t\t\tdata-toggle="dropdown" aria-haspopup="true" aria-expanded="false">\n\t\t\t\t\t\t\t\t\t\t\t{if $end.month}{$months[$end.month - 1]|default:{"January"|t}}{else}{"(not set)"|t}{/if}\n\t\t\t\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t\t\t\t\t<input type="hidden" id="{$prefix|default:\'\'}yo-hours-date-range-input-day-endmonth" value="{$end.month|default:0}">\n\t\t\t\t\t\t\t\t\t\t<div class="dropdown-menu dropdown-menu-right">\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="1" class="dropdown-item{if $end.month == 1} active{/if}">{"January"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="2" class="dropdown-item{if $end.month == 2} active{/if}">{"February"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="3" class="dropdown-item{if $end.month == 3} active{/if}">{"March"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="4" class="dropdown-item{if $end.month == 4} active{/if}">{"April"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="5" class="dropdown-item{if $end.month == 5} active{/if}">{"May"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="6" class="dropdown-item{if $end.month == 6} active{/if}">{"June"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="7" class="dropdown-item{if $end.month == 7} active{/if}">{"July"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="8" class="dropdown-item{if $end.month == 8} active{/if}">{"August"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="9" class="dropdown-item{if $end.month == 9} active{/if}">{"September"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="10" class="dropdown-item{if $end.month == 10} active{/if}">{"October"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="11" class="dropdown-item{if $end.month == 11} active{/if}">{"November"|t}</a>\n\t\t\t\t\t\t\t\t\t\t\t<a href="javascript:;" data-value="12" class="dropdown-item{if $end.month == 12} active{/if}">{"December"|t}</a>\n\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class="tab-pane{if $editMode && $type == \'holiday\'} active{/if}" role="tabpanel"\n\t\t\t\t\t\t\t id="{$prefix|default:\'\'}yo-hours-date-range-tab-holiday">\n\t\t\t\t\t\t\t{if !$editMode || $typicalWeek}\n\t\t\t\t\t\t\t\t<div class="form-check form-check-inline" id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-sh">\n\t\t\t\t\t\t\t\t\t<input type="radio" id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-sh-input" name="holiday-type"\n\t\t\t\t\t\t\t\t\t\t   class="form-check-input" value="SH"{if $start.holiday == "SH"} checked{/if}>\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-sh-input"\n\t\t\t\t\t\t\t\t\t\t   class="form-check-label">{"School holidays"|t}</label>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t\t{if !$editMode || !$typicalWeek}\n\t\t\t\t\t\t\t\t<div class="form-check form-check-inline" id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-ph">\n\t\t\t\t\t\t\t\t\t<input type="radio" id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-ph-input" name="holiday-type"\n\t\t\t\t\t\t\t\t\t\t   class="form-check-input" value="PH"{if $start.holiday == "PH"} checked{/if}>\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-ph-input"\n\t\t\t\t\t\t\t\t\t\t   class="form-check-label">{"Public holidays"|t}</label>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t<div class="form-check form-check-inline" id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-easter">\n\t\t\t\t\t\t\t\t\t<input type="radio" id="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-easter-input" name="holiday-type"\n\t\t\t\t\t\t\t\t\t\t   class="form-check-input" value="easter"{if $start.holiday == "easter"} checked{/if}>\n\t\t\t\t\t\t\t\t\t<label for="{$prefix|default:\'\'}yo-hours-date-range-input-holiday-easter-input"\n\t\t\t\t\t\t\t\t\t\t   class="form-check-label">{"Easter"|t}</label>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t{/if}\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="modal-footer">\n\t\t\t\t\t<button type="button" class="btn btn-secondary" data-dismiss="modal">{"Close"|t}</button>\n\t\t\t\t\t<button type="button" class="btn btn-primary">{"OK"|t}</button>\n\t\t\t\t</div>\n\t\t\t</form>\n\t\t</div>\n\t</div>\n</div>', //language=HTML
			rangeNav: '<ul class="nav nav-tabs" id="{$prefix|default:\'\'}yo-hours-range-nav" role="tablist">\n\t{foreach $dateRanges as $dateRange}\n\t\t{assign var="timeName" value=$dateRange->getInterval()->getTimeSelector()}\n\t\t<li role="presentation" class="rnav nav-item">\n\t\t\t<a href="javascript:;" role="tab" data-index="{$dateRange@index}"\n\t\t\t   class="nav-link{if $dateRange == $activeDateRange} active{/if}">{{$timeName|default:"All year"}|t}</a>\n\t\t</li>\n\t{/foreach}\n\n\t<li role="presentation" class="nav-item">\n\t\t<a href="javascript:;" role="button" class="nav-link add" title="{\'Add new date range\'|t}">\n\t\t\t<span aria-hidden="true">+</span>\n\t\t</a>\n\t</li>\n</ul>'
		}
	};

	/**
	 * Controllers
	 * @type {Object}
	 */
	YoHours.ctrl = {};

	/**
	 * Views
	 * @type {Object}
	 */
	YoHours.view = {};

	/**
	 *
	 * @param {YoHours.view.MainView} main
	 * @constructor
	 */
	YoHours.view.DateRangeView = function (main) {
		/** Is the modal shown to edit some date range ? True = edit, false = add */
		this._editMode = false;

		/** Date range type **/
		this._rangeType = null;

		/** The main view **/
		this._mainView = main;

		/**
		 * Modal
		 * @type {jQuery}
		 * @private
		 */
		this._modal = null;
	};
	/**
	 * Shows the modal
	 * @param {boolean} edit Edit mode ? (optional)
	 */
	YoHours.view.DateRangeView.prototype.show = function (edit) {
		this._editMode = edit || false;

		let self = this;
		let opts = this._mainView.getController().getOptions();
		let tpl = new jSmart(YoHours.templates[opts.bootstrapVersion].dateRangeModal);
		this._modal = $(tpl.fetch({
			prefix: opts.idPrefix,
			months: YoHours.IRL_MONTHS,
			editMode: this._editMode,
			typicalWeek: this._mainView.getCalendarView().getDateRange().definesTypicalWeek(),
			start: this._mainView.getCalendarView().getDateRange().getInterval().getStart() || {},
			end: this._mainView.getCalendarView().getDateRange().getInterval().getEnd() || {},
			type: this._mainView.getCalendarView().getDateRange().getInterval().getType()
		}));

		this._modal.on('hidden.bs.modal', function () {
			$(this).remove();
			self._modal = null;
		});
		this._modal.find('.modal-footer .btn-primary').on('click', function () {
			self.validate();
		});
		this._modal.find('a[role=tab]').on('shown.bs.tab', function () {
			self._rangeType = $(this).data('type');
		});
		this._modal.find('.month-dropdown .dropdown-menu a').on('click', function () {
			let $el = $(this), $monthDropdown = $el.closest('.month-dropdown'),
				$btn = $monthDropdown.find('[data-toggle="dropdown"]'),
				$input = $monthDropdown.find('input[type="hidden"]'),
				$dayInput = $monthDropdown.parent().find('> input[type="number"]');

			$input.val($el.data('value'));
			$monthDropdown.find('.dropdown-menu .active').removeClass('active');
			if (opts.bootstrapVersion === 'bootstrap4') {
				$el.addClass('active');
				$btn.html(YoHours.IRL_MONTHS[$el.data('value') - 1]);
			} else {
				$el.parent().addClass('active');
				$btn.html(YoHours.IRL_MONTHS[$el.data('value') - 1] + ' <span class="caret"></span>');
			}
			if ($dayInput.length) {
				$dayInput.prop('max', YoHours.MONTH_END_DAY[$el.data('value') - 1]);
			}
		});

		this._modal.appendTo('body').modal('show');
	};
	/**
	 * Form Validation function
	 */
	YoHours.view.DateRangeView.prototype.validate = function () {
		let wInterval, startVal, endVal, startVal2, endVal2;
		let opts = this._mainView.getController().getOptions();

		try {
			switch (this._rangeType) {
				case 'month':
					//Start
					startVal = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-month-start').val());
					if (isNaN(startVal)) {
						throw new Error(i18n.translate('Invalid start month').withContext('yohours/notifications').fetch());
					}

					//End
					endVal = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-month-end').val());
					if (!isNaN(endVal) && endVal > 0) {
						wInterval = new YoHours.WideInterval().month(startVal, endVal);
					} else {
						wInterval = new YoHours.WideInterval().month(startVal);
					}

					break;
				case 'week':
					//Start
					startVal = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-week-start').val());
					if (isNaN(startVal) || startVal < 1) {
						throw new Error(i18n.translate('Invalid start week').withContext('yohours/notifications').fetch());
					}

					//End
					endVal = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-week-end').val());
					if (!isNaN(endVal) && endVal > 0) {
						wInterval = new YoHours.WideInterval().week(startVal, endVal);
					} else {
						wInterval = new YoHours.WideInterval().week(startVal);
					}

					break;
				case 'day':
					//Start
					startVal = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-day-startday').val());
					if (isNaN(startVal) || startVal < 1) {
						throw new Error(i18n.translate('Invalid start day').withContext('yohours/notifications').fetch());
					}
					startVal2 = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-day-startmonth').val());
					if (isNaN(startVal2) || startVal2 < 1) {
						throw new Error(i18n.translate('Invalid start month').withContext('yohours/notifications').fetch());
					}

					//End
					endVal = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-day-endday').val());
					endVal2 = parseInt($('#' + opts.idPrefix + 'yo-hours-date-range-input-day-endmonth').val());
					if (!isNaN(endVal) && endVal > 0 && !isNaN(endVal2) && endVal2 > 0) {
						wInterval = new YoHours.WideInterval().day(startVal, startVal2, endVal, endVal2);
					} else if (this._editMode && this._mainView.getCalendarView().getDateRange().definesTypicalWeek()) {
						throw new Error(i18n.translate('Missing end day').withContext('yohours/notifications').fetch());
					} else {
						wInterval = new YoHours.WideInterval().day(startVal, startVal2);
					}

					break;
				case 'holiday':
					startVal = $('input[name="holiday-type"]:checked', this._modal).val();
					if (startVal !== 'PH' && startVal !== 'SH' && startVal !== 'easter') {
						throw new Error(i18n.translate('Invalid holiday type').withContext('yohours/notifications').fetch());
					}
					wInterval = new YoHours.WideInterval().holiday(startVal);

					break;

				case 'always':
				default:
					wInterval = new YoHours.WideInterval().always();
			}

			//Check if not overlapping another date range
			let ranges = this._mainView.getController().getDateRanges();
			let l = ranges.length, i = 0;
			let generalRange = -1; //Wider date range which can be copied if needed

			while (i < l) {
				if (ranges[i] !== undefined && ranges[i].getInterval().equals(wInterval)) {
					throw new Error(i18n.translate('This time range is identical to another one').withContext('yohours/notifications').fetch());
				} else {
					if (ranges[i] !== undefined && ranges[i].isGeneralFor(new YoHours.DateRange(wInterval))) {
						generalRange = i;
					}
					i++;
				}
			}

			//Edit currently shown calendar
			if (this._editMode) {
				this._mainView.getCalendarView().getDateRange().updateRange(wInterval);
				this._mainView.getCalendarView().show(this._mainView.getCalendarView().getDateRange());
				this._mainView.refresh();
			} else {
				//Copy wider date range intervals
//				if ($('#range-copy-box').is(':checked') && generalRange >= 0) {
//					this._mainView.getCalendarView().show(this._mainView.getController().newRange(wInterval, ranges[generalRange].getTypical().getIntervals()));
//				} else {
				this._mainView.getCalendarView().show(this._mainView.getController().newRange(wInterval));
//				}
			}
			if (this._modal) {
				this._modal.modal('hide');
			}
		} catch (e) {
			window.alert(e);
			console.error(e);
		}
	};

	/**
	 * The calendar view, with its navigation bar
	 * @param {YoHours.view.MainView} main
	 * @constructor
	 */
	YoHours.view.CalendarView = function (main) {
		/** The main view **/
		this._mainView = main;

		/** Calendar */
		this._calendar= null;

		/** The currently shown date range **/
		this._dateRange = null;
	};
	/**
	 * @return The currently shown date range
	 */
	YoHours.view.CalendarView.prototype.getDateRange = function () {
		return this._dateRange;
	};
	/**
	 * Updates the date range navigation bar
	 */
	YoHours.view.CalendarView.prototype.updateRangeNavigationBar = function () {
		let opts = this._mainView.getController().getOptions();
		let tpl = new jSmart(YoHours.templates[opts.bootstrapVersion].rangeNav);
		let newNav = $(tpl.fetch({
			prefix: opts.idPrefix,
			dateRanges: this._mainView.getController().getDateRanges(),
			activeDateRange: this._dateRange
		}));
		let self = this;

		newNav.find('.rnav > a').on('click', function () {
			self.show(self._mainView.getController().getDateRanges()[parseInt($(this).data('index'))]);
			if (opts.bootstrapVersion === 'bootstrap4') {
				newNav.find('.rnav > a').removeClass('active');
				$(this).addClass('active');
			} else {
				newNav.find('.rnav').removeClass('active');
				$(this).parent().addClass('active');
			}
		});
		newNav.find('a.add').on('click', function () {
			self._mainView.getDateRangeView().show(false);
		});

		$('#' + opts.idPrefix + 'yo-hours-range-nav').replaceWith(newNav);
	};
	/**
	 * Updates the label showing the human readable date range
	 */
	YoHours.view.CalendarView.prototype.updateDateRangeLabel = function () {
		let opts = this._mainView.getController().getOptions();
		$('#' + opts.idPrefix + 'yo-hours-range-text-label').html(this._dateRange.getInterval().getTimeForHumans());
	};
	/**
	 * Displays the given typical week or day
	 * @param {YoHours.DateRange} dateRange
	 */
	YoHours.view.CalendarView.prototype.show = function (dateRange) {
		let i;
		let opts = this._mainView.getController().getOptions();
		let $calendar = $('#' + opts.idPrefix + 'yo-hours-calendar');

		if (this._calendar) {
			this._calendar.destroy();
		}

		this._dateRange = dateRange;

		let intervals = this._dateRange.getTypical().getIntervals();
		let events = [];
		let interval, eventData, to, eventConstraint, defaultView, colFormat;
		let fctSelect, fctEdit;
		let self = this;

		/*
		 * Variables depending of the kind of typical day/week
		 */
		if (this._dateRange.definesTypicalWeek()) {
			//Create intervals array
			for (i = 0; i < intervals.length; i++) {
				interval = intervals[i];

				if (interval !== undefined) {
					//Single minute event
					if (interval.getStartDay() === interval.getEndDay() && interval.getFrom() === interval.getTo()) {
						to = moment().startOf('isoweek').day(1).hour(0).minute(0).second(0).milliseconds(0).add(interval.getEndDay(), 'days').add(interval.getTo() + 1, 'minutes');
					} else {
						to = moment().startOf('isoweek').day(1).hour(0).minute(0).second(0).milliseconds(0).add(interval.getEndDay(), 'days').add(interval.getTo(), 'minutes');
					}

					//Add event on calendar
					eventData = {
						id: i,
						start: moment().startOf('isoweek').day(1).hour(0).minute(0).second(0).milliseconds(0).add(interval.getStartDay(), 'days').add(interval.getFrom(), 'minutes').toDate(),
						end: to.toDate()
					};
					events.push(eventData);
				}
			}

			eventConstraint = {
				start: moment().startOf('isoweek').day(1).format('YYYY-MM-DD[T00:00:00]'),
				end: moment().startOf('isoweek').day(1).add(7, 'days').format('YYYY-MM-DD[T00:00:00]')
			};
			defaultView = 'timeGridWeek';
			colFormat = (this._mainView.isMinimal()) ? {weekday: 'short'} : {weekday: 'long'};
			fctSelect = function (info) {
				let start = moment(info.start);
				let end = moment(info.end);

				//Add event to week intervals
				let minStart = parseInt(start.format('H'), 10) * 60 + parseInt(start.format('m'), 10);
				let minEnd = parseInt(end.format('H'), 10) * 60 + parseInt(end.format('m'), 10);
				let dayStart = swDayToMwDay(start.format('d'));
				let dayEnd = swDayToMwDay(end.format('d'));

				//All day interval
				if (minStart === 0 && minEnd === 0 && dayEnd - dayStart >= 1) {
					minEnd = YoHours.MINUTES_MAX;
					dayEnd--;
				}

				let weekId = self._dateRange.getTypical().addInterval(new YoHours.Interval(dayStart, dayEnd, minStart, minEnd));

				//Add event on calendar
				eventData = {
					id: weekId, start: start.toDate(), end: end.toDate()
				};
				self._calendar.addEvent(eventData);

				self._mainView.refresh();

				//Simulate click event to display resizer
				self.simulateClick();
			};

			fctEdit = function (info) {
				let event = info.event;
				let start = moment(event.start);
				let end = moment(event.end);

				let minStart = parseInt(start.format('H'), 10) * 60 + parseInt(start.format('m'), 10);
				let minEnd = parseInt(end.format('H'), 10) * 60 + parseInt(end.format('m'), 10);
				let dayStart = swDayToMwDay(start.format('d'));
				let dayEnd = swDayToMwDay(end.format('d'));

				//All day interval
				if (minStart === 0 && minEnd === 0 && dayEnd - dayStart >= 1) {
					minEnd = YoHours.MINUTES_MAX;
					dayEnd--;
				}

				self._dateRange.getTypical().editInterval(event.id, new YoHours.Interval(dayStart, dayEnd, minStart, minEnd));
				self._mainView.refresh();
			};
		} else {
			//Create intervals array
			for (i = 0; i < intervals.length; i++) {
				interval = intervals[i];

				if (interval !== undefined) {
					//Single minute event
					if (interval.getFrom() === interval.getTo()) {
						to = moment().hour(0).minute(0).second(0).milliseconds(0).add(interval.getTo() + 1, 'minutes');
					} else {
						to = moment().hour(0).minute(0).second(0).milliseconds(0).add(interval.getTo(), 'minutes');
					}

					//Add event on calendar
					eventData = {
						id: i,
						start: moment().hour(0).minute(0).second(0).milliseconds(0).add(interval.getFrom(), 'minutes').toDate(),
						end: to.toDate()
					};
					events.push(eventData);
				}
			}

			eventConstraint = {
				start: moment().format('YYYY-MM-DD[T00:00:00]'),
				end: moment().add(1, 'days').format('YYYY-MM-DD[T00:00:00]')
			};
			defaultView = 'timeGridWeek';
			colFormat = {day: 'numeric', month: 'long', year: 'numeric'};
			fctSelect = function (info) {
				let start = moment(info.start);
				let end = moment(info.end);

				//Add event to week intervals
				let minStart = parseInt(start.format('H', 10)) * 60 + parseInt(start.format('m'), 10);
				let minEnd = parseInt(end.format('H'), 10) * 60 + parseInt(end.format('m'), 10);
				let weekId = self._dateRange.getTypical().addInterval(new YoHours.Interval(0, 0, minStart, minEnd));

				//Add event on calendar
				eventData = {
					id: weekId, start: start.toDate(), end: end.toDate()
				};
				self._calendar.addEvent(eventData);

				self._mainView.refresh();

				//Simulate click event to display resizer
				self.simulateClick();
			};

			fctEdit = function (info) {
				let event = info.event;
				let start = moment(event.start);
				let end = moment(event.end);
				let minStart = parseInt(start.format('H'), 10) * 60 + parseInt(start.format('m'), 10);
				let minEnd = parseInt(end.format('H'), 10) * 60 + parseInt(end.format('m'), 10);
				self._dateRange.getTypical().editInterval(event.id, new YoHours.Interval(0, 0, minStart, minEnd));
				self._mainView.refresh();
			};
		}

		//Create calendar
		//*
		this._calendar = new FullCalendar.Calendar($calendar.get(0), {
			plugins: ['timeGrid', 'interaction'],
			header: {
				left: '', center: '', right: ''
			},
			locale: opts.locale,
			defaultView: defaultView,
			editable: true,
			height: opts.height,
			columnHeaderFormat: colFormat,
			eventTimeFormat: {
				hour: '2-digit',
				minute: '2-digit'
			},
			allDayText: '24/24',
			allDaySlot: false,
			slotDuration: '00:15:00',
			slotLabelFormat: {
				hour: '2-digit',
				minute: '2-digit'
			},
			scrollTime: '06:00:00',
			firstDay: 1,
			eventOverlap: false,
			events: events,
			eventConstraint: eventConstraint,
			selectable: true,
			selectMirror: true,
			selectOverlap: false,
			select: fctSelect,
			eventClick: function (info) {
				self._dateRange.getTypical().removeInterval(info.event.id);
				info.event.remove();
				self._mainView.refresh();
			},
			eventResize: fctEdit,
			eventDrop: fctEdit
		});

		this._calendar.render();
		this._calendar.rerenderEvents();

		this.updateDateRangeLabel();
		this.updateRangeNavigationBar();
	};
	/**
	 * Simulates a mouse click over the calendar
	 */
	YoHours.view.CalendarView.prototype.simulateClick = function () {
		let opts = this._mainView.getController().getOptions();
		let $calendar = $('#' + opts.idPrefix + 'yo-hours-calendar');
		let offset = $calendar.offset();
		let event = $.Event('mousedown', {
			which: 1, pageX: offset.left, pageY: offset.top
		});
		$calendar.trigger(event);
	};
	/**
	 * Initialize view
	 */
	YoHours.view.CalendarView.prototype.init = function () {
		let self = this;
		let opts = this._mainView.getController().getOptions();

		$('#' + opts.idPrefix + 'yo-hours-range-edit').on('click', function () {
			self._mainView.getDateRangeView().show(true);
		});
		$('#' + opts.idPrefix + 'yo-hours-range-delete').on('click', function () {
			self._mainView.getController().deleteCurrentRange();
			self.show(self._mainView.getController().getFirstDateRange());
		});
	};

	/**
	 * The opening hours text input field
	 * @param {YoHours.view.MainView} main
	 * @param {Element|jQuery} field
	 * @constructor
	 */
	YoHours.view.HoursInputView = function (main, field) {
		/** The main view **/
		this._mainView = main;

		/** The input field **/
		this._field = $(field);

		/** The timer **/
		this._timer = null;

		let self = this;
		let opts = this._mainView.getController().getOptions();

		this._field.on('input propertychange', function () {
			window.clearTimeout(self._timer);
			self._timer = window.setTimeout(self.changedHandler.call(self), opts.delay);
		}).on('keydown', function (e) {
			if (e.keyCode === 13) {
				e.preventDefault();
				window.clearTimeout(self._timer);
				self.changedHandler();
			}
		});
	};
	/**
	 * @return {string} The opening_hours value
	 */
	YoHours.view.HoursInputView.prototype.getValue = function () {
		return this._field.val();
	};
	/**
	 * Changes the input value
	 * @param {int|number|string} val
	 */
	YoHours.view.HoursInputView.prototype.setValue = function (val) {
		this._field.val(val);
	};
	/**
	 * Sets if the contained value is correct or not
	 * @param {boolean} valid
	 */
	YoHours.view.HoursInputView.prototype.setValid = function (valid) {
		let opts = this._mainView.getController().getOptions();
		if (opts.bootstrapVersion === 'bootstrap4') {
			this._field.addClass(valid ? 'is-valid' : 'is-invalid').removeClass(valid ? 'is-invalid' : 'is-valid');
		} else {
			this._field.closest('.form-group').addClass(valid ? 'has-success' : 'has-error').removeClass(valid ? 'has-error' : 'has-success');
		}
	};
	/**
	 * Called when input value changed to check it, and update calendar
	 */
	YoHours.view.HoursInputView.prototype.changedHandler = function () {
		let caretPos = this._field.caret();
		this._field.val(this._field.val().replace(/â£/gi, ' '));
		this._mainView.getController().showHours(this._field.val());
		this._field.caret(caretPos);
	};
	/**
	 * Initialize HoursInputView
	 */
	YoHours.view.HoursInputView.prototype.init = function () {
		let self = this;
		let opts = this._mainView.getController().getOptions();
		let tpl = new jSmart(YoHours.templates[opts.bootstrapVersion].inputGroup);
		let $parent = this._field.parent();
		let $tpl = $(tpl.fetch({
			prefix: opts.idPrefix,
			iconClock: YoHours.templates.iconClock,
			iconPencil: YoHours.templates.iconPencil,
			iconTrash: YoHours.templates.iconTrash
		}));
		$tpl.find('#toReplace').replaceWith(this._field);
		$tpl.find('.btn[data-toggle="collapse"]').each(function () {
			$(document).on('shown.bs.collapse', $(this).data('target'), function () {
				let $calendar = $('#' + opts.idPrefix + 'yo-hours-calendar');
				self._mainView.getCalendarView()._calendar.render();
				self._mainView.getCalendarView()._calendar.rerenderEvents();
			});
		});
		$parent.append($tpl);
	};

	/**
	 * MainView, view class for the main page
	 * @param {YoHours.ctrl.MainController} ctrl
	 * @param {Element|jQuery} field
	 * @constructor
	 */
	YoHours.view.MainView = function (ctrl, field) {
		/** The application controller **/
		this._ctrl = ctrl;

		let opts = this._ctrl.getOptions();

		/** The week view **/
		this._calendarView = new YoHours.view.CalendarView(this);

		/** The hours input view **/
		this._hoursInputView = new YoHours.view.HoursInputView(this, field);

		/** The date range modal **/
		this._dateRangeView = new YoHours.view.DateRangeView(this);

		/** Is the view in minimal mode ? **/
		this._minimal = opts.minimal;
	};
	/**
	 * Returns the hours input view
	 * @return {YoHours.view.HoursInputView}
	 */
	YoHours.view.MainView.prototype.getHoursInputView = function () {
		return this._hoursInputView;
	};
	/**
	 * Returns the date range view
	 * @return {YoHours.view.DateRangeView}
	 */
	YoHours.view.MainView.prototype.getDateRangeView = function () {
		return this._dateRangeView;
	};
	/**
	 * Returns the calendar view
	 * @return {YoHours.view.CalendarView}
	 */
	YoHours.view.MainView.prototype.getCalendarView = function () {
		return this._calendarView;
	};
	/**
	 * The controller
	 * @return {YoHours.ctrl.MainController}
	 */
	YoHours.view.MainView.prototype.getController = function () {
		return this._ctrl;
	};
	/**
	 * Minimal mode ?
	 * @return {boolean}
	 */
	YoHours.view.MainView.prototype.isMinimal = function () {
		return this._minimal;
	};
	/**
	 * Initializes the view
	 */
	YoHours.view.MainView.prototype.init = function () {
		this._hoursInputView.init();
		let opts = this.getController().getOptions();

		let inputVal = this._hoursInputView.getValue();
		if (inputVal !== undefined && inputVal.trim() !== '') {
			this._ctrl.showHours(inputVal);
		} else {
			this._calendarView.show(this._ctrl.getFirstDateRange());
		}

		this._calendarView.init();
		$('#' + opts.idPrefix + 'yo-hours-collapse').removeClass('show in');
	};
	/**
	 * Refreshes the view
	 */
	YoHours.view.MainView.prototype.refresh = function () {
		this._hoursInputView.setValue(this._ctrl.getOpeningHours());
	};
	/**
	 * The main controller of YoHours
	 * @param {jQuery|Element} field
	 * @param {{}|void} options
	 * @constructor
	 */
	YoHours.ctrl.MainController = function (field, options) {
		/**
		 * @type {Object}
		 * @private
		 */
		this._options = $.extend({}, YoHours.options, options);

		/** Main view object **/
		this._view = new YoHours.view.MainView(this, field);

		/** All the wide intervals defined **/
		this._dateRanges = [new YoHours.DateRange()];

		/** The opening hours builder **/
		this._builder = new YoHours.OpeningHoursBuilder();

		/** The opening hours parser **/
		this._parser = new YoHours.OpeningHoursParser();
	};
	/**
	 * @return {string} The opening_hours value
	 */
	YoHours.ctrl.MainController.prototype.getOpeningHours = function () {
		return this._builder.build(this._dateRanges);
	};
	/**
	 * @return {Object} The options
	 */
	YoHours.ctrl.MainController.prototype.getOptions = function () {
		return this._options;
	};
	/**
	 * @return {YoHours.view.MainView} The main view
	 */
	YoHours.ctrl.MainController.prototype.getView = function () {
		return this._view;
	};
	/**
	 * @return {YoHours.DateRange[]} The date ranges array, some may be undefined
	 */
	YoHours.ctrl.MainController.prototype.getDateRanges = function () {
		return this._dateRanges;
	};
	/**
	 * @return {YoHours.DateRange} The first defined date range
	 */
	YoHours.ctrl.MainController.prototype.getFirstDateRange = function () {
		let i = 0, found = false;
		while (i < this._dateRanges.length && !found) {
			if (this._dateRanges[i] !== undefined) {
				found = true;
			} else {
				i++;
			}
		}

		//If no date range found, create a new one
		if (!found) {
			this._dateRanges = [new YoHours.DateRange()];
			i = 0;
		}

		return this._dateRanges[i];
	};
	/**
	 * Initializes the controller
	 */
	YoHours.ctrl.MainController.prototype.init = function () {
		this._view.init();
	};
	/**
	 * Clear all defined data
	 */
	YoHours.ctrl.MainController.prototype.clear = function () {
		this._dateRanges = [new YoHours.DateRange()];
		this._view.getCalendarView().show(this._dateRanges[0]);
		this._view.refresh();
	};
	/**
	 * Adds a new date range
	 * @param {YoHours.WideInterval} wInterval
	 * @param {YoHours.Interval[]|null} copyIntervals The intervals to copy (or null if create new void range)
	 * @return {YoHours.DateRange} The created range
	 */
	YoHours.ctrl.MainController.prototype.newRange = function (wInterval, copyIntervals) {
		copyIntervals = copyIntervals || null;
		let range = new YoHours.DateRange(wInterval);

		if (copyIntervals !== null) {
			range.getTypical().copyIntervals(copyIntervals);
		}

		this._dateRanges.push(range);
		this._view.refresh();
		return range;
	};
	/**
	 * Deletes the currently shown date range
	 */
	YoHours.ctrl.MainController.prototype.deleteCurrentRange = function () {
		let range = this._view.getCalendarView().getDateRange();
		let l = this._dateRanges.length, i = 0;

		while (i < l) {
			if (this._dateRanges[i] === range) {
				this._dateRanges.splice(i, 1);
				break;
			} else {
				i++;
			}
		}

		//Refresh calendar
		this._view.getCalendarView().show(this.getFirstDateRange());
		this._view.refresh();
	};
	/**
	 * Displays the given opening hours
	 * @param {string} str The opening hours to show
	 */
	YoHours.ctrl.MainController.prototype.showHours = function (str) {
		let opts = this.getOptions();
		let calendar = this.getView().getCalendarView()._calendar;
		if (str.length > 0) {
			//Clear intervals
			this._week = new YoHours.Week();

			if (calendar) {
				let events = calendar.getEvents();
				calendar.batchRendering(function () {
					$.each(events, function () {
						this.remove();
					});
				});
			}

			//Parse given string
			try {
				this._dateRanges = this._parser.parse(str.trim());
				this._view.getCalendarView().show(this._dateRanges[0]);
				this._view.getHoursInputView().setValid(true);
			} catch (e) {
				console.error(e);

				//Show error
				/*
				let ohTest;
				try {
					new opening_hours(str.trim(), null);
					ohTest = true;
				} catch (e2) {
					console.error(e2);
					ohTest = false;
				}
				//*/
				this._view.getHoursInputView().setValid(false);
			}

			this._view.getHoursInputView().setValue(str);
		}
	};

	$.fn.yoHours = function (options, templates) {
		this.each(function () {
			let controller = $(this).data('yoHours');
			if (typeof options === 'string' && controller) {
				if (typeof controller[options] === 'function') {
					if (templates && $.isArray(templates)) {
						controller[options].apply(this, templates);
					} else {
						controller[options]();
					}
				} else {
					console.error(options + ' is not a valid method!');
				}
			} else {
				let opts = $.extend({idPrefix: 'yh' + (++YoHours.counter) + '_'}, YoHours.options, options);
				let locale = opts.locale;
				moment.locale(locale);

				if (templates && (typeof templates === 'object')) {
					YoHours.templates = $.extend({}, YoHours.templates, templates);
				}

				if (i18n === undefined) {
					if (YoHours.locale && YoHours.locale[locale]) {
						i18n = new Jed({
							domain: 'messages', locale_data: YoHours.locale[locale]
						});
					}
				}

				controller = new YoHours.ctrl.MainController(this, opts);
				controller.init();
				$(this).data('yoHours', controller);
			}
		});

		return this;
	};
})(window, jQuery, moment, YoHours, jSmart, Jed);