let weights = [];
let TOP = Infinity;


for(let i=2;i<process.argv.length;i++){
  if(i==2){
    weights = [];
    if(process.argv[i] == 'help'){
      console.log(
`Prints out standings from the meta settings defined in meta.ini

usage: node meta.js -top=[top] [[name]=[weight] ...]

example: node meta.js titForTat=100 exampleStrats.simpleton=50
`);
      process.exit();
    }
  }
  if(
    process.argv[i].indexOf('-t=')==0 ||
    process.argv[i].indexOf('-top=')==0 ||
    process.argv[i].indexOf('--top=')==0
  ){
    TOP = parseInt(process.argv[i].replace('--top=','').replace('-top=','').replace('-t=',''));
    continue;
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

      if(weight1<0){weight1=0;}
      if(weight2<0){weight2=0;}

      if(n1 == n2){
        if(weight1 != 0){
          weight1-=1;
        }
        if(weight2 != 0){
          weight2-=1;
        }
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

  console.log("  # |  avg  | stdev | weight | name\n"+
  "----+-------+-------+--------+------\n"+
  winners.filter(a=>getWeight(a[0], meta)>=0).slice(0,TOP).map((a,b)=>`${(b+1+'').padStart(3)} | `+
  `${(a[1].cum/a[1].games+0.0005+'').slice(0,5).padEnd(5,' ')} | `+
  `${(a[1].stdev/a[1].games+0.0005+'').slice(0,5).padEnd(5,' ')} | `+
  `${getWeight(a[0], meta)>=1000?(''+Math.round(getWeight(a[0], meta))).padStart(6):getWeight(a[0], meta)%1==0?(''+getWeight(a[0], meta)).padStart(6):(''+getWeight(a[0], meta)).slice(0,6).padEnd(6,0)} | `+
  `${a[0]}\n`).join(''));
}

function oldprint(data, meta){
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

  console.log("  # |  avg  | stdev | weight | name");
  console.log("----+-------+-------+--------+------");
  console.log(winners.map((a,b)=>`${(b+1+'').padStart(3)} | ${(a[1].cum/a[1].games+0.0005+'').slice(0,5).padEnd(5,' ')} | ${(a[1].stdev/a[1].games+0.0005+'').slice(0,5).padEnd(5,' ')} | ${(getWeight(a[0], meta)+'').padStart(6)} | ${a[0]}\n`).join(''));
}
