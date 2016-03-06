// require packages
var request = require('request');
var fs = require("fs");
var Random = require("random-js");
var r = new Random();
var Twit = require('twit')
 var T = new Twit({
    consumer_key:         "..."
  , consumer_secret:      "..."
  , access_token:         "..."
  , access_token_secret:  "..."
})

// run every ten minutes
var timer = setInterval (function () {checkTimetable()}, 600000);

function checkTimetable() {
	// access JSON files
	var stations = JSON.parse(fs.readFileSync('melbourne_train_stations.json'));
	var lines = JSON.parse(fs.readFileSync('melb_train_lines.json'));
	var trams = JSON.parse(fs.readFileSync('tram_routes.json'));
	var adjNouns = JSON.parse(fs.readFileSync('adj_nouns.json'));
	var trainSpills = JSON.parse(fs.readFileSync('train_spills.json'));

	// we want to trigger the bot twice around 7:35 and 8:05 Melbourne time, then again around 17:15 and 17:50
	// from April to September we are UTC + 10, from October to March we are UTC + 11
	// each year the daylight savings start and end dates changes slightly so a couple of weeks a year it will be slightly out.
	var timeNow = new Date();
	var nowHours = timeNow.getUTCHours();
	var nowMinutes = timeNow.getUTCMinutes();

	// find out if we're on summer time (+11) or standard time (+10)
	// we simply do this by finding what month we're in 
	// we'll be out by a day in the morning because UTC is half a day behind us
	// the server is in Toronto so using getMonth() doesn't really resolve that problem

	function summerTime(){
		if ( timeNow.getUTCMonth() >= 9 || timeNow.getUTCMonth() < 3) {
			return true
		}
	}

	// summer time triggers
	// morning
	if (nowHours === 20 && summerTime()) {
		if (nowMinutes > 29 && nowMinutes < 40) {
			announcement();
		}
	}

	if (nowHours === 21 && summerTime()) {
		if (nowMinutes > 0 && nowMinutes < 11) {
			announcement();
		}
	}

	// evening
	if (nowHours === 6 && summerTime()) {
		if (nowMinutes > 9 && nowMinutes < 20)  {
			announcement();
		}
	}

	if (nowHours === 7 && summerTime()) {
		if (nowMinutes > 0 && nowMinutes < 11) {
			announcement();
		}
	}

	// standard time triggers
	// morning
	if (nowHours === 21 && !summerTime()) {
		if (nowMinutes > 29 && nowMinutes < 40) {
			announcement();
		}
	}

	if (nowHours === 22 && !summerTime()) {
		if (nowMinutes > 0 && nowMinutes < 11) {
			announcement();
		}
	}

	// evening
	if (nowHours === 7 && !summerTime()) {
		if (nowMinutes > 9 && nowMinutes < 20)  {
			announcement();
		}
	}

	if (nowHours === 8 && !summerTime()) {
		if (nowMinutes > 0 && nowMinutes < 11) {
			announcement();
		}
	}

	// ****************************************
	// ************ RUN THE BOT!** ************
	// ****************************************

	function announcement() {

		// ****************************************
		// ********** SET UP VARIABLES ************
		// ****************************************

		// pick a random adjective
		var totalAdj = adjNouns.adj.length;
		var randAdj = r.integer(1,totalAdj);
		var rAdj = totalAdj - randAdj;
		//pick a random noun
		var totalNouns = adjNouns.noun.length;
		var randNoun = r.integer(1,totalNouns);
		var rNoun = totalNouns - randNoun;
		// select level of incident
		var rLevel = r.integer(0,8)
		var levelArray = ["Severe","Minor","Serious","Mild","Temporary","Major","Unfortunate","Regretable","Embarrassing","So-So","Usual","Typical","Unforseen","Average","Annual"]
		var level = levelArray[rLevel];
		// select type of incident
		var rType = r.integer(0,10)
		var typeArray = ["delays","incident","disruption","collision","short-shunting","cancellation","stoppage","derailment","re-routing","cock-up","bus replacement","runaround","incompetence","slowness","early-running",""]
		var type = typeArray[rType];

		// ****************************************
		// ************** WEATHER *****************
		// ****************************************

		function checkWeather() {
		request('http://api.openweathermap.org/data/2.5/weather?id=7839805&units=metric&APPID=68e13e0b2a4a24061470fbe854ff1aba', function (error, response, body) {
		  if (!error && response.statusCode == 200) {
		    var weather = JSON.parse(body);
		    var weatherTemp = weather.main.temp;
		    var weatherCloud = weather.clouds.all;
		    var weatherWind = weather.wind.speed;
			var theWeather = [];
		    if (weather.rain) {
		    var weatherRain = weather.rain['1h'];	
			} else { 
				weatherRain = 0;
			}

			// check for any extreme weather
			// if there is any, push a phrase to theWeather array
			// we do it like this because we only want one message, but if it is cloudy AND raining for example we have to choose one of them.
		    if (weatherTemp > 30) {
		    	theWeather.push('inducing heat')
		    }
		    if (weatherCloud > 50) {
		    	theWeather.push('shaped clouds')
		    }
		    if (weatherRain > 6) {
		    	theWeather.push('flavoured rain')
		    }
		    if (weatherRain > 1 && weatherRain < 3) {
		    	theWeather.push('related dampness')
		    }
		    if (weatherWind > 11) {
		    	theWeather.push('scented wind')
		    } 

		    if  (theWeather.length > 0) {
		    	// if there's weather, randomly choose a phrase to use in the weatherMessage
		    	var totalWeather = theWeather.length;
		    	var rWeather = r.integer(1, totalWeather);
		    	var wChoice = totalWeather - rWeather;
		    	weatherMessage(theWeather[wChoice]);
		    } else {
		    	// if there's no weather, just use the trainDelay message.
		    	 trainDelay()
		    }
		  }
		});
	}

		function weatherMessage(weather) {

			var lineNum = r.integer(0,18);
			var line = lines.lines[lineNum];
			var lineLength = stations[line].length;
			var sNum = r.integer(1, lineLength);
			var stop = lineLength - sNum;
			var location = stations[line][stop];
			var tweetText = level +  " " + type + " due to " + adjNouns.noun[rNoun] + "-" + weather + " at " + location + ".";
			T.post('statuses/update', { status: tweetText }, function(err, data, response) {
			  console.log("tweeted: " + data.text);
			  if (err) {
			  console.log(err);	
			  } 
			});
		}

		// ****************************************
		// **************** TRAINS ****************
		// ****************************************

		function trainDelay() {
			// chose a random number between 0 and 18 (there are 19 metro lines)
			var lineNum = r.integer(0,18);
			var line = lines.lines[lineNum];
			// find how many stations there are on the line
			var lineLength = stations[line].length;
			// we can then find a random station by using 'length' minus any number between 1 and length, inclusive
			// i.e. length will always be one more than the last index number, and zero is always the first station
			var sNum = r.integer(1, lineLength);
			var stop = lineLength - sNum;
			// now choose a random station
			var location = stations[line][stop];
			// Use a function with 'some' to find out whether the station name is on the special list
			function listedStation(stn){
				return location == stn.name
			}
			var isListed = trainSpills.station.some(listedStation);

			// if it's on the special stations list, iterate until you find it.
			if (isListed) {
				for (x in trainSpills.station) {
					var spStation = trainSpills.station[x];
					if (location == spStation.name) {
						var totalSpills = spStation.options.length;
						var spillNum = r.integer(1, totalSpills);
						var spill = totalSpills - spillNum;
						var tweetText = level + " " + type + " on " + line + " line due to " + adjNouns.adj[rAdj] + " " + spStation.options[spill] + " at " + location + ".";
						T.post('statuses/update', { status: tweetText }, function(err, data, response) {
						  console.log("tweeted: " + data.text);
						  if (err) {
						  console.log(err);	
						  } 
						});
					}	
				}	
			} else /* if it's not on the list, use the generic list */{
				tweetText = level +  " " + type + " on " + line + " line: " + adjNouns.noun[rNoun]+ " at " + location + ".";
				T.post('statuses/update', { status: tweetText }, function(err, data, response) {
						  console.log("tweeted: " + data.text);
						  if (err) {
						  console.log(err);	
						  } 
						});	
			}		
		}

		// ****************************************
		// **************** TRAMS *****************
		// ****************************************

		// pick one of the 25 tram routes
		var tramNum = r.integer(0,24);
		var tramRoute = trams.routes[tramNum].route;
		// randomly decide which direction it's heading
		var tramDirection = r.bool();
		if (tramDirection) {
			var tramDestination = trams.routes[tramNum].to	
		} else {
			var tramDestination = trams.routes[tramNum].from;
		}

		// pick a random incident
		var totalTramOptions = trams.routes[tramNum].incidents.length;
		var tramOpts = r.integer(1, totalTramOptions);
		var trInc = totalTramOptions - tramOpts;
		var tramIncident = trams.routes[tramNum].incidents[trInc];

		// send a differently worded message depending on which function is called.

		function tramDelayOne() {
			var tweetText = tramRoute + " to " + tramDestination + ": " + type + " due to " + tramIncident + ".";
			T.post('statuses/update', { status: tweetText }, function(err, data, response) {
			  console.log("tweeted: " + data.text);
			  if (err) {
			  console.log(err);	
			  } 
			});			
		};

		function tramDelayTwo() {
			// make a variable with 50% chance of being true
			var flip = r.bool();
			if (flip) {
				var tweetText = level + ' ' + type + ' on ' + tramRoute + ' due to ' + adjNouns.adj[rAdj] + ' ' + adjNouns.noun[rNoun] + '.';
				T.post('statuses/update', { status: tweetText }, function(err, data, response) {
				  console.log("tweeted: " + data.text);
				  if (err) {
				  console.log(err);	
				  } 
				});			
			} else {
				var tweetText = "dT> apologises for any inconvenience on " + tramRoute + ": " + level + " " + adjNouns.noun[rNoun] + " " + type + ".";
				T.post('statuses/update', { status: tweetText }, function(err, data, response) {
				  console.log("tweeted: " + data.text);
				  if (err) {
				  console.log(err);	
				  } 
				});
			}
		};

		// ****************************************
		// ******** CHOOSE AN ANNOUNCEMENT ********
		// ****************************************

		var tweet = r.integer(1,4);

		if (tweet == 1) {
			checkWeather()		
		}
		if (tweet == 2) {
			trainDelay();		
		}
		if (tweet == 3) {
			tramDelayOne();		
		}
		if (tweet == 4) {
			tramDelayTwo();		
		}
	}
	console.log("looped on " + timeNow.toDateString());
}

