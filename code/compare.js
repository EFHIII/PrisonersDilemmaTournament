let names = ['eStrats.titForTat','simpleton'];
let COLSIZE = 30;

const data = require("./cache.json");

let color = false;

let customNames = false;

for(let i=0;i<process.argv.length;i++){
  if(i==2){
    names = [];
    if(process.argv[i] == 'help'){
      console.log(
`Compares the performance of strategies who's path includes
any of the provided names against all the other strategies

usage: node compare.js -width=[width] -color [[name] ...]

example: node compare.js -w=10 -c titForTat exampleStrats.simpleton
`);
      process.exit();
    }
  }
  if(
    process.argv[i].indexOf('-w=')==0 ||
    process.argv[i].indexOf('-width=')==0 ||
    process.argv[i].indexOf('--width=')==0
  ){
    COLSIZE = parseInt(process.argv[i].replace('--width=','').replace('-width=','').replace('-w=',''));
  }
  if(
    process.argv[i].indexOf('-c')==0 ||
    process.argv[i].indexOf('-color')==0 ||
    process.argv[i].indexOf('--color')==0
  ){
    color = true;
  }
  if(i > 1 &&
    process.argv[i].indexOf('-')<0 &&
    process.argv[i].indexOf('/')<0 &&
    process.argv[i].indexOf('\\')<0
  ){
    if(!customNames){
      customNames = true;
      names = [];
    }
    names.push(process.argv[i]);
  }
}


function standardDeviation(a) {
  let mean = 0;
  a.map(a => mean += a);
  mean /= a.length;

  let sum = 0;
  for (let val of a) {
    sum += (val - mean) * (val - mean);
  }
  return Math.sqrt(1 / a.length * sum);
}

function compare(data, names){
  let participants = [];
  let participantStuff = {};

  let scores={};

  for(let n1 in data){
    if(!scores.hasOwnProperty(n1)){
      scores[n1] = {
        games:0,
        stdev:0,
        cum:0,
      };
    }
    let newest = data[n1][Object.keys(data[n1]).reduce((a, b) => a > b ? a : b)];
    for(let n2 in newest){
      if(!scores.hasOwnProperty(n2)){
        scores[n2] = {
          games:0,
          stdev:0,
          cum:0,
        };
      }
      let round = newest[n2][Object.keys(newest[n2]).reduce((a, b) => a > b ? a : b)];

      scores[n1].games++;
      scores[n2].games++;
      scores[n1].cum+=round[0];
      scores[n2].cum+=round[1];
      scores[n1].stdev+=round[2];
      scores[n2].stdev+=round[3];

      //round = round.map(a=>typeof a == 'number'?Math.round(a*100)/100:a)

      let has = -1;
      names.map(a=>{
        if(n1.indexOf(a)>=0){
          if(participants.indexOf(n2) < 0){
            participants.push(n2);
            participantStuff[n2] = {};
          }
          participantStuff[n2][n1] = round[0];
        }
        if(n2.indexOf(a)>=0){
          if(participants.indexOf(n1) < 0){
            participants.push(n1);
            participantStuff[n1] = {};
          }
          participantStuff[n1][n2] = round[1];
        }
      })
    }
  }

  if(Object.keys(participantStuff).length <= 0){
    console.log("No results");
    process.exit();
  }

  names = Object.keys(participantStuff[Object.keys(participantStuff)[0]]);

  for(let i in names){
    participants.splice(participants.indexOf(names[i]),1);
  }

  function mapParticipants(a) {
    let ar = [];
    for(let v in participantStuff[a]){
      ar.push(participantStuff[a][v]);
    }
    return [a, standardDeviation(ar)];
  }

  participants = participants.map(mapParticipants).sort((a, b) => b[1] - a[1]).map(a => a[0]);

  let t1 =  "Opponent ".padStart(COLSIZE);
  let t2 = "---------".padStart(COLSIZE,'-');

  for(let n in names){
    t1 += "|"+names[n].padEnd(COLSIZE).slice(0,COLSIZE);
    t2 += "+"+"".padEnd(COLSIZE,"-");
  }

  console.log(`${t1}\n${t2}`);
  for(let i in participants){
    let t = '';
    let best = [-Infinity,[]];
    let worst = [Infinity,[]];
    for(let n in names){
      let v = participantStuff[participants[i]][names[n]];
      if(v > best[0]){
        best = [v, [names[n]]];
      }
      else if(v == best[0]){
        best[1].push(names[n]);
      }
      if(v < worst[0]){
        worst = [v, [names[n]]];
      }
      else if(v == worst[0]){
        worst[1].push(names[n]);
      }
    }
    if(best[0] == worst[0]){continue;}
    //console.log(`\n\nbest: ${best}\nworst: ${worst}\n\n`);
    for(let n in names){
      let v = participantStuff[participants[i]][names[n]];
      if(color){
        t += `|${best[1].indexOf(names[n])>=0?(worst[1].indexOf(names[n])>=0?'\x1b[100m':'\x1b[42m'):(worst[1].indexOf(names[n])>=0?'\x1b[41m':'')} `+(''+Math.round(v*1000)/1000).padEnd(COLSIZE-1)+'\x1b[0m';
      }
      else{
        if(best[1].indexOf(names[n])>=0){
          t += ("| > "+Math.round(v*1000)/1000+" <").padEnd(COLSIZE+1);
        }
        else{
          t += ("|   "+Math.round(v*1000)/1000).padEnd(COLSIZE+1);
        }
      }
    }
    console.log(`${(''+participants[i]).padEnd(COLSIZE).slice(0,COLSIZE)}${t}`);
  }
}

compare(data, names)
