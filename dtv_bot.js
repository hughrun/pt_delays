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

	// ****************************************
	// ************** UTILITIES ***************
	// ****************************************

// title case - capitalise the initial letter of the word when called
function titleCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

function sendTweet(tweetText) {
	T.post('statuses/update', { status: tweetText }, function(err, data, response) {
	  console.log("tweeted: " + data.text);
	  if (err) {
	  console.log(err);	
	  } 
	});
};

	// ***************************************
	// **************** SETUP ****************
	// ***************************************

// run every ten minutes
var timer = setInterval (function () {checkTimetable()}, 600000);

function checkTimetable() {
	// access JSON files
	var trams = JSON.parse(fs.readFileSync('tram_routes.json'));
	var adjNouns = JSON.parse(fs.readFileSync('adj_nouns.json'));
	var qAndA = JSON.parse(fs.readFileSync('q_and_a.json'));
	var stations = fs.readFileSync('train_stations.txt').toString().split(",");
	
	// ****************************************
	// *************** TIMERS *****************
	// ****************************************

	// work out what day it is
	// trickier than you think, because our server is in Toronto...
	var toronto = new Date();
	var torontoTime = toronto.getTime()
	var Melbourne = new Date(torontoTime + 5.04e+7);
	var today = Melbourne.getDay();
	var week = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

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
	};

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

		// coin toss
		var flip = r.bool();
		// pick a random adjective
		var rAdj = r.pick(adjNouns.adj);
		//pick a random noun
		var rNoun = r.pick(adjNouns.noun);
		//pick a random bad thing
		var rBad = r.pick(adjNouns.bad_things);
		//pick a random good thing
		var rGood = r.pick(adjNouns.good_things);
		// pick a random follow up comment
		var followUp = r.pick(adjNouns.follow_up)
		// pick a random level of incident
		var levelArray = ["Severe","Minor","Serious","Mild","Temporary","Major","Unfortunate","Regretable","Embarrassing","So-So","Usual","Typical","Unforseen","Average","Annual","Weird	"]
		var level = r.pick(levelArray);
		// select type of incident
		var typeArray = ["delays","incident","disruption","collision","short-shunting","cancellation","stoppage","re-routing","cock-up","bus replacement","runaround","incompetence","slowness","early-running","confusion"]
		var type = r.pick(typeArray);
		// pick a random signoff
		var signOffArray = ["dT\> apologises for any inconvenience.","Have a nice day.","Expect delays.","Sucks to be you.","¯\\_(ツ)_/¯","Short-shunting likely.","All change.","Enjoy " + week[today] + "!","Hope you brought a packed lunch.","Everyone out!", "Please don't block the doors."];
		var signOff = r.pick(signOffArray);
		// pick a random station
		var station = r.pick(stations);
		// pick a random tram route
		var route = r.pick(trams.routes);
		// coin toss direction of tram
		var tramRoute = route.route;
		if (flip) {
			var tramDestination = route.to;	
		} else {
			var tramDestination = route.from;
		}

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
			if (r.bool()){
				var tweetText = level +  " " + type + " due to " + rNoun + "-" + weather + " at " + station + " station" + ".";	
			} else {
				var tweetText = titleCase(rNoun) + "-" + weather + " caused " + type + " at " + station + ". " + signOff;
			}

			sendTweet(tweetText);
		};

		// ****************************************
		// **************** TRAINS ****************
		// ****************************************

		function trainDelay() {

			question = r.pick(qAndA.questions);
			answer = r.pick(question.a);
			
			if (flip) {
				var tweetText = question.q + " " + answer;		
			} else {
				var tweetText = level + " " + rBad + " at " + station + ". " + signOff;
			}	
			sendTweet(tweetText);
		};

		// ****************************************
		// ************ CRUSHED DREAMS ************
		// ****************************************

		function crushedDreams() {
			if (flip) {
				sendTweet(rGood + " delayed. " + followUp);
			} else {
				sendTweet(rGood + " delayed. Happy " + week[today] + "!");
			}
		};

		// ****************************************
		// ***************** TRAMS ****************
		// ****************************************

		function tramDelayTwo() {
			// make a variable with 50% chance of being true
			if (flip) {
				var tweetText = level + ' ' + type + ' on ' + tramRoute + ' due to ' + rAdj + ' ' + rNoun + '.';
				sendTweet(tweetText);		
			} else {
				var tweetText = tramRoute + ": " + level + " " + rBad + " " + tramDestination + "-bound. " + signOff;
				sendTweet(tweetText);
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
			crushedDreams();		
		}
		if (tweet == 4) {
			tramDelayTwo();		
		}
	}
}

