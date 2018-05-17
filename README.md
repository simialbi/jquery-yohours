# jquery-yohours

![YoHours logo](src/img/logo.svg)

## READ ME

jquery-yohours is a jquery plugin which transforms an input to an calendar 
widget to create opening hours in the famous 
[opening_hours](https://wiki.openstreetmap.org/wiki/Key:opening_hours) syntax.

It's based on [Adrien Pavie](https://github.com/PanierAvide)'s
[YoHours Application](http://projets.pavie.info/yohours/)

A live demo is available at [projets.pavie.info/yohours](http://projets.pavie.info/yohours/).

[![Help making this possible](https://liberapay.com/assets/widgets/donate.svg)](https://liberapay.com/PanierAvide/donate)

## Usage

YoHours is simple to use. These are the basic actions you can do:

* Add an interval: drag with your mouse over the calendar
* Remove an interval: click on it
* Extend an interval: drag the "=" sign on intervals extremities

### Seasons

YoHours is now able to handle opening hours which depends of seasons. 
You can define hours for specific days, weeks, months or holidays. To do so, 
start by defining the common opening hours ("All year" tab), then refine by 
adding a new season (the green "+" tab) and set the opening hours on the new 
calendar. You can add as many seasons as you want. You can also edit or remove 
a season by clicking on the pencil and trash buttons, between seasons tabs 
and calendar.


### Supported opening_hours values

YoHours supports only a subset of the opening_hours syntax. Here are some 
examples of supported values:

* Basic hours: `08:00-18:00` or `08:00-12:00,14:00-18:00` or `10:00`
* Weekday selectors: `Mo-Fr,Su 09:00-17:00; Sa 10:00-19:00`
* Week selectors: `week 01-05: Mo,Tu 08:00-10:00; week 06-10: Mo,Tu 10:00-12:00`
* Month selectors: `Jan-Apr: We 10:00-15:00`
* Monthday selectors: `Jan 25-30,Feb 28-Apr 15: Tu 11:00-17:00`
* Holidays selectors: `PH 21:00-23:00` or `SH Mo,Tu 06:00-09:00` or `easter off`...
* Always open: `24/7`
* Any combination of the previous examples separated by semi-colons


### Unsupported opening_hours values

The elements which are present in the [opening_hours formal specification](https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification) and not listed before aren't supported. You can contact me to discuss the integration of some new elements if needed.

### Use on your site

#### Requirements
* [jquery](https://jquery.com)
* [bootstrap 3 | 4](https://getbootstrap.com)
* [moment.js](https://momentjs.com)
* [fullcalendar](https://fullcalendar.io)
* [jSmart](https://github.com/umakantp/jsmart)

#### Installation

TODO



## License


Copyright 2015 Adrien PAVIE

See [LICENSE](LICENSE) for complete AGPL3 license.

YoHours is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

YoHours is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with YoHours. If not, see <http://www.gnu.org/licenses/>.