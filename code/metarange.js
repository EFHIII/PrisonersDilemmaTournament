let weights = [];
let STEPS = 200;
let TOP = 10;
let COLOR = [];
let COLORTEXT = '\x1b[42m';

for(let i=2;i<process.argv.length;i++){
  if(i==2){
    weights = [];
    if(process.argv[i] == 'help'){
      console.log(
`Prints out an animated standings interpolating between the provided meta range

usage: node metarange.js -top=[top] -steps=[steps] [-color=[name] ...] [[name]=[weightStart]-[weightEnd] ...]

example: node metarange.js titForTat=0-100
`);
      process.exit();
    }
  }
  if(
    process.argv[i].indexOf('-s=')==0 ||
    process.argv[i].indexOf('-steps=')==0 ||
    process.argv[i].indexOf('--steps=')==0
  ){
    STEPS = parseInt(process.argv[i].replace('--steps=','').replace('-steps=','').replace('-s=',''));
    continue;
  }
  if(
    process.argv[i].indexOf('-t=')==0 ||
    process.argv[i].indexOf('-top=')==0 ||
    process.argv[i].indexOf('--top=')==0
  ){
    TOP = parseInt(process.argv[i].replace('--top=','').replace('-top=','').replace('-t=',''));
    continue;
  }
  if(
    process.argv[i].indexOf('-c=')==0 ||
    process.argv[i].indexOf('-color=')==0 ||
    process.argv[i].indexOf('--color=')==0
  ){
    COLOR.push(process.argv[i].replace('--color=','').replace('-color=','').replace('-c=',''));
    continue;
  }
  weights.push(process.argv[i]);
}

const fs = require("fs");
let meta = fs.readFileSync('meta.ini', 'utf8');

meta = meta.split('\n');

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

  //if(v[1] < 0){
  //  v[1] = -0;
  //}

  return v;
}).filter(a=>a!=null);

weights = weights.map((a)=>{
  v = a.replace(/;.+/,'');
  if(v.indexOf('=')<0){
    return;
  }
  v = v.replace(/ /g,'').split('=');
  v[1] = v[1].split('-');

  if(v[1].length == 1){
    v[1].push(v[1][0]);
  }

  if(v[1].length != 2){
    return;
  }

  start = parseFloat(v[1][0]);
  end = parseFloat(v[1][1]);

  if(isNaN(start) || isNaN(end)){
    return;
  }

  if(start < 0){
    start = 0;
  }

  if(end < 0){
    end = 0;
  }

  return [v[0],start,end];
}).filter(a=>a!=null);

const data = require("./cache.json");

printRange(data, meta, weights);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

  console.clear();
  console.log("  # |  avg  | stdev | weight | name\n"+
  "----+-------+-------+--------+------\n"+
  winners.filter(a=>getWeight(a[0], meta)>=0).slice(0,TOP).map((a,b)=>{
    let weight = getWeight(a[0], meta);
    let ctext = COLOR.filter(c=>a[0].indexOf(c)>=0?1:0).length > 0;
    return `${ctext?COLORTEXT:''}`+
    `${(b+1+'').padStart(3)} | `+
    `${(a[1].cum/a[1].games+0.0005+'').slice(0,5).padEnd(5,' ')} | `+
    `${(a[1].stdev/a[1].games+0.0005+'').slice(0,5).padEnd(5,' ')} | `+
    `${weight>=1000?(''+Math.round(weight)).padStart(6):getWeight(a[0], meta)%1==0?(''+weight).padStart(6):(''+weight).slice(0,6).padEnd(6,0)} | `+
    `${a[0]}`+
    `${ctext?'\x1b[0m':''}\n`;
  }).join(''));
}

async function printRange(data,meta,metaranges){
  for(let i=0;i<=STEPS;i++){
    let tempMeta = meta.slice().concat(metaranges.map(a=>[a[0],a[1]+(a[2]-a[1])*i/STEPS]));
    print(data,tempMeta);
    console.log('\n'+metaranges.map(a=>`${a[0]} = ${a[1]+(a[2]-a[1])*i/STEPS}`).join('\n'));
    await sleep(1000/30);
  }
}
