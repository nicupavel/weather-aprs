
# Weather Aprs (MeteoGlance)
Shows a world-wide view of **live, observed** Weather Data obtained from APRS and CWOP stations.

![weather-aprs](https://user-images.githubusercontent.com/1650801/229296970-5da3d78c-d549-4807-b75c-94cddd6d5a2e.gif)

## What it does
Continously gathers live weather data from APRS and CWOP stations around the world. 

## Live URLs
[meteoglance.com](https://meteoglance.com)

or

[weather.oci.linuxconsulting.ro](http://weather.oci.linuxconsulting.ro)

## UI
There is a simple UI that shows stations data: temperature, wind, precipitation for the last 24 hours, humidity and pressure over world-map overlay.
Clicking on markers shows detailed information about the station and weather data.

## Technical details

Unstructured data is saved in a Mongo DB with a default historical limit of 1 year of previous observations. 
REST API for querying all stations or station by name or nearby latitude/longitude location (see below). 

## Running
The easiest way is to run this project through provided docker-compose. This will setup the entire "stack" and required modules.

      git clone https://github.com/nicupavel/weather-aprs.git
      cd weather-aprs
      cp .env.sample .env
      cd docker
      ./run.sh --build

The default configuration from ```.env.sample``` file are setup for a docker run environment. If you wish to develop modifications to the sources
you can export or add to .env: ```DEVELOP_LOCALLY=1```. This will mount the local sources to the containers and run nodemon for reload on save.

 *Note* : `--build` argument is only needed for the first build or on container configuration change.

## REST API

- ```GET /api/v0/stations``` - returns all stations by name and location (lat/long)
- ```GET /api/v0/stations/data``` - returns all stations by name and location along with today observed data
- ```GET /api/v0/stations/data/tight/:keys``` - returns all stations by name and location and last observed weather key.
```keys``` is a comma separated list of 1 or more *weather keys*:
```temp```, ```humidity```, ```pressure```, ```rain_midnight```,```rain_1h```, ```rain_24h```, ```wind_speed```, ```wind_gust```, ```wind_direction```
Data returned is an object with the format:

      {
        "<station_name>": [<lat>, <long>, <weather_key_1>, ... ],
      }


- ```GET /api/v0/station/:name``` - return data for specified station name
- ```GET /api/v0/nearby/:lat/:lon/:dist``` - returns nearby stations by the specified longitude, latitude and distance
