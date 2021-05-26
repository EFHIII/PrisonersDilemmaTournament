const fs = require("fs");

let view = ['jed'];

const data = require("./cache.json");

print(data);

function print(data){
  let ans = "";

  for(let n1 in data){
    let newest = data[n1][Object.keys(data[n1]).reduce((a, b) => a > b ? a : b)];
    for(let n2 in newest){
      let round = newest[n2][Object.keys(newest[n2]).reduce((a, b) => a > b ? a : b)];

      if(view.indexOf(n1) >= 0 || view.indexOf(n2) >= 0){

      }
    }
  }

}

function run(txt){
  let scores = false;
  let ans = txt.split('\n');
  for(let i=0;i<ans.length;i++){
    if(ans[i].indexOf('SCORES')>0){scores=true;}
    ans[i]=ans[i].replace(/(?!VS\.|\S\.)[a-zA-Z0-9]+\./g,'');
    if(ans[i][0] === 'C' || ans[i][0] === 'D'){
      let t = ans[i].split(' ');
      let tt='';

      for(let j=0;j<t.length;j+=2){
        switch(t[j]+t[j+1]){
          case 'CC':tt+='█';break;
          case 'CD':tt+='▌';break;
          case 'DC':tt+='▐';break;
          case 'DD':tt+=' ';break;
        }
      }

      ans[i] = '\x1b[41m\x1b[92m'+tt+'\x1b[0m\n';
    }
    else if(ans[i].indexOf('VS.') > 0){
      if(view.slice().map(a=>ans[i].indexOf(a)>=0).indexOf(true)<0){
        ans.splice(i,6);
        i--;
      }
      else{
        ans[i]+='\n';
        ans[i]=ans[i].replace('P1',parseFloat(ans[i+3].split(' ')[4]));
        ans[i]=ans[i].replace('P2',parseFloat(ans[i+4].split(' ')[4]));
      }
    }
    else if(ans[i].indexOf('Final') >= 0){
      ans[i]='';
    }
    else{
      if(ans[i].length < 2){}
      else{
        ans[i]+='\n';
      }
    }

    if(scores && ans[i].indexOf(':')>0){
      q=ans[i].slice(0,4);
      ans[i]=ans[i].slice(4).replace(/ /g,'');
      ans[i]=q+ans[i].replace(':',''.padEnd(26-ans[i].indexOf(':'),' '));
      ans[i]=ans[i].replace('average',' average');
      ans[i]=ans[i].replace('(',' (');
    }
  }
  console.log(ans.join(''));
}
