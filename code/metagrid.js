let weights = [];
let STEPS = 3;
let COLOR = false;
let FOCUS = "";
let COLORTEXT = '\x1b[42m';

for(let i=2;i<process.argv.length;i++){
  if(i==2){
    weights = [];
    if(process.argv[i] == 'help'){
      console.log(
`Prints out a grid of the position of the focused strategy for the provided meta ranges

usage: node metagrid.js -focus=[name] -color -steps=[steps] [[name]=[weightStart]-[weightEnd] ...]

example: node metagrid.js -f=exampleStrats.titForTat -c random=0-10 titForTat=0-100
`);
      process.exit();
    }
  }
  if(
    process.argv[i].indexOf('-s=')==0 ||
    process.argv[i].indexOf('-steps=')==0 ||
    process.argv[i].indexOf('--steps=')==0
  ){
    STEPS = -1+parseInt(process.argv[i].replace('--steps=','').replace('-steps=','').replace('-s=',''));
    continue;
  }
  if(
    process.argv[i].indexOf('-f=')==0 ||
    process.argv[i].indexOf('-focus=')==0 ||
    process.argv[i].indexOf('--focus=')==0
  ){
    FOCUS = process.argv[i].replace('--focus=','').replace('-focus=','').replace('-f=','');
    continue;
  }
  if(
    process.argv[i].indexOf('-c')==0 ||
    process.argv[i].indexOf('-color')==0 ||
    process.argv[i].indexOf('--color')==0
  ){
    COLOR = true;
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

printRanges(data, meta, weights);

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

function simulateMeta(data, meta){
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

  return winners.sort((a,b)=>b[1].cum/b[1].games-a[1].cum/a[1].games);
}

function simulateMetas(data,meta,metaranges){
  let ans=[];
  for(let i=0;i<=STEPS;i++){
    if(metaranges.length>1){
      ans.push(simulateMetas(data,meta.slice().concat([[
        metaranges[0][0],
        metaranges[0][1]+(metaranges[0][2]-metaranges[0][1])*i/STEPS
      ]]),metaranges.slice(1)));
    }
    else{
      let winners = simulateMeta(data,meta.slice().concat([[
        metaranges[0][0],
        metaranges[0][1]+(metaranges[0][2]-metaranges[0][1])*i/STEPS
      ]]));
      ans.push(winners.map((a,b)=>a.concat(b)).filter(a=>a[0].indexOf(FOCUS)>=0?1:0)[0][2]);
    }
  }
  return ans;
}

function printNDPositions(a,min,max,depth=1){
  let ans=[];

  if(!min){
    let cp = a.flat();
    while(cp[0].length){
      cp=cp.flat();
      depth++;
    }

    min = cp.reduce((a,b)=>Math.min(a,b));
    max = cp.reduce((a,b)=>Math.max(a,b));

    console.log(`${min+1} - ${max+1}`);

    [min,max] = [min+(max-min)/5,min+(max-min)/2];
  }

  if(depth == 0){ans='';}

  for(let i=0;i<a.length;i++){
    if(typeof a[i]==="number"){

      if(COLOR && a[i]<=min){
        ans+='\x1b[42m'+(a[i]+1+'').padStart(3)+'\x1b[0m';
      }
      else if(COLOR && a[i]>=max){
        ans+='\x1b[41m'+(a[i]+1+'').padStart(3)+'\x1b[0m';
      }
      else{
        ans+=(a[i]+1+'').padStart(3);
      }
    }
    else{
      ans.push(printNDPositions(a[i],min,max,depth-1));
    }
  }
  if(depth == 2){
    let base=ans[0].split('\n');
    for(let i=1;i<ans.length;i++){
      var c = ans[i].split('\n');
      for(let j=0;j<c.length;j++){
        base[j]+='  '+c[j];
      }
    }
    return base.join('\n');
  }
  if(depth == 0){
    return ans;
  }

  return ans.join('\n')+'\n';
}

function printRanges(data,meta,metaranges){
  let positions = simulateMetas(data,meta,metaranges.reverse());
  console.log(printNDPositions(positions));
}
