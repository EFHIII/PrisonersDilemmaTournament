import os

STRATEGY_FOLDERS = [p for p in os.listdir() if os.path.isdir(p)]
CACHE_FILE = "cache.json"

# Minimum rounds to run before an early escape
MIN_ROUNDS = 11

# Minimum Standard Deviation to keep calculating after MIN_ROUNDS
MIN_SD = 0.02

import multiprocessing
import itertools
import importlib
import pathlib

import numpy as np
import random
from multiprocessing import Pool, cpu_count
import statistics
import argparse
import sys
import json

parser = argparse.ArgumentParser(description="Run the Prisoner's Dilemma simulation.")
parser.add_argument(
    "-n",
    "--num-runs",
    dest="num_runs",
    type=int,
    default=100,
    help="Number of runs to average out",
)

cacheparser = parser.add_argument_group("Cache")

cacheparser.add_argument(
    "--delete-cache",
    "--remove-cache",
    dest="delete_cache",
    action="store_true",
    default=False,
    help="Deletes the cache."
)

cacheparser.add_argument(
    "--cache-file",
    dest="cache_file",
    type=str,
    default="",
    help="Specifies the cache file to use."
)

parser.add_argument(
    "-j",
    "--num-processes",
    dest="processes",
    type=int,
    default=cpu_count(),
    help="Number of processes to run the simulation with. By default, this is the same as your CPU core count.",
)


args = parser.parse_args()


NUM_RUNS = args.num_runs

# The i-j-th element of this array is how many points you
# receive if you do play i, and your opponent does play j.
pointsArray = [
    [1,5],
    [0,3]
]

moveLabels = ["D", "C"]

def getVisibleHistory(history, player, turn):
    historySoFar = history[:,:turn].copy()
    if player == 1:
        historySoFar = np.flip(historySoFar,0)
    return historySoFar

def strategyMove(move):
    if type(move) is str:
        defects = ["defect","tell truth"]
        return 0 if (move in defects) else 1
    else:
        # Coerce all moves to be 0 or 1 so strategies can safely assume 0/1's only
        return int(bool(move))

def runRound(moduleA, moduleB):
    memoryA = None
    memoryB = None

    LENGTH_OF_GAME = int(200-40*np.log(1-random.random())) # The games are a minimum of 200 turns long. The np.log here guarantees that every turn after the 200th has an equal (low) chance of being the final turn.
    history = np.zeros((2,LENGTH_OF_GAME),dtype=int)
    historyFlipped = np.zeros((2,LENGTH_OF_GAME),dtype=int)

    for turn in range(LENGTH_OF_GAME):
        playerAmove, memoryA = moduleA.strategy(history[:,:turn].copy(),memoryA)
        playerBmove, memoryB = moduleB.strategy(historyFlipped[:,:turn].copy(),memoryB)
        history[0, turn] = strategyMove(playerAmove)
        history[1, turn] = strategyMove(playerBmove)
        historyFlipped[0,turn] = history[1,turn]
        historyFlipped[1,turn] = history[0,turn]

    return history

def tallyRoundScores(history):
    scoreA = 0
    scoreB = 0
    ROUND_LENGTH = history.shape[1]
    for turn in range(ROUND_LENGTH):
        playerAmove = history[0,turn]
        playerBmove = history[1,turn]
        scoreA += pointsArray[playerAmove][playerBmove]
        scoreB += pointsArray[playerBmove][playerAmove]
    return scoreA/ROUND_LENGTH, scoreB/ROUND_LENGTH

def pad(stri, leng):
    result = stri
    for i in range(len(stri),leng):
        result = result+" "
    return result

def progressBar(width, completion):
    numCompleted = round(width * completion)
    return f"[{'=' * numCompleted}{' ' * (width - numCompleted)}]"

def runRounds(pair):
    moduleA = importlib.import_module(pair[0][0])
    moduleB = importlib.import_module(pair[1][0])

    allScoresA = []
    allScoresB = []
    firstRoundHistory = None
    for i in range(NUM_RUNS):
        roundHistory = runRound(moduleA, moduleB)
        scoresA, scoresB = tallyRoundScores(roundHistory)
        if i == 0:
            # log the first round's history
            firstRoundHistory = roundHistory.tolist()
            # check if the game was one of a few basic cases for early escape
            if scoresA == 3 and scoresB == 3:
                return [
                    [pair[0][0],pair[1][0],pair[0][1],pair[1][1]],
                    [3, 3, 0, 0, firstRoundHistory],
                    [3, 3, 0, 0, firstRoundHistory],
                ]
            if scoresA == 0:
                return [
                    [pair[0][0],pair[1][0],pair[0][1],pair[1][1]],
                    [0, 5, 0, 0, firstRoundHistory],
                    [5, 0, 0, 0, firstRoundHistory],
                ]
            if scoresB == 0:
                return [
                    [pair[0][0],pair[1][0],pair[0][1],pair[1][1]],
                    [5, 0, 0, 0, firstRoundHistory],
                    [0, 5, 0, 0, firstRoundHistory],
                ]

        allScoresA.append(scoresA)
        allScoresB.append(scoresB)

        if i == MIN_ROUNDS and MIN_ROUNDS > 0:
            # check if the scores are statistically reliable
            if statistics.stdev(allScoresA) < MIN_SD or statistics.stdev(allScoresB) < MIN_SD:
                avgScoreA = statistics.mean(allScoresA)
                avgScoreB = statistics.mean(allScoresB)
                stdevA = statistics.stdev(allScoresA) if len(allScoresA) > 1 else 0
                stdevB = statistics.stdev(allScoresB) if len(allScoresB) > 1 else 0

                return [
                    [pair[0][0],pair[1][0],pair[0][1],pair[1][1]],
                    [avgScoreA, avgScoreB, stdevA, stdevB, firstRoundHistory],
                    [avgScoreB, avgScoreA, stdevB, stdevA, firstRoundHistory],
                ]

    avgScoreA = statistics.mean(allScoresA)
    avgScoreB = statistics.mean(allScoresB)
    stdevA = statistics.stdev(allScoresA) if len(allScoresA) > 1 else 0
    stdevB = statistics.stdev(allScoresB) if len(allScoresB) > 1 else 0

    return [
        [pair[0][0],pair[1][0],pair[0][1],pair[1][1]],
        [avgScoreA, avgScoreB, stdevA, stdevB, firstRoundHistory],
        [avgScoreB, avgScoreA, stdevB, stdevA, firstRoundHistory],
    ]

