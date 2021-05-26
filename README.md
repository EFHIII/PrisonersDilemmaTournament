# PrisonersDilemmaTournamentTools
This repo contains tools and example code written by CaryKH, Edward Haas, and various contributers to https://github.com/Prisoners-Dilemma-Enjoyers/PrisonersDilemmaTournament

## Usage
You can run the tournament using

> run.py

This will create a cache file `cache.json` which can be used with the other tools for analysis. The cache file also makes subsequent runs of `run.py` significantly faster. You can have `run.py` ignore the cache file using the flag `--delete-cache`.

## print.js
Prints out matches that involve any files who's path includes any of the provided names

usage:
> node print.js [[name] []...]

example:
> node print.js titForTat exampleStrats.simpleton

## compare.js
Compares the performance of strategies who's path includes any of the provided names against all the other strategies

usage:
> node compare.js -width=[width] -color [[name] []...]

example:
> node compare.js -w=10 -c titForTat exampleStrats.simpleton

## meta.js
Prints out matches that involve any files who's path includes any of the provided names

usage:
> node meta.js [[name] []...]

example:
> node meta.js titForTat exampleStrats.simpleton
