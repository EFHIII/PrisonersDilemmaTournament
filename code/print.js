let METAFILE = 'meta.ini';

let names = [];

if(process.argv.length < 3){
  process.argv.push('help')
}

for(let i=2;i<process.argv.length;i++){
  if(i==2){
    names = [];
    if(process.argv[i] == 'help'){
      console.log(
`Prints out matches that involve any files
who's path includes any of the provided names

usage: node print.js -meta=[metafile.ini] [[name] ...]

example: node print.js titForTat exampleStrats.simpleton
`);
      process.exit();
    }
  }
  if(
    process.argv[i].indexOf('-m=')==0 ||
    process.argv[i].indexOf('-meta=')==0 ||
    process.argv[i].indexOf('--meta=')==0
  ){
    METAFILE = process.argv[i].replace('--meta=','').replace('-meta=','').replace('-m=','');
    if(METAFILE.indexOf('.ini') < 0){
      METAFILE += '.ini';
    }
    continue;
  }
  names.push(process.argv[i]);
}

const fs = require("fs");
let meta = fs.readFileSync(METAFILE, 'utf8');

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

  return v;
}).filter(a=>a!=null);

const data = require("./cache.json");

print(data);

function getWeight(name, meta){
  let ans = 1;
  meta.forEach(a=>ans*=name.indexOf(a[0])>=0?a[1]:1);
  return ans;
}

function print(data){
  let ans = [];

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

      scores[n1].games++;
      scores[n2].games++;
      scores[n1].cum+=round[0];
      scores[n2].cum+=round[1];
      scores[n1].stdev+=round[2];
      scores[n2].stdev+=round[3];

      round = round.map(a=>typeof a == 'number'?Math.round(a*100)/100:a)

      let has = -1;
      names.map(a=>{
        if(n1.indexOf(a)>=0){has=1}
        if(n2.indexOf(a)>=0){has=0}
      })

      if(has >= 0 && (has == 1 ? weight2 != 0 : weight1 != 0)){
        let txt=[has ?
          `${n1} (${round[0]} +/- ${round[2]}) VS ${n2} (${round[1]} +/- ${round[3]})\n` :
          `${n2} (${round[1]} +/- ${round[3]}) VS ${n1} (${round[0]} +/- ${round[2]})\n`
        ];
        let t = round[4];
        for(let k=0;k<2;k++){
          let tt='';
          for(let j=0;j<t[k].length;j+=2){
            switch(''+t[k][j]+t[k][j+1]){
              case '11':tt+='█';break;
              case '10':tt+='▌';break;
              case '01':tt+='▐';break;
              case '00':tt+=' ';break;
            }
          }
          txt.push('\x1b[41m\x1b[32m'+tt+'\x1b[0m\n');
        }
        ans.push([
          round[has ? 0 : 1],
          txt[0] + (has ? txt[1]+txt[2]:txt[2]+txt[1])
        ]);
      }
    }
  }

  console.log(ans.sort((a,b)=>b[0]-a[0]).map(a=>a[1]).join(''));

  let winners = [];
  for(let n in scores){
    winners.push([n,scores[n]]);
  }

  winners.sort((a,b)=>b[1].cum/b[1].games-a[1].cum/a[1].games);

  //console.log(winners.map((a,b)=>`${(b+1+'').padStart(3)} | ${(a[1].cum/a[1].games+0.005+'').slice(0,4).padEnd(4,' ')} | ${a[0]}\n`).join(''));
}