def loadCache():
    if args.delete_cache:
        return {}
    try:
        with open(CACHE_FILE, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}


def progressBar(completion):
    numCompleted = round(50 * completion)
    return f"[{'=' * numCompleted}{' ' * (50 - numCompleted)}]"


def runFullPairingTournament(inFolders, outFile):
    print("Starting tournament, reading files from " + ", ".join(inFolders))

    # load the cache file if it exists
    cache = loadCache()

    # create a list of the files from all the folders w/ time last modified
    STRATEGY_LIST = []
    for inFolder in inFolders:
        for file in os.listdir(inFolder):
            if file.endswith(".py"):
                STRATEGY_LIST.append([
                    f"{inFolder}.{file[:-3]}",
                    f"{pathlib.Path(f'{inFolder}/{file[:-3]}.py').stat().st_mtime_ns}"
                ])

    if len(STRATEGY_LIST) < 2:
        raise ValueError('Not enough strategies!')

    combinations = list(itertools.combinations(STRATEGY_LIST, r=2))

    for s in STRATEGY_LIST:
        combinations.append([s,s])

    numCombinations = len(combinations)

    sys.stdout.write(f"\r{0}/{numCombinations} pairings ({NUM_RUNS} runs per pairing, 0 hits, 0 misses) {progressBar(0)}")
    sys.stdout.flush()

    i = len(combinations)

    # remove already cached pairings where both files haven't changed
    while i > 0:
        i -= 1
        if combinations[i][0][0] in cache:
            if combinations[i][0][1] in cache[combinations[i][0][0]]:
                if combinations[i][1][0] in cache[combinations[i][0][0]][combinations[i][0][1]]:
                    if combinations[i][1][1] in cache[combinations[i][0][0]][combinations[i][0][1]][combinations[i][1][0]]:
                        combinations.pop(i)
                    continue

        if combinations[i][1][0] in cache:
            if combinations[i][1][1] in cache[combinations[i][1][0]]:
                if combinations[i][0][0] in cache[combinations[i][1][0]][combinations[i][1][1]]:
                    if combinations[i][0][1] in cache[combinations[i][1][0]][combinations[i][1][1]][combinations[i][0][0]]:
                        combinations.pop(i)

    skippedCombinations = numCombinations-len(combinations)

    sys.stdout.write(f"\r{skippedCombinations}/{numCombinations} pairings ({NUM_RUNS} runs per pairing, {skippedCombinations} hits, {numCombinations-skippedCombinations} misses) {progressBar(0)}")
    sys.stdout.flush()

    progressCounter = 0

    with Pool(args.processes) as p:
        # play out each combination multi-threaded with 10-size chunks
        for v in p.imap_unordered(runRounds, combinations, 10):
            # log to console
            progressCounter += 1
            if progressCounter % 10 == 0:
                sys.stdout.write(f"\r{skippedCombinations+progressCounter}/{numCombinations} pairings ({NUM_RUNS} runs per pairing, {skippedCombinations} hits, {numCombinations-skippedCombinations} misses) {progressBar(progressCounter/(numCombinations-skippedCombinations))}")
                sys.stdout.flush()

            # normalize alphabetically
            if v[0][0] > v[0][1]:
                v[0]=[v[0][1],v[0][0],v[0][3],v[0][2]]
                v[1]=v[2]
                v[1][4].reverse()

            # add to cache
            if v[0][0] not in cache:
                cache[v[0][0]] = {}
            if v[0][2] not in cache[v[0][0]]:
                cache[v[0][0]][v[0][2]] = {}
            if v[0][1] not in cache[v[0][0]][v[0][2]]:
                cache[v[0][0]][v[0][2]][v[0][1]] = {}
            cache[v[0][0]][v[0][2]][v[0][1]][v[0][3]] = v[1]

    # write cache file
    with open(outFile, 'w') as of:
        json.dump(cache, of)

    print("\nDone with everything! Results file written to "+outFile)

if __name__ == "__main__":
    runFullPairingTournament(STRATEGY_FOLDERS, CACHE_FILE)
