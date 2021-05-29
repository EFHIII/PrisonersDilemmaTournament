import os

STRATEGY_FOLDERS = [p for p in os.listdir() if os.path.isdir(p)]
CACHE_FILE = "cache.json"

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

parser.add_argument(
    "-d",
    "--det-turns",
    dest="deterministic_turns",
    type=int,
    default=500,
    help="Number of turns in a deterministic run",
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


DETERMINISTIC_TURNS = args.deterministic_turns

if DETERMINISTIC_TURNS < 200:
    raise Exception("--det-turns must be at least 200")

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

turnChances = []

def turnChance(x,summing=False):
    if x == 0:
        return 1/40
    if summing:
        S = turnChance(x-1,True)
        return (1-S)/40+S
    return (1-turnChance(x-1,True))/40

for i in range(DETERMINISTIC_TURNS-199):
    turnChances.append(turnChance(i))

# this is so that deterministic algorithms still get 3 points for always Coop,
# instead of 2.999
chancesSum = sum(turnChances)
turnChances = [i/chancesSum for i in turnChances]

def runDeterministic(moduleA, moduleB):
    memoryA = None
    memoryB = None
    memoryA2 = None
    memoryB2 = None

    history = np.zeros((2,DETERMINISTIC_TURNS),dtype=int)
    historyFlipped = np.zeros((2,DETERMINISTIC_TURNS),dtype=int)

    for turn in range(DETERMINISTIC_TURNS):
        playerAmove, memoryA = moduleA.strategy(history[:,:turn].copy(),memoryA)
        playerBmove, memoryB = moduleB.strategy(historyFlipped[:,:turn].copy(),memoryB)
        history[0, turn] = strategyMove(playerAmove)
        history[1, turn] = strategyMove(playerBmove)

        playerAmove2, memoryA2 = moduleA.strategy(history[:,:turn].copy(),memoryA2)
        playerBmove2, memoryB2 = moduleB.strategy(historyFlipped[:,:turn].copy(),memoryB2)

        if strategyMove(playerAmove2) != strategyMove(playerAmove):
            return False
        if strategyMove(playerBmove2) != strategyMove(playerBmove):
            return False

        historyFlipped[0,turn] = history[1,turn]
        historyFlipped[1,turn] = history[0,turn]

    totals = [0,0]
    scores = [0,0]

    for turn in range(199):
        scores[0] += pointsArray[history[0,turn]][history[1,turn]]
        scores[1] += pointsArray[history[1,turn]][history[0,turn]]

    for turn in range(199,DETERMINISTIC_TURNS):
        scores[0] += pointsArray[history[0,turn]][history[1,turn]]
        scores[1] += pointsArray[history[1,turn]][history[0,turn]]

        totals[0] += scores[0]/(turn+1)*turnChances[turn-199]
        totals[1] += scores[1]/(turn+1)*turnChances[turn-199]

    return totals, history

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

    deterministic = runDeterministic(moduleA, moduleB)

    allScoresA = []
    allScoresB = []
    firstRoundHistory = None
    if deterministic:
        allScoresA = [deterministic[0][0]]
        allScoresB = [deterministic[0][1]]
        firstRoundHistory = deterministic[1].tolist()
    else:
        for i in range(NUM_RUNS):
            roundHistory = runRound(moduleA, moduleB)
            scoresA, scoresB = tallyRoundScores(roundHistory)
            if i == 0:
                # log the first round's history
                firstRoundHistory = roundHistory.tolist()

            allScoresA.append(scoresA)
            allScoresB.append(scoresB)

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
