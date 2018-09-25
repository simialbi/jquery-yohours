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

##### Using Bower
You can use the `bower` package manager to install. Run:

    bower install jquery-yohours

##### Using npm
You can use the `npm` package manager to install. Run:

    npm install jquery-yohours

##### Manual

Download the source [ZIP](https://github.com/simialbi/jquery-yohours/zipball/master)
or [TAR](https://github.com/simialbi/jquery-yohours/tarball/master) and extract the
plugin assets into your project (dist folder contents).

#### Load assets

Load the following in your header:

```html
<!-- bootstrap 3 and 4 are supported -->
<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css" integrity="sha384-WskhaSGFgHYWDcbwN70/dfYBj47jz9qbsMId/iRN3ewGhXQFZCSftd1LZCfmhktB" crossorigin="anonymous">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/fullcalendar/3.9.0/fullcalendar.min.css" crossorigin="anonymous">
<link rel="stylesheet" href="path/to/dist/css/yohours.css">

<script src="https://code.jquery.com/jquery-3.3.1.min.js" integrity="sha256-FgpCb/KJQlLNfOu91ta32o/NMZxltwRo8QtmkMRdAu8=" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/caret/1.0.0/jquery.caret.min.js" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.1/moment-with-locales.min.js" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js" integrity="sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49" crossorigin="anonymous"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/js/bootstrap.min.js" integrity="sha384-smHYKdLADwkXOn1EmN1qk/HfnUcbVRZyYmZ4qpPea6sjB/pTJ0euyQp0Mk8ck+5T" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/fullcalendar/3.9.0/fullcalendar.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/jsmart/dist/jsmart.min.js" crossorigin="anonymous"></script>
<script src="path/to/dist/js/jed.min.js"></script>
<!-- Optional: Load i18n translation -->
<script src="path/to/dist/js/i18n/en.min.js"></script>
<script src="path/to/dist/js/yohours.min.js"></script>
```

> Note: All dependencies required by `yohours` are included in the example above.

#### Init Widget

````html
<div class="form-group">
	<label for="myOpeningHours">Opening Hours</label>
	<input type="text" id="myOpeningHours" class="form-control">
</div>

<script>
	$('#myOpeningHours').yoHours({
		bootstrapVersion: 'bootstrap3', // or bootstrap4
		delay: 700, // in ms, delay before plugin starts parsing input string
		height: 600, // in pixels, max height of calendar
		locale: 'en' // must be loaded before yohours like in example above
	}, {  // template overrides (see YoHours.templates)
		iconClock: '<i class="fas fa-clock"></i>',
		iconPencil: '<i class="fas fa-pencil-alt"></i>',
		iconTrash: '<i class="fas fa-trash-alt"></i>',
		bootstrap3: {
			inputGroup: '<div class="input-group">\n\t<input type="text" class="form-control" id="toReplace">\n\t<span class="input-group-btn">\n\t\t<button class="btn btn-default" type="button" role="button" data-toggle="collapse" data-target="#{$prefix|default:\'\'}yo-hours-collapse"\n\t\t\t\taria-expanded="false" aria-controls="{$prefix|default:\'\'}yo-hours-collapse">\n\t\t\t{$icon}\n\t\t</button>\n\t</span>\n</div>\n<div id="{$prefix|default:\'\'}yo-hours-collapse" class="yo-hours-collapse collapse in">\n\t<div id="{$prefix|default:\'\'}yo-hours-range-nav"></div>\n\t\n\t<div class="tab-content">\n\t\t<div class="tab-pane active">\n\t\t\t<nav class="navbar navbar-default">\n\t\t\t\t<div class="navbar-header">\n\t\t\t\t\t<button type="button" class="navbar-toggle collapsed" data-toggle="collapse"\n\t\t\t\t\t\t\tdata-target="#{$prefix|default:\'\'}yo-hours-nav" aria-expanded="false"\n\t\t\t\t\t\t\taria-controls="{$prefix|default:\'\'}yo-hours-nav">\n\t\t\t\t\t\t<span class="sr-only">{"Toggle navigation"|t}</span>\n\t\t\t\t\t\t<span class="icon-bar"></span>\n\t\t\t\t\t\t<span class="icon-bar"></span>\n\t\t\t\t\t\t<span class="icon-bar"></span>\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t\t<div class="collapse navbar-collapse" id="{$prefix|default:\'\'}yo-hours-nav">\n\t\t\t\t\t<p class="navbar-text">{"Calendar defining"|t} <span id="{$prefix|default:\'\'}yo-hours-range-text-label"></span></p>\n\t\t\t\t\t<button id="{$prefix|default:\'\'}yo-hours-range-edit" class="btn btn-default navbar-btn navbar-right" type="button">\n\t\t\t\t\t\t&#x1F589;\n\t\t\t\t\t</button>\n\t\t\t\t\t<button id="{$prefix|default:\'\'}yo-hours-range-delete" class="btn btn-danger navbar-btn navbar-right" type="button">\n\t\t\t\t\t\t&#x1F5D1;\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t</nav>\n\t\t\t<div id="{$prefix|default:\'\'}yo-hours-calendar" class="yo-hours-calendar"></div>\n\t\t</div>\n\t</div>\n</div>'
		}
	});
</script>
````


## License


Copyright 2015 Adrien PAVIE, 2018 Simon Karlen

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