let weights = [];


for(let i=2;i<process.argv.length;i++){
  if(i==2){
    weights = [];
    if(process.argv[i] == 'help'){
      console.log(
`Prints out standings from the meta settings defined in meta.ini

usage: node meta.js [name]=[weight] []...]

example: node meta.js titForTat=100 exampleStrats.simpleton=50
`);
      process.exit();
    }
  }
  weights.push(process.argv[i]);
}

const fs = require("fs");
let meta = fs.readFileSync('meta.ini', 'utf8');

meta = meta.split('\n').concat(weights);

meta = meta.map((a)=>{
  v = a.replace(/;.+/,'');
  if(v.indexOf('=')<0){
    return;
  }
  v = v.replace(/ /g,'').split('=');
  v[1] = parseFloat(v[1]);

  if(isNaN(v[1])){
    return;
  }

  if(v[1] < 0){
    v[1] = 0;
  }

  return v;
}).filter(a=>a!=null);

const data = require("./cache.json");

print(data, meta);

function getWeight(name, meta){
  let ans = 1;
  meta.forEach(a=>ans*=name.indexOf(a[0])>=0?a[1]:1);
  return ans;
}

function print(data, meta){
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

      let weight1 = getWeight(n1,meta);
      let weight2 = getWeight(n2,meta);

      if(n1 == n2){
        weight1-=1;
        weight2-=1;
      }

      scores[n1].games+=weight2;
      scores[n2].games+=weight1;
      scores[n1].cum+=round[0]*weight2;
      scores[n2].cum+=round[1]*weight1;
      scores[n1].stdev+=round[2]*weight2;
      scores[n2].stdev+=round[3]*weight1;
    }
  }

  let winners = [];
  for(let n in scores){
    winners.push([n,scores[n]]);
  }

  winners.sort((a,b)=>b[1].cum/b[1].games-a[1].cum/a[1].games);

  console.log(winners.map((a,b)=>`${(b+1+'').padStart(3)} | ${(a[1].cum/a[1].games+0.005+'').slice(0,4).padEnd(4,' ')} | ${a[0]}\n`).join(''));
}
